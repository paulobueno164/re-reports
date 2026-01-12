import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { Lancamento, ExpenseStatus, ExpenseOrigin, Anexo } from '../types';
import * as periodoService from './periodoService';
import * as tipoDespesaService from './tipoDespesaService';
import * as auditService from './auditService';

export interface CreateLancamentoInput {
  colaborador_id: string;
  periodo_id: string;
  tipo_despesa_id: string;
  origem?: ExpenseOrigin;
  descricao_fato_gerador: string;
  numero_documento?: string | null;
  valor_lancado: number;
  valor_considerado: number;
  valor_nao_considerado?: number;
}

export interface UpdateLancamentoInput {
  tipo_despesa_id?: string;
  origem?: ExpenseOrigin;
  descricao_fato_gerador?: string;
  numero_documento?: string | null;
  valor_lancado?: number;
  valor_considerado?: number;
  valor_nao_considerado?: number;
}

export interface LancamentoWithRelations extends Lancamento {
  colaborador?: {
    id: string;
    nome: string;
    matricula: string;
    departamento: string;
  };
  tipo_despesa?: {
    id: string;
    nome: string;
    grupo: string;
  };
  periodo?: {
    id: string;
    periodo: string;
  };
  anexos?: Anexo[];
}

export const getAllLancamentos = async (
  filters?: {
    colaborador_id?: string;
    periodo_id?: string;
    status?: ExpenseStatus;
    tipo_despesa_id?: string;
  }
): Promise<LancamentoWithRelations[]> => {
  let sql = `
    SELECT 
      l.*,
      json_build_object('id', c.id, 'nome', c.nome, 'matricula', c.matricula, 'departamento', c.departamento) as colaborador,
      json_build_object('id', td.id, 'nome', td.nome, 'grupo', td.grupo) as tipo_despesa,
      json_build_object('id', cp.id, 'periodo', cp.periodo) as periodo
    FROM lancamentos l
    JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id
    JOIN tipos_despesas td ON td.id = l.tipo_despesa_id
    JOIN calendario_periodos cp ON cp.id = l.periodo_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.colaborador_id) {
    sql += ` AND l.colaborador_id = $${paramIndex}`;
    params.push(filters.colaborador_id);
    paramIndex++;
  }

  if (filters?.periodo_id) {
    sql += ` AND l.periodo_id = $${paramIndex}`;
    params.push(filters.periodo_id);
    paramIndex++;
  }

  if (filters?.status) {
    sql += ` AND l.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters?.tipo_despesa_id) {
    sql += ` AND l.tipo_despesa_id = $${paramIndex}`;
    params.push(filters.tipo_despesa_id);
    paramIndex++;
  }

  sql += ' ORDER BY l.created_at DESC';

  const result = await query(sql, params);
  return result.rows;
};

