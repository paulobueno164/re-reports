-- =====================================================
-- RE-REPORTS - SCRIPT COMPLETO DE CRIAÇÃO DO BANCO
-- =====================================================
-- Este script cria toda a estrutura necessária para o sistema RE-Reports
-- Pode ser executado em PostgreSQL local ou Supabase
-- Versão: 1.0
-- Data: 2025-01-17
-- =====================================================

-- =====================================================
-- EXTENSÕES NECESSÁRIAS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SCHEMAS (para compatibilidade com Supabase)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- =====================================================
-- TABELA DE USUÁRIOS (auth.users) - PostgreSQL local
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
        CREATE TABLE auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            encrypted_password TEXT,
            raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Função auth.uid() para compatibilidade
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;

-- =====================================================
-- STORAGE TABLES (compatibilidade com Supabase)
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        CREATE TABLE storage.buckets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            public BOOLEAN DEFAULT FALSE
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        CREATE TABLE storage.objects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bucket_id TEXT REFERENCES storage.buckets(id),
            name TEXT,
            owner UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN string_to_array(name, '/');
END
$$;

-- =====================================================
-- ENUMS
-- =====================================================

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('FINANCEIRO', 'COLABORADOR', 'RH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.expense_classification AS ENUM ('fixo', 'variavel'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.expense_origin AS ENUM ('proprio', 'conjuge', 'filhos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.expense_status AS ENUM ('enviado', 'em_analise', 'valido', 'invalido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.period_status AS ENUM ('aberto', 'fechado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.componente_remuneracao AS ENUM ('vale_alimentacao', 'vale_refeicao', 'ajuda_custo', 'mobilidade', 'cesta_beneficios', 'pida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- TABELAS PRINCIPAIS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.calendario_periodos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    data_final DATE NOT NULL,
    abre_lancamento DATE NOT NULL,
    fecha_lancamento DATE NOT NULL,
    status public.period_status NOT NULL DEFAULT 'aberto',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tipos_despesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    grupo TEXT NOT NULL,
    classificacao public.expense_classification NOT NULL DEFAULT 'variavel',
    valor_padrao_teto NUMERIC NOT NULL DEFAULT 0,
    origem_permitida public.expense_origin[] NOT NULL DEFAULT ARRAY['proprio']::public.expense_origin[],
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Eventos de Folha por componente de remuneração (não mais por tipo de despesa)
CREATE TABLE IF NOT EXISTS public.tipos_despesas_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    componente public.componente_remuneracao NOT NULL UNIQUE,
    codigo_evento TEXT NOT NULL,
    descricao_evento TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.colaboradores_elegiveis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    matricula TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    departamento TEXT NOT NULL,
    salario_base NUMERIC NOT NULL DEFAULT 0,
    vale_alimentacao NUMERIC NOT NULL DEFAULT 0,
    vale_refeicao NUMERIC NOT NULL DEFAULT 0,
    transporte NUMERIC NOT NULL DEFAULT 0,
    mobilidade NUMERIC NOT NULL DEFAULT 0,
    ajuda_custo NUMERIC NOT NULL DEFAULT 0,
    cesta_beneficios_teto NUMERIC NOT NULL DEFAULT 0,
    pida_teto NUMERIC NOT NULL DEFAULT 0,
    tem_pida BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.colaborador_tipos_despesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE,
    tipo_despesa_id UUID NOT NULL REFERENCES public.tipos_despesas(id) ON DELETE CASCADE,
    teto_individual NUMERIC,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(colaborador_id, tipo_despesa_id)
);

CREATE TABLE IF NOT EXISTS public.lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE,
    periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT,
    tipo_despesa_id UUID NOT NULL REFERENCES public.tipos_despesas(id) ON DELETE RESTRICT,
    origem public.expense_origin NOT NULL DEFAULT 'proprio',
    descricao_fato_gerador TEXT NOT NULL,
    valor_lancado NUMERIC NOT NULL,
    valor_considerado NUMERIC NOT NULL,
    valor_nao_considerado NUMERIC NOT NULL DEFAULT 0,
    status public.expense_status NOT NULL DEFAULT 'enviado',
    validado_por UUID,
    validado_em TIMESTAMP WITH TIME ZONE,
    motivo_invalidacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lancamento_id UUID NOT NULL REFERENCES public.lancamentos(id) ON DELETE CASCADE,
    nome_arquivo TEXT NOT NULL,
    tipo_arquivo TEXT NOT NULL,
    tamanho INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    hash_comprovante VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anexos_hash_unique ON public.anexos(hash_comprovante) WHERE hash_comprovante IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fechamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL,
    data_processamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'sucesso',
    total_colaboradores INTEGER NOT NULL DEFAULT 0,
    total_eventos INTEGER NOT NULL DEFAULT 0,
    valor_total NUMERIC NOT NULL DEFAULT 0,
    detalhes_erro TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.eventos_pida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE,
    periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT,
    fechamento_id UUID NOT NULL REFERENCES public.fechamentos(id) ON DELETE CASCADE,
    valor_base_pida NUMERIC NOT NULL DEFAULT 0,
    valor_diferenca_cesta NUMERIC NOT NULL DEFAULT 0,
    valor_total_pida NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exportacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT,
    fechamento_id UUID REFERENCES public.fechamentos(id) ON DELETE SET NULL,
    usuario_id UUID NOT NULL,
    nome_arquivo TEXT NOT NULL,
    qtd_registros INTEGER NOT NULL DEFAULT 0,
    data_exportacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_description TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_lancamentos_colaborador ON public.lancamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_periodo ON public.lancamentos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON public.lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_anexos_lancamento ON public.anexos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_user ON public.colaboradores_elegiveis(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- =====================================================
-- FUNÇÕES
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_colaborador_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.colaboradores_elegiveis WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, email) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email), NEW.email);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'COLABORADOR');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_periodo_lancamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    periodo_record RECORD;
    proximo_periodo RECORD;
    data_atual DATE := CURRENT_DATE;
