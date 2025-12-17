-- =====================================================
-- RE-REPORTS - Database Schema
-- Generated: 2024-12-17
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

-- Status do período
CREATE TYPE public.period_status AS ENUM ('aberto', 'fechado');

-- Classificação de despesas
CREATE TYPE public.expense_classification AS ENUM ('fixo', 'variavel');

-- Origem da despesa
CREATE TYPE public.expense_origin AS ENUM ('proprio', 'conjuge', 'filhos');

-- Status da despesa
CREATE TYPE public.expense_status AS ENUM ('enviado', 'em_analise', 'valido', 'invalido');

-- Roles da aplicação
CREATE TYPE public.app_role AS ENUM ('FINANCEIRO', 'COLABORADOR', 'RH');

-- =====================================================
-- TABLES
-- =====================================================

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de roles de usuários
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de calendário de períodos
CREATE TABLE public.calendario_periodos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_final DATE NOT NULL,
  abre_lancamento DATE NOT NULL,
  fecha_lancamento DATE NOT NULL,
  status public.period_status NOT NULL DEFAULT 'aberto'::period_status,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de colaboradores elegíveis
CREATE TABLE public.colaboradores_elegiveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  matricula TEXT NOT NULL,
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
  tem_pida BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de tipos de despesas
CREATE TABLE public.tipos_despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  grupo TEXT NOT NULL,
  classificacao public.expense_classification NOT NULL DEFAULT 'variavel'::expense_classification,
  valor_padrao_teto NUMERIC NOT NULL DEFAULT 0,
  origem_permitida public.expense_origin[] NOT NULL DEFAULT ARRAY['proprio'::expense_origin],
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de eventos de folha por tipo de despesa
CREATE TABLE public.tipos_despesas_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_despesa_id UUID NOT NULL REFERENCES public.tipos_despesas(id) ON DELETE CASCADE,
  codigo_evento TEXT NOT NULL,
  descricao_evento TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT tipos_despesas_eventos_tipo_despesa_id_key UNIQUE (tipo_despesa_id)
);

-- Tabela de vínculos colaborador x tipos de despesas
CREATE TABLE public.colaborador_tipos_despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE,
  tipo_despesa_id UUID NOT NULL REFERENCES public.tipos_despesas(id) ON DELETE CASCADE,
  teto_individual NUMERIC,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de lançamentos
CREATE TABLE public.lancamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id),
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id),
  tipo_despesa_id UUID NOT NULL REFERENCES public.tipos_despesas(id),
  origem public.expense_origin NOT NULL DEFAULT 'proprio'::expense_origin,
  descricao_fato_gerador TEXT NOT NULL,
  valor_lancado NUMERIC NOT NULL,
  valor_considerado NUMERIC NOT NULL,
  valor_nao_considerado NUMERIC NOT NULL DEFAULT 0,
  status public.expense_status NOT NULL DEFAULT 'enviado'::expense_status,
  validado_por UUID,
  validado_em TIMESTAMP WITH TIME ZONE,
  motivo_invalidacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de anexos/comprovantes
CREATE TABLE public.anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lancamento_id UUID NOT NULL REFERENCES public.lancamentos(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  hash_comprovante VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice único para hash de comprovantes (evitar duplicados)
CREATE UNIQUE INDEX anexos_hash_comprovante_key ON public.anexos(hash_comprovante) WHERE hash_comprovante IS NOT NULL;

-- Tabela de fechamentos
CREATE TABLE public.fechamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id),
  usuario_id UUID NOT NULL,
  data_processamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sucesso',
  valor_total NUMERIC NOT NULL DEFAULT 0,
  total_eventos INTEGER NOT NULL DEFAULT 0,
  total_colaboradores INTEGER NOT NULL DEFAULT 0,
  detalhes_erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de exportações
CREATE TABLE public.exportacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id),
  fechamento_id UUID REFERENCES public.fechamentos(id),
  usuario_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  qtd_registros INTEGER NOT NULL DEFAULT 0,
  data_exportacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de eventos PI/DA
CREATE TABLE public.eventos_pida (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id),
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id),
  fechamento_id UUID NOT NULL REFERENCES public.fechamentos(id),
  valor_base_pida NUMERIC NOT NULL DEFAULT 0,
  valor_diferenca_cesta NUMERIC NOT NULL DEFAULT 0,
  valor_total_pida NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de audit logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_description TEXT,
  action TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Função para verificar se usuário tem uma role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para obter o ID do colaborador pelo user_id
