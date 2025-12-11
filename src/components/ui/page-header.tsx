import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="page-title text-xl sm:text-2xl">{title}</h1>
        {description && <p className="page-description text-sm sm:text-base">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">{children}</div>}
    </div>
  );
}
