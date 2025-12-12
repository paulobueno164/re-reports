import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NameInconsistencyAlertProps {
  colaboradorNome: string;
  profileNome: string;
}

export function NameInconsistencyAlert({ colaboradorNome, profileNome }: NameInconsistencyAlertProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-warning cursor-help">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm font-medium mb-1">Nomes divergentes</p>
          <p className="text-xs text-muted-foreground">
            <strong>Nome RH:</strong> {colaboradorNome}
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Nome Usuário:</strong> {profileNome}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
