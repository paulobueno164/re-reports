// Mock Mode Configuration - Separate file to avoid circular dependencies
// Set to true to use mocked data instead of real API calls
export const MOCK_MODE = true;

// Mock Users for authentication - defined here to avoid circular dependencies
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
