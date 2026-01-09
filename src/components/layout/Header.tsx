import { useState } from 'react';
import { Search, User, Menu, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useIsMobile } from '@/hooks/use-mobile';
import onsetLogo from '@/assets/onset-logo.png';
import { AppRole } from '@/services/auth.service';

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

const ROLE_LABELS: Record<AppRole, string> = {
  RH: 'RH',
  FINANCEIRO: 'Financeiro',
  COLABORADOR: 'Colaborador',
  ADMINISTRADOR: 'Administrador',
};

export function Header({ title, onMenuClick }: HeaderProps) {
  const { user, signOut, roles, activeRole, setActiveRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchExpanded, setSearchExpanded] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const getDashboardRouteForRole = (role: AppRole): string => {
    switch (role) {
      case 'RH':
        return '/dashboard-rh';
      case 'FINANCEIRO':
        return '/dashboard-financeiro';
      case 'ADMINISTRADOR':
        // Página inicial do ADMINISTRADOR é sempre Configurações
        return '/configuracoes';
      case 'COLABORADOR':
      default:
        return '/';
    }
  };

  const handleRoleChange = (role: AppRole) => {
    setActiveRole(role);
    // Navegar para a página inicial da role e recarregar
    const dashboardRoute = getDashboardRouteForRole(role);
    window.location.href = dashboardRoute;
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getPrimaryRole = () => {
    if (activeRole) {
      return ROLE_LABELS[activeRole];
    }
    if (roles.includes('RH')) return 'RH';
    if (roles.includes('FINANCEIRO')) return 'Financeiro';
    return 'Colaborador';
  };

  const hasMultipleRoles = roles.length > 1;

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-card px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile Menu Button */}
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuClick}
            className="h-10 w-10"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        )}
        
        {/* Mobile Logo */}
        {isMobile && !searchExpanded && (
          <img src={onsetLogo} alt="Onset" className="h-8 w-auto" />
        )}

        {title && !isMobile && (
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Search - Desktop */}
        {!isMobile && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="w-64 pl-9 bg-background"
            />
          </div>
        )}

        {/* Search - Mobile Expandable */}
        {isMobile && (
          <>
            {searchExpanded ? (
              <div className="absolute inset-x-0 top-0 z-50 flex h-14 items-center gap-2 bg-card px-3">
                <Input
                  type="search"
                  placeholder="Buscar..."
                  className="flex-1 h-10 bg-background"
                  autoFocus
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSearchExpanded(false)}
                  className="h-10 w-10"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSearchExpanded(true)}
                className="h-10 w-10"
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2 h-10">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user ? getInitials(user.email || '') : 'U'}
                </AvatarFallback>
              </Avatar>
              {!isMobile && (
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium max-w-32 truncate">{user?.email}</span>
                  <span className="text-xs text-muted-foreground">{getPrimaryRole()}</span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Minha Conta</p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hasMultipleRoles && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                  Perfil Ativo
                </DropdownMenuLabel>
                {roles.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{ROLE_LABELS[role]}</span>
                      {activeRole === role && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
