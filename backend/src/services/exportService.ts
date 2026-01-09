import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';

export interface ExportacaoRecord {
  id: string;
  periodo_id: string;
  fechamento_id: string | null;
  usuario_id: string;
  nome_arquivo: string;
  qtd_registros: number;
  data_exportacao: string;
  created_at: string;
}

export interface ExportDataRow {
  matricula: string;
  nome: string;
  departamento: string;
  codigo_evento: string;
  descricao_evento: string;
  valor: number;
  periodo: string;
}

export const getExportData = async (
  periodoId: string,
  fechamentoId?: string
): Promise<ExportDataRow[]> => {
  // Buscar eventos de folha cadastrados por componente
  const eventosResult = await query(
    'SELECT componente, codigo_evento, descricao_evento FROM tipos_despesas_eventos'
  );
  
  const eventosMap = new Map<string, { codigo: string; descricao: string }>();
  for (const e of eventosResult.rows) {
    eventosMap.set(e.componente, { codigo: e.codigo_evento, descricao: e.descricao_evento });
  }

  // Buscar lançamentos válidos (todos vão para Cesta de Benefícios)
  const cestaEvento = eventosMap.get('cesta_beneficios') || { codigo: 'CESTA', descricao: 'Cesta de Benefícios' };
  
  const lancamentosResult = await query(
    `SELECT 
      c.matricula,
      c.nome,
      c.departamento,
      l.valor_considerado as valor,
      cp.periodo
    FROM lancamentos l
    JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id
    JOIN calendario_periodos cp ON cp.id = l.periodo_id
    WHERE l.periodo_id = $1 AND l.status = 'valido'
    ORDER BY c.nome`,
    [periodoId]
  );

  // Map lancamentos to export format with cesta evento
  const lancamentosData = lancamentosResult.rows.map(row => ({
    matricula: row.matricula,
    nome: row.nome,
    departamento: row.departamento,
    codigo_evento: cestaEvento.codigo,
    descricao_evento: cestaEvento.descricao,
    valor: parseFloat(row.valor),
    periodo: row.periodo,
  }));

  // Buscar eventos PIDA
  const pidaEvento = eventosMap.get('pida') || { codigo: 'PIDA', descricao: 'Propriedade Intelectual / Direitos Autorais' };
  
  const pidaResult = await query(
    `SELECT 
      c.matricula,
      c.nome,
      c.departamento,
      ep.valor_total_pida as valor,
      cp.periodo
    FROM eventos_pida ep
    JOIN colaboradores_elegiveis c ON c.id = ep.colaborador_id
    JOIN calendario_periodos cp ON cp.id = ep.periodo_id
    WHERE ep.periodo_id = $1
    ORDER BY c.nome`,
    [periodoId]
  );

  const pidaData = pidaResult.rows.map(row => ({
    matricula: row.matricula,
    nome: row.nome,
    departamento: row.departamento,
    codigo_evento: pidaEvento.codigo,
    descricao_evento: pidaEvento.descricao,
    valor: parseFloat(row.valor),
    periodo: row.periodo,
  }));

  // Combinar e agrupar por colaborador + evento
  const allData = [...lancamentosData, ...pidaData];

  // Agrupar por matricula + codigo_evento
  const grouped = new Map<string, ExportDataRow>();

  for (const row of allData) {
    const key = `${row.matricula}-${row.codigo_evento}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.valor += row.valor;
    } else {
      grouped.set(key, { ...row });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.nome !== b.nome) return a.nome.localeCompare(b.nome);
    return a.codigo_evento.localeCompare(b.codigo_evento);
  });
};

export const createExportacao = async (
  periodoId: string,
  usuarioId: string,
  nomeArquivo: string,
  qtdRegistros: number,
  fechamentoId?: string
): Promise<ExportacaoRecord> => {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO exportacoes (
      id, periodo_id, fechamento_id, usuario_id, nome_arquivo, qtd_registros, data_exportacao, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
    [id, periodoId, fechamentoId || null, usuarioId, nomeArquivo, qtdRegistros]
  );

  return result.rows[0];
};

export const getExportacoes = async (periodoId?: string): Promise<ExportacaoRecord[]> => {
  let sql = `
    SELECT e.*, cp.periodo as periodo_nome
    FROM exportacoes e
    JOIN calendario_periodos cp ON cp.id = e.periodo_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (periodoId) {
    sql += ' AND e.periodo_id = $1';
    params.push(periodoId);
  }

  sql += ' ORDER BY e.data_exportacao DESC';

  const result = await query(sql, params);
  return result.rows;
};

export const getExportacaoById = async (id: string): Promise<ExportacaoRecord | null> => {
  const result = await query(
    `SELECT e.*, cp.periodo as periodo_nome
     FROM exportacoes e
     JOIN calendario_periodos cp ON cp.id = e.periodo_id
     WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};
