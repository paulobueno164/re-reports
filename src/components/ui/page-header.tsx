import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('page-header flex flex-col gap-3 sm:gap-4', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="page-title text-lg sm:text-xl md:text-2xl">{title}</h1>
          {description && <p className="page-description text-xs sm:text-sm line-clamp-2">{description}</p>}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
