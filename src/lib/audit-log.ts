import apiClient from '@/lib/api-client';

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
  try {
    await apiClient.post('/api/audit-logs', {
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
  } catch (error) {
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
  const params = new URLSearchParams();
  
  if (options?.entityType) {
    params.append('entityType', options.entityType);
  }
  if (options?.entityId) {
    params.append('entityId', options.entityId);
  }
  if (options?.userId) {
    params.append('userId', options.userId);
  }
  if (options?.startDate) {
    params.append('startDate', options.startDate.toISOString());
  }
  if (options?.endDate) {
    params.append('endDate', options.endDate.toISOString());
  }
  if (options?.limit) {
    params.append('limit', String(options.limit));
  }

  const query = params.toString();
  return apiClient.get(`/api/audit-logs${query ? `?${query}` : ''}`);
}