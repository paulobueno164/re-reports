import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUser, AppRole } from '@/services/auth.service';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  roles: AppRole[];
  activeRole: AppRole | null;
  hasRole: (role: AppRole) => boolean;
  setActiveRole: (role: AppRole | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_ROLE_STORAGE_KEY = 'active_role';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);

  // Carregar role ativa do localStorage ao inicializar
  useEffect(() => {
    const savedActiveRole = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
    if (savedActiveRole && ['FINANCEIRO', 'COLABORADOR', 'RH', 'ADMINISTRADOR'].includes(savedActiveRole)) {
      setActiveRoleState(savedActiveRole as AppRole);
    }
  }, []);

  const fetchCurrentUser = async () => {
    if (!authService.isAuthenticated()) {
      setUser(null);
      setRoles([]);
      setActiveRoleState(null);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      setRoles(currentUser.roles);

      // Se o usuário tem múltiplas roles, definir a role ativa
      if (currentUser.roles.length > 1) {
        const savedActiveRole = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as AppRole | null;
        if (savedActiveRole && currentUser.roles.includes(savedActiveRole)) {
          setActiveRoleState(savedActiveRole);
        } else {
          // Definir a primeira role como padrão
          const firstRole = currentUser.roles[0];
          setActiveRoleState(firstRole);
          localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, firstRole);
        }
      } else {
        // Se tem apenas uma role, não definir role ativa (comportamento padrão)
        setActiveRoleState(null);
        localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      }
    } catch (error) {
      // Token inválido ou expirado
      authService.logout();
      setUser(null);
      setRoles([]);
      setActiveRoleState(null);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const setActiveRole = (role: AppRole | null) => {
    if (role && roles.includes(role)) {
      setActiveRoleState(role);
      localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
    } else {
      setActiveRoleState(null);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    }
  };

  const hasRole = (role: AppRole): boolean => {
    // Se há uma role ativa, verificar apenas ela
    if (activeRole) {
      return activeRole === role;
    }
    // Caso contrário, verificar se o usuário tem a role (comportamento padrão)
    return roles.includes(role);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authService.login(email, password);
      setUser(result.user);
      setRoles(result.user.roles);
      
      // Se o usuário tem múltiplas roles, definir a role ativa
      if (result.user.roles.length > 1) {
        const savedActiveRole = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as AppRole | null;
        if (savedActiveRole && result.user.roles.includes(savedActiveRole)) {
          setActiveRoleState(savedActiveRole);
        } else {
          const firstRole = result.user.roles[0];
          setActiveRoleState(firstRole);
          localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, firstRole);
        }
      } else {
        setActiveRoleState(null);
        localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      }
      
      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message || 'Erro ao fazer login') };
    }
  };

  const signOut = async () => {
    await authService.logout();
    setUser(null);
    setRoles([]);
    setActiveRoleState(null);
    localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        roles,
        activeRole,
        hasRole,
        setActiveRole,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
