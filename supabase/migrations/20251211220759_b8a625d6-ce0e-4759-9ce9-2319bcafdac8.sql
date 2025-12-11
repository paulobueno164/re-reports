-- Create audit log table for tracking validation actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'aprovar', 'rejeitar', 'criar', 'atualizar'
  entity_type TEXT NOT NULL, -- 'lancamento', 'colaborador', 'tipo_despesa', etc.
  entity_id UUID NOT NULL,
  entity_description TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RH and FINANCEIRO can view all audit logs
CREATE POLICY "RH e Financeiro podem ver audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'RH') OR has_role(auth.uid(), 'FINANCEIRO'));

-- Only RH can insert audit logs (through application)
CREATE POLICY "Sistema pode inserir audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'RH') OR has_role(auth.uid(), 'FINANCEIRO'));

-- Create index for faster queries
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);