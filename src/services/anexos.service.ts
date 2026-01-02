import apiClient from '@/lib/api-client';

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

export const anexosService = {
  async getByLancamentoId(lancamentoId: string): Promise<Anexo[]> {
    return apiClient.get<Anexo[]>(`/api/lancamentos/${lancamentoId}/anexos`);
  },

  async upload(lancamentoId: string, file: File): Promise<Anexo> {
    return apiClient.uploadFile(`/api/lancamentos/${lancamentoId}/anexos`, file);
  },

  async delete(anexoId: string): Promise<void> {
    await apiClient.delete(`/api/anexos/${anexoId}`);
  },

  async download(anexoId: string): Promise<Blob> {
    return apiClient.downloadFile(`/api/anexos/${anexoId}/download`);
  },

  getViewUrl(anexoId: string): string {
    return apiClient.getFileUrl(anexoId);
  },
};

export default anexosService;
