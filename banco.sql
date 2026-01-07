--
-- PostgreSQL database dump
--

\restrict HyV52nHfZLRbJylgHlV1FnbMoHLpY5aXT9TdNiOKSniUnUQ4sXfQLVONznX7yza

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'FINANCEIRO',
    'COLABORADOR',
    'RH'
);


--
-- Name: componente_remuneracao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.componente_remuneracao AS ENUM (
    'vale_alimentacao',
    'vale_refeicao',
    'ajuda_custo',
    'mobilidade',
    'cesta_beneficios',
    'pida'
);


--
-- Name: expense_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_classification AS ENUM (
    'fixo',
    'variavel'
);


--
-- Name: expense_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_origin AS ENUM (
    'proprio',
    'conjuge',
    'filhos'
);


--
-- Name: expense_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_status AS ENUM (
    'enviado',
    'em_analise',
    'valido',
    'invalido'
);


--
-- Name: period_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.period_status AS ENUM (
    'aberto',
    'fechado'
);


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;


--
-- Name: get_colaborador_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_colaborador_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT id FROM public.colaboradores_elegiveis WHERE user_id = _user_id LIMIT 1 $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, email) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email), NEW.email);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'COLABORADOR');
    RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


--
-- Name: validar_comprovante_duplicado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_comprovante_duplicado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.hash_comprovante IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.anexos WHERE hash_comprovante = NEW.hash_comprovante AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
            RAISE EXCEPTION 'Este comprovante jÃ¡ foi utilizado em outro lanÃ§amento.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_periodo_lancamento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_periodo_lancamento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    periodo_record RECORD;
    proximo_periodo RECORD;
    data_atual DATE := CURRENT_DATE;
BEGIN
    SELECT * INTO periodo_record FROM public.calendario_periodos WHERE id = NEW.periodo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PerÃ­odo nÃ£o encontrado'; END IF;
    IF periodo_record.status != 'aberto' THEN RAISE EXCEPTION 'Este perÃ­odo estÃ¡ fechado para lanÃ§amentos'; END IF;
    IF TG_OP = 'INSERT' THEN
        IF data_atual < periodo_record.abre_lancamento::date THEN
            RAISE EXCEPTION 'PerÃ­odo de lanÃ§amento ainda nÃ£o iniciou. Abertura em: %', periodo_record.abre_lancamento;
        END IF;
        IF data_atual > periodo_record.fecha_lancamento::date THEN
            SELECT * INTO proximo_periodo FROM public.calendario_periodos WHERE abre_lancamento::date > periodo_record.fecha_lancamento::date AND status = 'aberto' ORDER BY abre_lancamento ASC LIMIT 1;
            IF FOUND THEN NEW.periodo_id := proximo_periodo.id;
            ELSE RAISE EXCEPTION 'PerÃ­odo de lanÃ§amento encerrado e nÃ£o hÃ¡ prÃ³ximo perÃ­odo disponÃ­vel.'; END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN string_to_array(name, '/');
END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    encrypted_password text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ativo boolean DEFAULT true NOT NULL
);


