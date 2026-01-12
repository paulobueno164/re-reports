import apiClient from '@/lib/api-client';

export type ExpenseStatus = 'enviado' | 'em_analise' | 'valido' | 'invalido';
export type ExpenseOrigin = 'proprio' | 'conjuge' | 'filhos';

export interface Lancamento {
  id: string;
  colaborador_id: string;
  periodo_id: string;
  tipo_despesa_id: string;
  origem: ExpenseOrigin;
  descricao_fato_gerador: string;
  numero_documento: string | null;
  valor_lancado: number;
  valor_considerado: number;
  valor_nao_considerado: number;
  status: ExpenseStatus;
  validado_por: string | null;
  validado_em: string | null;
  motivo_invalidacao: string | null;
  parcelamento_ativo: boolean;
  parcelamento_total_parcelas: number | null;
  parcelamento_numero_parcela: number | null;
  parcelamento_valor_total: number | null;
  created_at: string;
  updated_at: string;
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

export interface Anexo {
  id: string;
  lancamento_id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  storage_path: string;
  tamanho: number;
  hash_comprovante: string | null;
  created_at: string;
}

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

export interface LancamentoFilters {
  colaborador_id?: string;
  periodo_id?: string;
  status?: ExpenseStatus;
  tipo_despesa_id?: string;
}

export interface BatchResult {
  aprovados?: number;
  rejeitados?: number;
  erros: string[];
}

export const lancamentosService = {
  async getAll(filters?: LancamentoFilters): Promise<Lancamento[]> {
    const params = new URLSearchParams();
    if (filters?.colaborador_id) params.append('colaborador_id', filters.colaborador_id);
    if (filters?.periodo_id) params.append('periodo_id', filters.periodo_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tipo_despesa_id) params.append('tipo_despesa_id', filters.tipo_despesa_id);
    
    const query = params.toString();
    return apiClient.get<Lancamento[]>(`/api/lancamentos${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<Lancamento> {
    return apiClient.get<Lancamento>(`/api/lancamentos/${id}`);
  },

  async create(data: CreateLancamentoInput): Promise<Lancamento> {
    return apiClient.post<Lancamento>('/api/lancamentos', data);
  },

  async update(id: string, data: UpdateLancamentoInput): Promise<Lancamento> {
    return apiClient.put<Lancamento>(`/api/lancamentos/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/lancamentos/${id}`);
  },

  async iniciarAnalise(id: string): Promise<Lancamento> {
    return apiClient.post<Lancamento>(`/api/lancamentos/${id}/iniciar-analise`);
  },

  async aprovar(id: string): Promise<Lancamento> {
    return apiClient.post<Lancamento>(`/api/lancamentos/${id}/aprovar`);
  },

  async rejeitar(id: string, motivo: string): Promise<Lancamento> {
    return apiClient.post<Lancamento>(`/api/lancamentos/${id}/rejeitar`, { motivo });
  },

  async aprovarEmLote(ids: string[]): Promise<BatchResult> {
    return apiClient.post<BatchResult>('/api/lancamentos/aprovar-lote', { ids });
  },

  async rejeitarEmLote(ids: string[], motivo: string): Promise<BatchResult> {
    return apiClient.post<BatchResult>('/api/lancamentos/rejeitar-lote', { ids, motivo });
  },
};

export default lancamentosService;
