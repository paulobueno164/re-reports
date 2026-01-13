import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { AuditLog } from '../types';

export interface CreateAuditLogInput {
  userId: string;
  userName: string;
  action: 'aprovar' | 'rejeitar' | 'criar' | 'atualizar' | 'excluir' | 'iniciar_analise' | 'processar';
  entityType: 'lancamento' | 'colaborador' | 'tipo_despesa' | 'periodo' | 'evento_folha' | 'departamento' | 'grupo_despesa' | 'fechamento';
  entityId: string;
  entityDescription?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

export const createAuditLog = async (input: CreateAuditLogInput): Promise<AuditLog> => {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO audit_logs (
      id, user_id, user_name, action, entity_type, entity_id,
      entity_description, old_values, new_values, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
    [
      id,
      input.userId,
      input.userName,
      input.action,
      input.entityType,
      input.entityId,
      input.entityDescription || null,
      input.oldValues ? JSON.stringify(input.oldValues) : null,
      input.newValues ? JSON.stringify(input.newValues) : null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );

  return result.rows[0];
};

export interface GetAuditLogsOptions {
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export const getAuditLogs = async (options?: GetAuditLogsOptions): Promise<AuditLog[]> => {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (options?.entityType) {
    sql += ` AND entity_type = $${paramIndex}`;
    params.push(options.entityType);
    paramIndex++;
  }

  if (options?.entityId) {
    sql += ` AND entity_id = $${paramIndex}`;
    params.push(options.entityId);
    paramIndex++;
  }

  if (options?.userId) {
    sql += ` AND user_id = $${paramIndex}`;
    params.push(options.userId);
    paramIndex++;
  }

  if (options?.startDate) {
    sql += ` AND created_at >= $${paramIndex}`;
    params.push(options.startDate.toISOString());
    paramIndex++;
  }

  if (options?.endDate) {
    sql += ` AND created_at <= $${paramIndex}`;
    params.push(options.endDate.toISOString());
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
    paramIndex++;
  }

  const result = await query(sql, params);
  return result.rows;
};

export const getAuditLogsByEntity = async (
  entityType: string,
  entityId: string
): Promise<AuditLog[]> => {
  return getAuditLogs({ entityType, entityId });
};
