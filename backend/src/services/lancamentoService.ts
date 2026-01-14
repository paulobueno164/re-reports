import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { Lancamento, ExpenseStatus, ExpenseOrigin, Anexo } from '../types';
import * as periodoService from './periodoService';
import * as tipoDespesaService from './tipoDespesaService';
import * as auditService from './auditService';

/**
 * Deleta parcelas automáticas de um período específico
 * Usado quando um período futuro fechado é excluído
 */
export const deletarParcelasAutomaticasDoPeriodo = async (
  periodoId: string
): Promise<number> => {
  // Buscar todas as parcelas automáticas (com lancamento_origem_id) do período
  const parcelasAutomaticas = await query(
    `SELECT id, lancamento_origem_id, parcelamento_numero_parcela
     FROM lancamentos
     WHERE periodo_id = $1
       AND lancamento_origem_id IS NOT NULL
       AND parcelamento_ativo = true`,
    [periodoId]
  );

  if (parcelasAutomaticas.rows.length === 0) {
    return 0;
  }

  // Agrupar por lançamento origem para reordenar depois
  const parcelasPorOrigem = new Map<string, any[]>();
  for (const parcela of parcelasAutomaticas.rows) {
    const origemId = parcela.lancamento_origem_id;
    if (!parcelasPorOrigem.has(origemId)) {
      parcelasPorOrigem.set(origemId, []);
    }
    parcelasPorOrigem.get(origemId)!.push(parcela);
  }

  // Deletar as parcelas
  const idsParaDeletar = parcelasAutomaticas.rows.map(p => p.id);
  await query(
    `DELETE FROM lancamentos WHERE id = ANY($1::uuid[])`,
    [idsParaDeletar]
  );

  // Reordenar parcelas para cada lançamento origem
  for (const [origemId, parcelas] of parcelasPorOrigem.entries()) {
    await reordenarParcelas(origemId);
  }

  return idsParaDeletar.length;
};

/**
 * Reordena as parcelas de um lançamento origem após exclusão de parcelas
 * Garante que os números das parcelas sejam sequenciais (1, 2, 3, ...)
 */
export const reordenarParcelas = async (lancamentoOrigemId: string): Promise<void> => {
  // Buscar todas as parcelas (incluindo a original) ordenadas por data de criação
  const todasParcelas = await query(
    `SELECT id, parcelamento_numero_parcela, created_at
     FROM lancamentos
     WHERE (lancamento_origem_id = $1 OR id = $1)
       AND parcelamento_ativo = true
     ORDER BY created_at ASC`,
    [lancamentoOrigemId]
  );

  // Reordenar: a primeira é sempre 1, as seguintes são 2, 3, 4, ...
  for (let i = 0; i < todasParcelas.rows.length; i++) {
    const parcela = todasParcelas.rows[i];
    const novoNumero = i + 1;

    // Só atualizar se o número mudou
    if (parcela.parcelamento_numero_parcela !== novoNumero) {
      await query(
        `UPDATE lancamentos
         SET parcelamento_numero_parcela = $1
         WHERE id = $2`,
        [novoNumero, parcela.id]
      );
    }
  }
};

/**
 * Verifica e cria parcelas pendentes para lançamentos com parcelamento
 * quando novos períodos são criados
 */
