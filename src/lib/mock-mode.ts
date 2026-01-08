// Mock Mode Configuration
// Set to true to use mocked data instead of real API calls
export const MOCK_MODE = true;

// Mock Users for authentication
export const MOCK_USERS = [
  {
    id: 'user-rh-001',
    email: 'rh@sistema.com.br',
    password: 'admin123',
    nome: 'Administrador RH',
    roles: ['RH'] as ('FINANCEIRO' | 'COLABORADOR' | 'RH')[],
  },
  {
    id: 'user-financeiro-001',
    email: 'financeiro@sistema.com.br',
    password: 'admin123',
    nome: 'Gestor Financeiro',
    roles: ['FINANCEIRO'] as ('FINANCEIRO' | 'COLABORADOR' | 'RH')[],
  },
  {
    id: 'user-colaborador-001',
    email: 'colaborador@sistema.com.br',
    password: 'admin123',
    nome: 'João Silva Santos',
    roles: ['COLABORADOR'] as ('FINANCEIRO' | 'COLABORADOR' | 'RH')[],
    colaboradorId: '1', // Links to mockEmployees[0]
  },
];

// Current logged in user (stored in memory for mock mode)
let currentMockUser: typeof MOCK_USERS[0] | null = null;

export const setCurrentMockUser = (user: typeof MOCK_USERS[0] | null) => {
  currentMockUser = user;
  if (user) {
    localStorage.setItem('mock_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('mock_user');
  }
};

export const getCurrentMockUser = () => {
  if (currentMockUser) return currentMockUser;
  
  const stored = localStorage.getItem('mock_user');
  if (stored) {
    currentMockUser = JSON.parse(stored);
    return currentMockUser;
  }
  return null;
};

export const authenticateMockUser = (email: string, password: string) => {
  const user = MOCK_USERS.find(u => u.email === email && u.password === password);
  if (user) {
    setCurrentMockUser(user);
    return { user, token: 'mock-token-' + user.id };
  }
  throw new Error('Email ou senha inválidos');
};

export const logoutMockUser = () => {
  setCurrentMockUser(null);
};