--
-- Name: anexos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anexos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lancamento_id uuid NOT NULL,
    nome_arquivo text NOT NULL,
    tipo_arquivo text NOT NULL,
    tamanho integer NOT NULL,
    storage_path text NOT NULL,
    hash_comprovante character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    entity_description text,
    old_values jsonb,
    new_values jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calendario_periodos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendario_periodos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    periodo text NOT NULL,
    data_inicio date NOT NULL,
    data_final date NOT NULL,
    abre_lancamento date NOT NULL,
    fecha_lancamento date NOT NULL,
    status public.period_status DEFAULT 'aberto'::public.period_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: colaborador_tipos_despesas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaborador_tipos_despesas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    tipo_despesa_id uuid NOT NULL,
    teto_individual numeric,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: colaboradores_elegiveis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaboradores_elegiveis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    matricula text NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    departamento text NOT NULL,
    salario_base numeric DEFAULT 0 NOT NULL,
    vale_alimentacao numeric DEFAULT 0 NOT NULL,
    vale_refeicao numeric DEFAULT 0 NOT NULL,
    transporte numeric DEFAULT 0 NOT NULL,
    mobilidade numeric DEFAULT 0 NOT NULL,
    ajuda_custo numeric DEFAULT 0 NOT NULL,
    cesta_beneficios_teto numeric DEFAULT 0 NOT NULL,
    pida_teto numeric DEFAULT 0 NOT NULL,
    tem_pida boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eventos_pida; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos_pida (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    periodo_id uuid NOT NULL,
    fechamento_id uuid NOT NULL,
    valor_base_pida numeric DEFAULT 0 NOT NULL,
    valor_diferenca_cesta numeric DEFAULT 0 NOT NULL,
    valor_total_pida numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exportacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exportacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    periodo_id uuid NOT NULL,
    fechamento_id uuid,
    usuario_id uuid NOT NULL,
    nome_arquivo text NOT NULL,
    qtd_registros integer DEFAULT 0 NOT NULL,
    data_exportacao timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fechamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fechamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    periodo_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    data_processamento timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'sucesso'::text NOT NULL,
    total_colaboradores integer DEFAULT 0 NOT NULL,
    total_eventos integer DEFAULT 0 NOT NULL,
    valor_total numeric DEFAULT 0 NOT NULL,
    detalhes_erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lancamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    periodo_id uuid NOT NULL,
    tipo_despesa_id uuid NOT NULL,
    origem public.expense_origin DEFAULT 'proprio'::public.expense_origin NOT NULL,
    descricao_fato_gerador text NOT NULL,
    valor_lancado numeric NOT NULL,
    valor_considerado numeric NOT NULL,
    valor_nao_considerado numeric DEFAULT 0 NOT NULL,
    status public.expense_status DEFAULT 'enviado'::public.expense_status NOT NULL,
    validado_por uuid,
    validado_em timestamp with time zone,
    motivo_invalidacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tipos_despesas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_despesas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    grupo text NOT NULL,
    classificacao public.expense_classification DEFAULT 'variavel'::public.expense_classification NOT NULL,
    valor_padrao_teto numeric DEFAULT 0 NOT NULL,
    origem_permitida public.expense_origin[] DEFAULT ARRAY['proprio'::public.expense_origin] NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tipos_despesas_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_despesas_eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    componente public.componente_remuneracao NOT NULL,
    codigo_evento text NOT NULL,
    descricao_evento text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    public boolean DEFAULT false
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: anexos anexos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos
    ADD CONSTRAINT anexos_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: calendario_periodos calendario_periodos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendario_periodos
    ADD CONSTRAINT calendario_periodos_pkey PRIMARY KEY (id);


--
-- Name: colaborador_tipos_despesas colaborador_tipos_despesas_colaborador_id_tipo_despesa_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_tipos_despesas
    ADD CONSTRAINT colaborador_tipos_despesas_colaborador_id_tipo_despesa_id_key UNIQUE (colaborador_id, tipo_despesa_id);


--
-- Name: colaborador_tipos_despesas colaborador_tipos_despesas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_tipos_despesas
    ADD CONSTRAINT colaborador_tipos_despesas_pkey PRIMARY KEY (id);


--
-- Name: colaboradores_elegiveis colaboradores_elegiveis_matricula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaboradores_elegiveis
    ADD CONSTRAINT colaboradores_elegiveis_matricula_key UNIQUE (matricula);


--
-- Name: colaboradores_elegiveis colaboradores_elegiveis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaboradores_elegiveis
    ADD CONSTRAINT colaboradores_elegiveis_pkey PRIMARY KEY (id);


--
-- Name: eventos_pida eventos_pida_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_pida
    ADD CONSTRAINT eventos_pida_pkey PRIMARY KEY (id);


--
-- Name: exportacoes exportacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exportacoes
    ADD CONSTRAINT exportacoes_pkey PRIMARY KEY (id);


--
-- Name: fechamentos fechamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fechamentos
    ADD CONSTRAINT fechamentos_pkey PRIMARY KEY (id);


--
-- Name: lancamentos lancamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: tipos_despesas_eventos tipos_despesas_eventos_componente_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_despesas_eventos
    ADD CONSTRAINT tipos_despesas_eventos_componente_key UNIQUE (componente);


--
-- Name: tipos_despesas_eventos tipos_despesas_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_despesas_eventos
    ADD CONSTRAINT tipos_despesas_eventos_pkey PRIMARY KEY (id);


--
-- Name: tipos_despesas tipos_despesas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_despesas
    ADD CONSTRAINT tipos_despesas_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: idx_anexos_hash_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_anexos_hash_unique ON public.anexos USING btree (hash_comprovante) WHERE (hash_comprovante IS NOT NULL);


--
-- Name: idx_anexos_lancamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anexos_lancamento ON public.anexos USING btree (lancamento_id);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_colaboradores_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaboradores_user ON public.colaboradores_elegiveis USING btree (user_id);


--
-- Name: idx_lancamentos_colaborador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_colaborador ON public.lancamentos USING btree (colaborador_id);


--
-- Name: idx_lancamentos_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_periodo ON public.lancamentos USING btree (periodo_id);


--
-- Name: idx_lancamentos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_status ON public.lancamentos USING btree (status);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: colaboradores_elegiveis update_colaboradores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON public.colaboradores_elegiveis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lancamentos update_lancamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lancamentos_updated_at BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: anexos validar_comprovante_duplicado_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validar_comprovante_duplicado_trigger BEFORE INSERT OR UPDATE ON public.anexos FOR EACH ROW EXECUTE FUNCTION public.validar_comprovante_duplicado();


--
-- Name: lancamentos validar_periodo_lancamento_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validar_periodo_lancamento_trigger BEFORE INSERT OR UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.validar_periodo_lancamento();


--
-- Name: anexos anexos_lancamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos
    ADD CONSTRAINT anexos_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES public.lancamentos(id) ON DELETE CASCADE;


--
-- Name: colaborador_tipos_despesas colaborador_tipos_despesas_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_tipos_despesas
    ADD CONSTRAINT colaborador_tipos_despesas_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE;


--
-- Name: colaborador_tipos_despesas colaborador_tipos_despesas_tipo_despesa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_tipos_despesas
    ADD CONSTRAINT colaborador_tipos_despesas_tipo_despesa_id_fkey FOREIGN KEY (tipo_despesa_id) REFERENCES public.tipos_despesas(id) ON DELETE CASCADE;


--
-- Name: eventos_pida eventos_pida_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_pida
    ADD CONSTRAINT eventos_pida_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE;


--
-- Name: eventos_pida eventos_pida_fechamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_pida
    ADD CONSTRAINT eventos_pida_fechamento_id_fkey FOREIGN KEY (fechamento_id) REFERENCES public.fechamentos(id) ON DELETE CASCADE;


--
-- Name: eventos_pida eventos_pida_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_pida
    ADD CONSTRAINT eventos_pida_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT;


--
-- Name: exportacoes exportacoes_fechamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exportacoes
    ADD CONSTRAINT exportacoes_fechamento_id_fkey FOREIGN KEY (fechamento_id) REFERENCES public.fechamentos(id) ON DELETE SET NULL;


--
-- Name: exportacoes exportacoes_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exportacoes
    ADD CONSTRAINT exportacoes_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT;


--
-- Name: fechamentos fechamentos_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fechamentos
    ADD CONSTRAINT fechamentos_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT;


--
-- Name: lancamentos lancamentos_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores_elegiveis(id) ON DELETE CASCADE;


--
-- Name: lancamentos lancamentos_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.calendario_periodos(id) ON DELETE RESTRICT;


--
-- Name: lancamentos lancamentos_tipo_despesa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_tipo_despesa_id_fkey FOREIGN KEY (tipo_despesa_id) REFERENCES public.tipos_despesas(id) ON DELETE RESTRICT;


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: lancamentos Colaborador pode atualizar seus envios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Colaborador pode atualizar seus envios" ON public.lancamentos FOR UPDATE USING (((colaborador_id = public.get_colaborador_id(auth.uid())) AND (status = 'enviado'::public.expense_status)));


--
-- Name: lancamentos Colaborador pode deletar seus envios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Colaborador pode deletar seus envios" ON public.lancamentos FOR DELETE USING (((colaborador_id = public.get_colaborador_id(auth.uid())) AND (status = 'enviado'::public.expense_status)));


--
-- Name: lancamentos Colaborador pode inserir lanÃ§amentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Colaborador pode inserir lanÃ§amentos" ON public.lancamentos FOR INSERT WITH CHECK ((colaborador_id = public.get_colaborador_id(auth.uid())));


--
-- Name: colaboradores_elegiveis Colaborador pode ver seus prÃ³prios dados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Colaborador pode ver seus prÃ³prios dados" ON public.colaboradores_elegiveis FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: eventos_pida Colaborador pode ver seus prÃ³prios eventos_pida; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Colaborador pode ver seus prÃ³prios eventos_pida" ON public.eventos_pida FOR SELECT USING ((colaborador_id = public.get_colaborador_id(auth.uid())));


--
-- Name: lancamentos Colaborador pode ver seus prÃ³prios lanÃ§amentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Colaborador pode ver seus prÃ³prios lanÃ§amentos" ON public.lancamentos FOR SELECT USING ((colaborador_id = public.get_colaborador_id(auth.uid())));


--
-- Name: colaborador_tipos_despesas Colaborador pode ver seus prÃ³prios vÃ­nculos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Colaborador pode ver seus prÃ³prios vÃ­nculos" ON public.colaborador_tipos_despesas FOR SELECT USING ((colaborador_id = public.get_colaborador_id(auth.uid())));


--
-- Name: exportacoes Financeiro pode ver e criar exportaÃ§Ãµes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Financeiro pode ver e criar exportaÃ§Ãµes" ON public.exportacoes USING (public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role));


--
-- Name: audit_logs RH e Financeiro podem ver audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver audit logs" ON public.audit_logs FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: fechamentos RH e Financeiro podem ver fechamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver fechamentos" ON public.fechamentos FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: anexos RH e Financeiro podem ver todos anexos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver todos anexos" ON public.anexos FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: colaboradores_elegiveis RH e Financeiro podem ver todos colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver todos colaboradores" ON public.colaboradores_elegiveis FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: eventos_pida RH e Financeiro podem ver todos eventos_pida; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver todos eventos_pida" ON public.eventos_pida FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: lancamentos RH e Financeiro podem ver todos lanÃ§amentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver todos lanÃ§amentos" ON public.lancamentos FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: profiles RH e Financeiro podem ver todos perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver todos perfis" ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: colaborador_tipos_despesas RH e Financeiro podem ver todos vÃ­nculos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH e Financeiro podem ver todos vÃ­nculos" ON public.colaborador_tipos_despesas FOR SELECT USING ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: calendario_periodos RH pode gerenciar calendÃ¡rio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode gerenciar calendÃ¡rio" ON public.calendario_periodos USING (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: colaboradores_elegiveis RH pode gerenciar colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode gerenciar colaboradores" ON public.colaboradores_elegiveis USING (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: tipos_despesas_eventos RH pode gerenciar eventos folha; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode gerenciar eventos folha" ON public.tipos_despesas_eventos USING (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: user_roles RH pode gerenciar roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode gerenciar roles" ON public.user_roles USING (public.has_role(auth.uid(), 'RH'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: tipos_despesas RH pode gerenciar tipos de despesas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode gerenciar tipos de despesas" ON public.tipos_despesas USING (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: colaborador_tipos_despesas RH pode gerenciar vÃ­nculos tipos despesas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode gerenciar vÃ­nculos tipos despesas" ON public.colaborador_tipos_despesas USING (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: eventos_pida RH pode inserir eventos_pida; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode inserir eventos_pida" ON public.eventos_pida FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: fechamentos RH pode processar fechamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode processar fechamentos" ON public.fechamentos FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: lancamentos RH pode validar lanÃ§amentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode validar lanÃ§amentos" ON public.lancamentos FOR UPDATE USING (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: exportacoes RH pode ver exportaÃ§Ãµes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RH pode ver exportaÃ§Ãµes" ON public.exportacoes FOR SELECT USING (public.has_role(auth.uid(), 'RH'::public.app_role));


--
-- Name: audit_logs Sistema pode inserir audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sistema pode inserir audit logs" ON public.audit_logs FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)));


--
-- Name: calendario_periodos Todos autenticados podem ver calendÃ¡rio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Todos autenticados podem ver calendÃ¡rio" ON public.calendario_periodos FOR SELECT USING (true);


--
-- Name: tipos_despesas_eventos Todos autenticados podem ver eventos folha; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Todos autenticados podem ver eventos folha" ON public.tipos_despesas_eventos FOR SELECT USING (true);


--
-- Name: tipos_despesas Todos autenticados podem ver tipos de despesas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Todos autenticados podem ver tipos de despesas" ON public.tipos_despesas FOR SELECT USING (true);


--
-- Name: anexos UsuÃ¡rio pode gerenciar anexos de seus lanÃ§amentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsuÃ¡rio pode gerenciar anexos de seus lanÃ§amentos" ON public.anexos USING ((lancamento_id IN ( SELECT lancamentos.id
   FROM public.lancamentos
  WHERE ((lancamentos.colaborador_id = public.get_colaborador_id(auth.uid())) AND (lancamentos.status = 'enviado'::public.expense_status)))));


--
-- Name: anexos UsuÃ¡rio pode ver anexos de seus lanÃ§amentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsuÃ¡rio pode ver anexos de seus lanÃ§amentos" ON public.anexos FOR SELECT USING ((lancamento_id IN ( SELECT lancamentos.id
   FROM public.lancamentos
  WHERE (lancamentos.colaborador_id = public.get_colaborador_id(auth.uid())))));


