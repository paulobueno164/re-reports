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
  ano_ref: number;
  mes_ref: number;
}

export const getExportData = async (
  periodoId: string,
  fechamentoId?: string
): Promise<ExportDataRow[]> => {
  // Buscar período para usar no resultado (incluindo data_final para ANO REF e MES REF)
  const periodoResult = await query(
    'SELECT periodo, data_final FROM calendario_periodos WHERE id = $1',
    [periodoId]
  );
  const periodo = periodoResult.rows[0]?.periodo || '';
  const dataFinal = periodoResult.rows[0]?.data_final;
  
  // Extrair ano e mês da data_final
  // O PostgreSQL pode retornar como Date object ou string, então tratamos ambos os casos
  let anoRef = 0;
  let mesRef = 0;
  if (dataFinal) {
    let data: Date;
    
    // Se já é um objeto Date, usar diretamente; caso contrário, criar a partir da string
    if (dataFinal instanceof Date) {
      data = dataFinal;
    } else {
      // Se for string no formato YYYY-MM-DD, criar Date
      data = new Date(String(dataFinal));
    }
    
    // Extrair ano e mês do objeto Date
    anoRef = data.getFullYear();
    mesRef = data.getMonth() + 1; // getMonth() retorna 0-11, então adicionamos 1
  }

  // Mapeamento de componentes para nomes (conforme tabela de eventos folha)
  const componenteNomeMap = new Map<string, string>([
    ['vale_alimentacao', 'Vale Alimentação'],
    ['vale_refeicao', 'Vale Refeição'],
    ['ajuda_custo', 'Ajuda de Custo'],
    ['mobilidade', 'Mobilidade'],
    ['cesta_beneficios', 'Cesta de Benefícios'],
    ['pida', 'PI/DA'],
  ]);

  // Buscar eventos de folha cadastrados por componente
  const eventosResult = await query(
    'SELECT componente, codigo_evento, descricao_evento FROM tipos_despesas_eventos'
  );
  
  const eventosMap = new Map<string, { codigo: string; nome: string }>();
  for (const e of eventosResult.rows) {
    const nomeComponente = componenteNomeMap.get(e.componente) || e.componente;
    eventosMap.set(e.componente, { codigo: e.codigo_evento, nome: nomeComponente });
  }

  // Buscar todos os colaboradores ativos do período
  const colaboradoresResult = await query(
    `SELECT 
      c.id,
      c.matricula,
      c.nome,
      c.departamento,
      c.vale_alimentacao,
      c.vale_refeicao,
      c.ajuda_custo,
      c.mobilidade,
      c.tem_pida
    FROM colaboradores_elegiveis c
    WHERE c.ativo = true
    ORDER BY c.nome`,
    []
  );

  const allData: ExportDataRow[] = [];

  // Para cada colaborador, criar linhas para componentes fixos
  for (const colab of colaboradoresResult.rows) {
    // Vale Alimentação
    const valeAlimentacaoEvento = eventosMap.get('vale_alimentacao');
    const valorValeAlimentacao = Number(colab.vale_alimentacao) || 0;
    if (valeAlimentacaoEvento && valorValeAlimentacao > 0) {
      allData.push({
        matricula: colab.matricula,
        nome: colab.nome,
        departamento: colab.departamento,
        codigo_evento: valeAlimentacaoEvento.codigo,
        descricao_evento: valeAlimentacaoEvento.nome,
        valor: valorValeAlimentacao,
        periodo: periodo,
        ano_ref: anoRef,
        mes_ref: mesRef,
      });
    }

    // Vale Refeição
    const valeRefeicaoEvento = eventosMap.get('vale_refeicao');
    const valorValeRefeicao = Number(colab.vale_refeicao) || 0;
    if (valeRefeicaoEvento && valorValeRefeicao > 0) {
      allData.push({
        matricula: colab.matricula,
        nome: colab.nome,
        departamento: colab.departamento,
        codigo_evento: valeRefeicaoEvento.codigo,
        descricao_evento: valeRefeicaoEvento.nome,
        valor: valorValeRefeicao,
        periodo: periodo,
        ano_ref: anoRef,
        mes_ref: mesRef,
      });
    }

    // Ajuda de Custo
    const ajudaCustoEvento = eventosMap.get('ajuda_custo');
    const valorAjudaCusto = Number(colab.ajuda_custo) || 0;
    if (ajudaCustoEvento && valorAjudaCusto > 0) {
      allData.push({
        matricula: colab.matricula,
        nome: colab.nome,
        departamento: colab.departamento,
        codigo_evento: ajudaCustoEvento.codigo,
        descricao_evento: ajudaCustoEvento.nome,
        valor: valorAjudaCusto,
        periodo: periodo,
        ano_ref: anoRef,
        mes_ref: mesRef,
      });
    }

    // Mobilidade
    const mobilidadeEvento = eventosMap.get('mobilidade');
    const valorMobilidade = Number(colab.mobilidade) || 0;
    if (mobilidadeEvento && valorMobilidade > 0) {
      allData.push({
        matricula: colab.matricula,
        nome: colab.nome,
        departamento: colab.departamento,
        codigo_evento: mobilidadeEvento.codigo,
        descricao_evento: mobilidadeEvento.nome,
        valor: valorMobilidade,
        periodo: periodo,
        ano_ref: anoRef,
        mes_ref: mesRef,
      });
    }
  }

  // Buscar lançamentos válidos (Cesta de Benefícios - valor aprovado)
  const cestaEvento = eventosMap.get('cesta_beneficios');
  
  // Só incluir Cesta de Benefícios se o evento estiver cadastrado
  if (cestaEvento) {
    const lancamentosResult = await query(
      `SELECT 
        c.matricula,
        c.nome,
        c.departamento,
        SUM(l.valor_considerado) as valor
      FROM lancamentos l
      JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id
      WHERE l.periodo_id = $1 AND l.status = 'valido'
      GROUP BY c.id, c.matricula, c.nome, c.departamento
      ORDER BY c.nome`,
      [periodoId]
    );

    // Map lançamentos to export format with cesta evento
    for (const row of lancamentosResult.rows) {
      const valor = Number(row.valor) || 0;
      if (valor > 0) {
        allData.push({
          matricula: row.matricula,
          nome: row.nome,
          departamento: row.departamento,
          codigo_evento: cestaEvento.codigo,
          descricao_evento: cestaEvento.nome,
          valor: valor,
          periodo: periodo,
          ano_ref: anoRef,
          mes_ref: mesRef,
        });
      }
    }
  }

  // Buscar eventos PIDA (apenas colaboradores com tem_pida = true)
  const pidaEvento = eventosMap.get('pida');
  
  // Só incluir PIDA se o evento estiver cadastrado
  if (pidaEvento) {
    // Buscar colaboradores com PIDA ativo (usar pida_teto diretamente do colaborador)
    const colaboradoresComPidaResult = await query(
      `SELECT 
        c.matricula,
        c.nome,
        c.departamento,
        c.pida_teto
      FROM colaboradores_elegiveis c
      WHERE c.ativo = true AND c.tem_pida = true
      ORDER BY c.nome`,
      []
    );

    // Criar linhas para colaboradores com PIDA (usar pida_teto diretamente)
    for (const row of colaboradoresComPidaResult.rows) {
      const valor = Number(row.pida_teto) || 0;
      if (valor > 0) {
        allData.push({
          matricula: row.matricula,
          nome: row.nome,
          departamento: row.departamento,
          codigo_evento: pidaEvento.codigo,
          descricao_evento: pidaEvento.nome,
          valor: valor,
          periodo: periodo,
          ano_ref: anoRef,
          mes_ref: mesRef,
        });
      }
    }
  }

  // Ordenar por nome do colaborador e código do evento
  return allData.sort((a, b) => {
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
