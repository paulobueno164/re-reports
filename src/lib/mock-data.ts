// Dados mock para desenvolvimento - RE-Reports

import {
  EligibleEmployee,
  ExpenseType,
  CalendarPeriod,
  ExpenseTypePayrollEvent,
  Expense,
  DashboardSummary,
} from '@/types';

// Colaboradores Elegíveis
export const mockEmployees: EligibleEmployee[] = [
  {
    id: '1',
    matricula: '12345',
    nome: 'João Silva Santos',
    email: 'joao.silva@onset.com.br',
    departamento: 'Tecnologia da Informação',
    salarioBase: 8000,
    valeAlimentacao: 600,
    valeRefeicao: 800,
    ajudaCusto: 500,
    mobilidade: 400,
    transporte: 300,
    cestaBeneficiosTeto: 2000,
    temPida: true,
    pidaTeto: 1500,
    ativo: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: '2',
    matricula: '12346',
    nome: 'Maria Oliveira Costa',
    email: 'maria.oliveira@onset.com.br',
    departamento: 'Financeiro',
    salarioBase: 9500,
    valeAlimentacao: 600,
    valeRefeicao: 800,
    ajudaCusto: 600,
    mobilidade: 500,
    transporte: 350,
    cestaBeneficiosTeto: 2500,
    temPida: true,
    pidaTeto: 2000,
    ativo: true,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: '3',
    matricula: '12347',
    nome: 'Carlos Eduardo Mendes',
    email: 'carlos.mendes@onset.com.br',
    departamento: 'Recursos Humanos',
    salarioBase: 7500,
    valeAlimentacao: 600,
    valeRefeicao: 800,
    ajudaCusto: 450,
    mobilidade: 350,
    transporte: 280,
    cestaBeneficiosTeto: 1800,
    temPida: false,
    pidaTeto: 0,
    ativo: true,
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: '4',
    matricula: '12348',
    nome: 'Ana Paula Rodrigues',
    email: 'ana.rodrigues@onset.com.br',
    departamento: 'Marketing',
    salarioBase: 6800,
    valeAlimentacao: 600,
    valeRefeicao: 800,
    ajudaCusto: 400,
    mobilidade: 300,
    transporte: 250,
    cestaBeneficiosTeto: 1500,
    temPida: true,
    pidaTeto: 1000,
    ativo: true,
    createdAt: new Date('2024-04-05'),
    updatedAt: new Date('2024-12-01'),
  },
];

