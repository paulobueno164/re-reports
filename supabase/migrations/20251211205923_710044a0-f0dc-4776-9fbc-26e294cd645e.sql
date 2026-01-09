-- Enum para perfis de usuário
CREATE TYPE public.app_role AS ENUM ('FINANCEIRO', 'COLABORADOR', 'RH');

-- Enum para status de despesa
CREATE TYPE public.expense_status AS ENUM ('rascunho', 'enviado', 'em_analise', 'valido', 'invalido');

-- Enum para classificação de despesa
CREATE TYPE public.expense_classification AS ENUM ('fixo', 'variavel');

-- Enum para origem da despesa
CREATE TYPE public.expense_origin AS ENUM ('proprio', 'conjuge', 'filhos');

-- Enum para status do período
CREATE TYPE public.period_status AS ENUM ('aberto', 'fechado');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles dos usuários (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tabela de colaboradores elegíveis
CREATE TABLE public.colaboradores_elegiveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  matricula TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  departamento TEXT NOT NULL,
  salario_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  vale_alimentacao DECIMAL(12,2) NOT NULL DEFAULT 0,
  vale_refeicao DECIMAL(12,2) NOT NULL DEFAULT 0,
  ajuda_custo DECIMAL(12,2) NOT NULL DEFAULT 0,
  mobilidade DECIMAL(12,2) NOT NULL DEFAULT 0,
  transporte DECIMAL(12,2) NOT NULL DEFAULT 0,
  cesta_beneficios_teto DECIMAL(12,2) NOT NULL DEFAULT 0,
  tem_pida BOOLEAN NOT NULL DEFAULT false,
  pida_teto DECIMAL(12,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de tipos de despesas
CREATE TABLE public.tipos_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  classificacao expense_classification NOT NULL DEFAULT 'variavel',
  valor_padrao_teto DECIMAL(12,2) NOT NULL DEFAULT 0,
  grupo TEXT NOT NULL,
  origem_permitida expense_origin[] NOT NULL DEFAULT ARRAY['proprio']::expense_origin[],
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de calendário de períodos
CREATE TABLE public.calendario_periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo TEXT NOT NULL UNIQUE,
  data_inicio DATE NOT NULL,
  data_final DATE NOT NULL,
  abre_lancamento DATE NOT NULL,
  fecha_lancamento DATE NOT NULL,
  status period_status NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de vínculo tipo despesa × evento folha
CREATE TABLE public.tipos_despesas_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_despesa_id UUID NOT NULL REFERENCES public.tipos_despesas(id) ON DELETE CASCADE,
  codigo_evento TEXT NOT NULL,
  descricao_evento TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo_despesa_id)
);

-- Tabela de lançamentos de despesas
CREATE TABLE public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE,
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT,
  tipo_despesa_id UUID NOT NULL REFERENCES public.tipos_despesas(id) ON DELETE RESTRICT,
  origem expense_origin NOT NULL DEFAULT 'proprio',
  valor_lancado DECIMAL(12,2) NOT NULL,
  valor_considerado DECIMAL(12,2) NOT NULL,
  valor_nao_considerado DECIMAL(12,2) NOT NULL DEFAULT 0,
  descricao_fato_gerador TEXT NOT NULL,
  status expense_status NOT NULL DEFAULT 'rascunho',
  motivo_invalidacao TEXT,
  validado_por UUID REFERENCES auth.users(id),
  validado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de anexos
