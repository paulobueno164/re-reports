import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { ColaboradorElegivel } from '../types';

export interface CreateColaboradorInput {
  nome: string;
  email: string;
  matricula: string;
  departamento: string;
  salario_base?: number;
  vale_alimentacao?: number;
  vale_refeicao?: number;
  ajuda_custo?: number;
  mobilidade?: number;
  transporte?: number;
  cesta_beneficios_teto?: number;
  pida_teto?: number;
  tem_pida?: boolean;
  ativo?: boolean;
  user_id?: string;
}

export interface UpdateColaboradorInput extends Partial<CreateColaboradorInput> {}

export const getAllColaboradores = async (
  filters?: {
    ativo?: boolean;
    departamento?: string;
    search?: string;
  }
): Promise<ColaboradorElegivel[]> => {
  let sql = 'SELECT * FROM colaboradores_elegiveis WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.ativo !== undefined) {
    sql += ` AND ativo = $${paramIndex}`;
    params.push(filters.ativo);
    paramIndex++;
  }

  if (filters?.departamento) {
    sql += ` AND departamento = $${paramIndex}`;
    params.push(filters.departamento);
    paramIndex++;
  }

  if (filters?.search) {
    sql += ` AND (nome ILIKE $${paramIndex} OR matricula ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  sql += ' ORDER BY nome ASC';

  const result = await query(sql, params);
  return result.rows;
};

export const getColaboradorById = async (id: string): Promise<ColaboradorElegivel | null> => {
  const result = await query(
    'SELECT * FROM colaboradores_elegiveis WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

export const getColaboradorByUserId = async (userId: string): Promise<ColaboradorElegivel | null> => {
  const result = await query(
    'SELECT * FROM colaboradores_elegiveis WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
};

export const getColaboradorByEmail = async (email: string): Promise<ColaboradorElegivel | null> => {
  const result = await query(
    'SELECT * FROM colaboradores_elegiveis WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
};

export const createColaborador = async (input: CreateColaboradorInput): Promise<ColaboradorElegivel> => {
  const id = uuidv4();
  
  const result = await query(
    `INSERT INTO colaboradores_elegiveis (
      id, nome, email, matricula, departamento,
      salario_base, vale_alimentacao, vale_refeicao, ajuda_custo,
      mobilidade, transporte, cesta_beneficios_teto, pida_teto,
      tem_pida, ativo, user_id, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
    ) RETURNING *`,
    [
      id,
      input.nome,
      input.email.toLowerCase(),
      input.matricula,
      input.departamento,
      input.salario_base || 0,
      input.vale_alimentacao || 0,
      input.vale_refeicao || 0,
      input.ajuda_custo || 0,
      input.mobilidade || 0,
      input.transporte || 0,
      input.cesta_beneficios_teto || 0,
      input.pida_teto || 0,
      input.tem_pida || false,
      input.ativo ?? true,
      input.user_id || null,
    ]
  );

  return result.rows[0];
};

export const updateColaborador = async (
  id: string,
  input: UpdateColaboradorInput
): Promise<ColaboradorElegivel | null> => {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(key === 'email' ? value.toLowerCase() : value);
      paramIndex++;
    }
  });

  if (fields.length === 0) {
    return getColaboradorById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE colaboradores_elegiveis SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

export const deleteColaborador = async (id: string): Promise<boolean> => {
  const result = await query(
    'DELETE FROM colaboradores_elegiveis WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
};

export const linkColaboradorToUser = async (colaboradorId: string, userId: string): Promise<void> => {
  await query(
    'UPDATE colaboradores_elegiveis SET user_id = $1, updated_at = NOW() WHERE id = $2',
    [userId, colaboradorId]
  );
};

export const unlinkColaboradorFromUser = async (colaboradorId: string): Promise<void> => {
  await query(
    'UPDATE colaboradores_elegiveis SET user_id = NULL, updated_at = NOW() WHERE id = $1',
    [colaboradorId]
  );
};

export const getDepartamentos = async (): Promise<string[]> => {
  const result = await query(
    'SELECT DISTINCT departamento FROM colaboradores_elegiveis ORDER BY departamento'
  );
  return result.rows.map((r) => r.departamento);
};
