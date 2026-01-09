import apiClient from '@/lib/api-client';

export type ExpenseClassification = 'fixo' | 'variavel';
export type ExpenseOrigin = 'proprio' | 'conjuge' | 'filhos';

export interface TipoDespesa {
  id: string;
  nome: string;
  grupo: string;
  valor_padrao_teto: number;
  classificacao: ExpenseClassification;
  origem_permitida: ExpenseOrigin[];
  ativo: boolean;
  created_at: string;
}

export interface CreateTipoDespesaInput {
  nome: string;
  grupo: string;
  valor_padrao_teto?: number;
  classificacao?: ExpenseClassification;
  origem_permitida?: ExpenseOrigin[];
  ativo?: boolean;
}

export interface UpdateTipoDespesaInput extends Partial<CreateTipoDespesaInput> {}

export interface TipoDespesaFilters {
  ativo?: boolean;
  classificacao?: ExpenseClassification;
}

export const tiposDespesasService = {
  async getAll(filters?: TipoDespesaFilters): Promise<TipoDespesa[]> {
    const params = new URLSearchParams();
    if (filters?.ativo !== undefined) params.append('ativo', String(filters.ativo));
    if (filters?.classificacao) params.append('classificacao', filters.classificacao);
    
    const query = params.toString();
    return apiClient.get<TipoDespesa[]>(`/api/tipos-despesas${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<TipoDespesa> {
    return apiClient.get<TipoDespesa>(`/api/tipos-despesas/${id}`);
  },

  async create(data: CreateTipoDespesaInput): Promise<TipoDespesa> {
    return apiClient.post<TipoDespesa>('/api/tipos-despesas', data);
  },

  async update(id: string, data: UpdateTipoDespesaInput): Promise<TipoDespesa> {
    return apiClient.put<TipoDespesa>(`/api/tipos-despesas/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/tipos-despesas/${id}`);
  },
};

export default tiposDespesasService;
