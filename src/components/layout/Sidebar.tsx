import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Link2,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  LogOut,
  Activity,
  History,
  X,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: ('FINANCEIRO' | 'COLABORADOR' | 'RH')[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['COLABORADOR'],
  },
  {
    label: 'Dashboard RH',
    href: '/dashboard-rh',
    icon: <Activity className="w-5 h-5" />,
    roles: ['RH'],
  },
  {
    label: 'Dashboard Financeiro',
    href: '/dashboard-financeiro',
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ['FINANCEIRO'],
  },
  {
    label: 'Colaboradores',
    href: '/colaboradores',
    icon: <Users className="w-5 h-5" />,
    roles: ['RH'],
  },
  {
    label: 'Tipos de Despesas',
    href: '/tipos-despesas',
    icon: <FileText className="w-5 h-5" />,
    roles: ['RH'],
  },
  {
    label: 'Calendário',
    href: '/calendario',
    icon: <Calendar className="w-5 h-5" />,
    roles: ['RH'],
  },
  {
    label: 'Eventos Folha',
    href: '/eventos-folha',
    icon: <Link2 className="w-5 h-5" />,
    roles: ['RH'],
  },
  {
    label: 'Lançamentos',
    href: '/lancamentos',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Fechamento',
    href: '/fechamento',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    roles: ['RH', 'FINANCEIRO'],
  },
  {
    label: 'Relatórios',
    href: '/relatorios',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    label: 'Auditoria',
    href: '/auditoria',
    icon: <History className="w-5 h-5" />,
    roles: ['RH', 'FINANCEIRO'],
  },
  {
    label: 'Gerenciar Usuários',
    href: '/gerenciar-usuarios',
    icon: <UserCog className="w-5 h-5" />,
    roles: ['RH'],
  },
];

interface SidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function SidebarContent({ onNavClick, onClose }: { onNavClick?: () => void; onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, hasRole, roles } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNavigation = navigation.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => hasRole(role));
  });

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-lg font-bold text-sidebar-primary-foreground">RE</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-sidebar-foreground">RE-Reports</h1>
            <p className="text-xs text-sidebar-foreground/60">Remuneração Estratégica</p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar menu</span>
          </Button>
        )}
      </div>

      {/* Role Badge */}
      <div className="px-6 py-3 border-b border-sidebar-border">
        <div className="flex flex-wrap gap-1">
          {roles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sidebar-primary/20 text-sidebar-primary"
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {filteredNavigation.map((item) => (
            <li key={item.href}>
              <NavLink
                to={item.href}
                onClick={onNavClick}
                className={({ isActive }) =>
                  cn('nav-link', isActive && 'nav-link-active')
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={handleLogout}
          className="nav-link w-full text-sidebar-foreground/60 hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const isMobile = useIsMobile();

  // Mobile: Sheet/Drawer
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de navegação</SheetTitle>
          </SheetHeader>
          <SidebarContent 
            onNavClick={() => onOpenChange?.(false)} 
            onClose={() => onOpenChange?.(false)} 
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}
