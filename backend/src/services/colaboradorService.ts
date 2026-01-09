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
  ferias_inicio?: string | null;
  ferias_fim?: string | null;
  beneficio_proporcional?: boolean;
  ativo?: boolean;
  user_id?: string;
}

export interface UpdateColaboradorInput extends Partial<CreateColaboradorInput> { }

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

import * as auditService from './auditService';

// ... (imports)

export const createColaborador = async (
  input: CreateColaboradorInput,
  executorId: string,
  executorName: string
): Promise<ColaboradorElegivel> => {
  const id = uuidv4();

  return await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO colaboradores_elegiveis (
        id, nome, email, matricula, departamento,
        salario_base, vale_alimentacao, vale_refeicao, ajuda_custo,
        mobilidade, transporte, cesta_beneficios_teto, pida_teto,
        tem_pida, ferias_inicio, ferias_fim, beneficio_proporcional,
        ativo, user_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
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
        (input.ferias_inicio && input.ferias_inicio !== '') ? input.ferias_inicio : null,
        (input.ferias_fim && input.ferias_fim !== '') ? input.ferias_fim : null,
        input.beneficio_proporcional || false,
        input.ativo ?? true,
        input.user_id || null,
      ]
    );

    const colaborador = result.rows[0];

    // Se o colaborador foi criado com um user_id vinculado, sincronizar dados para o perfil do usuário
    if (colaborador.user_id) {
      await client.query(
        'UPDATE profiles SET nome = $1, email = $2, updated_at = NOW() WHERE id = $3',
        [colaborador.nome, colaborador.email.toLowerCase(), colaborador.user_id]
      );

      await client.query(
        'UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2',
        [colaborador.email.toLowerCase(), colaborador.user_id]
      );
    }

    // Audit Log
    await auditService.createAuditLog({
      userId: executorId,
      userName: executorName,
      action: 'criar',
      entityType: 'colaborador',
      entityId: colaborador.id,
      entityDescription: `Criação do colaborador ${colaborador.nome} (${colaborador.matricula})`,
      newValues: colaborador,
    });

    return colaborador;
  });
};

export const updateColaborador = async (
  id: string,
  input: UpdateColaboradorInput,
  executorId: string,
  executorName: string
): Promise<ColaboradorElegivel | null> => {
  return await transaction(async (client) => {
    // Buscar colaborador atual para verificar se tinha user_id antes e para logs
    const currentColab = await client.query(
      'SELECT * FROM colaboradores_elegiveis WHERE id = $1',
      [id]
    );
    const oldValues = currentColab.rows[0];
    const hadUserIdBefore = oldValues?.user_id;

    // Lista de campos válidos que podem ser atualizados na tabela
    const validFields = [
      'nome',
      'email',
      'matricula',
      'departamento',
      'salario_base',
      'vale_alimentacao',
      'vale_refeicao',
      'ajuda_custo',
      'mobilidade',
      'transporte',
      'cesta_beneficios_teto',
      'pida_teto',
      'tem_pida',
      'ferias_inicio',
      'ferias_fim',
      'beneficio_proporcional',
      'ativo',
      'user_id'
    ];

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const inputKeys = Object.keys(input) as Array<keyof UpdateColaboradorInput>;

    inputKeys.forEach((key) => {
      const value = input[key];
      // Apenas processar campos válidos que existem na tabela
      if (value !== undefined && validFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        // Tratamento especial para campos de data (converter string vazia para null)
        if ((key === 'ferias_inicio' || key === 'ferias_fim') && (value === '' || value === null)) {
          values.push(null);
        } else if (key === 'email' && typeof value === 'string') {
          values.push(value.toLowerCase());
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return getColaboradorById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE colaboradores_elegiveis SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updatedColaborador = result.rows[0] || null;

    // Se o colaborador tem um user_id vinculado, sincronizar dados para o perfil do usuário
    if (updatedColaborador?.user_id) {
      // Verificar se o user_id foi recém-vinculado ou se nome/email foram atualizados
      const user_idWasJustLinked = input.user_id !== undefined && !hadUserIdBefore;
      const nomeWasUpdated = input.nome !== undefined;
      const emailWasUpdated = input.email !== undefined;

      // Se user_id foi recém-vinculado ou nome/email foram atualizados, sincronizar
      if (user_idWasJustLinked || nomeWasUpdated || emailWasUpdated) {
        // Sempre sincronizar com os dados atuais do colaborador
        await client.query(
          'UPDATE profiles SET nome = $1, email = $2, updated_at = NOW() WHERE id = $3',
          [updatedColaborador.nome, updatedColaborador.email.toLowerCase(), updatedColaborador.user_id]
        );

        // Atualizar email em auth.users também
        await client.query(
          'UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2',
          [updatedColaborador.email.toLowerCase(), updatedColaborador.user_id]
        );
      }
    }

    // Audit Log
    if (updatedColaborador) {
      await auditService.createAuditLog({
        userId: executorId,
        userName: executorName,
        action: 'atualizar',
        entityType: 'colaborador',
        entityId: id,
        entityDescription: `Atualização do colaborador ${updatedColaborador.nome}`,
        oldValues: oldValues,
        newValues: updatedColaborador,
      });
    }

    return updatedColaborador;
  });
};

export const deleteColaborador = async (
  id: string,
  executorId: string,
  executorName: string
): Promise<boolean> => {
  const colab = await getColaboradorById(id);

  try {
    // Tentar deletar diretamente primeiro
    const result = await query(
      'DELETE FROM colaboradores_elegiveis WHERE id = $1',
      [id]
    );

    if ((result.rowCount ?? 0) > 0) {
      // Audit Log
      await auditService.createAuditLog({
        userId: executorId,
        userName: executorName,
        action: 'excluir',
        entityType: 'colaborador',
        entityId: id,
        entityDescription: `Exclusão do colaborador ${colab?.nome || id}`,
        oldValues: colab || undefined,
      });
      return true;
    }
    return false;
  } catch (error: any) {
    // Se falhar por constraint (tem lançamentos, etc), marcar como inativo instead
    if (error.code === '23503' || error.message?.includes('foreign key') || error.message?.includes('still referenced')) {
      const updateResult = await query(
        'UPDATE colaboradores_elegiveis SET ativo = false, updated_at = NOW() WHERE id = $1',
        [id]
      );
      if ((updateResult.rowCount ?? 0) > 0) {
        // Audit Log para inativação forçada
        await auditService.createAuditLog({
          userId: executorId,
          userName: executorName,
          action: 'atualizar',
          entityType: 'colaborador',
          entityId: id,
          entityDescription: `Colaborador ${colab?.nome || id} marcado como inativo ao tentar excluir (possui vínculos)`,
          oldValues: colab || undefined,
          newValues: { ativo: false },
        });

        throw new Error('Não foi possível excluir o colaborador pois ele possui registros vinculados (lançamentos, etc). O colaborador foi marcado como inativo.');
      }
    }
    // Se for outro erro, relançar
    throw error;
  }
};

export const linkColaboradorToUser = async (colaboradorId: string, userId: string): Promise<void> => {
  await transaction(async (client) => {
    // Buscar dados do colaborador
    const colaboradorResult = await client.query(
      'SELECT nome, email FROM colaboradores_elegiveis WHERE id = $1',
      [colaboradorId]
    );

    if (colaboradorResult.rows.length === 0) {
      throw new Error('Colaborador não encontrado');
    }

    const colaborador = colaboradorResult.rows[0];

    // Vincular colaborador ao usuário
    await client.query(
      'UPDATE colaboradores_elegiveis SET user_id = $1, updated_at = NOW() WHERE id = $2',
      [userId, colaboradorId]
    );

    // Sincronizar dados do colaborador para o perfil do usuário
    await client.query(
      'UPDATE profiles SET nome = $1, email = $2, updated_at = NOW() WHERE id = $3',
      [colaborador.nome, colaborador.email.toLowerCase(), userId]
    );

    // Atualizar email em auth.users também
    await client.query(
      'UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2',
      [colaborador.email.toLowerCase(), userId]
    );
  });
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
