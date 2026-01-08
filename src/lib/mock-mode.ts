// Mock Mode User Management
import { MOCK_MODE, MOCK_USERS } from './mock-config';
export { MOCK_MODE, MOCK_USERS };

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
