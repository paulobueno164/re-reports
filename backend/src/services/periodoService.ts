import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { CalendarioPeriodo, PeriodStatus } from '../types';

export interface CreatePeriodoInput {
  periodo: string;
  data_inicio: string;
  data_final: string;
  abre_lancamento: string;
  fecha_lancamento: string;
  status?: PeriodStatus;
}

export interface UpdatePeriodoInput extends Partial<CreatePeriodoInput> { }

export const getAllPeriodos = async (
  filters?: { status?: PeriodStatus }
): Promise<CalendarioPeriodo[]> => {
  // Atualizar status dos períodos baseado na data atual
  const today = new Date().toISOString().split('T')[0];
  try {
    await query(
      `UPDATE calendario_periodos 
       SET status = CASE 
         WHEN data_inicio <= $1::date AND data_final >= $1::date THEN 'aberto'::public.period_status
         ELSE 'fechado'::public.period_status
       END`,
      [today]
    );
  } catch (error) {
    // Se falhar a atualização, continuar mesmo assim (não é crítico)
    console.error('Erro ao atualizar status dos períodos:', error);
  }

  let sql = 'SELECT * FROM calendario_periodos WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  sql += ' ORDER BY data_inicio DESC';

  const result = await query(sql, params);
  return result.rows;
};

export const getPeriodoById = async (id: string): Promise<CalendarioPeriodo | null> => {
  const result = await query(
    'SELECT * FROM calendario_periodos WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

export const getCurrentPeriodo = async (): Promise<CalendarioPeriodo | null> => {
  const today = new Date().toISOString().split('T')[0];

  const result = await query(
    `SELECT * FROM calendario_periodos 
     WHERE data_inicio <= $1 AND data_final >= $1 AND status = 'aberto'
     ORDER BY data_inicio DESC
     LIMIT 1`,
    [today]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Se não encontrar período atual, retorna o mais recente
  const fallback = await query(
    `SELECT * FROM calendario_periodos 
     ORDER BY data_inicio DESC
     LIMIT 1`
  );

  return fallback.rows[0] || null;
};

export const getOpenPeriodoForSubmission = async (): Promise<CalendarioPeriodo | null> => {
  const today = new Date().toISOString().split('T')[0];

  const result = await query(
    `SELECT * FROM calendario_periodos 
     WHERE abre_lancamento <= $1 AND fecha_lancamento >= $1 AND status = 'aberto'
     ORDER BY data_inicio DESC
     LIMIT 1`,
    [today]
  );

  return result.rows[0] || null;
};

import * as auditService from './auditService';

export const createPeriodo = async (
  input: CreatePeriodoInput,
  executorId: string,
  executorName: string
): Promise<CalendarioPeriodo> => {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO calendario_periodos (
      id, periodo, data_inicio, data_final, abre_lancamento, fecha_lancamento, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
    [
      id,
      input.periodo,
      input.data_inicio,
      input.data_final,
      input.abre_lancamento,
      input.fecha_lancamento,
      input.status || 'aberto',
    ]
  );

  const novoPeriodo = result.rows[0];

  // Audit Log
  await auditService.createAuditLog({
    userId: executorId,
    userName: executorName,
    action: 'criar',
    entityType: 'periodo',
    entityId: novoPeriodo.id,
    entityDescription: `Criação do período ${novoPeriodo.periodo}`,
    newValues: novoPeriodo,
  });

  return novoPeriodo;
};

export const updatePeriodo = async (
  id: string,
  input: UpdatePeriodoInput,
  executorId: string,
  executorName: string
): Promise<CalendarioPeriodo | null> => {
  // Obter valores antigos para log
  const oldValues = await getPeriodoById(id);

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  });

  if (fields.length === 0) {
    return getPeriodoById(id);
  }

  values.push(id);

  const result = await query(
    `UPDATE calendario_periodos SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  const updatedPeriodo = result.rows[0] || null;

  if (updatedPeriodo) {
    // Audit Log
    await auditService.createAuditLog({
      userId: executorId,
      userName: executorName,
      action: 'atualizar',
      entityType: 'periodo',
      entityId: id,
      entityDescription: `Atualização do período ${updatedPeriodo.periodo}`,
      oldValues: oldValues || undefined,
      newValues: updatedPeriodo,
    });
  }

  return updatedPeriodo;
};

export const deletePeriodo = async (
  id: string,
  executorId: string,
  executorName: string
): Promise<boolean> => {
  const periodo = await getPeriodoById(id);

  const result = await query(
    'DELETE FROM calendario_periodos WHERE id = $1',
    [id]
  );

  if ((result.rowCount ?? 0) > 0) {
    // Audit Log
    await auditService.createAuditLog({
      userId: executorId,
      userName: executorName,
      action: 'excluir',
      entityType: 'periodo',
      entityId: id,
      entityDescription: `Exclusão do período ${periodo?.periodo || id}`,
      oldValues: periodo || undefined,
    });
    return true;
  }
  return false;
};