--
-- Name: profiles UsuÃ¡rios podem atualizar seu prÃ³prio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsuÃ¡rios podem atualizar seu prÃ³prio perfil" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles UsuÃ¡rios podem ver seu prÃ³prio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsuÃ¡rios podem ver seu prÃ³prio perfil" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles UsuÃ¡rios podem ver suas prÃ³prias roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsuÃ¡rios podem ver suas prÃ³prias roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: anexos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: calendario_periodos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendario_periodos ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador_tipos_despesas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaborador_tipos_despesas ENABLE ROW LEVEL SECURITY;

--
-- Name: colaboradores_elegiveis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaboradores_elegiveis ENABLE ROW LEVEL SECURITY;

--
-- Name: eventos_pida; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eventos_pida ENABLE ROW LEVEL SECURITY;

--
-- Name: exportacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exportacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: fechamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_despesas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tipos_despesas ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_despesas_eventos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tipos_despesas_eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: objects UsuÃ¡rios autenticados podem fazer upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "UsuÃ¡rios autenticados podem fazer upload" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'comprovantes'::text) AND (auth.uid() IS NOT NULL)));


--
-- Name: objects UsuÃ¡rios podem deletar seus prÃ³prios arquivos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "UsuÃ¡rios podem deletar seus prÃ³prios arquivos" ON storage.objects FOR DELETE USING (((bucket_id = 'comprovantes'::text) AND ((owner = auth.uid()) OR public.has_role(auth.uid(), 'RH'::public.app_role))));


--
-- Name: objects UsuÃ¡rios podem ver seus prÃ³prios arquivos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "UsuÃ¡rios podem ver seus prÃ³prios arquivos" ON storage.objects FOR SELECT USING (((bucket_id = 'comprovantes'::text) AND ((owner = auth.uid()) OR public.has_role(auth.uid(), 'RH'::public.app_role) OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role))));


--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict HyV52nHfZLRbJylgHlV1FnbMoHLpY5aXT9TdNiOKSniUnUQ4sXfQLVONznX7yza