CREATE OR REPLACE FUNCTION public.get_colaborador_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.colaboradores_elegiveis WHERE user_id = _user_id LIMIT 1
$$;

-- Função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Função para criar perfil e atribuir role padrão ao criar novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email
  );
  
  -- Atribuir role padrão de COLABORADOR
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'COLABORADOR');
  
  RETURN NEW;
END;
$$;

-- Função para validar período de lançamento
CREATE OR REPLACE FUNCTION public.validar_periodo_lancamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Função para validar comprovantes duplicados
CREATE OR REPLACE FUNCTION public.validar_comprovante_duplicado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at em colaboradores_elegiveis
CREATE TRIGGER update_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores_elegiveis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em lancamentos
CREATE TRIGGER update_lancamentos_updated_at
  BEFORE UPDATE ON public.lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para validar período de lançamento
CREATE TRIGGER validar_periodo_lancamento_trigger
  BEFORE INSERT OR UPDATE ON public.lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_periodo_lancamento();

-- Trigger para validar comprovantes duplicados
CREATE TRIGGER validar_comprovante_duplicado_trigger
  BEFORE INSERT OR UPDATE ON public.anexos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_comprovante_duplicado();

-- Trigger para criar perfil ao criar novo usuário (auth.users)
-- NOTA: Este trigger deve ser criado no schema auth, executar como superuser
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores_elegiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_despesas_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaborador_tipos_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exportacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_pida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES - profiles
-- =====================================================

CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "RH e Financeiro podem ver todos perfis"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =====================================================
-- POLICIES - user_roles
-- =====================================================