// Tipos de Despesas
export const mockExpenseTypes: ExpenseType[] = [
  {
    id: '1',
    nome: 'Notebook',
    classificacao: 'variavel',
    valorPadraoTeto: 5000,
    grupo: 'Equipamentos',
    origemPermitida: ['proprio'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    nome: 'Celular',
    classificacao: 'variavel',
    valorPadraoTeto: 1500,
    grupo: 'Equipamentos',
    origemPermitida: ['proprio'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    nome: 'Previdência Privada',
    classificacao: 'variavel',
    valorPadraoTeto: 2000,
    grupo: 'Seguros',
    origemPermitida: ['proprio'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '4',
    nome: 'Pós-graduação/MBA',
    classificacao: 'variavel',
    valorPadraoTeto: 3000,
    grupo: 'Educação',
    origemPermitida: ['proprio'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '5',
    nome: 'Farmácias e Drogarias',
    classificacao: 'variavel',
    valorPadraoTeto: 800,
    grupo: 'Saúde',
    origemPermitida: ['proprio', 'conjuge', 'filhos'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '6',
    nome: 'Plano de Saúde',
    classificacao: 'variavel',
    valorPadraoTeto: 1200,
    grupo: 'Saúde',
    origemPermitida: ['proprio', 'conjuge', 'filhos'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '7',
    nome: 'Cultura (Cinema, Teatro, Shows)',
    classificacao: 'variavel',
    valorPadraoTeto: 500,
    grupo: 'Cultura',
    origemPermitida: ['proprio', 'conjuge', 'filhos'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '8',
    nome: 'Academia/Esportes',
    classificacao: 'variavel',
    valorPadraoTeto: 400,
    grupo: 'Saúde',
    origemPermitida: ['proprio'],
    ativo: true,
    createdAt: new Date('2024-01-01'),
  },
];

// Calendário de Períodos
export const mockCalendarPeriods: CalendarPeriod[] = [
  {
    id: '1',
    periodo: '12/2025',
    dataInicio: new Date('2025-11-21'),
    dataFinal: new Date('2025-12-20'),
    abreLancamento: new Date('2025-12-10'),
    fechaLancamento: new Date('2025-12-20'),
    status: 'aberto',
  },
  {
    id: '2',
    periodo: '01/2026',
    dataInicio: new Date('2025-12-21'),
    dataFinal: new Date('2026-01-20'),
    abreLancamento: new Date('2026-01-10'),
    fechaLancamento: new Date('2026-01-20'),
    status: 'aberto',
  },
  {
    id: '3',
    periodo: '11/2025',
    dataInicio: new Date('2025-10-21'),
    dataFinal: new Date('2025-11-20'),
    abreLancamento: new Date('2025-11-10'),
    fechaLancamento: new Date('2025-11-20'),
    status: 'fechado',
  },
];

// Vínculos Tipo Despesa × Evento Folha
export const mockPayrollEvents: ExpenseTypePayrollEvent[] = [
  {
    id: '1',
    tipoDespesaId: '1',
    tipoDespesaNome: 'Notebook',
    codigoEvento: '108930',
    descricaoEvento: 'Equipamentos de uso',
  },
  {
    id: '2',
    tipoDespesaId: '2',
    tipoDespesaNome: 'Celular',
    codigoEvento: '108940',
    descricaoEvento: 'Equipamentos de uso',
  },
  {
    id: '3',
    tipoDespesaId: '3',
    tipoDespesaNome: 'Previdência Privada',
    codigoEvento: '439020',
    descricaoEvento: 'Previdência Privada',
  },
  {
    id: '4',
    tipoDespesaId: '4',
    tipoDespesaNome: 'Pós-graduação/MBA',
    codigoEvento: '762310',
    descricaoEvento: 'Ensino pós-graduação',
  },
  {
    id: '5',
    tipoDespesaId: '5',
    tipoDespesaNome: 'Farmácias e Drogarias',
    codigoEvento: '354620',
    descricaoEvento: 'Medicamentos',
  },
];

// Lançamentos de Despesas
export const mockExpenses: Expense[] = [
  {
    id: '1',
    colaboradorId: '1',
    colaboradorNome: 'João Silva Santos',
    periodoId: '1',
    periodo: '12/2025',
    tipoDespesaId: '1',
    tipoDespesaNome: 'Notebook',
    origem: 'proprio',
    valorLancado: 3500,
    valorConsiderado: 3500,
    valorNaoConsiderado: 0,
    descricaoFatoGerador: 'Compra de notebook Dell Latitude para trabalho remoto',
    status: 'valido',
    createdAt: new Date('2025-12-11'),
    updatedAt: new Date('2025-12-11'),
  },
  {
    id: '2',
    colaboradorId: '1',
    colaboradorNome: 'João Silva Santos',
    periodoId: '1',
    periodo: '12/2025',
    tipoDespesaId: '5',
    tipoDespesaNome: 'Farmácias e Drogarias',
    origem: 'filhos',
    valorLancado: 250,
    valorConsiderado: 250,
    valorNaoConsiderado: 0,
    descricaoFatoGerador: 'Medicamentos para filho - gripe',
    status: 'em_analise',
    createdAt: new Date('2025-12-12'),
    updatedAt: new Date('2025-12-12'),
  },
  {
    id: '3',
    colaboradorId: '2',
    colaboradorNome: 'Maria Oliveira Costa',
    periodoId: '1',
    periodo: '12/2025',
    tipoDespesaId: '4',
    tipoDespesaNome: 'Pós-graduação/MBA',
    origem: 'proprio',
    valorLancado: 2800,
    valorConsiderado: 2500,
    valorNaoConsiderado: 300,
    descricaoFatoGerador: 'Mensalidade MBA em Gestão Financeira - FGV',
    status: 'valido',
    createdAt: new Date('2025-12-13'),
    updatedAt: new Date('2025-12-14'),
  },
  {
    id: '4',
    colaboradorId: '3',
    colaboradorNome: 'Carlos Eduardo Mendes',
    periodoId: '1',
    periodo: '12/2025',
    tipoDespesaId: '8',
    tipoDespesaNome: 'Academia/Esportes',
    origem: 'proprio',
    valorLancado: 180,
    valorConsiderado: 180,
    valorNaoConsiderado: 0,
    descricaoFatoGerador: 'Mensalidade Smart Fit - dezembro',
    status: 'enviado',
    createdAt: new Date('2025-12-14'),
    updatedAt: new Date('2025-12-14'),
  },
];

// Dashboard Summary
export const mockDashboardSummary: DashboardSummary = {
  totalColaboradoresElegiveis: 4,
  totalLancamentosMes: 12,
  valorTotalMes: 28750,
  pendentesValidacao: 3,
  periodoAtual: '12/2025',
  diasRestantes: 9,
};

// Grupos de Despesas
export const expenseGroups = [
  'Equipamentos',
  'Seguros',
  'Educação',
  'Saúde',
  'Cultura',
];

// Departamentos
export const departments = [
  'Tecnologia da Informação',
  'Financeiro',
  'Recursos Humanos',
  'Marketing',
  'Comercial',
  'Operações',
  'Jurídico',
];

// Helper para formatar moeda
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Helper para formatar percentual
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Helper para formatar data
export function formatDate(date: Date): string {
  // Use UTC to avoid timezone shift issues with date-only strings
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

// Helper para status label
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    rascunho: 'Rascunho',
    enviado: 'Enviado',
    em_analise: 'Em Análise',
    valido: 'Válido',
    invalido: 'Inválido',
    aberto: 'Aberto',
    fechado: 'Fechado',
  };
  return labels[status] || status;
}

// Helper para origem label
export function getOriginLabel(origin: string): string {
  const labels: Record<string, string> = {
    proprio: 'Próprio',
    conjuge: 'Cônjuge',
    filhos: 'Filhos',
  };
  return labels[origin] || origin;
}
