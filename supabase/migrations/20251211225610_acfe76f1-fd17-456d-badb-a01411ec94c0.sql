-- ============================================
-- PROMPT 2: Tabela eventos_pida para persistir PI/DA no fechamento
-- ============================================

CREATE TABLE public.eventos_pida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id UUID NOT NULL REFERENCES public.fechamentos(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE,
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id) ON DELETE CASCADE,
  valor_base_pida DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_diferenca_cesta DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_total_pida DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para eventos_pida
ALTER TABLE public.eventos_pida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RH e Financeiro podem ver todos eventos_pida"
ON public.eventos_pida
FOR SELECT
USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "RH pode inserir eventos_pida"
ON public.eventos_pida
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'RH'::app_role));

CREATE POLICY "Colaborador pode ver seus próprios eventos_pida"
ON public.eventos_pida
FOR SELECT
USING (colaborador_id = get_colaborador_id(auth.uid()));

-- Índices para eventos_pida
CREATE INDEX idx_eventos_pida_fechamento ON public.eventos_pida(fechamento_id);
CREATE INDEX idx_eventos_pida_colaborador ON public.eventos_pida(colaborador_id);
CREATE INDEX idx_eventos_pida_periodo ON public.eventos_pida(periodo_id);

-- ============================================
-- PROMPT 3: Trigger para validação de período de lançamento
-- ============================================

CREATE OR REPLACE FUNCTION public.validar_periodo_lancamento()
RETURNS TRIGGER AS $$
DECLARE
  periodo_record RECORD;
  proximo_periodo RECORD;
  data_atual DATE := CURRENT_DATE;
BEGIN
  -- Buscar período informado
  SELECT * INTO periodo_record FROM public.calendario_periodos WHERE id = NEW.periodo_id;
  
  -- Verificar se período existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Período não encontrado';
  END IF;
  
  -- Verificar se período está aberto
  IF periodo_record.status != 'aberto' THEN
    RAISE EXCEPTION 'Este período está fechado para lançamentos';
  END IF;
  
  -- Verificar data de lançamento (apenas para INSERT)
  IF TG_OP = 'INSERT' THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
DROP TRIGGER IF EXISTS tr_validar_periodo_lancamento ON public.lancamentos;
CREATE TRIGGER tr_validar_periodo_lancamento
BEFORE INSERT OR UPDATE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.validar_periodo_lancamento();

-- ============================================
-- PROMPT 4: Unicidade de comprovantes via hash
-- ============================================

-- Adicionar coluna hash na tabela anexos
ALTER TABLE public.anexos ADD COLUMN IF NOT EXISTS hash_comprovante VARCHAR(64);

-- Criar índice único para hash (permitindo nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_anexos_hash_unique 
ON public.anexos(hash_comprovante) 
WHERE hash_comprovante IS NOT NULL;

-- Função para validar comprovante duplicado
CREATE OR REPLACE FUNCTION public.validar_comprovante_duplicado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hash_comprovante IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.anexos 
      WHERE hash_comprovante = NEW.hash_comprovante 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Este comprovante já foi utilizado em outro lançamento. Cada nota fiscal/recibo só pode ser lançado uma única vez.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para validação de duplicidade
DROP TRIGGER IF EXISTS tr_validar_comprovante_duplicado ON public.anexos;
CREATE TRIGGER tr_validar_comprovante_duplicado
BEFORE INSERT OR UPDATE ON public.anexos
FOR EACH ROW EXECUTE FUNCTION public.validar_comprovante_duplicado();