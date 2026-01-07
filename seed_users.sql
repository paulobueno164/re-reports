--
-- PostgreSQL database dump
--

\restrict 7FGc1SLAdRH9VjcyrcTVbTrVzZceYEzc2WZQgGcIU5uBPCEctas4i3SzbF3lSPR

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
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: postgres
--

INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at, ativo) VALUES ('8ec139bf-9cb3-456f-a30f-7b7dfb26c8f8', 'financeiro@sistema.com.br', '$2a$10$XnlAjHPrLWkwf2PDA/BREe1iAg8KwH34OrCZXMSuJk6Ro0Z1Q.gTe', '{"nome": "Usuário Financeiro"}', '2026-01-02 08:37:49.176349-03', '2026-01-02 08:37:49.176349-03', true);
INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at, ativo) VALUES ('b1d96a6f-1120-4e6c-8a37-bc93bd74ac23', 'teste@teste.com.br', '$2a$10$gMdm6DHR8HT4bPKw.76z2O7O7p48aHrTi8tDWtJ0So50kAB9XkYEi', '{"nome": "teste"}', '2026-01-02 09:44:56.522805-03', '2026-01-02 09:54:01.872968-03', true);
INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at, ativo) VALUES ('a97de2f6-a3e6-4926-a818-c9757a10ffb7', 'rh@sistema.com.br', '$2a$10$jwVfmcWSKlpMh1IMOAkgSOl4hyMRe1GoobHq6k1MQ/JCX423MxrqG', '{"nome": "Usuário RH"}', '2026-01-02 08:37:49.049913-03', '2026-01-02 09:57:18.165533-03', true);
INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at, ativo) VALUES ('7134a817-c4e9-43b0-ae86-5a7231c84278', 'paulo@teclia.com', '$2a$10$t2dj59s9quTRRkwr/zZlse5Eo9IKli2gXaZFhzTba8CFd70IslUY2', '{"nome": "paulo alarico"}', '2026-01-02 10:52:40.498268-03', '2026-01-02 10:52:59.029485-03', true);
INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at, ativo) VALUES ('fbee0c45-8fce-40e1-b3c1-62691ab20798', 'colaborador@sistema.com.br', '$2a$10$Bfnxkb6olr4rMJkJHoqY4On7CanidtaR2jn16jcsCN8I0cS1vyvJu', '{"nome": "Usuário Colaborador"}', '2026-01-02 08:37:49.263959-03', '2026-01-03 15:50:43.483134-03', true);
INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at, ativo) VALUES ('004af605-bf26-4caf-8167-9da640d257ce', 'testerh@sistema.com.br', '$2a$10$Wk52RTSHl5RA/MN/WEAY3.vz7JWZi4zK3.tA.9QwDiYYVIRWCBP4O', '{"nome": "Teste RH"}', '2026-01-03 16:02:21.906309-03', '2026-01-03 16:02:21.930193-03', true);