BEGIN
    SELECT * INTO periodo_record FROM public.calendario_periodos WHERE id = NEW.periodo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Período não encontrado'; END IF;
    IF periodo_record.status != 'aberto' THEN RAISE EXCEPTION 'Este período está fechado para lançamentos'; END IF;
    IF TG_OP = 'INSERT' THEN
        IF data_atual < periodo_record.abre_lancamento::date THEN
            RAISE EXCEPTION 'Período de lançamento ainda não iniciou. Abertura em: %', periodo_record.abre_lancamento;
        END IF;
        IF data_atual > periodo_record.fecha_lancamento::date THEN
            SELECT * INTO proximo_periodo FROM public.calendario_periodos WHERE abre_lancamento::date > periodo_record.fecha_lancamento::date AND status = 'aberto' ORDER BY abre_lancamento ASC LIMIT 1;
            IF FOUND THEN NEW.periodo_id := proximo_periodo.id;
            ELSE RAISE EXCEPTION 'Período de lançamento encerrado e não há próximo período disponível.'; END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_comprovante_duplicado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.hash_comprovante IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.anexos WHERE hash_comprovante = NEW.hash_comprovante AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
            RAISE EXCEPTION 'Este comprovante já foi utilizado em outro lançamento.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_colaboradores_updated_at ON public.colaboradores_elegiveis;
CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON public.colaboradores_elegiveis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lancamentos_updated_at ON public.lancamentos;
CREATE TRIGGER update_lancamentos_updated_at BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS validar_periodo_lancamento_trigger ON public.lancamentos;
CREATE TRIGGER validar_periodo_lancamento_trigger BEFORE INSERT OR UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.validar_periodo_lancamento();

DROP TRIGGER IF EXISTS validar_comprovante_duplicado_trigger ON public.anexos;
CREATE TRIGGER validar_comprovante_duplicado_trigger BEFORE INSERT OR UPDATE ON public.anexos FOR EACH ROW EXECUTE FUNCTION public.validar_comprovante_duplicado();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_despesas_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores_elegiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaborador_tipos_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_pida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exportacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "RH e Financeiro podem ver todos perfis" ON public.profiles;
CREATE POLICY "RH e Financeiro podem ver todos perfis" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- USER_ROLES
DROP POLICY IF EXISTS "Usuários podem ver suas próprias roles" ON public.user_roles;
CREATE POLICY "Usuários podem ver suas próprias roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "RH pode gerenciar roles" ON public.user_roles;
CREATE POLICY "RH pode gerenciar roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'RH')) WITH CHECK (public.has_role(auth.uid(), 'RH'));