export const processarParcelasPendentes = async (
  novoPeriodoId: string,
  novoPeriodoDataInicio: string
): Promise<void> => {
  // Buscar lançamentos com parcelamento que têm parcelas pendentes
  // (lançamentos originais que não têm todas as parcelas criadas)
  // IMPORTANTE: Excluir lançamentos rejeitados (status = 'invalido')
  // pois se a primeira parcela foi rejeitada, não devemos criar novas parcelas
  const lancamentosComParcelamento = await query(
    `SELECT l.*, cp.data_final as periodo_data_final, cp.data_inicio as periodo_data_inicio
     FROM lancamentos l
     JOIN calendario_periodos cp ON cp.id = l.periodo_id
     WHERE l.parcelamento_ativo = true
       AND l.parcelamento_total_parcelas > 1
       AND l.lancamento_origem_id IS NULL
       AND l.status != 'invalido'
     ORDER BY l.created_at ASC`,
    []
  );

  for (const lancamentoOrigem of lancamentosComParcelamento.rows) {
    // Verificar novamente se o lançamento original não foi rejeitado (dupla verificação)
    if (lancamentoOrigem.status === 'invalido') {
      continue; // Pular este lançamento, não criar parcelas para ele
    }

    const totalParcelas = lancamentoOrigem.parcelamento_total_parcelas;
    const valorParcela = lancamentoOrigem.valor_lancado;
    const valorTotal = lancamentoOrigem.parcelamento_valor_total || (valorParcela * totalParcelas);

    // Contar quantas parcelas já foram criadas (incluindo a original)
    // IMPORTANTE: Contar apenas parcelas que não foram rejeitadas
    const parcelasExistentes = await query(
      `SELECT COUNT(*) as total
       FROM lancamentos
       WHERE (lancamento_origem_id = $1 OR id = $1)
         AND status != 'invalido'`,
      [lancamentoOrigem.id]
    );

    const parcelasCriadas = parseInt(parcelasExistentes.rows[0].total);

    // Se ainda há parcelas pendentes
    if (parcelasCriadas < totalParcelas) {
      const parcelaNumero = parcelasCriadas + 1; // Próxima parcela a ser criada
      const parcelaId = uuidv4();

      // Verificar se já existe uma parcela para este período
      const parcelaExistente = await query(
        `SELECT id FROM lancamentos
         WHERE lancamento_origem_id = $1
           AND parcelamento_numero_parcela = $2
           AND periodo_id = $3`,
        [lancamentoOrigem.id, parcelaNumero, novoPeriodoId]
      );

      // Se não existe, criar a parcela
      if (parcelaExistente.rows.length === 0) {
        await query(
          `INSERT INTO lancamentos (
            id, colaborador_id, periodo_id, tipo_despesa_id, origem,
            descricao_fato_gerador, numero_documento, valor_lancado, valor_considerado, valor_nao_considerado,
            parcelamento_ativo, parcelamento_valor_total, parcelamento_numero_parcela, parcelamento_total_parcelas, lancamento_origem_id,
            status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'enviado', NOW(), NOW())`,
          [
            parcelaId,
            lancamentoOrigem.colaborador_id,
            novoPeriodoId,
            lancamentoOrigem.tipo_despesa_id,
            lancamentoOrigem.origem,
            lancamentoOrigem.descricao_fato_gerador,
            lancamentoOrigem.numero_documento,
            valorParcela,
            valorParcela, // valor_considerado igual ao valor_lancado por padrão
            lancamentoOrigem.valor_nao_considerado || 0,
            true, // parcelamento_ativo
            valorTotal,
            parcelaNumero,
            totalParcelas,
            lancamentoOrigem.id, // lancamento_origem_id
          ]
        );

        // Copiar anexos do lançamento original para a parcela
        const anexosOrigem = await query(
          'SELECT nome_arquivo, tipo_arquivo, storage_path, tamanho FROM anexos WHERE lancamento_id = $1',
          [lancamentoOrigem.id]
        );

        for (const anexoOrigem of anexosOrigem.rows) {
          // Criar novo registro de anexo apontando para a parcela, mas usando o mesmo arquivo no storage
          await query(
            `INSERT INTO anexos (
              id, lancamento_id, nome_arquivo, tipo_arquivo, storage_path, tamanho, hash_comprovante, created_at
            ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NULL, NOW())`,
            [
              parcelaId,
              anexoOrigem.nome_arquivo,
              anexoOrigem.tipo_arquivo,
              anexoOrigem.storage_path,
              anexoOrigem.tamanho,
            ]
          );
        }

        // Criar audit log (usando UUID nulo para sistema)
        await auditService.createAuditLog({
          userId: '00000000-0000-0000-0000-000000000000',
          userName: 'Sistema',
          action: 'criar',
          entityType: 'lancamento',
          entityId: parcelaId,
          entityDescription: `Parcela ${parcelaNumero}/${totalParcelas} de ${valorParcela} (parcelamento automático ao criar período)`,
          newValues: { parcela: parcelaNumero, total: totalParcelas, origem_id: lancamentoOrigem.id },
        });
      }
    }
  }
};

/**
 * Sincroniza anexos de parcelas existentes que não têm anexos
 * Copia anexos do lançamento original para todas as parcelas que não possuem anexos
 */
