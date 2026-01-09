import { useRef, useState } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAttachments } from '@/hooks/use-attachments';
import { cn } from '@/lib/utils';

interface AttachmentUploadSimpleProps {
  lancamentoId: string;
  onUploadComplete?: () => void;
}

export function AttachmentUploadSimple({
  lancamentoId,
  onUploadComplete,
}: AttachmentUploadSimpleProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { uploading, uploadAttachment } = useAttachments();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleFileChange(files[0]);
    }
  };

  const handleFileChange = async (file: File) => {
    await uploadAttachment(lancamentoId, file);
    onUploadComplete?.();
  };

  return (
    <div className="space-y-3">
      <Alert variant="default" className="border-primary/30 bg-primary/5">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Adicione comprovantes para validação do lançamento.
        </AlertDescription>
      </Alert>

      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-border'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Enviando...</p>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground mb-2">
              Arraste ou clique para adicionar comprovantes
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(file);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Selecionar Arquivo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
