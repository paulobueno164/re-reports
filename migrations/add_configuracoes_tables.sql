-- =====================================================
-- MIGRATION: Adicionar tabelas de Configurações
-- Data: 2026-01-09
-- =====================================================

-- Tabela de Departamentos
CREATE TABLE IF NOT EXISTS public.departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de Grupos de Despesa
CREATE TABLE IF NOT EXISTS public.grupos_despesa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_departamentos_ativo ON public.departamentos(ativo);
CREATE INDEX IF NOT EXISTS idx_grupos_despesa_ativo ON public.grupos_despesa(ativo);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_departamentos_updated_at ON public.departamentos;
CREATE TRIGGER update_departamentos_updated_at 
    BEFORE UPDATE ON public.departamentos 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_grupos_despesa_updated_at ON public.grupos_despesa;
CREATE TRIGGER update_grupos_despesa_updated_at 
    BEFORE UPDATE ON public.grupos_despesa 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar departamentos existentes
INSERT INTO public.departamentos (nome, ativo)
SELECT DISTINCT departamento, TRUE
FROM public.colaboradores_elegiveis
WHERE departamento IS NOT NULL AND departamento != ''
ON CONFLICT (nome) DO NOTHING;

-- Migrar grupos de despesa existentes
INSERT INTO public.grupos_despesa (nome, ativo)
SELECT DISTINCT grupo, TRUE
FROM public.tipos_despesas
WHERE grupo IS NOT NULL AND grupo != ''
ON CONFLICT (nome) DO NOTHING;

-- RLS Policies
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_despesa ENABLE ROW LEVEL SECURITY;

-- Todos podem ver
DROP POLICY IF EXISTS "Todos autenticados podem ver departamentos" ON public.departamentos;
CREATE POLICY "Todos autenticados podem ver departamentos" 
    ON public.departamentos FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Todos autenticados podem ver grupos despesa" ON public.grupos_despesa;
CREATE POLICY "Todos autenticados podem ver grupos despesa" 
    ON public.grupos_despesa FOR SELECT USING (TRUE);

-- RH pode gerenciar
DROP POLICY IF EXISTS "RH pode gerenciar departamentos" ON public.departamentos;
CREATE POLICY "RH pode gerenciar departamentos" 
    ON public.departamentos FOR ALL 
    USING (public.has_role(auth.uid(), 'RH'));

DROP POLICY IF EXISTS "RH pode gerenciar grupos despesa" ON public.grupos_despesa;
CREATE POLICY "RH pode gerenciar grupos despesa" 
    ON public.grupos_despesa FOR ALL 
    USING (public.has_role(auth.uid(), 'RH'));

-- Comentários
COMMENT ON TABLE public.departamentos IS 'Cadastro de departamentos da empresa';
COMMENT ON TABLE public.grupos_despesa IS 'Cadastro de grupos de despesas utilizados em tipos_despesas';
