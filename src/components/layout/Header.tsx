import { useState } from 'react';
import { Search, User, Menu, X } from 'lucide-react';
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

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchExpanded, setSearchExpanded] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getPrimaryRole = () => {
    if (roles.includes('RH')) return 'RH';
    if (roles.includes('FINANCEIRO')) return 'Financeiro';
    return 'Colaborador';
  };

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
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">RE</span>
            </div>
          </div>
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
