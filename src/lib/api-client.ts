// API Client for RE-Reports Backend
import { MOCK_MODE } from './mock-config';
import { handleMockRequest } from './mock-api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  clearToken(): void {
    localStorage.removeItem('auth_token');
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (!skipAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro de conexão' }));
      const errorMessage = error.error || error.message || `HTTP ${response.status}`;
      const httpError = new Error(errorMessage);
      (httpError as any).status = response.status;
      throw httpError;
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    if (MOCK_MODE) return handleMockRequest('GET', endpoint) as Promise<T>;
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    if (MOCK_MODE) return handleMockRequest('POST', endpoint, data) as Promise<T>;
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    if (MOCK_MODE) return handleMockRequest('PUT', endpoint, data) as Promise<T>;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    if (MOCK_MODE) return handleMockRequest('DELETE', endpoint) as Promise<T>;
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Upload de arquivos
  async uploadFile(endpoint: string, file: File, additionalData?: Record<string, string>): Promise<any> {
    if (MOCK_MODE) return handleMockRequest('POST', endpoint);
    
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro no upload' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Download de arquivos
  async downloadFile(endpoint: string): Promise<Blob> {
    if (MOCK_MODE) return new Blob(['mock file content'], { type: 'application/pdf' });
    
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.blob();
  }

  getFileUrl(anexoId: string): string {
    if (MOCK_MODE) return '/placeholder.svg';
    return `${this.baseUrl}/api/anexos/${anexoId}/view`;
  }
}

export const apiClient = new ApiClient(API_URL);
export default apiClient;
