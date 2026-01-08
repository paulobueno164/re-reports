// Mock API responses for all endpoints
import { 
  mockEmployees, 
  mockExpenseTypes, 
  mockCalendarPeriods, 
  mockExpenses,
  mockPayrollEvents,
  mockDashboardSummary,
} from './mock-data';
import { getCurrentMockUser, MOCK_USERS } from './mock-mode';

// Simula delay de rede
const delay = (ms: number = 200) => new Promise(resolve => setTimeout(resolve, ms));

// Mock Colaboradores (formato backend)
const mockColaboradoresBackend = mockEmployees.map(emp => ({
  id: emp.id,
  matricula: emp.matricula,
  nome: emp.nome,
  email: emp.email,
  departamento: emp.departamento,
  salario_base: emp.salarioBase,
  vale_alimentacao: emp.valeAlimentacao,
  vale_refeicao: emp.valeRefeicao,
  ajuda_custo: emp.ajudaCusto,
  mobilidade: emp.mobilidade,
  cesta_beneficios_teto: emp.cestaBeneficiosTeto,
  tem_pida: emp.temPida,
  pida_teto: emp.pidaTeto,
  ativo: emp.ativo,
  transporte: 0,
  beneficio_proporcional: false,
  ferias_inicio: null,
  ferias_fim: null,
  user_id: emp.id === '1' ? 'user-colaborador-001' : null,
  created_at: emp.createdAt?.toISOString() || new Date().toISOString(),
  updated_at: emp.updatedAt?.toISOString() || new Date().toISOString(),
}));

// Mock Períodos (formato backend)
const mockPeriodosBackend = mockCalendarPeriods.map(p => ({
  id: p.id,
  periodo: p.periodo,
  data_inicio: p.dataInicio.toISOString().split('T')[0],
  data_final: p.dataFinal.toISOString().split('T')[0],
  abre_lancamento: p.abreLancamento.toISOString().split('T')[0],
  fecha_lancamento: p.fechaLancamento.toISOString().split('T')[0],
  status: p.status,
  created_at: new Date().toISOString(),
}));

// Mock Tipos de Despesas (formato backend)
const mockTiposDespesasBackend = mockExpenseTypes.map(t => ({
  id: t.id,
  nome: t.nome,
  classificacao: t.classificacao,
  valor_padrao_teto: t.valorPadraoTeto,
  grupo: t.grupo,
  origem_permitida: t.origemPermitida,
  ativo: t.ativo,
  created_at: t.createdAt?.toISOString() || new Date().toISOString(),
}));

// Mock Lançamentos (formato backend)
const mockLancamentosBackend = mockExpenses.map(e => ({
  id: e.id,
  colaborador_id: e.colaboradorId,
  periodo_id: e.periodoId,
  tipo_despesa_id: e.tipoDespesaId,
  origem: e.origem,
  valor_lancado: e.valorLancado,
  valor_considerado: e.valorConsiderado,
  valor_nao_considerado: e.valorNaoConsiderado,
  descricao_fato_gerador: e.descricaoFatoGerador,
  status: e.status,
  numero_documento: null,
  motivo_invalidacao: null,
  validado_por: e.status === 'valido' ? 'user-rh-001' : null,
  validado_em: e.status === 'valido' ? new Date().toISOString() : null,
  parcelamento_ativo: false,
  parcelamento_total_parcelas: null,
  parcelamento_numero_parcela: null,
  parcelamento_valor_total: null,
  lancamento_origem_id: null,
  created_at: e.createdAt?.toISOString() || new Date().toISOString(),
  updated_at: e.updatedAt?.toISOString() || new Date().toISOString(),
  // Joins
  colaborador: mockColaboradoresBackend.find(c => c.id === e.colaboradorId),
  periodo: mockPeriodosBackend.find(p => p.id === e.periodoId),
  tipo_despesa: mockTiposDespesasBackend.find(t => t.id === e.tipoDespesaId),
}));

// Mock Eventos Folha (formato backend)
const mockEventosFolhaBackend = mockPayrollEvents.map(e => ({
  id: e.id,
  codigo_evento: e.codigoEvento,
  descricao_evento: e.descricaoEvento,
  componente: 'cesta_beneficios',
  created_at: new Date().toISOString(),
}));

