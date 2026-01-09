-- =====================================================
-- MIGRATION: Adicionar perfil ADMINISTRADOR
-- Data: 2026-01-09
-- =====================================================

-- Adicionar ADMINISTRADOR ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ADMINISTRADOR';

-- Atualizar políticas de Auditoria para incluir ADMINISTRADOR
DROP POLICY IF EXISTS "RH e Financeiro podem ver audit logs" ON public.audit_logs;
CREATE POLICY "Administrador pode ver audit logs" 
    ON public.audit_logs FOR SELECT 
    USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

DROP POLICY IF EXISTS "Sistema pode inserir audit logs" ON public.audit_logs;
CREATE POLICY "Sistema pode inserir audit logs" 
    ON public.audit_logs FOR INSERT 
    WITH CHECK (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO') OR public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- Atualizar políticas de Departamentos para incluir ADMINISTRADOR
DROP POLICY IF EXISTS "RH pode gerenciar departamentos" ON public.departamentos;
CREATE POLICY "Administrador pode gerenciar departamentos" 
    ON public.departamentos FOR ALL 
    USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- Atualizar políticas de Grupos de Despesa para incluir ADMINISTRADOR
DROP POLICY IF EXISTS "RH pode gerenciar grupos despesa" ON public.grupos_despesa;
CREATE POLICY "Administrador pode gerenciar grupos despesa" 
    ON public.grupos_despesa FOR ALL 
    USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- Comentários
COMMENT ON TYPE public.app_role IS 'Perfis de usuário: FINANCEIRO, COLABORADOR, RH, ADMINISTRADOR';
