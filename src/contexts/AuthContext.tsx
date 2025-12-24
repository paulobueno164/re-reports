import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUser, AppRole } from '@/services/auth.service';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const fetchCurrentUser = async () => {
    if (!authService.isAuthenticated()) {
      setUser(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      setRoles(currentUser.roles);
    } catch (error) {
      // Token inválido ou expirado
      authService.logout();
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authService.login(email, password);
      setUser(result.user);
      setRoles(result.user.roles);
      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message || 'Erro ao fazer login') };
    }
  };

  const signOut = async () => {
    await authService.logout();
    setUser(null);
    setRoles([]);
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
        hasRole,
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
