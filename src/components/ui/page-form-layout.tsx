import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { BackButton } from './back-button';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './card';

interface PageFormLayoutProps {
  title: string;
  description?: string;
  backTo: string;
  backLabel?: string;
  children: ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  isViewMode?: boolean;
  extraActions?: ReactNode;
}

export const PageFormLayout = ({
  title,
  description,
  backTo,
  backLabel,
  children,
  onSave,
  onCancel,
  saving = false,
  isViewMode = false,
  extraActions,
}: PageFormLayoutProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <BackButton to={backTo} label={backLabel} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          {children}

          {!isViewMode && (onSave || onCancel) && (
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              {extraActions}
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={saving}>
                  Cancelar
                </Button>
              )}
              {onSave && (
                <Button onClick={onSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              )}
            </div>
          )}

          {isViewMode && extraActions && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              {extraActions}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
