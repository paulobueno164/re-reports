import * as XLSX from 'xlsx';

interface ExportRow {
  matricula: string;
  nome: string;
  departamento: string;
  codigoEvento: string;
  descricaoEvento: string;
  valor: number;
  periodo: string;
}

export function exportToExcel(data: ExportRow[], periodo: string): void {
  // Formatar data para nome do arquivo
  const hoje = new Date();
  const dataFormatada = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
  const periodoFormatado = periodo.replace('/', '');
  
  // Criar worksheet
  const wsData = [
    ['Matrícula', 'Nome', 'Departamento', 'Código Evento', 'Descrição Evento', 'Valor (R$)', 'Período'],
    ...data.map(row => [
      row.matricula,
      row.nome,
      row.departamento,
      row.codigoEvento,
      row.descricaoEvento,
      row.valor,
      row.periodo,
    ])
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Definir largura das colunas
  ws['!cols'] = [
    { wch: 12 }, // Matrícula
    { wch: 30 }, // Nome
    { wch: 25 }, // Departamento
    { wch: 15 }, // Código Evento
    { wch: 25 }, // Descrição Evento
    { wch: 15 }, // Valor
    { wch: 10 }, // Período
  ];
  
  // Criar workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Remuneração Estratégica');
  
  // Gerar e baixar arquivo
  const fileName = `RemuneracaoEstrategica_${periodoFormatado}_${dataFormatada}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

interface StatementData {
  colaborador: {
    matricula: string;
    nome: string;
    departamento: string;
  };
  periodo: string;
  componentes: {
    nome: string;
    valorParametrizado: number;
    valorUtilizado: number;
    percentual: number;
  }[];
  lancamentos: {
    data: string;
    tipoDespesa: string;
    origem: string;
    valorLancado: number;
    valorConsiderado: number;
    status: string;
  }[];
  totais: {
    rendimentoTotal: number;
    cestaBeneficiosUtilizado: number;
    cestaBeneficiosTeto: number;
    diferencaPida: number;
  };
}

export function exportStatementToExcel(data: StatementData): void {
  const hoje = new Date();
  const dataFormatada = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
  const periodoFormatado = data.periodo.replace('/', '');
  
  const wb = XLSX.utils.book_new();
  
  // Aba 1: Resumo
  const resumoData = [
    ['EXTRATO DE REMUNERAÇÃO ESTRATÉGICA'],
    [],
    ['Colaborador:', data.colaborador.nome],
    ['Matrícula:', data.colaborador.matricula],
    ['Departamento:', data.colaborador.departamento],
    ['Período:', data.periodo],
    [],
    ['RESUMO GERAL'],
    ['Componente', 'Valor Parametrizado', 'Valor Utilizado', '% Utilizado'],
    ...data.componentes.map(c => [
      c.nome,
      c.valorParametrizado,
      c.valorUtilizado,
      `${c.percentual.toFixed(1)}%`,
    ]),
    [],
    ['TOTAIS'],
    ['Rendimento Total', data.totais.rendimentoTotal, '', ''],
    ['Cesta de Benefícios - Teto', data.totais.cestaBeneficiosTeto, '', ''],
    ['Cesta de Benefícios - Utilizado', data.totais.cestaBeneficiosUtilizado, '', ''],
    ['Diferença convertida para PI/DA', data.totais.diferencaPida, '', ''],
  ];
  
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo['!cols'] = [
    { wch: 30 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  
  // Aba 2: Lançamentos
  const lancamentosData = [
    ['DETALHAMENTO DE LANÇAMENTOS'],
    [],
    ['Data', 'Tipo de Despesa', 'Origem', 'Valor Lançado', 'Valor Considerado', 'Status'],
    ...data.lancamentos.map(l => [
      l.data,
      l.tipoDespesa,
      l.origem,
      l.valorLancado,
      l.valorConsiderado,
      l.status,
    ]),
  ];
  
  const wsLancamentos = XLSX.utils.aoa_to_sheet(lancamentosData);
  wsLancamentos['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLancamentos, 'Lançamentos');
  
  // Gerar e baixar arquivo
  const fileName = `Extrato_${data.colaborador.matricula}_${periodoFormatado}_${dataFormatada}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportBatchToZip(statements: StatementData[]): void {
  // Para simplificação, vamos exportar um único Excel com múltiplas abas
  const hoje = new Date();
  const dataFormatada = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
  
  const wb = XLSX.utils.book_new();
  
  statements.forEach((data, index) => {
    const tabName = `${data.colaborador.matricula}`.substring(0, 31); // Excel limita a 31 caracteres
    
    const sheetData = [
      ['EXTRATO DE REMUNERAÇÃO ESTRATÉGICA'],
      [],
      ['Colaborador:', data.colaborador.nome],
      ['Matrícula:', data.colaborador.matricula],
      ['Departamento:', data.colaborador.departamento],
      ['Período:', data.periodo],
      [],
      ['Componente', 'Valor Parametrizado', 'Valor Utilizado', '% Utilizado'],
      ...data.componentes.map(c => [
        c.nome,
        c.valorParametrizado,
        c.valorUtilizado,
        `${c.percentual.toFixed(1)}%`,
      ]),
      [],
      ['Rendimento Total', data.totais.rendimentoTotal, '', ''],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, tabName);
  });
  
  const fileName = `Relatorios_Lote_${dataFormatada}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

interface ColaboradorExpenseData {
  colaborador: {
    nome: string;
    matricula: string;
    departamento: string;
  };
  periodo: string;
  expenses: {
    data: string;
    tipoDespesa: string;
    origem: string;
    valorLancado: number;
    valorConsiderado: number;
    valorNaoConsiderado: number;
    status: string;
    descricao: string;
  }[];
  totais: {
    total: number;
    totalConsiderado: number;
    cestaTeto: number;
  };
  statusCounts: {
    enviado: number;
    em_analise: number;
    valido: number;
    invalido: number;
  };
}

export function exportColaboradorExpenses(data: ColaboradorExpenseData): void {
  const hoje = new Date();
  const dataFormatada = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
  const periodoFormatado = data.periodo.replace('/', '');
  
  const wb = XLSX.utils.book_new();
  
  const statusLabels: Record<string, string> = {
    enviado: 'Enviado',
    em_analise: 'Em Análise',
    valido: 'Válido',
    invalido: 'Inválido',
  };
  
  // Aba: Resumo e Lançamentos
  const sheetData = [
    ['DESPESAS DO COLABORADOR'],
    [],
    ['Colaborador:', data.colaborador.nome],
    ['Matrícula:', data.colaborador.matricula],
    ['Departamento:', data.colaborador.departamento],
    ['Período:', data.periodo],
    [],
    ['RESUMO POR STATUS'],
    ['Status', 'Quantidade'],
    ['Enviado', data.statusCounts.enviado],
    ['Em Análise', data.statusCounts.em_analise],
    ['Válido', data.statusCounts.valido],
    ['Inválido', data.statusCounts.invalido],
    ['Total', data.expenses.length],
    [],
    ['TOTAIS'],
    ['Total Lançado', data.totais.total],
    ['Total Considerado', data.totais.totalConsiderado],
    ['Teto Cesta de Benefícios', data.totais.cestaTeto],
    [],
    ['DETALHAMENTO DE LANÇAMENTOS'],
    ['Data', 'Tipo de Despesa', 'Origem', 'Descrição', 'Valor Lançado', 'Valor Considerado', 'Não Considerado', 'Status'],
    ...data.expenses.map(e => [
      e.data,
      e.tipoDespesa,
      e.origem,
      e.descricao,
      e.valorLancado,
      e.valorConsiderado,
      e.valorNaoConsiderado,
      statusLabels[e.status] || e.status,
    ]),
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 12 },
    { wch: 35 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
  
  const fileName = `Despesas_${data.colaborador.matricula}_${periodoFormatado}_${dataFormatada}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
