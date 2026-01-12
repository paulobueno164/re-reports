-- Adicionar campos de parcelamento em lançamentos
-- Esta migração adiciona os campos necessários para suportar parcelamento de despesas

-- Verificar e adicionar cada coluna individualmente para evitar erros se já existir
DO $$ 
BEGIN
    -- parcelamento_ativo
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lancamentos' 
        AND column_name = 'parcelamento_ativo'
    ) THEN
        ALTER TABLE public.lancamentos 
        ADD COLUMN parcelamento_ativo BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- parcelamento_valor_total
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lancamentos' 
        AND column_name = 'parcelamento_valor_total'
    ) THEN
        ALTER TABLE public.lancamentos 
        ADD COLUMN parcelamento_valor_total NUMERIC;
    END IF;

    -- parcelamento_numero_parcela
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lancamentos' 
        AND column_name = 'parcelamento_numero_parcela'
    ) THEN
        ALTER TABLE public.lancamentos 
        ADD COLUMN parcelamento_numero_parcela INTEGER;
    END IF;

    -- parcelamento_total_parcelas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lancamentos' 
        AND column_name = 'parcelamento_total_parcelas'
    ) THEN
        ALTER TABLE public.lancamentos 
        ADD COLUMN parcelamento_total_parcelas INTEGER;
    END IF;

    -- lancamento_origem_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lancamentos' 
        AND column_name = 'lancamento_origem_id'
    ) THEN
        ALTER TABLE public.lancamentos 
        ADD COLUMN lancamento_origem_id UUID REFERENCES public.lancamentos(id);
    END IF;
END $$;

-- Comentários para documentação
COMMENT ON COLUMN public.lancamentos.parcelamento_ativo IS 'Indica se o lançamento faz parte de um parcelamento';
COMMENT ON COLUMN public.lancamentos.parcelamento_valor_total IS 'Valor total da despesa parcelada';
COMMENT ON COLUMN public.lancamentos.parcelamento_numero_parcela IS 'Número da parcela atual (1, 2, 3, etc.)';
COMMENT ON COLUMN public.lancamentos.parcelamento_total_parcelas IS 'Número total de parcelas';
COMMENT ON COLUMN public.lancamentos.lancamento_origem_id IS 'ID do lançamento original (primeira parcela) que gerou este parcelamento';

