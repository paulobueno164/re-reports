-- Atribuir role RH ao usuário admin
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'RH'::app_role
FROM public.profiles p
WHERE p.email = 'ams.contato@onset.com.br'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'RH'
);

-- Também atribuir FINANCEIRO para acesso completo
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'FINANCEIRO'::app_role
FROM public.profiles p
WHERE p.email = 'ams.contato@onset.com.br'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'FINANCEIRO'
);