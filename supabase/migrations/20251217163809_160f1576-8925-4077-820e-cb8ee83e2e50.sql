-- Remove cesta_beneficios_teto column from colaboradores_elegiveis
ALTER TABLE public.colaboradores_elegiveis DROP COLUMN IF EXISTS cesta_beneficios_teto;