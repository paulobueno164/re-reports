import api from '@/lib/api-client';

export interface Departamento {
    id: string;
    nome: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateDepartamentoInput {
    nome: string;
    ativo?: boolean;
}

export interface UpdateDepartamentoInput {
    nome?: string;
    ativo?: boolean;
}

export const departamentoService = {
    getAll: async (filters?: { ativo?: boolean }): Promise<Departamento[]> => {
        const params = new URLSearchParams();
        if (filters?.ativo !== undefined) {
            params.append('ativo', filters.ativo.toString());
        }
        return await api.get(`/api/departamentos?${params.toString()}`);
    },

    getById: async (id: string): Promise<Departamento> => {
        return await api.get(`/api/departamentos/${id}`);
    },

    create: async (input: CreateDepartamentoInput): Promise<Departamento> => {
        return await api.post('/api/departamentos', input);
    },

    update: async (id: string, input: UpdateDepartamentoInput): Promise<Departamento> => {
        return await api.put(`/api/departamentos/${id}`, input);
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/api/departamentos/${id}`);
    },
};