-- CALENDARIO_PERIODOS
DROP POLICY IF EXISTS "Todos autenticados podem ver calendário" ON public.calendario_periodos;
CREATE POLICY "Todos autenticados podem ver calendário" ON public.calendario_periodos FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "RH pode gerenciar calendário" ON public.calendario_periodos;
CREATE POLICY "RH pode gerenciar calendário" ON public.calendario_periodos FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- TIPOS_DESPESAS
DROP POLICY IF EXISTS "Todos autenticados podem ver tipos de despesas" ON public.tipos_despesas;
CREATE POLICY "Todos autenticados podem ver tipos de despesas" ON public.tipos_despesas FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "RH pode gerenciar tipos de despesas" ON public.tipos_despesas;
CREATE POLICY "RH pode gerenciar tipos de despesas" ON public.tipos_despesas FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- TIPOS_DESPESAS_EVENTOS
DROP POLICY IF EXISTS "Todos autenticados podem ver eventos folha" ON public.tipos_despesas_eventos;
CREATE POLICY "Todos autenticados podem ver eventos folha" ON public.tipos_despesas_eventos FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "RH pode gerenciar eventos folha" ON public.tipos_despesas_eventos;
CREATE POLICY "RH pode gerenciar eventos folha" ON public.tipos_despesas_eventos FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- COLABORADORES_ELEGIVEIS
DROP POLICY IF EXISTS "Colaborador pode ver seus próprios dados" ON public.colaboradores_elegiveis;
CREATE POLICY "Colaborador pode ver seus próprios dados" ON public.colaboradores_elegiveis FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "RH e Financeiro podem ver todos colaboradores" ON public.colaboradores_elegiveis;
CREATE POLICY "RH e Financeiro podem ver todos colaboradores" ON public.colaboradores_elegiveis FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "RH pode gerenciar colaboradores" ON public.colaboradores_elegiveis;
CREATE POLICY "RH pode gerenciar colaboradores" ON public.colaboradores_elegiveis FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- COLABORADOR_TIPOS_DESPESAS
DROP POLICY IF EXISTS "Colaborador pode ver seus próprios vínculos" ON public.colaborador_tipos_despesas;
CREATE POLICY "Colaborador pode ver seus próprios vínculos" ON public.colaborador_tipos_despesas FOR SELECT USING (colaborador_id = public.get_colaborador_id(auth.uid()));
DROP POLICY IF EXISTS "RH e Financeiro podem ver todos vínculos" ON public.colaborador_tipos_despesas;
CREATE POLICY "RH e Financeiro podem ver todos vínculos" ON public.colaborador_tipos_despesas FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "RH pode gerenciar vínculos tipos despesas" ON public.colaborador_tipos_despesas;
CREATE POLICY "RH pode gerenciar vínculos tipos despesas" ON public.colaborador_tipos_despesas FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- LANCAMENTOS
DROP POLICY IF EXISTS "Colaborador pode ver seus próprios lançamentos" ON public.lancamentos;
CREATE POLICY "Colaborador pode ver seus próprios lançamentos" ON public.lancamentos FOR SELECT USING (colaborador_id = public.get_colaborador_id(auth.uid()));
DROP POLICY IF EXISTS "RH e Financeiro podem ver todos lançamentos" ON public.lancamentos;
CREATE POLICY "RH e Financeiro podem ver todos lançamentos" ON public.lancamentos FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "Colaborador pode inserir lançamentos" ON public.lancamentos;
CREATE POLICY "Colaborador pode inserir lançamentos" ON public.lancamentos FOR INSERT WITH CHECK (colaborador_id = public.get_colaborador_id(auth.uid()));
DROP POLICY IF EXISTS "Colaborador pode atualizar seus envios" ON public.lancamentos;
CREATE POLICY "Colaborador pode atualizar seus envios" ON public.lancamentos FOR UPDATE USING (colaborador_id = public.get_colaborador_id(auth.uid()) AND status = 'enviado');
DROP POLICY IF EXISTS "Colaborador pode deletar seus envios" ON public.lancamentos;
CREATE POLICY "Colaborador pode deletar seus envios" ON public.lancamentos FOR DELETE USING (colaborador_id = public.get_colaborador_id(auth.uid()) AND status = 'enviado');
DROP POLICY IF EXISTS "RH pode validar lançamentos" ON public.lancamentos;
CREATE POLICY "RH pode validar lançamentos" ON public.lancamentos FOR UPDATE USING (public.has_role(auth.uid(), 'RH'));

