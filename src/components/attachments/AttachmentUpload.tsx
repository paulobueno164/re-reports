import { useRef, useState } from 'react';
import { Upload, X, FileText, Image, Download, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAttachments, Attachment } from '@/hooks/use-attachments';
import { cn } from '@/lib/utils';

interface AttachmentUploadProps {
  lancamentoId?: string;
  onFileSelect?: (file: File) => void;
  disabled?: boolean;
  viewMode?: boolean;
}

export function AttachmentUpload({
  lancamentoId,
  onFileSelect,
  disabled = false,
  viewMode = false,
}: AttachmentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    attachments,
    uploading,
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    getPreviewUrl,
    fetchAttachments,
  } = useAttachments();

  // Fetch attachments when component mounts with lancamentoId
  useState(() => {
    if (lancamentoId) {
      fetchAttachments(lancamentoId);
    }
  });

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

    if (disabled || viewMode) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleFileChange(files[0]);
    }
  };

  const handleFileChange = async (file: File) => {
    if (onFileSelect) {
      onFileSelect(file);
    }

    if (lancamentoId) {
      await uploadAttachment(lancamentoId, file);
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    const url = await getPreviewUrl(attachment);
    if (url) {
      if (attachment.tipoArquivo.startsWith('image/')) {
        setPreviewUrl(url);
        setPreviewOpen(true);
      } else {
        // For PDFs and other documents, open in new tab
        window.open(url, '_blank');
      }
    }
  };

  const getFileIcon = (tipoArquivo: string) => {
    if (tipoArquivo.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!viewMode && (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-border',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Enviando arquivo...</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-1">
                Arraste arquivos ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, XLSX, DOC, DOCX, PNG, JPG (máx. 5MB)
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
                disabled={disabled}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                Selecionar Arquivo
              </Button>
            </>
          )}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Comprovantes Anexados ({attachments.length})
          </p>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(attachment.tipoArquivo)}
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {attachment.nomeArquivo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.tamanho)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePreview(attachment)}
                  title="Visualizar"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => downloadAttachment(attachment)}
                  title="Baixar"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {!viewMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAttachment(attachment)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode && attachments.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Nenhum comprovante anexado
        </p>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visualizar Comprovante</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
