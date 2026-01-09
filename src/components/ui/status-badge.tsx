import { cn } from '@/lib/utils';
import { ExpenseStatus, PeriodStatus } from '@/types';

interface StatusBadgeProps {
  status: ExpenseStatus | PeriodStatus | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  enviado: {
    label: 'Enviado',
    className: 'status-badge bg-info/10 text-info',
  },
  em_analise: {
    label: 'Em Análise',
    className: 'status-badge status-analysis',
  },
  valido: {
    label: 'Válido',
    className: 'status-badge status-valid',
  },
  invalido: {
    label: 'Inválido',
    className: 'status-badge status-invalid',
  },
  aberto: {
    label: 'Aberto',
    className: 'status-badge status-valid',
  },
  fechado: {
    label: 'Fechado',
    className: 'status-badge status-draft',
  },
  pendente: {
    label: 'Pendente',
    className: 'status-badge status-pending',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'status-badge status-draft',
  };

  return (
    <span className={cn(config.className, className)}>
      {config.label}
    </span>
  );
}