// Mock Audit Logs
const mockAuditLogs = [
  {
    id: '1',
    user_id: 'user-rh-001',
    user_name: 'Administrador RH',
    action: 'APROVAR_DESPESA',
    entity_type: 'lancamento',
    entity_id: '1',
    entity_description: 'Notebook - João Silva Santos',
    old_values: { status: 'em_analise' },
    new_values: { status: 'valido' },
    metadata: null,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: 'user-rh-001',
    user_name: 'Administrador RH',
    action: 'CRIAR_COLABORADOR',
    entity_type: 'colaborador',
    entity_id: '1',
    entity_description: 'João Silva Santos',
    old_values: null,
    new_values: { nome: 'João Silva Santos', email: 'joao.silva@onset.com.br' },
    metadata: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

// Mock Users (formato backend)
const mockUsersBackend = MOCK_USERS.map(u => ({
  id: u.id,
  email: u.email,
  nome: u.nome,
  avatar_url: null,
  roles: u.roles,
  created_at: new Date().toISOString(),
  ativo: true,
}));

// Mock Fechamentos
const mockFechamentos = [
  {
    id: 'fech-1',
    periodo_id: '3',
    status: 'processado',
    data_processamento: new Date('2025-11-25').toISOString(),
    total_colaboradores: 4,
    total_eventos: 8,
    valor_total: 15600,
    usuario_id: 'user-rh-001',
    detalhes_erro: null,
    created_at: new Date('2025-11-25').toISOString(),
    periodo: mockPeriodosBackend.find(p => p.id === '3'),
  },
];

// Handler type
type MockHandler = (params: Record<string, string>, data?: any) => Promise<any>;

// API Route handlers
const handlers: Record<string, MockHandler> = {
  // Auth
  'POST /auth/login': async (_params, data) => {
    await delay();
    const user = MOCK_USERS.find(u => u.email === data?.email && u.password === data?.password);
    if (!user) throw new Error('Email ou senha inválidos');
    return {
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        roles: user.roles,
      },
      token: 'mock-token-' + user.id,
    };
  },
  
  'GET /auth/me': async () => {
    await delay();
    const user = getCurrentMockUser();
    if (!user) throw new Error('Não autenticado');
    return {
      id: user.id,
      email: user.email,
      nome: user.nome,
      roles: user.roles,
    };
  },
  
  'GET /auth/users': async () => {
    await delay();
    return mockUsersBackend;
  },
  
  'GET /auth/users/:id': async (params) => {
    await delay();
    const user = mockUsersBackend.find(u => u.id === params.id);
    if (!user) throw new Error('Usuário não encontrado');
    return user;
  },
  
  'PUT /auth/change-password': async () => {
    await delay();
    return { success: true };
  },
  
  'POST /auth/users': async (_params, data) => {
    await delay();
    const newUser = {
      id: 'user-' + Date.now(),
      email: data?.email || '',
      nome: data?.nome || '',
      avatar_url: null,
      roles: [data?.role || 'COLABORADOR'],
      created_at: new Date().toISOString(),
      ativo: true,
    };
    mockUsersBackend.push(newUser);
    return { id: newUser.id, email: newUser.email };
  },
  
  // Colaboradores
  'GET /colaboradores': async () => {
    await delay();
    return mockColaboradoresBackend;
  },
  
  'GET /colaboradores/:id': async (params) => {
    await delay();
    const colab = mockColaboradoresBackend.find(c => c.id === params.id);
    if (!colab) throw new Error('Colaborador não encontrado');
    return colab;
  },
  
  'GET /colaboradores/me': async () => {
    await delay();
    const user = getCurrentMockUser();
    if (!user) throw new Error('Não autenticado');
    // Return first colaborador for mock
    return mockColaboradoresBackend[0];
  },
  
  'GET /colaboradores/user/:userId': async (params) => {
    await delay();
    const colab = mockColaboradoresBackend.find(c => c.user_id === params.userId);
    return colab || null;
  },
  
  'POST /colaboradores': async (_params, data) => {
    await delay();
    const newColab = {
      ...data,
      id: String(mockColaboradoresBackend.length + 1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockColaboradoresBackend.push(newColab);
    return newColab;
  },
  
  'PUT /colaboradores/:id': async (params, data) => {
    await delay();
    const index = mockColaboradoresBackend.findIndex(c => c.id === params.id);
    if (index === -1) throw new Error('Colaborador não encontrado');
    mockColaboradoresBackend[index] = { ...mockColaboradoresBackend[index], ...data };
    return mockColaboradoresBackend[index];
  },
  
  // Períodos
  'GET /periodos': async () => {
    await delay();
    return mockPeriodosBackend;
  },
  
  'GET /periodos/:id': async (params) => {
    await delay();
    const periodo = mockPeriodosBackend.find(p => p.id === params.id);
    if (!periodo) throw new Error('Período não encontrado');
    return periodo;
  },
  
  'POST /periodos': async (_params, data) => {
    await delay();
    const newPeriodo = {
      ...data,
      id: String(mockPeriodosBackend.length + 1),
      created_at: new Date().toISOString(),
    };
    mockPeriodosBackend.push(newPeriodo);
    return newPeriodo;
  },
  
  'PUT /periodos/:id': async (params, data) => {
    await delay();
    const index = mockPeriodosBackend.findIndex(p => p.id === params.id);
    if (index === -1) throw new Error('Período não encontrado');
    mockPeriodosBackend[index] = { ...mockPeriodosBackend[index], ...data };
    return mockPeriodosBackend[index];
  },
  
  // Tipos de Despesas
  'GET /tipos-despesas': async () => {
    await delay();
    return mockTiposDespesasBackend;
  },
  
  'GET /tipos-despesas/:id': async (params) => {
    await delay();
    const tipo = mockTiposDespesasBackend.find(t => t.id === params.id);
    if (!tipo) throw new Error('Tipo de despesa não encontrado');
    return tipo;
  },
  
  'POST /tipos-despesas': async (_params, data) => {
    await delay();
    const newTipo = {
      ...data,
      id: String(mockTiposDespesasBackend.length + 1),
      created_at: new Date().toISOString(),
    };
    mockTiposDespesasBackend.push(newTipo);
    return newTipo;
  },
  
  'PUT /tipos-despesas/:id': async (params, data) => {
    await delay();
    const index = mockTiposDespesasBackend.findIndex(t => t.id === params.id);
    if (index === -1) throw new Error('Tipo de despesa não encontrado');
    mockTiposDespesasBackend[index] = { ...mockTiposDespesasBackend[index], ...data };
    return mockTiposDespesasBackend[index];
  },
  
  // Lançamentos
  'GET /lancamentos': async () => {
    await delay();
    return mockLancamentosBackend;
  },
  
  'GET /lancamentos/:id': async (params) => {
    await delay();
    const lanc = mockLancamentosBackend.find(l => l.id === params.id);
    if (!lanc) throw new Error('Lançamento não encontrado');
    return lanc;
  },
  
  'POST /lancamentos': async (_params, data) => {
    await delay();
    const newLanc = {
      ...data,
      id: String(mockLancamentosBackend.length + 1),
      status: 'enviado',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      colaborador: mockColaboradoresBackend.find(c => c.id === data?.colaborador_id),
      periodo: mockPeriodosBackend.find(p => p.id === data?.periodo_id),
      tipo_despesa: mockTiposDespesasBackend.find(t => t.id === data?.tipo_despesa_id),
    };
    mockLancamentosBackend.push(newLanc);
    return newLanc;
  },
  
  'PUT /lancamentos/:id': async (params, data) => {
    await delay();
    const index = mockLancamentosBackend.findIndex(l => l.id === params.id);
    if (index === -1) throw new Error('Lançamento não encontrado');
    mockLancamentosBackend[index] = { ...mockLancamentosBackend[index], ...data, updated_at: new Date().toISOString() };
    return mockLancamentosBackend[index];
  },
  
  'PUT /lancamentos/:id/validar': async (params, data) => {
    await delay();
    const index = mockLancamentosBackend.findIndex(l => l.id === params.id);
    if (index === -1) throw new Error('Lançamento não encontrado');
    mockLancamentosBackend[index] = {
      ...mockLancamentosBackend[index],
      status: data?.status,
      motivo_invalidacao: data?.motivo_invalidacao || null,
      validado_por: getCurrentMockUser()?.id,
      validado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return mockLancamentosBackend[index];
  },
  
  'DELETE /lancamentos/:id': async (params) => {
    await delay();
    const index = mockLancamentosBackend.findIndex(l => l.id === params.id);
    if (index === -1) throw new Error('Lançamento não encontrado');
    mockLancamentosBackend.splice(index, 1);
    return { success: true };
  },
  
  // Eventos Folha
  'GET /eventos-folha': async () => {
    await delay();
    return mockEventosFolhaBackend;
  },
  
  'GET /eventos-folha/:id': async (params) => {
    await delay();
    const evento = mockEventosFolhaBackend.find(e => e.id === params.id);
    if (!evento) throw new Error('Evento não encontrado');
    return evento;
  },
  
  'POST /eventos-folha': async (_params, data) => {
    await delay();
    const newEvento = {
      ...data,
      id: String(mockEventosFolhaBackend.length + 1),
      created_at: new Date().toISOString(),
    };
    mockEventosFolhaBackend.push(newEvento);
    return newEvento;
  },
  
  'PUT /eventos-folha/:id': async (params, data) => {
    await delay();
    const index = mockEventosFolhaBackend.findIndex(e => e.id === params.id);
    if (index === -1) throw new Error('Evento não encontrado');
    mockEventosFolhaBackend[index] = { ...mockEventosFolhaBackend[index], ...data };
    return mockEventosFolhaBackend[index];
  },
  
  'DELETE /eventos-folha/:id': async (params) => {
    await delay();
    const index = mockEventosFolhaBackend.findIndex(e => e.id === params.id);
    if (index === -1) throw new Error('Evento não encontrado');
    mockEventosFolhaBackend.splice(index, 1);
    return { success: true };
  },
  
  // Audit
  'GET /audit': async () => {
    await delay();
    return mockAuditLogs;
  },
  
  'GET /audit/entity/:type/:id': async (params) => {
    await delay();
    return mockAuditLogs.filter(log => log.entity_type === params.type && log.entity_id === params.id);
  },
  
  'POST /audit': async (_params, data) => {
    await delay();
    const newLog = {
      id: String(mockAuditLogs.length + 1),
      ...data,
      created_at: new Date().toISOString(),
    };
    mockAuditLogs.push(newLog);
    return newLog;
  },
  
  // Dashboard
  'GET /dashboard/summary': async () => {
    await delay();
    return mockDashboardSummary;
  },
  
  'GET /dashboard/rh': async () => {
    await delay();
    const currentPeriod = mockPeriodosBackend.find(p => p.status === 'aberto');
    const lancamentosCurrentPeriod = mockLancamentosBackend.filter(l => l.periodo_id === currentPeriod?.id);
    
    return {
      totalElegiveis: mockColaboradoresBackend.filter(c => c.ativo).length,
      totalCestaUtilizada: lancamentosCurrentPeriod
        .filter(l => l.status === 'valido')
        .reduce((sum, l) => sum + l.valor_considerado, 0),
      totalCestaDisponivel: mockColaboradoresBackend
        .filter(c => c.ativo)
        .reduce((sum, c) => sum + c.cesta_beneficios_teto, 0),
      pendentesValidacao: lancamentosCurrentPeriod.filter(l => l.status === 'enviado' || l.status === 'em_analise').length,
      diasRestantes: 9,
      periodoAtual: currentPeriod?.periodo || '01/2026',
    };
  },
  
  'GET /dashboard/financeiro': async () => {
    await delay();
    const currentPeriod = mockPeriodosBackend.find(p => p.status === 'aberto');
    const lancamentosCurrentPeriod = mockLancamentosBackend.filter(l => l.periodo_id === currentPeriod?.id);
    
    return {
      totalProcessado: lancamentosCurrentPeriod
        .filter(l => l.status === 'valido')
        .reduce((sum, l) => sum + l.valor_considerado, 0),
      totalPendente: lancamentosCurrentPeriod
        .filter(l => l.status !== 'valido' && l.status !== 'invalido')
        .reduce((sum, l) => sum + l.valor_lancado, 0),
      exportacoesRealizadas: 2,
      periodoAtual: currentPeriod?.periodo || '01/2026',
      distribuicaoPorDepartamento: [
        { departamento: 'Tecnologia da Informação', valor: 3750, percentual: 45 },
        { departamento: 'Financeiro', valor: 2800, percentual: 34 },
        { departamento: 'Recursos Humanos', valor: 180, percentual: 2 },
        { departamento: 'Marketing', valor: 1500, percentual: 19 },
      ],
    };
  },
  
  // Fechamento
  'GET /fechamento': async () => {
    await delay();
    return mockFechamentos;
  },
  
  'GET /fechamento/:id': async (params) => {
    await delay();
    const fechamento = mockFechamentos.find(f => f.id === params.id);
    if (!fechamento) throw new Error('Fechamento não encontrado');
    return fechamento;
  },
  
  'POST /fechamento/processar': async (_params, data) => {
    await delay();
    const newFechamento = {
      id: 'fech-' + (mockFechamentos.length + 1),
      periodo_id: data?.periodo_id,
      status: 'processado',
      data_processamento: new Date().toISOString(),
      total_colaboradores: mockColaboradoresBackend.filter(c => c.ativo).length,
      total_eventos: mockLancamentosBackend.filter(l => l.periodo_id === data?.periodo_id && l.status === 'valido').length,
      valor_total: mockLancamentosBackend
        .filter(l => l.periodo_id === data?.periodo_id && l.status === 'valido')
        .reduce((sum, l) => sum + l.valor_considerado, 0),
      usuario_id: getCurrentMockUser()?.id || 'unknown',
      detalhes_erro: null,
      created_at: new Date().toISOString(),
      periodo: mockPeriodosBackend.find(p => p.id === data?.periodo_id),
    };
    mockFechamentos.push(newFechamento);
    return newFechamento;
  },
  
  // Anexos (retorna vazio por padrão)
  'GET /lancamentos/:id/anexos': async () => {
    await delay();
    return [];
  },
  
  'POST /lancamentos/:id/anexos': async () => {
    await delay();
    return {
      id: 'anexo-' + Date.now(),
      nome_arquivo: 'documento.pdf',
      tipo_arquivo: 'application/pdf',
      tamanho: 1024,
      storage_path: '/mock/path',
      created_at: new Date().toISOString(),
    };
  },
  
  'DELETE /anexos/:id': async () => {
    await delay();
    return { success: true };
  },
  
  // Export
  'POST /export/excel': async () => {
    await delay();
    return { url: '/mock-export.xlsx' };
  },
  
  'POST /export/pdf': async () => {
    await delay();
    return { url: '/mock-export.pdf' };
  },
  
  'GET /export/fechamento/:id': async () => {
    await delay();
    return { url: '/mock-fechamento.xlsx' };
  },
};

// Helper to match route patterns
export function matchRoute(method: string, path: string): { handler: string; params: Record<string, string> } | null {
  const routes = Object.keys(handlers);
  
  for (const route of routes) {
    const [routeMethod, routePath] = route.split(' ');
    if (routeMethod !== method) continue;
    
    // Convert route pattern to regex
    const paramNames: string[] = [];
    const regexPattern = routePath.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    
    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);
    
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      return { handler: route, params };
    }
  }
  
  return null;
}

export async function handleMockRequest(method: string, endpoint: string, data?: any): Promise<any> {
  // Remove /api prefix if present
  const path = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
  
  const matched = matchRoute(method, path);
  
  if (!matched) {
    console.warn(`[MOCK] No handler for ${method} ${path}`);
    return {};
  }
  
  console.log(`[MOCK] ${method} ${path}`, data);
  
  const handler = handlers[matched.handler];
  return handler(matched.params, data);
}
