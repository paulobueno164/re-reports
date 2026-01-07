import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { TipoDespesa, ExpenseClassification, ExpenseOrigin } from '../types';

export interface CreateTipoDespesaInput {
  nome: string;
  grupo: string;
  valor_padrao_teto?: number;
  classificacao?: ExpenseClassification;
  origem_permitida?: ExpenseOrigin[];
  ativo?: boolean;
}

export interface UpdateTipoDespesaInput extends Partial<CreateTipoDespesaInput> { }

// Componentes de remuneração (exceto Salário Base)
export type ComponenteRemuneracao =
  | 'vale_alimentacao'
  | 'vale_refeicao'
  | 'ajuda_custo'
  | 'mobilidade'
  | 'cesta_beneficios'
  | 'pida';

export interface EventoFolha {
  id: string;
  componente: ComponenteRemuneracao;
  codigo_evento: string;
  descricao_evento: string;
  created_at: string;
}

export const getAllTiposDespesas = async (
  filters?: { ativo?: boolean; classificacao?: ExpenseClassification }
): Promise<TipoDespesa[]> => {
  let sql = 'SELECT * FROM tipos_despesas WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.ativo !== undefined) {
    sql += ` AND ativo = $${paramIndex}`;
    params.push(filters.ativo);
    paramIndex++;
  }

  if (filters?.classificacao) {
    sql += ` AND classificacao = $${paramIndex}`;
    params.push(filters.classificacao);
    paramIndex++;
  }

  sql += ' ORDER BY grupo, nome';

  const result = await query(sql, params);

  // Normalizar origem_permitida para sempre ser array
  return result.rows.map((row: any) => {
    let origemPermitida = row.origem_permitida;

    // Se é string, tentar converter para array
    if (typeof origemPermitida === 'string') {
      // Remove chaves {proprio} -> proprio
      const cleaned = origemPermitida.replace(/^\{|\}$/g, '').trim();
      // Converte em array
      origemPermitida = cleaned ? cleaned.split(',').map((s: string) => s.trim()) : ['proprio'];
    }

    // Se não é array, usar default
    if (!Array.isArray(origemPermitida)) {
      origemPermitida = ['proprio'];
    }

    return {
      ...row,
      origem_permitida: origemPermitida,
    };
  });
};

export const getTipoDespesaById = async (id: string): Promise<TipoDespesa | null> => {
  const result = await query(
    'SELECT * FROM tipos_despesas WHERE id = $1',
    [id]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  let origemPermitida = row.origem_permitida;

  // Normalizar origem_permitida
  if (typeof origemPermitida === 'string') {
    const cleaned = origemPermitida.replace(/^\{|\}$/g, '').trim();
    origemPermitida = cleaned ? cleaned.split(',').map((s: string) => s.trim()) : ['proprio'];
  }

  if (!Array.isArray(origemPermitida)) {
    origemPermitida = ['proprio'];
  }

  return {
    ...row,
    origem_permitida: origemPermitida,
  };
};

export const createTipoDespesa = async (input: CreateTipoDespesaInput): Promise<TipoDespesa> => {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO tipos_despesas (
      id, nome, grupo, valor_padrao_teto, classificacao, origem_permitida, ativo, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
    [
      id,
      input.nome,
      input.grupo,
      input.valor_padrao_teto || 0,
      input.classificacao || 'variavel',
      input.origem_permitida || ['proprio'],
      input.ativo ?? true,
    ]
  );

  return result.rows[0];
};

export const updateTipoDespesa = async (
  id: string,
  input: UpdateTipoDespesaInput
): Promise<TipoDespesa | null> => {
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
    return getTipoDespesaById(id);
  }

  values.push(id);

  const result = await query(
    `UPDATE tipos_despesas SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

export const deleteTipoDespesa = async (id: string): Promise<boolean> => {
  const result = await query(
    'DELETE FROM tipos_despesas WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
};

// Eventos de Folha (nova estrutura por componente de remuneração)
export const getEventoByComponente = async (componente: ComponenteRemuneracao): Promise<EventoFolha | null> => {
  const result = await query(
    'SELECT * FROM tipos_despesas_eventos WHERE componente = $1',
    [componente]
  );
  return result.rows[0] || null;
};

export const getEventoById = async (id: string): Promise<EventoFolha | null> => {
  const result = await query(
    'SELECT * FROM tipos_despesas_eventos WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

export const getAllEventosFolha = async (): Promise<EventoFolha[]> => {
  const result = await query(
    'SELECT * FROM tipos_despesas_eventos ORDER BY componente'
  );
  return result.rows;
};

export const createEvento = async (
  componente: ComponenteRemuneracao,
  codigoEvento: string,
  descricaoEvento: string
): Promise<EventoFolha> => {
  const result = await query(
    `INSERT INTO tipos_despesas_eventos (id, componente, codigo_evento, descricao_evento, created_at)
     VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [uuidv4(), componente, codigoEvento, descricaoEvento]
  );
  return result.rows[0];
};