export const sincronizarAnexosParcelas = async (): Promise<void> => {
  // Buscar todos os lançamentos originais com parcelamento que têm anexos
  const lancamentosOrigem = await query(
    `SELECT DISTINCT l.id, l.parcelamento_total_parcelas
     FROM lancamentos l
     WHERE l.parcelamento_ativo = true
       AND l.lancamento_origem_id IS NULL
       AND EXISTS (SELECT 1 FROM anexos a WHERE a.lancamento_id = l.id)`,
    []
  );

  for (const lancamentoOrigem of lancamentosOrigem.rows) {
    // Buscar todas as parcelas deste lançamento (incluindo a original)
    const todasParcelas = await query(
      `SELECT id FROM lancamentos
       WHERE (id = $1 OR lancamento_origem_id = $1)
         AND parcelamento_ativo = true`,
      [lancamentoOrigem.id]
    );

    // Buscar anexos do lançamento original
    const anexosOrigem = await query(
      'SELECT nome_arquivo, tipo_arquivo, storage_path, tamanho FROM anexos WHERE lancamento_id = $1',
      [lancamentoOrigem.id]
    );

    if (anexosOrigem.rows.length === 0) {
      continue; // Se não há anexos no original, não há o que copiar
    }

    // Para cada parcela, verificar se já tem anexos e copiar se não tiver
    for (const parcela of todasParcelas.rows) {
      // Verificar se a parcela já tem anexos
      const anexosParcela = await query(
        'SELECT COUNT(*) as total FROM anexos WHERE lancamento_id = $1',
        [parcela.id]
      );

      const qtdAnexosParcela = parseInt(anexosParcela.rows[0].total);

      // Se a parcela não tem anexos, copiar do original
      if (qtdAnexosParcela === 0) {
        for (const anexoOrigem of anexosOrigem.rows) {
          await query(
            `INSERT INTO anexos (
              id, lancamento_id, nome_arquivo, tipo_arquivo, storage_path, tamanho, hash_comprovante, created_at
            ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NULL, NOW())`,
            [
              parcela.id,
              anexoOrigem.nome_arquivo,
              anexoOrigem.tipo_arquivo,
              anexoOrigem.storage_path,
              anexoOrigem.tamanho,
            ]
          );
        }
      }
    }
  }
};

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
  parcelamento_ativo?: boolean;
  parcelamento_valor_total?: number | null;
  parcelamento_numero_parcela?: number | null;
  parcelamento_total_parcelas?: number | null;
  lancamento_origem_id?: string | null;
}

