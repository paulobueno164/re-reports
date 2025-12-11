import { supabase } from '@/integrations/supabase/client';

interface AuditLogEntry {
  userId: string;
  userName: string;
  action: 'aprovar' | 'rejeitar' | 'criar' | 'atualizar' | 'excluir' | 'iniciar_analise';
  entityType: 'lancamento' | 'colaborador' | 'tipo_despesa' | 'periodo' | 'evento_folha';
  entityId: string;
  entityDescription?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: entry.userId,
    user_name: entry.userName,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    entity_description: entry.entityDescription,
    old_values: entry.oldValues,
    new_values: entry.newValues,
    metadata: entry.metadata,
  });

  if (error) {
    console.error('Failed to create audit log:', error);
  }
}

export async function getAuditLogs(options?: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType);
  }
  if (options?.entityId) {
    query = query.eq('entity_id', options.entityId);
  }
  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }
  if (options?.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }
  if (options?.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return query;
}
