
-- Remover políticas restritivas existentes
DROP POLICY IF EXISTS "RH pode gerenciar roles" ON public.user_roles;
DROP POLICY IF EXISTS "RH pode ver todas roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias roles" ON public.user_roles;

-- Recriar como políticas PERMISSIVE (padrão)
CREATE POLICY "RH pode gerenciar roles" 
ON public.user_roles 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'RH'::app_role))
WITH CHECK (has_role(auth.uid(), 'RH'::app_role));

CREATE POLICY "Usuários podem ver suas próprias roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
