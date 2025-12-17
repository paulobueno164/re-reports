-- Update RLS policy to allow FINANCEIRO to process fechamentos
DROP POLICY IF EXISTS "RH pode processar fechamentos" ON public.fechamentos;

CREATE POLICY "RH e Financeiro podem processar fechamentos" 
ON public.fechamentos 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

-- Also allow FINANCEIRO to insert eventos_pida (created during fechamento)
DROP POLICY IF EXISTS "RH pode inserir eventos_pida" ON public.eventos_pida;

CREATE POLICY "RH e Financeiro podem inserir eventos_pida" 
ON public.eventos_pida 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));