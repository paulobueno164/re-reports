import { useEffect, useState } from 'react';
import { FileText, Image, Download, Eye, Loader2, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import anexosService, { Anexo } from '@/services/anexos.service';

interface Attachment {
  id: string;
  nomeArquivo: string;
  tipoArquivo: string;
  tamanho: number;
  storagePath: string;
}

interface AttachmentViewerProps {
  lancamentoId: string;
  className?: string;
}

export function AttachmentViewer({ lancamentoId, className }: AttachmentViewerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<'image' | 'pdf'>('image');
  const [previewName, setPreviewName] = useState('');
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchAttachments();
  }, [lancamentoId]);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const data = await anexosService.getByLancamentoId(lancamentoId);
      setAttachments(
        data.map((a) => ({
          id: a.id,
          nomeArquivo: a.nome_arquivo,
          tipoArquivo: a.tipo_arquivo,
          tamanho: a.tamanho,
          storagePath: a.storage_path,
        }))
      );
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
    setLoading(false);
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const blob = await anexosService.download(attachment.storagePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    setLoadingPreview(true);
    setPreviewName(attachment.nomeArquivo);
    setZoom(100);
    setRotation(0);

    try {
      const url = anexosService.getViewUrl(attachment.id);
      
      if (attachment.tipoArquivo.startsWith('image/')) {
        setPreviewType('image');
        setPreviewUrl(url);
        setPreviewOpen(true);
      } else if (attachment.tipoArquivo === 'application/pdf') {
        setPreviewType('pdf');
        setPreviewUrl(url);
        setPreviewOpen(true);
      } else {
        // For other files, download directly
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error getting preview URL:', error);
    }
    setLoadingPreview(false);
  };

  const getFileIcon = (tipoArquivo: string) => {
    if (tipoArquivo.startsWith('image/')) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (tipoArquivo === 'application/pdf') {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPreviewable = (tipoArquivo: string) => {
    return tipoArquivo.startsWith('image/') || tipoArquivo === 'application/pdf';
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando anexos...</span>
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Nenhum comprovante anexado
      </p>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Thumbnail Grid for Images */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {attachments.filter((a) => a.tipoArquivo.startsWith('image/')).map((attachment) => (
          <AttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            onPreview={() => handlePreview(attachment)}
            onDownload={() => handleDownload(attachment)}
          />
        ))}
      </div>

      {/* List for Non-Image Files */}
      {attachments.filter((a) => !a.tipoArquivo.startsWith('image/')).map((attachment) => (
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
            {isPreviewable(attachment.tipoArquivo) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePreview(attachment)}
                title="Visualizar"
                disabled={loadingPreview}
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDownload(attachment)}
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-full max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="truncate">{previewName}</span>
              {previewType === 'image' && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Diminuir">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
                  <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Aumentar">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleRotate} title="Girar">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30 rounded-lg min-h-[400px]">
            {previewType === 'image' && previewUrl && (
              <img
                src={previewUrl}
                alt={previewName}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
                className="max-w-full max-h-full object-contain"
              />
            )}
            {previewType === 'pdf' && previewUrl && (
              <iframe
                src={previewUrl}
                title={previewName}
                className="w-full h-full min-h-[500px] rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Thumbnail component for image attachments
function AttachmentThumbnail({
  attachment,
  onPreview,
  onDownload,
}: {
  attachment: Attachment;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThumbnail();
  }, [attachment.storagePath]);

  const loadThumbnail = async () => {
    try {
      const url = anexosService.getViewUrl(attachment.id);
      setThumbnailUrl(url);
    } catch (error) {
      console.error('Error loading thumbnail:', error);
    }
    setLoading(false);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={attachment.nomeArquivo}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {/* Overlay with actions */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <Button variant="secondary" size="icon" onClick={onPreview} title="Visualizar">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={onDownload} title="Baixar">
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* File name */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="text-xs text-white truncate">{attachment.nomeArquivo}</p>
      </div>
    </div>
  );
}
