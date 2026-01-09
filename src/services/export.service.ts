import apiClient from '@/lib/api-client';

export interface ExportacaoRecord {
  id: string;
  periodo_id: string;
  fechamento_id: string | null;
  usuario_id: string;
  nome_arquivo: string;
  qtd_registros: number;
  data_exportacao: string;
  created_at: string;
  periodo_nome?: string;
}

export interface ExportDataRow {
  matricula: string;
  nome: string;
  departamento: string;
  codigo_evento: string;
  descricao_evento: string;
  valor: number;
  periodo: string;
}

export const exportService = {
  async getAll(periodoId?: string): Promise<ExportacaoRecord[]> {
    const params = periodoId ? `?periodo_id=${periodoId}` : '';
    return apiClient.get<ExportacaoRecord[]>(`/api/exportacoes${params}`);
  },

  async getById(id: string): Promise<ExportacaoRecord> {
    return apiClient.get<ExportacaoRecord>(`/api/exportacoes/${id}`);
  },

  async getExportData(periodoId: string): Promise<ExportDataRow[]> {
    return apiClient.get<ExportDataRow[]>(`/api/exportacoes/data/${periodoId}`);
  },

  async createRecord(periodoId: string, nomeArquivo: string, qtdRegistros: number, fechamentoId?: string): Promise<ExportacaoRecord> {
    return apiClient.post<ExportacaoRecord>('/api/exportacoes', {
      periodo_id: periodoId,
      nome_arquivo: nomeArquivo,
      qtd_registros: qtdRegistros,
      fechamento_id: fechamentoId,
    });
  },
};

export default exportService;