CREATE TABLE public.anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES public.lancamentos(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de fechamentos mensais
CREATE TABLE public.fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT,
  data_processamento TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  total_colaboradores INTEGER NOT NULL DEFAULT 0,
  total_eventos INTEGER NOT NULL DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sucesso',
  detalhes_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de exportações
CREATE TABLE public.exportacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.calendario_periodos(id),
  fechamento_id UUID REFERENCES public.fechamentos(id),
  data_exportacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  nome_arquivo TEXT NOT NULL,
  qtd_registros INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Função para verificar role do usuário (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para obter colaborador do usuário
CREATE OR REPLACE FUNCTION public.get_colaborador_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.colaboradores_elegiveis WHERE user_id = _user_id LIMIT 1
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON public.colaboradores_elegiveis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lancamentos_updated_at BEFORE UPDATE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores_elegiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_despesas_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exportacoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "RH e Financeiro podem ver todos perfis" ON public.profiles
FOR SELECT USING (
  public.has_role(auth.uid(), 'RH') OR 
  public.has_role(auth.uid(), 'FINANCEIRO')
);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- RLS Policies para user_roles (somente leitura para usuários, RH pode gerenciar)
CREATE POLICY "Usuários podem ver suas próprias roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "RH pode ver todas roles" ON public.user_roles
FOR SELECT USING (public.has_role(auth.uid(), 'RH'));

CREATE POLICY "RH pode gerenciar roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- RLS Policies para colaboradores_elegiveis
CREATE POLICY "Colaborador pode ver seus próprios dados" ON public.colaboradores_elegiveis
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "RH e Financeiro podem ver todos colaboradores" ON public.colaboradores_elegiveis
FOR SELECT USING (
  public.has_role(auth.uid(), 'RH') OR 
  public.has_role(auth.uid(), 'FINANCEIRO')
);

CREATE POLICY "RH pode gerenciar colaboradores" ON public.colaboradores_elegiveis
FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- RLS Policies para tipos_despesas (leitura para todos autenticados, escrita para RH)
CREATE POLICY "Todos autenticados podem ver tipos de despesas" ON public.tipos_despesas
FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH pode gerenciar tipos de despesas" ON public.tipos_despesas
FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- RLS Policies para calendario_periodos (leitura para todos autenticados, escrita para RH)
CREATE POLICY "Todos autenticados podem ver calendário" ON public.calendario_periodos
FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH pode gerenciar calendário" ON public.calendario_periodos
FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- RLS Policies para tipos_despesas_eventos (leitura para todos, escrita para RH)
CREATE POLICY "Todos autenticados podem ver eventos folha" ON public.tipos_despesas_eventos
FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH pode gerenciar eventos folha" ON public.tipos_despesas_eventos
FOR ALL USING (public.has_role(auth.uid(), 'RH'));

-- RLS Policies para lancamentos
CREATE POLICY "Colaborador pode ver seus próprios lançamentos" ON public.lancamentos
FOR SELECT USING (
  colaborador_id = public.get_colaborador_id(auth.uid())
);

CREATE POLICY "RH e Financeiro podem ver todos lançamentos" ON public.lancamentos
FOR SELECT USING (
  public.has_role(auth.uid(), 'RH') OR 
  public.has_role(auth.uid(), 'FINANCEIRO')
);

CREATE POLICY "Colaborador pode inserir lançamentos" ON public.lancamentos
FOR INSERT WITH CHECK (
  colaborador_id = public.get_colaborador_id(auth.uid())
);

CREATE POLICY "Colaborador pode atualizar seus rascunhos" ON public.lancamentos
FOR UPDATE USING (
  colaborador_id = public.get_colaborador_id(auth.uid()) AND
  status IN ('rascunho', 'enviado')
);

CREATE POLICY "RH pode validar lançamentos" ON public.lancamentos
FOR UPDATE USING (public.has_role(auth.uid(), 'RH'));

CREATE POLICY "Colaborador pode deletar seus rascunhos" ON public.lancamentos
FOR DELETE USING (
  colaborador_id = public.get_colaborador_id(auth.uid()) AND
  status = 'rascunho'
);

-- RLS Policies para anexos
CREATE POLICY "Usuário pode ver anexos de seus lançamentos" ON public.anexos
FOR SELECT USING (
  lancamento_id IN (
    SELECT id FROM public.lancamentos 
    WHERE colaborador_id = public.get_colaborador_id(auth.uid())
  )
);

CREATE POLICY "RH e Financeiro podem ver todos anexos" ON public.anexos
FOR SELECT USING (
  public.has_role(auth.uid(), 'RH') OR 
  public.has_role(auth.uid(), 'FINANCEIRO')
);

CREATE POLICY "Usuário pode gerenciar anexos de seus lançamentos" ON public.anexos
FOR ALL USING (
  lancamento_id IN (
    SELECT id FROM public.lancamentos 
    WHERE colaborador_id = public.get_colaborador_id(auth.uid())
    AND status IN ('rascunho', 'enviado')
  )
);

-- RLS Policies para fechamentos
CREATE POLICY "RH e Financeiro podem ver fechamentos" ON public.fechamentos
FOR SELECT USING (
  public.has_role(auth.uid(), 'RH') OR 
  public.has_role(auth.uid(), 'FINANCEIRO')
);

CREATE POLICY "RH pode processar fechamentos" ON public.fechamentos
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'RH'));

-- RLS Policies para exportacoes
CREATE POLICY "Financeiro pode ver e criar exportações" ON public.exportacoes
FOR ALL USING (public.has_role(auth.uid(), 'FINANCEIRO'));

CREATE POLICY "RH pode ver exportações" ON public.exportacoes
FOR SELECT USING (public.has_role(auth.uid(), 'RH'));

-- Criar bucket de storage para comprovantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes', 'comprovantes', false);

-- Policies de storage
CREATE POLICY "Usuários podem fazer upload de comprovantes" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "Usuários podem ver seus comprovantes" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes');

CREATE POLICY "Usuários podem deletar seus comprovantes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes');