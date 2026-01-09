import apiClient from '@/lib/api-client';

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

export interface FinanceiroDashboardMetrics extends DashboardMetrics {
  fechamentos_pendentes: number;
  ultimo_fechamento?: {
    periodo: string;
    data: string;
    valor: number;
  };
  exportacoes_recentes: number;
}

export const dashboardService = {
  async getRHMetrics(periodoId?: string, departamento?: string): Promise<DashboardMetrics> {
    const params = new URLSearchParams();
    if (periodoId) params.append('periodo_id', periodoId);
    if (departamento) params.append('departamento', departamento);
    const query = params.toString();
    return apiClient.get<DashboardMetrics>(`/api/dashboard/rh${query ? `?${query}` : ''}`);
  },

  async getFinanceiroMetrics(periodoId?: string): Promise<FinanceiroDashboardMetrics> {
    const params = periodoId ? `?periodo_id=${periodoId}` : '';
    return apiClient.get<FinanceiroDashboardMetrics>(`/api/dashboard/financeiro${params}`);
  },

  async getColaboradorMetrics(periodoId?: string): Promise<ColaboradorDashboardMetrics> {
    const params = periodoId ? `?periodo_id=${periodoId}` : '';
    return apiClient.get<ColaboradorDashboardMetrics>(`/api/dashboard/colaborador${params}`);
  },
};

export default dashboardService;
