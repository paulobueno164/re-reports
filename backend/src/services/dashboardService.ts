import { query } from '../config/database';

export interface DashboardMetrics {
  colaboradores_elegiveis: number;
  colaboradores_ativos: number;
  total_lancamentos: number;
  lancamentos_pendentes: number;
  lancamentos_em_analise: number;
  lancamentos_validos: number;
  lancamentos_invalidos: number;
  valor_total_lancado: number;
  valor_total_considerado: number;
  utilizacao_cesta: number;
}

export const getDashboardMetrics = async (
  periodoId?: string,
  departamento?: string
): Promise<DashboardMetrics> => {
  // Colaboradores
  let colaboradoresQuery = 'SELECT COUNT(*) as total, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) as ativos FROM colaboradores_elegiveis';
  const colaboradoresParams: any[] = [];

  if (departamento) {
    colaboradoresQuery += ' WHERE departamento = $1';
    colaboradoresParams.push(departamento);
  }

  const colaboradoresResult = await query(colaboradoresQuery, colaboradoresParams);

  // Lançamentos
  let lancamentosQuery = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) as pendentes,
      SUM(CASE WHEN status = 'em_analise' THEN 1 ELSE 0 END) as em_analise,
      SUM(CASE WHEN status = 'valido' THEN 1 ELSE 0 END) as validos,
      SUM(CASE WHEN status = 'invalido' THEN 1 ELSE 0 END) as invalidos,
      COALESCE(SUM(valor_lancado), 0) as valor_lancado,
      COALESCE(SUM(valor_considerado), 0) as valor_considerado
    FROM lancamentos l
  `;
  const lancamentosParams: any[] = [];
  const conditions: string[] = [];
  let paramIndex = 1;

  if (periodoId) {
    conditions.push(`l.periodo_id = $${paramIndex}`);
    lancamentosParams.push(periodoId);
    paramIndex++;
  }

  if (departamento) {
    lancamentosQuery += ' JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id';
    conditions.push(`c.departamento = $${paramIndex}`);
    lancamentosParams.push(departamento);
    paramIndex++;
  }

  if (conditions.length > 0) {
    lancamentosQuery += ' WHERE ' + conditions.join(' AND ');
  }

  const lancamentosResult = await query(lancamentosQuery, lancamentosParams);

  // Cálculo de utilização da cesta
  let utilizacaoQuery = `
    SELECT 
      COALESCE(SUM(c.cesta_beneficios_teto), 0) as teto_total,
      COALESCE(SUM(l.valor_considerado), 0) as utilizado_total
    FROM colaboradores_elegiveis c
    LEFT JOIN lancamentos l ON l.colaborador_id = c.id AND l.status = 'valido'
    LEFT JOIN tipos_despesas td ON td.id = l.tipo_despesa_id AND td.classificacao = 'variavel'
    WHERE c.ativo = true
  `;
  const utilizacaoParams: any[] = [];

  if (periodoId) {
    utilizacaoQuery += ' AND (l.periodo_id = $1 OR l.periodo_id IS NULL)';
    utilizacaoParams.push(periodoId);
  }

  if (departamento) {
    utilizacaoQuery += ` AND c.departamento = $${utilizacaoParams.length + 1}`;
    utilizacaoParams.push(departamento);
  }

  const utilizacaoResult = await query(utilizacaoQuery, utilizacaoParams);
  const tetoTotal = parseFloat(utilizacaoResult.rows[0].teto_total) || 1;
  const utilizadoTotal = parseFloat(utilizacaoResult.rows[0].utilizado_total) || 0;
  const utilizacaoCesta = Math.min(100, (utilizadoTotal / tetoTotal) * 100);

  return {
    colaboradores_elegiveis: parseInt(colaboradoresResult.rows[0].total),
    colaboradores_ativos: parseInt(colaboradoresResult.rows[0].ativos),
    total_lancamentos: parseInt(lancamentosResult.rows[0].total),
    lancamentos_pendentes: parseInt(lancamentosResult.rows[0].pendentes),
    lancamentos_em_analise: parseInt(lancamentosResult.rows[0].em_analise),
    lancamentos_validos: parseInt(lancamentosResult.rows[0].validos),
    lancamentos_invalidos: parseInt(lancamentosResult.rows[0].invalidos),
    valor_total_lancado: parseFloat(lancamentosResult.rows[0].valor_lancado),
    valor_total_considerado: parseFloat(lancamentosResult.rows[0].valor_considerado),
    utilizacao_cesta: utilizacaoCesta,
  };
};

export interface ColaboradorDashboardMetrics {
  cesta_teto: number;
  cesta_utilizado: number;
  cesta_disponivel: number;
  total_lancamentos: number;
  lancamentos_enviados: number;
  lancamentos_em_analise: number;
  lancamentos_validos: number;
  lancamentos_invalidos: number;
  beneficios_fixos: {
    vale_alimentacao: number;
    vale_refeicao: number;
    ajuda_custo: number;
    mobilidade: number;
    transporte: number;
  };
}

export const getColaboradorDashboardMetrics = async (
  colaboradorId: string,
  periodoId?: string
): Promise<ColaboradorDashboardMetrics> => {
  // Dados do colaborador
  const colaboradorResult = await query(
    `SELECT cesta_beneficios_teto, vale_alimentacao, vale_refeicao, ajuda_custo, mobilidade, transporte
     FROM colaboradores_elegiveis WHERE id = $1`,
    [colaboradorId]
  );

  if (colaboradorResult.rows.length === 0) {
    throw new Error('Colaborador não encontrado');
  }

  const colaborador = colaboradorResult.rows[0];

  // Lançamentos
  let lancamentosQuery = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) as enviados,
      SUM(CASE WHEN status = 'em_analise' THEN 1 ELSE 0 END) as em_analise,
      SUM(CASE WHEN status = 'valido' THEN 1 ELSE 0 END) as validos,
      SUM(CASE WHEN status = 'invalido' THEN 1 ELSE 0 END) as invalidos,
      COALESCE(SUM(CASE WHEN status = 'valido' THEN valor_considerado ELSE 0 END), 0) as total_considerado
    FROM lancamentos
    WHERE colaborador_id = $1
  `;
  const params: any[] = [colaboradorId];

  if (periodoId) {
    lancamentosQuery += ' AND periodo_id = $2';
    params.push(periodoId);
  }

  const lancamentosResult = await query(lancamentosQuery, params);
  const lancs = lancamentosResult.rows[0];

  const cestaUtilizado = parseFloat(lancs.total_considerado);
  const cestaTeto = parseFloat(colaborador.cesta_beneficios_teto);

  return {
    cesta_teto: cestaTeto,
    cesta_utilizado: cestaUtilizado,
    cesta_disponivel: Math.max(0, cestaTeto - cestaUtilizado),
    total_lancamentos: parseInt(lancs.total),
    lancamentos_enviados: parseInt(lancs.enviados),
    lancamentos_em_analise: parseInt(lancs.em_analise),
    lancamentos_validos: parseInt(lancs.validos),
    lancamentos_invalidos: parseInt(lancs.invalidos),
    beneficios_fixos: {
      vale_alimentacao: parseFloat(colaborador.vale_alimentacao),
      vale_refeicao: parseFloat(colaborador.vale_refeicao),
      ajuda_custo: parseFloat(colaborador.ajuda_custo),
      mobilidade: parseFloat(colaborador.mobilidade),
      transporte: parseFloat(colaborador.transporte),
    },
  };
};

