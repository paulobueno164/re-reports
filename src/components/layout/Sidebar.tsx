import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Link2,
  Receipt,
  CheckSquare,
  FileSpreadsheet,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Colaboradores',
    href: '/colaboradores',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Tipos de Despesas',
    href: '/tipos-despesas',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Calendário',
    href: '/calendario',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Eventos Folha',
    href: '/eventos-folha',
    icon: <Link2 className="w-5 h-5" />,
  },
  {
    label: 'Lançamentos',
    href: '/lancamentos',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Validação',
    href: '/validacao',
    icon: <CheckSquare className="w-5 h-5" />,
  },
  {
    label: 'Fechamento',
    href: '/fechamento',
    icon: <FileSpreadsheet className="w-5 h-5" />,
  },
  {
    label: 'Relatórios',
    href: '/relatorios',
    icon: <BarChart3 className="w-5 h-5" />,
  },
];

export function Sidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-lg font-bold text-sidebar-primary-foreground">RE</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-sidebar-foreground">RE-Reports</h1>
            <p className="text-xs text-sidebar-foreground/60">Remuneração Estratégica</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.href}>
                {item.children ? (
                  <div>
                    <button
                      onClick={() => toggleExpanded(item.label)}
                      className={cn(
                        'nav-link w-full justify-between',
                        location.pathname.startsWith(item.href) && 'bg-sidebar-accent'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        {item.icon}
                        {item.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform',
                          expandedItems.includes(item.label) && 'rotate-180'
                        )}
                      />
                    </button>
                    {expandedItems.includes(item.label) && (
                      <ul className="mt-1 ml-8 space-y-1">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <NavLink
                              to={child.href}
                              className={({ isActive }) =>
                                cn('nav-link text-sm', isActive && 'nav-link-active')
                              }
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      cn('nav-link', isActive && 'nav-link-active')
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
          <button className="nav-link w-full text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <Settings className="w-5 h-5" />
            Configurações
          </button>
          <button className="nav-link w-full text-sidebar-foreground/60 hover:text-destructive">
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
