-- Create enum for remuneration components
CREATE TYPE public.componente_remuneracao AS ENUM (
  'vale_alimentacao',
  'vale_refeicao',
  'ajuda_custo',
  'mobilidade',
  'cesta_beneficios',
  'pida'
);

-- Recreate tipos_despesas_eventos table with new structure
DROP TABLE IF EXISTS public.tipos_despesas_eventos;

CREATE TABLE public.tipos_despesas_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  componente componente_remuneracao NOT NULL UNIQUE,
  codigo_evento TEXT NOT NULL,
  descricao_evento TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tipos_despesas_eventos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Todos autenticados podem ver eventos folha" 
ON public.tipos_despesas_eventos 
FOR SELECT 
USING (true);

CREATE POLICY "RH pode gerenciar eventos folha" 
ON public.tipos_despesas_eventos 
FOR ALL 
USING (has_role(auth.uid(), 'RH'::app_role));