export interface FinanceiroDashboardMetrics extends DashboardMetrics {
  fechamentos_pendentes: number;
  ultimo_fechamento?: {
    periodo: string;
    data: string;
    valor: number;
  };
  exportacoes_recentes: number;
}

export const getFinanceiroDashboardMetrics = async (
  periodoId?: string
): Promise<FinanceiroDashboardMetrics> => {
  const baseMetrics = await getDashboardMetrics(periodoId);

  // Fechamentos pendentes (períodos fechados sem exportação)
  const fechamentosPendentesResult = await query(
    `SELECT COUNT(*) as count
     FROM fechamentos f
     WHERE NOT EXISTS (
       SELECT 1 FROM exportacoes e WHERE e.fechamento_id = f.id
     )`,
    []
  );

  // Último fechamento
  const ultimoFechamentoResult = await query(
    `SELECT f.*, cp.periodo
     FROM fechamentos f
     JOIN calendario_periodos cp ON cp.id = f.periodo_id
     ORDER BY f.data_processamento DESC
     LIMIT 1`,
    []
  );

  // Exportações recentes (últimos 30 dias)
  const exportacoesResult = await query(
    `SELECT COUNT(*) as count
     FROM exportacoes
     WHERE created_at > NOW() - INTERVAL '30 days'`,
    []
  );

  return {
    ...baseMetrics,
    fechamentos_pendentes: parseInt(fechamentosPendentesResult.rows[0].count),
    ultimo_fechamento: ultimoFechamentoResult.rows[0]
      ? {
          periodo: ultimoFechamentoResult.rows[0].periodo,
          data: ultimoFechamentoResult.rows[0].data_processamento,
          valor: parseFloat(ultimoFechamentoResult.rows[0].valor_total),
        }
      : undefined,
    exportacoes_recentes: parseInt(exportacoesResult.rows[0].count),
  };
};
