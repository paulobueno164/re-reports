import apiClient from '@/lib/api-client';

export type ComponenteRemuneracao =
  | 'vale_alimentacao'
  | 'vale_refeicao'
  | 'ajuda_custo'
  | 'mobilidade'
  | 'cesta_beneficios'
  | 'pida';

export interface EventoFolha {
  id: string;
  componente: ComponenteRemuneracao;
  codigo_evento: string;
  descricao_evento: string;
  created_at: string;
}

export interface CreateEventoFolhaInput {
  componente: ComponenteRemuneracao;
  codigo_evento: string;
  descricao_evento: string;
}

export interface UpdateEventoFolhaInput {
  codigo_evento: string;
  descricao_evento: string;
}

export const eventosFolhaService = {
  async getAll(): Promise<EventoFolha[]> {
    return apiClient.get<EventoFolha[]>('/api/eventos-folha');
  },

  async getById(id: string): Promise<EventoFolha> {
    return apiClient.get<EventoFolha>(`/api/eventos-folha/${id}`);
  },

  async create(data: CreateEventoFolhaInput): Promise<EventoFolha> {
    return apiClient.post<EventoFolha>('/api/eventos-folha', data);
  },

  async update(id: string, data: UpdateEventoFolhaInput): Promise<EventoFolha> {
    return apiClient.put<EventoFolha>(`/api/eventos-folha/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/eventos-folha/${id}`);
  },
};

export default eventosFolhaService;
