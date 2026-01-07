import apiClient from '@/lib/api-client';

export type AppRole = 'FINANCEIRO' | 'COLABORADOR' | 'RH';

export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  roles: AppRole[];
}

export interface LoginResult {
  user: AuthUser;
  token: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  nome: string;
  role?: AppRole;
}

export interface UserWithRoles {
  id: string;
  email: string;
  nome: string;
  avatar_url?: string;
  roles: AppRole[];
  created_at: string;
  ativo: boolean;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const result = await apiClient.post<LoginResult>('/auth/login', { email, password }, { skipAuth: true });
    apiClient.setToken(result.token);
    return result;
  },

  async logout(): Promise<void> {
    apiClient.clearToken();
  },

  async getMe(): Promise<AuthUser> {
    return apiClient.get<AuthUser>('/auth/me');
  },

  async getAllUsers(): Promise<UserWithRoles[]> {
    return apiClient.get<UserWithRoles[]>('/auth/users');
  },

  async getUserById(id: string): Promise<UserWithRoles> {
    return apiClient.get<UserWithRoles>(`/auth/users/${id}`);
  },

  async createUser(data: CreateUserInput): Promise<{ id: string; email: string }> {
    return apiClient.post('/auth/users', data);
  },

  async updateUserEmail(userId: string, email: string): Promise<void> {
    await apiClient.put(`/auth/users/${userId}/email`, { email });
  },

  async updateUserPassword(userId: string, password: string): Promise<void> {
    await apiClient.put(`/auth/users/${userId}/password`, { password });
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/auth/users/${userId}`);
  },

  async addUserRole(userId: string, role: AppRole): Promise<void> {
    await apiClient.post(`/auth/users/${userId}/roles`, { role });
  },

  async removeUserRole(userId: string, role: AppRole): Promise<void> {
    await apiClient.delete(`/auth/users/${userId}/roles/${role}`);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.put('/auth/change-password', { currentPassword, newPassword });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email }, { skipAuth: true });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password }, { skipAuth: true });
  },

  async toggleUserStatus(userId: string, ativo: boolean): Promise<void> {
    await apiClient.put(`/auth/users/${userId}/status`, { ativo });
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  },
};

export default authService;
