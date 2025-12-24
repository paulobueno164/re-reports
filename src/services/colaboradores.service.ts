import apiClient from '@/lib/api-client';

export interface Colaborador {
  id: string;
  user_id: string | null;
  nome: string;
  email: string;
  matricula: string;
  departamento: string;
  salario_base: number;
  vale_alimentacao: number;
  vale_refeicao: number;
  ajuda_custo: number;
  mobilidade: number;
  transporte: number;
  cesta_beneficios_teto: number;
  pida_teto: number;
  tem_pida: boolean;
  beneficio_proporcional: boolean;
  ferias_inicio: string | null;
  ferias_fim: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Alias for backwards compatibility
export type ColaboradorElegivel = Colaborador;

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
  ativo?: boolean;
  user_id?: string;
}

export interface UpdateColaboradorInput extends Partial<CreateColaboradorInput> {}

export interface ColaboradorFilters {
  ativo?: boolean;
  departamento?: string;
  search?: string;
}

export interface ColaboradorTipoDespesa {
  id: string;
  colaborador_id: string;
  tipo_despesa_id: string;
  teto_individual: number | null;
  ativo: boolean;
  created_at: string;
  tipo_despesa: {
    id: string;
    nome: string;
    grupo: string;
    valor_padrao_teto: number;
    classificacao: string;
    origem_permitida: string[];
    ativo: boolean;
  };
}

export const colaboradoresService = {
  async getAll(filters?: ColaboradorFilters): Promise<Colaborador[]> {
    const params = new URLSearchParams();
    if (filters?.ativo !== undefined) params.append('ativo', String(filters.ativo));
    if (filters?.departamento) params.append('departamento', filters.departamento);
    if (filters?.search) params.append('search', filters.search);
    
    const query = params.toString();
    return apiClient.get<Colaborador[]>(`/api/colaboradores${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<Colaborador> {
    return apiClient.get<Colaborador>(`/api/colaboradores/${id}`);
  },

  async create(data: CreateColaboradorInput): Promise<Colaborador> {
    return apiClient.post<Colaborador>('/api/colaboradores', data);
  },

  async update(id: string, data: UpdateColaboradorInput): Promise<Colaborador> {
    return apiClient.put<Colaborador>(`/api/colaboradores/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/colaboradores/${id}`);
  },

  async linkToUser(colaboradorId: string, userId: string): Promise<void> {
    await apiClient.put(`/api/colaboradores/${colaboradorId}/link-user`, { user_id: userId });
  },

  async unlinkFromUser(colaboradorId: string): Promise<void> {
    await apiClient.put(`/api/colaboradores/${colaboradorId}/unlink-user`, {});
  },

  async getTiposDespesas(colaboradorId: string): Promise<ColaboradorTipoDespesa[]> {
    return apiClient.get<ColaboradorTipoDespesa[]>(`/api/colaboradores/${colaboradorId}/tipos-despesas`);
  },

  async linkTipoDespesa(colaboradorId: string, tipoDespesaId: string, tetoIndividual?: number): Promise<ColaboradorTipoDespesa> {
    return apiClient.post<ColaboradorTipoDespesa>(`/api/colaboradores/${colaboradorId}/tipos-despesas`, {
      tipo_despesa_id: tipoDespesaId,
      teto_individual: tetoIndividual,
    });
  },

  async unlinkTipoDespesa(colaboradorId: string, tipoDespesaId: string): Promise<void> {
    await apiClient.delete(`/api/colaboradores/${colaboradorId}/tipos-despesas/${tipoDespesaId}`);
  },

  async getDepartamentos(): Promise<string[]> {
    return apiClient.get<string[]>('/api/departamentos');
  },
};

export default colaboradoresService;
