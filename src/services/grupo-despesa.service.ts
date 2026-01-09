import api from '@/lib/api-client';

export interface GrupoDespesa {
    id: string;
    nome: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateGrupoDespesaInput {
    nome: string;
    ativo?: boolean;
}

export interface UpdateGrupoDespesaInput {
    nome?: string;
    ativo?: boolean;
}

export const grupoDespesaService = {
    getAll: async (filters?: { ativo?: boolean }): Promise<GrupoDespesa[]> => {
        const params = new URLSearchParams();
        if (filters?.ativo !== undefined) {
            params.append('ativo', filters.ativo.toString());
        }
        return await api.get(`/api/grupos-despesa?${params.toString()}`);
    },

    getById: async (id: string): Promise<GrupoDespesa> => {
        return await api.get(`/api/grupos-despesa/${id}`);
    },

    create: async (input: CreateGrupoDespesaInput): Promise<GrupoDespesa> => {
        return await api.post('/api/grupos-despesa', input);
    },

    update: async (id: string, input: UpdateGrupoDespesaInput): Promise<GrupoDespesa> => {
        return await api.put(`/api/grupos-despesa/${id}`, input);
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/api/grupos-despesa/${id}`);
    },
};