export const getLancamentoById = async (id: string): Promise<LancamentoWithRelations | null> => {
  const result = await query(
    `SELECT 
      l.*,
      json_build_object('id', c.id, 'nome', c.nome, 'matricula', c.matricula, 'departamento', c.departamento) as colaborador,
      json_build_object('id', td.id, 'nome', td.nome, 'grupo', td.grupo) as tipo_despesa,
      json_build_object('id', cp.id, 'periodo', cp.periodo) as periodo
    FROM lancamentos l
    JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id
    JOIN tipos_despesas td ON td.id = l.tipo_despesa_id
    JOIN calendario_periodos cp ON cp.id = l.periodo_id
    WHERE l.id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const lancamento = result.rows[0];

  // Buscar anexos
  const anexosResult = await query(
    'SELECT * FROM anexos WHERE lancamento_id = $1 ORDER BY created_at',
    [id]
  );
  lancamento.anexos = anexosResult.rows;

  return lancamento;
};

export const createLancamento = async (
  input: CreateLancamentoInput,
  userId: string,
  userName: string
): Promise<Lancamento> => {
  // Validar período
  const periodo = await periodoService.getPeriodoById(input.periodo_id);
  if (!periodo) {
    throw new Error('Período não encontrado');
  }

  if (periodo.status !== 'aberto') {
    throw new Error('Este período está fechado para lançamentos');
  }

  const today = new Date().toISOString().split('T')[0];
  if (today < periodo.abre_lancamento) {
    throw new Error(`Período de lançamento ainda não iniciou. Abertura em: ${periodo.abre_lancamento}`);
  }

  // Se passou da data de fechamento, buscar próximo período
  let finalPeriodoId = input.periodo_id;
  if (today > periodo.fecha_lancamento) {
    const nextPeriodoResult = await query(
      `SELECT * FROM calendario_periodos 
       WHERE abre_lancamento > $1 AND status = 'aberto'
       ORDER BY abre_lancamento ASC
       LIMIT 1`,
      [periodo.fecha_lancamento]
    );

    if (nextPeriodoResult.rows.length > 0) {
      finalPeriodoId = nextPeriodoResult.rows[0].id;
    } else {
      throw new Error('Período de lançamento encerrado e não há próximo período disponível.');
    }
  }

  const id = uuidv4();

  const result = await query(
    `INSERT INTO lancamentos (
      id, colaborador_id, periodo_id, tipo_despesa_id, origem,
      descricao_fato_gerador, numero_documento, valor_lancado, valor_considerado, valor_nao_considerado,
      status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'enviado', NOW(), NOW()) RETURNING *`,
    [
      id,
      input.colaborador_id,
      finalPeriodoId,
      input.tipo_despesa_id,
      input.origem || 'proprio',
      input.descricao_fato_gerador,
      input.numero_documento || null,
      input.valor_lancado,
      input.valor_considerado,
      input.valor_nao_considerado || 0,
    ]
  );

  // Criar audit log
  await auditService.createAuditLog({
    userId,
    userName,
    action: 'criar',
    entityType: 'lancamento',
    entityId: id,
    entityDescription: `Lançamento de ${input.valor_lancado}`,
    newValues: result.rows[0],
  });

  return result.rows[0];
};

export const updateLancamento = async (
  id: string,
  input: UpdateLancamentoInput,
  userId: string,
  userName: string
): Promise<Lancamento | null> => {
  const existing = await getLancamentoById(id);
  if (!existing) {
    throw new Error('Lançamento não encontrado');
  }

  if (existing.status !== 'enviado') {
    throw new Error('Apenas lançamentos com status "enviado" podem ser editados');
  }

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
    return existing;
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE lancamentos SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  // Criar audit log
  await auditService.createAuditLog({
    userId,
    userName,
    action: 'atualizar',
    entityType: 'lancamento',
    entityId: id,
    oldValues: existing,
    newValues: result.rows[0],
  });

  return result.rows[0];
};

export const deleteLancamento = async (
  id: string,
  userId: string,
  userName: string
): Promise<boolean> => {
  const existing = await getLancamentoById(id);
  if (!existing) {
    throw new Error('Lançamento não encontrado');
  }

  if (existing.status !== 'enviado') {
    throw new Error('Apenas lançamentos com status "enviado" podem ser excluídos');
  }

  const result = await query('DELETE FROM lancamentos WHERE id = $1', [id]);

  // Criar audit log
  await auditService.createAuditLog({
    userId,
    userName,
    action: 'excluir',
    entityType: 'lancamento',
    entityId: id,
    oldValues: existing,
  });

  return (result.rowCount ?? 0) > 0;
};

export const iniciarAnalise = async (
  id: string,
  userId: string,
  userName: string
): Promise<Lancamento | null> => {
  const existing = await getLancamentoById(id);
  if (!existing) {
    throw new Error('Lançamento não encontrado');
  }

  if (existing.status !== 'enviado') {
    throw new Error('Apenas lançamentos com status "enviado" podem iniciar análise');
  }

  const result = await query(
    `UPDATE lancamentos SET status = 'em_analise', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  await auditService.createAuditLog({
    userId,
    userName,
    action: 'iniciar_analise',
    entityType: 'lancamento',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: 'em_analise' },
  });

  return result.rows[0];
};