-- ANEXOS
DROP POLICY IF EXISTS "Usuário pode ver anexos de seus lançamentos" ON public.anexos;
CREATE POLICY "Usuário pode ver anexos de seus lançamentos" ON public.anexos FOR SELECT USING (lancamento_id IN (SELECT id FROM public.lancamentos WHERE colaborador_id = public.get_colaborador_id(auth.uid())));
DROP POLICY IF EXISTS "RH e Financeiro podem ver todos anexos" ON public.anexos;
CREATE POLICY "RH e Financeiro podem ver todos anexos" ON public.anexos FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "Usuário pode gerenciar anexos de seus lançamentos" ON public.anexos;
CREATE POLICY "Usuário pode gerenciar anexos de seus lançamentos" ON public.anexos FOR ALL USING (lancamento_id IN (SELECT id FROM public.lancamentos WHERE colaborador_id = public.get_colaborador_id(auth.uid()) AND status = 'enviado'));

-- FECHAMENTOS
DROP POLICY IF EXISTS "RH e Financeiro podem ver fechamentos" ON public.fechamentos;
CREATE POLICY "RH e Financeiro podem ver fechamentos" ON public.fechamentos FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "RH pode processar fechamentos" ON public.fechamentos;
CREATE POLICY "RH pode processar fechamentos" ON public.fechamentos FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'RH'));

-- EVENTOS_PIDA
DROP POLICY IF EXISTS "Colaborador pode ver seus próprios eventos_pida" ON public.eventos_pida;
CREATE POLICY "Colaborador pode ver seus próprios eventos_pida" ON public.eventos_pida FOR SELECT USING (colaborador_id = public.get_colaborador_id(auth.uid()));
DROP POLICY IF EXISTS "RH e Financeiro podem ver todos eventos_pida" ON public.eventos_pida;
CREATE POLICY "RH e Financeiro podem ver todos eventos_pida" ON public.eventos_pida FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "RH pode inserir eventos_pida" ON public.eventos_pida;
CREATE POLICY "RH pode inserir eventos_pida" ON public.eventos_pida FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'RH'));

-- EXPORTACOES
DROP POLICY IF EXISTS "RH pode ver exportações" ON public.exportacoes;
CREATE POLICY "RH pode ver exportações" ON public.exportacoes FOR SELECT USING (public.has_role(auth.uid(), 'RH'));
DROP POLICY IF EXISTS "Financeiro pode ver e criar exportações" ON public.exportacoes;
CREATE POLICY "Financeiro pode ver e criar exportações" ON public.exportacoes FOR ALL USING (public.has_role(auth.uid(), 'FINANCEIRO'));

-- AUDIT_LOGS
DROP POLICY IF EXISTS "RH e Financeiro podem ver audit logs" ON public.audit_logs;
CREATE POLICY "RH e Financeiro podem ver audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));
DROP POLICY IF EXISTS "Sistema pode inserir audit logs" ON public.audit_logs;
CREATE POLICY "Sistema pode inserir audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes', 'comprovantes', FALSE) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
CREATE POLICY "Usuários autenticados podem fazer upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'comprovantes' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Usuários podem ver seus próprios arquivos" ON storage.objects;
CREATE POLICY "Usuários podem ver seus próprios arquivos" ON storage.objects FOR SELECT USING (bucket_id = 'comprovantes' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO')));
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios arquivos" ON storage.objects;
CREATE POLICY "Usuários podem deletar seus próprios arquivos" ON storage.objects FOR DELETE USING (bucket_id = 'comprovantes' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'RH')));

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