export const updateEvento = async (
  id: string,
  codigoEvento: string,
  descricaoEvento: string
): Promise<EventoFolha | null> => {
  const result = await query(
    `UPDATE tipos_despesas_eventos 
     SET codigo_evento = $1, descricao_evento = $2 
     WHERE id = $3 RETURNING *`,
    [codigoEvento, descricaoEvento, id]
  );
  return result.rows[0] || null;
};

export const deleteEvento = async (id: string): Promise<boolean> => {
  const result = await query(
    'DELETE FROM tipos_despesas_eventos WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
};

// Colaborador Tipos Despesas (vinculos)
export interface ColaboradorTipoDespesa {
  id: string;
  colaborador_id: string;
  tipo_despesa_id: string;
  teto_individual: number | null;
  ativo: boolean;
  created_at: string;
}

export const getColaboradorTiposDespesas = async (
  colaboradorId: string
): Promise<(ColaboradorTipoDespesa & { tipo_despesa: TipoDespesa })[]> => {
  const result = await query(
    `SELECT ctd.*, 
            row_to_json(td) as tipo_despesa
     FROM colaborador_tipos_despesas ctd
     JOIN tipos_despesas td ON td.id = ctd.tipo_despesa_id
     WHERE ctd.colaborador_id = $1 AND ctd.ativo = true
     ORDER BY td.nome`,
    [colaboradorId]
  );
  return result.rows;
};

export const linkTipoDespesaToColaborador = async (
  colaboradorId: string,
  tipoDespesaId: string,
  tetoIndividual?: number
): Promise<ColaboradorTipoDespesa> => {
  const existing = await query(
    'SELECT * FROM colaborador_tipos_despesas WHERE colaborador_id = $1 AND tipo_despesa_id = $2',
    [colaboradorId, tipoDespesaId]
  );

  if (existing.rows.length > 0) {
    const result = await query(
      `UPDATE colaborador_tipos_despesas 
       SET ativo = true, teto_individual = $1 
       WHERE colaborador_id = $2 AND tipo_despesa_id = $3 RETURNING *`,
      [tetoIndividual || null, colaboradorId, tipoDespesaId]
    );
    return result.rows[0];
  }

  const result = await query(
    `INSERT INTO colaborador_tipos_despesas (id, colaborador_id, tipo_despesa_id, teto_individual, ativo, created_at)
     VALUES ($1, $2, $3, $4, true, NOW()) RETURNING *`,
    [uuidv4(), colaboradorId, tipoDespesaId, tetoIndividual || null]
  );
  return result.rows[0];
};

export const unlinkTipoDespesaFromColaborador = async (
  colaboradorId: string,
  tipoDespesaId: string
): Promise<void> => {
  await query(
    'UPDATE colaborador_tipos_despesas SET ativo = false WHERE colaborador_id = $1 AND tipo_despesa_id = $2',
    [colaboradorId, tipoDespesaId]
  );
};

// Atualizar tipos de despesa de um colaborador em batch
export const updateColaboradorTiposDespesas = async (
  colaboradorId: string,
  tiposDespesaIds: string[]
): Promise<void> => {
  await transaction(async (client) => {
    // Desativar todos os vínculos atuais
    await client.query(
      'UPDATE colaborador_tipos_despesas SET ativo = false WHERE colaborador_id = $1',
      [colaboradorId]
    );

    // Ativar/criar os novos vínculos
    for (const tipoDespesaId of tiposDespesaIds) {
      const existing = await client.query(
        'SELECT id FROM colaborador_tipos_despesas WHERE colaborador_id = $1 AND tipo_despesa_id = $2',
        [colaboradorId, tipoDespesaId]
      );

      if (existing.rows.length > 0) {
        await client.query(
          'UPDATE colaborador_tipos_despesas SET ativo = true WHERE colaborador_id = $1 AND tipo_despesa_id = $2',
          [colaboradorId, tipoDespesaId]
        );
      } else {
        await client.query(
          `INSERT INTO colaborador_tipos_despesas (id, colaborador_id, tipo_despesa_id, ativo, created_at)
           VALUES (gen_random_uuid(), $1, $2, true, NOW())`,
          [colaboradorId, tipoDespesaId]
        );
      }
    }
  });
};
