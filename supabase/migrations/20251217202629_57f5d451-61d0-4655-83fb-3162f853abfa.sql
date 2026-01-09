-- Adicionar coluna cesta_beneficios_teto na tabela colaboradores_elegiveis
ALTER TABLE public.colaboradores_elegiveis 
ADD COLUMN cesta_beneficios_teto numeric NOT NULL DEFAULT 0;