--
-- Data for Name: colaboradores_elegiveis; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.colaboradores_elegiveis (id, user_id, matricula, nome, email, departamento, salario_base, vale_alimentacao, vale_refeicao, transporte, mobilidade, ajuda_custo, cesta_beneficios_teto, pida_teto, tem_pida, ativo, created_at, updated_at) VALUES ('722729c9-1a3b-4f96-a46f-d91ddec0c420', '7134a817-c4e9-43b0-ae86-5a7231c84278', '1234', 'paulo alarico', 'paulo@teclia.com', 'Tecnologia da Informação', 1000, 1000, 1000, 0, 1000, 1000, 1000, 0, false, true, '2026-01-02 10:52:59.029485-03', '2026-01-02 10:52:59.029485-03');
INSERT INTO public.colaboradores_elegiveis (id, user_id, matricula, nome, email, departamento, salario_base, vale_alimentacao, vale_refeicao, transporte, mobilidade, ajuda_custo, cesta_beneficios_teto, pida_teto, tem_pida, ativo, created_at, updated_at) VALUES ('5d7f91a7-e1d6-492b-82a1-3c9cb4cb8960', '004af605-bf26-4caf-8167-9da640d257ce', '55555', 'Teste RH', 'testerh@sistema.com.br', 'Recursos Humanos', 0, 0, 0, 0, 0, 0, 0, 0, false, true, '2026-01-03 15:49:53.298405-03', '2026-01-03 16:02:21.930193-03');
INSERT INTO public.colaboradores_elegiveis (id, user_id, matricula, nome, email, departamento, salario_base, vale_alimentacao, vale_refeicao, transporte, mobilidade, ajuda_custo, cesta_beneficios_teto, pida_teto, tem_pida, ativo, created_at, updated_at) VALUES ('d8a25d35-36ab-4726-b8df-18e835eb82ed', NULL, 'AUTO-001', 'Teste Editado', 'teste.auto@sistema.com.br', 'Tecnologia da Informação', 0, 0, 0, 0, 0, 0, 0, 0, false, true, '2026-01-04 14:24:05.711409-03', '2026-01-04 14:25:42.863319-03');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.profiles (id, nome, email, avatar_url, created_at, updated_at) VALUES ('a97de2f6-a3e6-4926-a818-c9757a10ffb7', 'Usuário RH', 'rh@sistema.com.br', NULL, '2026-01-02 08:37:49.049913-03', '2026-01-02 08:37:49.049913-03');
INSERT INTO public.profiles (id, nome, email, avatar_url, created_at, updated_at) VALUES ('8ec139bf-9cb3-456f-a30f-7b7dfb26c8f8', 'Usuário Financeiro', 'financeiro@sistema.com.br', NULL, '2026-01-02 08:37:49.176349-03', '2026-01-02 08:37:49.176349-03');
INSERT INTO public.profiles (id, nome, email, avatar_url, created_at, updated_at) VALUES ('b1d96a6f-1120-4e6c-8a37-bc93bd74ac23', 'teste', 'teste@teste.com.br', NULL, '2026-01-02 09:44:56.522805-03', '2026-01-02 09:44:56.522805-03');
INSERT INTO public.profiles (id, nome, email, avatar_url, created_at, updated_at) VALUES ('7134a817-c4e9-43b0-ae86-5a7231c84278', 'paulo alarico', 'paulo@teclia.com', NULL, '2026-01-02 10:52:40.498268-03', '2026-01-02 10:52:59.029485-03');
INSERT INTO public.profiles (id, nome, email, avatar_url, created_at, updated_at) VALUES ('fbee0c45-8fce-40e1-b3c1-62691ab20798', 'colaborador editado', 'colaborador@sistema.com.br', NULL, '2026-01-02 08:37:49.263959-03', '2026-01-03 15:50:43.483134-03');
INSERT INTO public.profiles (id, nome, email, avatar_url, created_at, updated_at) VALUES ('004af605-bf26-4caf-8167-9da640d257ce', 'Teste RH', 'testerh@sistema.com.br', NULL, '2026-01-03 16:02:21.906309-03', '2026-01-03 16:02:21.930193-03');


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('89a06901-1c3d-4bdd-b787-4d4ce4b5e014', 'a97de2f6-a3e6-4926-a818-c9757a10ffb7', 'RH', '2026-01-02 08:37:49.049913-03');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('331f74f5-a908-4dd4-8de8-8fbee920d49b', '8ec139bf-9cb3-456f-a30f-7b7dfb26c8f8', 'FINANCEIRO', '2026-01-02 08:37:49.176349-03');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('a96db039-6d27-4260-b9b1-480af797b367', 'fbee0c45-8fce-40e1-b3c1-62691ab20798', 'COLABORADOR', '2026-01-02 08:37:49.263959-03');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('b937cb25-6f84-4f5e-b198-9d8667b625df', 'b1d96a6f-1120-4e6c-8a37-bc93bd74ac23', 'RH', '2026-01-02 09:44:56.522805-03');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('98f11c52-536b-4204-8170-d90ee5148801', '7134a817-c4e9-43b0-ae86-5a7231c84278', 'COLABORADOR', '2026-01-02 10:53:58.537444-03');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('4aecd26c-9f2d-45cf-90e4-c130311152db', '004af605-bf26-4caf-8167-9da640d257ce', 'COLABORADOR', '2026-01-03 16:02:21.906309-03');


--
-- PostgreSQL database dump complete
--

\unrestrict 7FGc1SLAdRH9VjcyrcTVbTrVzZceYEzc2WZQgGcIU5uBPCEctas4i3SzbF3lSPR

