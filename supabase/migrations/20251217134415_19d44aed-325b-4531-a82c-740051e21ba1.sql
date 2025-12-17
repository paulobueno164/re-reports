-- Remove 'rascunho' from expense_status enum
-- First, update any existing records that might have 'rascunho' status to 'enviado'
UPDATE public.lancamentos 
SET status = 'enviado' 
WHERE status = 'rascunho';

-- Drop ALL policies that reference the status column with 'rascunho'
DROP POLICY IF EXISTS "Colaborador pode atualizar seus rascunhos" ON public.lancamentos;
DROP POLICY IF EXISTS "Colaborador pode deletar seus rascunhos" ON public.lancamentos;
DROP POLICY IF EXISTS "Usuário pode gerenciar anexos de seus lançamentos" ON public.anexos;

-- Create new enum type without 'rascunho'
CREATE TYPE expense_status_new AS ENUM ('enviado', 'em_analise', 'valido', 'invalido');

-- Update the column to use the new type
ALTER TABLE public.lancamentos 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE expense_status_new USING (status::text::expense_status_new),
  ALTER COLUMN status SET DEFAULT 'enviado'::expense_status_new;

-- Drop the old enum type
DROP TYPE expense_status;

-- Rename the new type to the original name
ALTER TYPE expense_status_new RENAME TO expense_status;

-- Recreate policies without 'rascunho' reference
-- Colaborador can update their own expenses with status 'enviado' only
CREATE POLICY "Colaborador pode atualizar seus envios" 
ON public.lancamentos 
FOR UPDATE 
USING (
  (colaborador_id = get_colaborador_id(auth.uid())) 
  AND (status = 'enviado'::expense_status)
);

-- Colaborador can delete their own expenses with status 'enviado' only
CREATE POLICY "Colaborador pode deletar seus envios" 
ON public.lancamentos 
FOR DELETE 
USING (
  (colaborador_id = get_colaborador_id(auth.uid())) 
  AND (status = 'enviado'::expense_status)
);

-- Recreate anexos policy - user can manage attachments of their expenses with 'enviado' status
CREATE POLICY "Usuário pode gerenciar anexos de seus lançamentos" 
ON public.anexos 
FOR ALL 
USING (
  lancamento_id IN (
    SELECT lancamentos.id
    FROM lancamentos
    WHERE (lancamentos.colaborador_id = get_colaborador_id(auth.uid())) 
      AND (lancamentos.status = 'enviado'::expense_status)
  )
);