export interface UpdateLancamentoInput {
  tipo_despesa_id?: string;
  origem?: ExpenseOrigin;
  descricao_fato_gerador?: string;
  numero_documento?: string | null;
  valor_lancado?: number;
  valor_considerado?: number;
  valor_nao_considerado?: number;
  parcelamento_ativo?: boolean;
  parcelamento_valor_total?: number | null;
  parcelamento_numero_parcela?: number | null;
  parcelamento_total_parcelas?: number | null;
  lancamento_origem_id?: string | null;
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
      parcelamento_ativo, parcelamento_valor_total, parcelamento_numero_parcela, parcelamento_total_parcelas, lancamento_origem_id,
      status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'enviado', NOW(), NOW()) RETURNING *`,
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
      input.parcelamento_ativo || false,
      input.parcelamento_valor_total || null,
      input.parcelamento_numero_parcela || null,
      input.parcelamento_total_parcelas || null,
      input.lancamento_origem_id || null,
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

  // Se parcelamento está ativo, criar parcelas futuras automaticamente
  if (input.parcelamento_ativo && input.parcelamento_total_parcelas && input.parcelamento_total_parcelas > 1) {
    const totalParcelas = input.parcelamento_total_parcelas;
    const valorParcela = input.valor_lancado; // Já é o valor da parcela
    const valorTotal = input.parcelamento_valor_total || (valorParcela * totalParcelas);

    // Buscar próximos períodos ordenados por data_inicio
    // Buscar tanto períodos abertos quanto fechados (pois podem ser criados depois)
    const nextPeriodsResult = await query(
      `SELECT * FROM calendario_periodos 
       WHERE data_inicio > $1
       ORDER BY data_inicio ASC
       LIMIT $2`,
      [periodo.data_final, totalParcelas - 1] // -1 porque a primeira parcela já foi criada
    );

    const nextPeriods = nextPeriodsResult.rows;

    // Criar parcelas futuras
    for (let i = 0; i < Math.min(nextPeriods.length, totalParcelas - 1); i++) {
      const parcelaNumero = i + 2; // Começa na parcela 2 (a primeira já foi criada)
      const periodoFuturo = nextPeriods[i];
      const parcelaId = uuidv4();

      // Calcular valor considerado para a parcela futura (mesma lógica da primeira parcela)
      // Por enquanto, usar o mesmo valor da parcela (pode ser ajustado conforme regra de negócio)
      const valorConsideradoParcela = valorParcela;

      await query(
        `INSERT INTO lancamentos (
          id, colaborador_id, periodo_id, tipo_despesa_id, origem,
          descricao_fato_gerador, numero_documento, valor_lancado, valor_considerado, valor_nao_considerado,
          parcelamento_ativo, parcelamento_valor_total, parcelamento_numero_parcela, parcelamento_total_parcelas, lancamento_origem_id,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'enviado', NOW(), NOW())`,
        [
          parcelaId,
          input.colaborador_id,
          periodoFuturo.id,
          input.tipo_despesa_id,
          input.origem || 'proprio',
          input.descricao_fato_gerador,
          input.numero_documento || null,
          valorParcela,
          valorConsideradoParcela,
          input.valor_nao_considerado || 0,
          true, // parcelamento_ativo
          valorTotal,
          parcelaNumero,
          totalParcelas,
          id, // lancamento_origem_id aponta para o lançamento original
        ]
      );

      // Criar audit log para cada parcela
      await auditService.createAuditLog({
        userId,
        userName,
        action: 'criar',
        entityType: 'lancamento',
        entityId: parcelaId,
        entityDescription: `Parcela ${parcelaNumero}/${totalParcelas} de ${valorParcela} (parcelamento automático)`,
        newValues: { parcela: parcelaNumero, total: totalParcelas, origem_id: id },
      });
    }

  }

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

  // Identificar o lançamento original e verificar se é parcela 1
  // Se este lançamento tem lancamento_origem_id, então é uma parcela e o original é o lancamento_origem_id
  // Se não tem lancamento_origem_id, então este é o lançamento original
  const lancamentoOrigemId = existing.lancamento_origem_id || existing.id;
  const numeroParcela = existing.parcelamento_numero_parcela || 1;
  // É parcela 1 se: (não tem lancamento_origem_id E é o original) OU (tem lancamento_origem_id E numeroParcela === 1)
  const isParcela1 = existing.parcelamento_ativo && numeroParcela === 1;

  // Recusar o lançamento atual
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

  // Se for a primeira parcela (lançamento original), recusar todas as parcelas futuras também
  if (isParcela1 && existing.parcelamento_ativo) {
    // Buscar todas as parcelas futuras (com lancamento_origem_id = id do lançamento original)
    const parcelasFuturas = await query(
      `SELECT id FROM lancamentos
       WHERE lancamento_origem_id = $1
         AND status IN ('enviado', 'em_analise')`,
      [lancamentoOrigemId]
    );

    // Recusar todas as parcelas futuras
    if (parcelasFuturas.rows.length > 0) {
      const idsParcelas = parcelasFuturas.rows.map(p => p.id);
      await query(
        `UPDATE lancamentos 
         SET status = 'invalido', validado_por = $1, validado_em = NOW(), motivo_invalidacao = $2, updated_at = NOW() 
         WHERE id = ANY($3::uuid[])`,
        [userId, `Rejeitado automaticamente: primeira parcela foi rejeitada. ${motivo}`, idsParcelas]
      );

      // Criar audit log para cada parcela rejeitada
      for (const parcela of parcelasFuturas.rows) {
        await auditService.createAuditLog({
          userId,
          userName,
          action: 'rejeitar',
          entityType: 'lancamento',
          entityId: parcela.id,
          entityDescription: `Parcela rejeitada automaticamente: primeira parcela foi rejeitada`,
          oldValues: { status: 'enviado' },
          newValues: { status: 'invalido', motivo_invalidacao: `Rejeitado automaticamente: primeira parcela foi rejeitada. ${motivo}` },
        });
      }

    }
  } else if (numeroParcela > 1) {
    // Se for parcela 2 ou superior, apenas recusar esta parcela (já foi recusada acima)
  }

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