CREATE POLICY "Usuários podem ver suas próprias roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "RH pode gerenciar roles"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'RH'::app_role))
  WITH CHECK (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - calendario_periodos
-- =====================================================

CREATE POLICY "Todos autenticados podem ver calendário"
  ON public.calendario_periodos FOR SELECT
  USING (true);

CREATE POLICY "RH pode gerenciar calendário"
  ON public.calendario_periodos FOR ALL
  USING (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - colaboradores_elegiveis
-- =====================================================

CREATE POLICY "Colaborador pode ver seus próprios dados"
  ON public.colaboradores_elegiveis FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "RH e Financeiro podem ver todos colaboradores"
  ON public.colaboradores_elegiveis FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "RH pode gerenciar colaboradores"
  ON public.colaboradores_elegiveis FOR ALL
  USING (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - tipos_despesas
-- =====================================================

CREATE POLICY "Todos autenticados podem ver tipos de despesas"
  ON public.tipos_despesas FOR SELECT
  USING (true);

CREATE POLICY "RH pode gerenciar tipos de despesas"
  ON public.tipos_despesas FOR ALL
  USING (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - tipos_despesas_eventos
-- =====================================================

CREATE POLICY "Todos autenticados podem ver eventos folha"
  ON public.tipos_despesas_eventos FOR SELECT
  USING (true);

CREATE POLICY "RH pode gerenciar eventos folha"
  ON public.tipos_despesas_eventos FOR ALL
  USING (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - colaborador_tipos_despesas
-- =====================================================

CREATE POLICY "Colaborador pode ver seus próprios vínculos"
  ON public.colaborador_tipos_despesas FOR SELECT
  USING (colaborador_id = get_colaborador_id(auth.uid()));

CREATE POLICY "RH e Financeiro podem ver todos vínculos"
  ON public.colaborador_tipos_despesas FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "RH pode gerenciar vínculos tipos despesas"
  ON public.colaborador_tipos_despesas FOR ALL
  USING (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - lancamentos
-- =====================================================

CREATE POLICY "Colaborador pode ver seus próprios lançamentos"
  ON public.lancamentos FOR SELECT
  USING (colaborador_id = get_colaborador_id(auth.uid()));

CREATE POLICY "RH e Financeiro podem ver todos lançamentos"
  ON public.lancamentos FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "Colaborador pode inserir lançamentos"
  ON public.lancamentos FOR INSERT
  WITH CHECK (colaborador_id = get_colaborador_id(auth.uid()));

CREATE POLICY "RH pode validar lançamentos"
  ON public.lancamentos FOR UPDATE
  USING (has_role(auth.uid(), 'RH'::app_role));

CREATE POLICY "Colaborador pode atualizar seus envios"
  ON public.lancamentos FOR UPDATE
  USING ((colaborador_id = get_colaborador_id(auth.uid())) AND (status = 'enviado'::expense_status));

CREATE POLICY "Colaborador pode deletar seus envios"
  ON public.lancamentos FOR DELETE
  USING ((colaborador_id = get_colaborador_id(auth.uid())) AND (status = 'enviado'::expense_status));

-- =====================================================
-- POLICIES - anexos
-- =====================================================

CREATE POLICY "Usuário pode ver anexos de seus lançamentos"
  ON public.anexos FOR SELECT
  USING (lancamento_id IN (
    SELECT id FROM lancamentos WHERE colaborador_id = get_colaborador_id(auth.uid())
  ));

CREATE POLICY "RH e Financeiro podem ver todos anexos"
  ON public.anexos FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "Usuário pode gerenciar anexos de seus lançamentos"
  ON public.anexos FOR ALL
  USING (lancamento_id IN (
    SELECT id FROM lancamentos 
    WHERE colaborador_id = get_colaborador_id(auth.uid()) 
      AND status = 'enviado'::expense_status
  ));

-- =====================================================
-- POLICIES - fechamentos
-- =====================================================

CREATE POLICY "RH e Financeiro podem ver fechamentos"
  ON public.fechamentos FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "RH pode processar fechamentos"
  ON public.fechamentos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - exportacoes
-- =====================================================

CREATE POLICY "Financeiro pode ver e criar exportações"
  ON public.exportacoes FOR ALL
  USING (has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "RH pode ver exportações"
  ON public.exportacoes FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - eventos_pida
-- =====================================================

CREATE POLICY "Colaborador pode ver seus próprios eventos_pida"
  ON public.eventos_pida FOR SELECT
  USING (colaborador_id = get_colaborador_id(auth.uid()));

CREATE POLICY "RH e Financeiro podem ver todos eventos_pida"
  ON public.eventos_pida FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "RH pode inserir eventos_pida"
  ON public.eventos_pida FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'RH'::app_role));

-- =====================================================
-- POLICIES - audit_logs
-- =====================================================

CREATE POLICY "RH e Financeiro podem ver audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

CREATE POLICY "Sistema pode inserir audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role));

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Criar bucket para comprovantes (executar no Dashboard do Supabase ou via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes', 'comprovantes', false);

-- Policies para storage (executar no Dashboard do Supabase)
-- CREATE POLICY "Usuários autenticados podem fazer upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'comprovantes' AND auth.role() = 'authenticated');

-- CREATE POLICY "Usuários podem ver seus próprios arquivos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "RH e Financeiro podem ver todos arquivos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'comprovantes' AND (
--     has_role(auth.uid(), 'RH'::app_role) OR has_role(auth.uid(), 'FINANCEIRO'::app_role)
--   ));

-- =====================================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_lancamentos_colaborador_id ON public.lancamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_periodo_id ON public.lancamentos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON public.lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo_despesa_id ON public.lancamentos(tipo_despesa_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_user_id ON public.colaboradores_elegiveis(user_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_departamento ON public.colaboradores_elegiveis(departamento);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_anexos_lancamento_id ON public.anexos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_fechamentos_periodo_id ON public.fechamentos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_exportacoes_periodo_id ON public.exportacoes(periodo_id);
CREATE INDEX IF NOT EXISTS idx_eventos_pida_colaborador_id ON public.eventos_pida(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_eventos_pida_periodo_id ON public.eventos_pida(periodo_id);
CREATE INDEX IF NOT EXISTS idx_calendario_periodos_status ON public.calendario_periodos(status);
CREATE INDEX IF NOT EXISTS idx_calendario_periodos_data_inicio ON public.calendario_periodos(data_inicio);

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 
-- 1. O trigger on_auth_user_created deve ser criado manualmente no schema auth
--    pelo painel do Supabase ou como superuser:
--    
--    CREATE TRIGGER on_auth_user_created
--      AFTER INSERT ON auth.users
--      FOR EACH ROW
--      EXECUTE FUNCTION public.handle_new_user();
--
-- 2. O bucket de storage 'comprovantes' deve ser criado pelo painel do Supabase
--    ou via API de Storage.
--
-- 3. As policies de storage devem ser criadas pelo painel do Supabase
--    na seção Storage > Policies.
--
-- 4. Certifique-se de que a extensão pgcrypto está habilitada para gen_random_uuid():
--    CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- =====================================================
