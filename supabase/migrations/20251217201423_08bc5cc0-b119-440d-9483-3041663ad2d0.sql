-- Adicionar campos de férias e benefício proporcional em colaboradores
ALTER TABLE public.colaboradores_elegiveis 
ADD COLUMN ferias_inicio DATE,
ADD COLUMN ferias_fim DATE,
ADD COLUMN beneficio_proporcional BOOLEAN NOT NULL DEFAULT false;

-- Adicionar campos de parcelamento em lançamentos
ALTER TABLE public.lancamentos 
ADD COLUMN parcelamento_ativo BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN parcelamento_valor_total NUMERIC,
ADD COLUMN parcelamento_numero_parcela INTEGER,
ADD COLUMN parcelamento_total_parcelas INTEGER,
ADD COLUMN lancamento_origem_id UUID REFERENCES public.lancamentos(id);