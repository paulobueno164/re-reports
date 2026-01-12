-- Atualizar função de validação de período para permitir criação de parcelas automáticas
-- Parcelas automáticas (com lancamento_origem_id) não devem ser validadas pela data de abertura/fechamento

CREATE OR REPLACE FUNCTION public.validar_periodo_lancamento()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    periodo_record RECORD;
    proximo_periodo RECORD;
    data_atual DATE := CURRENT_DATE;
    is_parcela_automatica BOOLEAN := FALSE;
BEGIN
    -- Se é uma parcela automática (tem lancamento_origem_id), pular validações de data
    -- Parcelas automáticas são criadas pelo sistema e não precisam seguir as regras de data
    IF NEW.lancamento_origem_id IS NOT NULL THEN
        is_parcela_automatica := TRUE;
    END IF;

    -- Buscar período informado
    SELECT * INTO periodo_record FROM public.calendario_periodos WHERE id = NEW.periodo_id;
    
    -- Verificar se período existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Período não encontrado';
    END IF;

    -- Se não for parcela automática, validar status do período
    IF NOT is_parcela_automatica THEN
        -- Verificar se período está aberto
        IF periodo_record.status != 'aberto' THEN
            RAISE EXCEPTION 'Este período está fechado para lançamentos';
        END IF;
    END IF;

    -- Verificar data de lançamento (apenas para INSERT e apenas se não for parcela automática)
    IF TG_OP = 'INSERT' AND NOT is_parcela_automatica THEN
        -- Se antes da data de abertura
        IF data_atual < periodo_record.abre_lancamento::date THEN
            RAISE EXCEPTION 'Período de lançamento ainda não iniciou. Abertura em: %', periodo_record.abre_lancamento;
        END IF;
        
        -- Se após fechamento, redirecionar para próximo período
        IF data_atual > periodo_record.fecha_lancamento::date THEN
            -- Buscar próximo período aberto
            SELECT * INTO proximo_periodo 
            FROM public.calendario_periodos 
            WHERE abre_lancamento::date > periodo_record.fecha_lancamento::date
              AND status = 'aberto'
            ORDER BY abre_lancamento ASC
            LIMIT 1;
            
            IF FOUND THEN
                -- Redirecionar para próximo período
                NEW.periodo_id := proximo_periodo.id;
            ELSE
                RAISE EXCEPTION 'Período de lançamento encerrado e não há próximo período disponível.';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

