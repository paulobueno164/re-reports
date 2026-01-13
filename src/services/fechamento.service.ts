import apiClient from '@/lib/api-client';

export interface Fechamento {
  id: string;
  periodo_id: string;
  usuario_id: string;
  usuario_nome?: string;
  data_processamento: string;
  status: string;
  detalhes_erro: string | null;
  total_colaboradores: number;
  total_eventos: number;
  valor_total: number;
  created_at: string;
  periodo?: {
    id: string;
    periodo: string;
  };
}

export interface EventoPida {
  id: string;
  colaborador_id: string;
  periodo_id: string;
  fechamento_id: string;
  valor_base_pida: number;
  valor_diferenca_cesta: number;
  valor_total_pida: number;
  created_at: string;
  colaborador_nome?: string;
  matricula?: string;
}

export interface ProcessarFechamentoResult {
  fechamento: Fechamento;
  eventos_pida: EventoPida[];
  resumo: {
    total_colaboradores: number;
    total_eventos: number;
    valor_total: number;
    valor_pida: number;
  };
}

export interface ResumoFechamento {
  por_status: Array<{
    status: string;
    count: number;
    total: number;
  }>;
  pendentes: {
    enviados: number;
    em_analise: number;
  };
  total_colaboradores: number;
}

export const fechamentoService = {
  async getAll(periodoId?: string): Promise<Fechamento[]> {
    const params = periodoId ? `?periodo_id=${periodoId}` : '';
    return apiClient.get<Fechamento[]>(`/api/fechamentos${params}`);
  },

  async getById(id: string): Promise<Fechamento> {
    return apiClient.get<Fechamento>(`/api/fechamentos/${id}`);
  },

  async processar(periodoId: string): Promise<ProcessarFechamentoResult> {
    return apiClient.post<ProcessarFechamentoResult>('/api/fechamentos', { periodo_id: periodoId });
  },

  async getResumo(periodoId: string): Promise<ResumoFechamento> {
    return apiClient.get<ResumoFechamento>(`/api/fechamentos/${periodoId}/resumo`);
  },

  async getEventosPida(periodoId?: string, fechamentoId?: string): Promise<EventoPida[]> {
    const params = new URLSearchParams();
    if (periodoId) params.append('periodo_id', periodoId);
    if (fechamentoId) params.append('fechamento_id', fechamentoId);
    const query = params.toString();
    return apiClient.get<EventoPida[]>(`/api/eventos-pida${query ? `?${query}` : ''}`);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/fechamentos/${id}`);
  },
};

export default fechamentoService;
