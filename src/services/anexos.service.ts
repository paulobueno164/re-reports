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
    return apiClient.get<Anexo[]>(`/api/attachments/${lancamentoId}`);
  },

  async upload(lancamentoId: string, file: File): Promise<Anexo> {
    return apiClient.uploadFile('/api/attachments/upload', file, {
      lancamento_id: lancamentoId,
    });
  },

  async delete(anexoId: string): Promise<void> {
    await apiClient.delete(`/api/attachments/${anexoId}`);
  },

  async download(storagePath: string): Promise<Blob> {
    return apiClient.downloadFile(`/api/attachments/download/${encodeURIComponent(storagePath)}`);
  },

  getFileUrl(storagePath: string): string {
    return apiClient.getFileUrl(storagePath);
  },
};

export default anexosService;
