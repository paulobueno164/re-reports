import apiClient from '@/lib/api-client';

export type PeriodStatus = 'aberto' | 'fechado';

export interface CalendarioPeriodo {
  id: string;
  periodo: string;
  data_inicio: string;
  data_final: string;
  abre_lancamento: string;
  fecha_lancamento: string;
  status: PeriodStatus;
  created_at: string;
}

export interface CreatePeriodoInput {
  periodo: string;
  data_inicio: string;
  data_final: string;
  abre_lancamento: string;
  fecha_lancamento: string;
  status?: PeriodStatus;
}

export interface UpdatePeriodoInput extends Partial<CreatePeriodoInput> {}

export interface PeriodoFilters {
  status?: PeriodStatus;
}

export const periodosService = {
  async getAll(filters?: PeriodoFilters): Promise<CalendarioPeriodo[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    
    const query = params.toString();
    return apiClient.get<CalendarioPeriodo[]>(`/api/periodos${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<CalendarioPeriodo> {
    return apiClient.get<CalendarioPeriodo>(`/api/periodos/${id}`);
  },

  async getCurrent(): Promise<CalendarioPeriodo | null> {
    try {
      return await apiClient.get<CalendarioPeriodo>('/api/periodos/current');
    } catch {
      return null;
    }
  },

  async create(data: CreatePeriodoInput): Promise<CalendarioPeriodo> {
    return apiClient.post<CalendarioPeriodo>('/api/periodos', data);
  },

  async update(id: string, data: UpdatePeriodoInput): Promise<CalendarioPeriodo> {
    return apiClient.put<CalendarioPeriodo>(`/api/periodos/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/periodos/${id}`);
  },
};

export default periodosService;
