import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
  href?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  variant = 'default',
  href,
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-primary text-primary-foreground',
    accent: 'bg-accent text-accent-foreground',
    success: 'bg-success/10 border-success/20',
    warning: 'bg-warning/10 border-warning/20',
  };

  const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-foreground/10 text-primary-foreground',
    accent: 'bg-accent-foreground/10 text-accent-foreground',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
  };

  const content = (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className={cn(
          'text-sm font-medium',
          variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
        )}>
          {title}
        </p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {description && (
          <p className={cn(
            'text-xs',
            variant === 'default' ? 'text-muted-foreground' : 'opacity-70'
          )}>
            {description}
          </p>
        )}
        {trend && (
          <p className={cn(
            'text-xs font-medium',
            trend.isPositive ? 'text-success' : 'text-destructive'
          )}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </p>
        )}
      </div>
      {Icon && (
        <div className={cn(
          'rounded-lg p-2.5',
          iconStyles[variant]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  );

  const cardClasses = cn(
    'stat-card block',
    variantStyles[variant],
    href && 'cursor-pointer hover:brightness-95 transition-all',
    className
  );

  if (href) {
    return (
      <Link to={href} className={cardClasses}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cardClasses}>
      {content}
    </div>
  );
}
