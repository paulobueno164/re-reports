// Re-export all services for easy importing
export { authService } from './auth.service';
export { colaboradoresService } from './colaboradores.service';
export { lancamentosService } from './lancamentos.service';
export { periodosService } from './periodos.service';
export { tiposDespesasService } from './tipos-despesas.service';
export { eventosFolhaService } from './eventos-folha.service';
export { fechamentoService } from './fechamento.service';
export { dashboardService } from './dashboard.service';
export { anexosService } from './anexos.service';
export { auditService } from './audit.service';
export { exportService } from './export.service';

// Re-export types
export type { AuthUser, AppRole, LoginResult, CreateUserInput, UserWithRoles } from './auth.service';
export type { ColaboradorElegivel, CreateColaboradorInput, UpdateColaboradorInput, ColaboradorFilters, ColaboradorTipoDespesa } from './colaboradores.service';
export type { Lancamento, Anexo, ExpenseStatus, ExpenseOrigin, CreateLancamentoInput, UpdateLancamentoInput, LancamentoFilters, BatchResult } from './lancamentos.service';
export type { CalendarioPeriodo, PeriodStatus, CreatePeriodoInput, UpdatePeriodoInput, PeriodoFilters } from './periodos.service';
export type { TipoDespesa, ExpenseClassification, CreateTipoDespesaInput, UpdateTipoDespesaInput, TipoDespesaFilters } from './tipos-despesas.service';
export type { EventoFolha, ComponenteRemuneracao, CreateEventoFolhaInput, UpdateEventoFolhaInput } from './eventos-folha.service';
export type { Fechamento, EventoPida, ProcessarFechamentoResult, ResumoFechamento } from './fechamento.service';
export type { DashboardMetrics, ColaboradorDashboardMetrics, FinanceiroDashboardMetrics } from './dashboard.service';
export type { AuditLog, AuditLogFilters } from './audit.service';
export type { ExportacaoRecord, ExportDataRow } from './export.service';
