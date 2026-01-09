-- Criar tabela audit_logs se não existir
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('aprovar', 'rejeitar', 'criar', 'atualizar', 'excluir', 'iniciar_analise')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('lancamento', 'colaborador', 'tipo_despesa', 'periodo', 'evento_folha')),
    entity_id UUID NOT NULL,
    entity_description TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Comentários
COMMENT ON TABLE public.audit_logs IS 'Registro de auditoria de todas as ações realizadas no sistema';
COMMENT ON COLUMN public.audit_logs.action IS 'Tipo de ação realizada (aprovar, rejeitar, criar, atualizar, excluir, iniciar_analise)';
COMMENT ON COLUMN public.audit_logs.entity_type IS 'Tipo de entidade afetada (lancamento, colaborador, tipo_despesa, periodo, evento_folha)';
COMMENT ON COLUMN public.audit_logs.old_values IS 'Valores anteriores da entidade (JSON)';
COMMENT ON COLUMN public.audit_logs.new_values IS 'Valores novos da entidade (JSON)';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Metadados adicionais da ação (JSON)';
