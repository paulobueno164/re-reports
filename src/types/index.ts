// RE-Reports - Tipos do Sistema

// Perfis de acesso
export type UserRole = 'FINANCEIRO' | 'COLABORADOR' | 'RH';

// Status de lançamento
export type ExpenseStatus = 'enviado' | 'em_analise' | 'valido' | 'invalido';

// Classificação de despesa
export type ExpenseClassification = 'fixo' | 'variavel';

// Origem da despesa
export type ExpenseOrigin = 'proprio' | 'conjuge' | 'filhos';

// Status do período
export type PeriodStatus = 'aberto' | 'fechado';

// Colaborador Elegível
export interface EligibleEmployee {
  id: string;
  matricula: string;
  nome: string;
  email: string;
  departamento: string;
  salarioBase: number;
  valeAlimentacao: number;
  valeRefeicao: number;
  ajudaCusto: number;
  mobilidade: number;
  cestaBeneficiosTeto: number;
  temPida: boolean;
  pidaTeto: number;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tipo de Despesa
export interface ExpenseType {
  id: string;
  nome: string;
  classificacao: ExpenseClassification;
  valorPadraoTeto: number;
  grupo: string;
  origemPermitida: ExpenseOrigin[];
  ativo: boolean;
  createdAt: Date;
}

// Período do Calendário
export interface CalendarPeriod {
  id: string;
  periodo: string; // MM/YYYY
  dataInicio: Date;
  dataFinal: Date;
  abreLancamento: Date;
  fechaLancamento: Date;
  status: PeriodStatus;
}

// Vínculo Tipo Despesa × Evento Folha
export interface ExpenseTypePayrollEvent {
  id: string;
  tipoDespesaId: string;
  tipoDespesaNome?: string;
  codigoEvento: string;
  descricaoEvento: string;
}

// Lançamento de Despesa
export interface Expense {
  id: string;
  colaboradorId: string;
  colaboradorNome?: string;
  periodoId: string;
  periodo?: string;
  tipoDespesaId: string;
  tipoDespesaNome?: string;
  origem: ExpenseOrigin;
  valorLancado: number;
  valorConsiderado: number;
  valorNaoConsiderado: number;
  descricaoFatoGerador: string;
  status: ExpenseStatus;
  motivoInvalidacao?: string;
  createdAt: Date;
  updatedAt: Date;
  anexos?: Attachment[];
}

// Anexo
export interface Attachment {
  id: string;
  lancamentoId: string;
  nomeArquivo: string;
  tipoArquivo: string;
  tamanho: number;
  storagePath: string;
  createdAt: Date;
}

// Fechamento
export interface MonthlyClosing {
  id: string;
  periodoId: string;
  periodo?: string;
  dataProcessamento: Date;
  usuarioId: string;
  usuarioNome?: string;
  totalColaboradores: number;
  totalEventos: number;
  status: 'sucesso' | 'erro';
  detalhesErro?: string;
}

// Exportação
export interface Export {
  id: string;
  periodoId: string;
  fechamentoId: string;
  dataExportacao: Date;
  usuarioId: string;
  usuarioNome?: string;
  nomeArquivo: string;
  qtdRegistros: number;
}

// Resumo do Dashboard
export interface DashboardSummary {
  totalColaboradoresElegiveis: number;
  totalLancamentosMes: number;
  valorTotalMes: number;
  pendentesValidacao: number;
  periodoAtual: string;
  diasRestantes: number;
}

// Simulação de Remuneração
export interface RemunerationSimulation {
  colaboradorId: string;
  colaboradorNome: string;
  componentes: {
    nome: string;
    valorContratado: number;
    tipo: 'fixo' | 'teto_variavel';
  }[];
  rendimentoTotal: number;
}

// Extrato Mensal
export interface MonthlyStatement {
  colaborador: {
    matricula: string;
    nome: string;
    departamento: string;
  };
  periodo: string;
  resumo: {
    componente: string;
    valorParametrizado: number;
    valorUtilizado: number;
    percentualUtilizado: number;
  }[];
  detalhamentoPorGrupo: {
    grupo: string;
    subtotal: number;
    lancamentos: Expense[];
  }[];
  analiseUtilizacao: {
    limiteCesta: number;
    totalUtilizado: number;
    saldoDisponivel: number;
    percentualUtilizado: number;
    diferencaPida: number;
  };
  comprovantes: Attachment[];
  dataGeracao: Date;
}