export const aprovarLancamento = async (
  id: string,
  userId: string,
  userName: string
): Promise<Lancamento | null> => {
  const existing = await getLancamentoById(id);
  if (!existing) {
    throw new Error('Lançamento não encontrado');
  }

  if (existing.status !== 'enviado' && existing.status !== 'em_analise') {
    throw new Error('Este lançamento não pode ser aprovado');
  }

  const result = await query(
    `UPDATE lancamentos 
     SET status = 'valido', validado_por = $1, validado_em = NOW(), updated_at = NOW() 
     WHERE id = $2 RETURNING *`,
    [userId, id]
  );

  await auditService.createAuditLog({
    userId,
    userName,
    action: 'aprovar',
    entityType: 'lancamento',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: 'valido', validado_por: userId },
  });

  return result.rows[0];
};

export const rejeitarLancamento = async (
  id: string,
  motivo: string,
  userId: string,
  userName: string
): Promise<Lancamento | null> => {
  const existing = await getLancamentoById(id);
  if (!existing) {
    throw new Error('Lançamento não encontrado');
  }

  if (existing.status !== 'enviado' && existing.status !== 'em_analise') {
    throw new Error('Este lançamento não pode ser rejeitado');
  }

  const result = await query(
    `UPDATE lancamentos 
     SET status = 'invalido', validado_por = $1, validado_em = NOW(), motivo_invalidacao = $2, updated_at = NOW() 
     WHERE id = $3 RETURNING *`,
    [userId, motivo, id]
  );

  await auditService.createAuditLog({
    userId,
    userName,
    action: 'rejeitar',
    entityType: 'lancamento',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: 'invalido', motivo_invalidacao: motivo },
  });

  return result.rows[0];
};

export const aprovarEmLote = async (
  ids: string[],
  userId: string,
  userName: string
): Promise<{ aprovados: number; erros: string[] }> => {
  const erros: string[] = [];
  let aprovados = 0;

  for (const id of ids) {
    try {
      await aprovarLancamento(id, userId, userName);
      aprovados++;
    } catch (error: any) {
      erros.push(`${id}: ${error.message}`);
    }
  }

  return { aprovados, erros };
};

export const rejeitarEmLote = async (
  ids: string[],
  motivo: string,
  userId: string,
  userName: string
): Promise<{ rejeitados: number; erros: string[] }> => {
  const erros: string[] = [];
  let rejeitados = 0;

  for (const id of ids) {
    try {
      await rejeitarLancamento(id, motivo, userId, userName);
      rejeitados++;
    } catch (error: any) {
      erros.push(`${id}: ${error.message}`);
    }
  }

  return { rejeitados, erros };
};

export const getPendingLancamentos = async (
  periodoId?: string
): Promise<LancamentoWithRelations[]> => {
  return getAllLancamentos({
    periodo_id: periodoId,
    status: 'enviado',
  });
};

export const getLancamentosForValidation = async (
  periodoId?: string
): Promise<LancamentoWithRelations[]> => {
  let sql = `
    SELECT 
      l.*,
      json_build_object('id', c.id, 'nome', c.nome, 'matricula', c.matricula, 'departamento', c.departamento) as colaborador,
      json_build_object('id', td.id, 'nome', td.nome, 'grupo', td.grupo) as tipo_despesa,
      json_build_object('id', cp.id, 'periodo', cp.periodo) as periodo
    FROM lancamentos l
    JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id
    JOIN tipos_despesas td ON td.id = l.tipo_despesa_id
    JOIN calendario_periodos cp ON cp.id = l.periodo_id
    WHERE l.status IN ('enviado', 'em_analise')
  `;
  const params: any[] = [];

  if (periodoId) {
    sql += ` AND l.periodo_id = $1`;
    params.push(periodoId);
  }

  sql += ' ORDER BY l.created_at ASC';

  const result = await query(sql, params);
  return result.rows;
};
