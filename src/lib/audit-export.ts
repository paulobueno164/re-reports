import * as XLSX from 'xlsx';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_description: string | null;
  old_values: any;
  new_values: any;
  metadata: any;
}

const actionLabels: Record<string, string> = {
  aprovar: 'Aprovação',
  rejeitar: 'Rejeição',
  criar: 'Criação',
  atualizar: 'Atualização',
  excluir: 'Exclusão',
};

const entityLabels: Record<string, string> = {
  lancamento: 'Lançamento',
  colaborador: 'Colaborador',
  tipo_despesa: 'Tipo de Despesa',
  periodo: 'Período',
  evento_folha: 'Evento de Folha',
};

export const exportAuditLogsToExcel = (logs: AuditLog[], filters?: {
  startDate?: string;
  endDate?: string;
  action?: string;
  entity?: string;
}) => {
  const data = logs.map((log) => ({
    'Data/Hora': new Date(log.created_at).toLocaleString('pt-BR'),
    'Usuário': log.user_name,
    'Ação': actionLabels[log.action] || log.action,
    'Tipo de Entidade': entityLabels[log.entity_type] || log.entity_type,
    'Descrição': log.entity_description || '-',
    'ID Entidade': log.entity_id,
    'Motivo (se rejeição)': log.new_values?.motivo || '-',
    'Valores Anteriores': log.old_values ? JSON.stringify(log.old_values) : '-',
    'Novos Valores': log.new_values ? JSON.stringify(log.new_values) : '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Data/Hora
    { wch: 25 }, // Usuário
    { wch: 15 }, // Ação
    { wch: 20 }, // Tipo de Entidade
    { wch: 40 }, // Descrição
    { wch: 36 }, // ID Entidade
    { wch: 30 }, // Motivo
    { wch: 40 }, // Valores Anteriores
    { wch: 40 }, // Novos Valores
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico de Auditoria');

  // Add metadata sheet
  const filterInfo = [
    ['Relatório de Auditoria - RE-Reports'],
    [''],
    ['Gerado em:', new Date().toLocaleString('pt-BR')],
    ['Total de registros:', logs.length.toString()],
    [''],
    ['Filtros aplicados:'],
    ['Período:', filters?.startDate && filters?.endDate ? `${filters.startDate} a ${filters.endDate}` : 'Todos'],
    ['Ação:', filters?.action && filters.action !== 'all' ? actionLabels[filters.action] || filters.action : 'Todas'],
    ['Entidade:', filters?.entity && filters.entity !== 'all' ? entityLabels[filters.entity] || filters.entity : 'Todas'],
  ];

  const metadataSheet = XLSX.utils.aoa_to_sheet(filterInfo);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Informações');

  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Auditoria_RE-Reports_${date}.xlsx`);
};
