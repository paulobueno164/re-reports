// Enums
export type AppRole = 'FINANCEIRO' | 'COLABORADOR' | 'RH' | 'ADMINISTRADOR';
export type ExpenseStatus = 'enviado' | 'em_analise' | 'valido' | 'invalido';
export type ExpenseOrigin = 'proprio' | 'conjuge' | 'filhos';
export type ExpenseClassification = 'fixo' | 'variavel';
export type PeriodStatus = 'aberto' | 'fechado';

// Database Tables
export interface Profile {
  id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface ColaboradorElegivel {
  id: string;
  user_id: string | null;
  nome: string;
  email: string;
  matricula: string;
  departamento: string;
  salario_base: number;
  vale_alimentacao: number;
  vale_refeicao: number;
  ajuda_custo: number;
  mobilidade: number;
  transporte: number;
  cesta_beneficios_teto: number;
  pida_teto: number;
  tem_pida: boolean;
  ferias_inicio: string | null;
  ferias_fim: string | null;
  beneficio_proporcional: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarioPeriodo {
  id: string;
  periodo: string;
  data_inicio: string;
  data_final: string;
  abre_lancamento: string;
  fecha_lancamento: string;
  status: PeriodStatus;
  created_at: string;
}

export interface TipoDespesa {
  id: string;
  nome: string;
  grupo: string;
  valor_padrao_teto: number;
  classificacao: ExpenseClassification;
  origem_permitida: ExpenseOrigin[];
  ativo: boolean;
  created_at: string;
}

export interface Lancamento {
  id: string;
  colaborador_id: string;
  periodo_id: string;
  tipo_despesa_id: string;
  origem: ExpenseOrigin;
  descricao_fato_gerador: string;
  numero_documento: string | null;
  valor_lancado: number;
  valor_considerado: number;
  valor_nao_considerado: number;
  status: ExpenseStatus;
  validado_por: string | null;
  validado_em: string | null;
  motivo_invalidacao: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_description: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface Fechamento {
  id: string;
  periodo_id: string;
  usuario_id: string;
  data_processamento: string;
  status: string;
  total_colaboradores: number;
  total_eventos: number;
  valor_total: number;
  detalhes_erro: string | null;
  created_at: string;
}

export interface EventoPida {
  id: string;
  colaborador_id: string;
  periodo_id: string;
  fechamento_id: string;
  valor_base_pida: number;
  valor_diferenca_cesta: number;
  valor_total_pida: number;
  created_at: string;
}

// Auth Types
export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  roles: AppRole[];
}

export interface JwtPayload {
  userId: string;
  email: string;
}

// Configuration Tables
export interface Departamento {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrupoDespesa {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Request Types
export interface AuthenticatedRequest extends Express.Request {
  user?: AuthUser;
}
