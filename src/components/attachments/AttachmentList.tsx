import { useEffect, useState, useRef } from 'react';
import { FileText, Image, Download, Eye, Loader2, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { anexosService, Anexo } from '@/services/anexos.service';

interface Attachment {
  id: string;
  nomeArquivo: string;
  tipoArquivo: string;
  tamanho: number;
  storagePath: string;
}

interface AttachmentListProps {
  lancamentoId: string;
  allowDelete?: boolean;
  onDeleteComplete?: () => void;
  onCountChange?: (count: number) => void;
}

export function AttachmentList({ lancamentoId, allowDelete = false, onDeleteComplete, onCountChange }: AttachmentListProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<'image' | 'pdf'>('image');
  const [previewName, setPreviewName] = useState('');
  const [zoom, setZoom] = useState(100);
  const [inlinePreviewUrl, setInlinePreviewUrl] = useState<string | null>(null);
  const [loadingInlinePreview, setLoadingInlinePreview] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchAttachments();
    
    // Cleanup: revogar blob URLs quando o componente desmontar
    return () => {
      if (inlinePreviewUrl) {
        URL.revokeObjectURL(inlinePreviewUrl);
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [lancamentoId]);

  // Limpar blob URL quando o modal fechar (com delay para garantir que não está mais em uso)
  useEffect(() => {
    if (!previewOpen && previewUrlRef.current) {
      const urlToRevoke = previewUrlRef.current;
      previewUrlRef.current = null;
      // Usar setTimeout para garantir que o React terminou de renderizar
      setTimeout(() => {
        URL.revokeObjectURL(urlToRevoke);
      }, 100);
    }
  }, [previewOpen]);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const data = await anexosService.getByLancamentoId(lancamentoId);
      const mapped = data.map((a) => ({
        id: a.id,
        nomeArquivo: a.nome_arquivo,
        tipoArquivo: a.tipo_arquivo,
        tamanho: a.tamanho,
        storagePath: a.storage_path,
      }));
      setAttachments(mapped);
      onCountChange?.(mapped.length);
      
      // Load inline preview if single image attachment
      if (mapped.length === 1 && mapped[0].tipoArquivo.startsWith('image/')) {
        loadInlinePreview(mapped[0]);
      } else {
        setInlinePreviewUrl(null);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
    setLoading(false);
  };

  const loadInlinePreview = async (attachment: Attachment) => {
    setLoadingInlinePreview(true);
    try {
      const blob = await anexosService.download(attachment.id);
      const url = URL.createObjectURL(blob);
      setInlinePreviewUrl(url);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast({
        title: 'Erro ao carregar preview',
        description: 'Não foi possível carregar a visualização do arquivo',
        variant: 'destructive',
      });
    }
    setLoadingInlinePreview(false);
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const blob = await anexosService.download(attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Erro ao baixar',
        description: 'Não foi possível baixar o arquivo',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    setPreviewName(attachment.nomeArquivo);
    setZoom(100);
    
    // Revogar blob URL anterior antes de criar um novo
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    
    try {
      if (attachment.tipoArquivo.startsWith('image/')) {
        // Para imagens, fazer download e criar blob URL
        const blob = await anexosService.download(attachment.id);
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewType('image');
        setPreviewUrl(url);
        setPreviewOpen(true);
      } else if (attachment.tipoArquivo === 'application/pdf') {
        // Para PDFs, fazer download e abrir no modal
        const blob = await anexosService.download(attachment.id);
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewType('pdf');
        setPreviewUrl(url);
        setPreviewOpen(true);
      } else {
        // Para outros tipos, tentar abrir diretamente
        const url = anexosService.getViewUrl(attachment.id);
        window.open(url, '_blank');
      }
    } catch (error) {
      toast({
        title: 'Erro ao visualizar',
        description: 'Não foi possível carregar o arquivo',
        variant: 'destructive',
      });
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 300));
    setImagePosition({ x: 0, y: 0 });
  };
  const handleZoomOut = () => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 25, 50);
      if (newZoom === 100) {
        setImagePosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom > 100 && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && zoom > 100) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleDelete = async (attachment: Attachment) => {
    setDeleting(attachment.id);
    try {
      await anexosService.delete(attachment.id);

      toast({
        title: 'Comprovante removido',
        description: `${attachment.nomeArquivo} foi removido com sucesso.`,
      });

      const newAttachments = attachments.filter((a) => a.id !== attachment.id);
      setAttachments(newAttachments);
      onCountChange?.(newAttachments.length);
      onDeleteComplete?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
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
    <div className="space-y-3">
      {/* Inline preview for single image attachment */}
      {attachments.length === 1 && attachments[0].tipoArquivo.startsWith('image/') && (
        <div className="rounded-lg border overflow-hidden bg-muted/30">
          {loadingInlinePreview ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : inlinePreviewUrl ? (
            <img
              src={inlinePreviewUrl}
              alt={attachments[0].nomeArquivo}
              className="w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                setPreviewUrl(inlinePreviewUrl);
                setPreviewOpen(true);
              }}
            />
          ) : null}
        </div>
      )}
      
      {/* Single PDF attachment - show open button */}
      {attachments.length === 1 && attachments[0].tipoArquivo === 'application/pdf' && (
        <div className="rounded-lg border p-4 bg-muted/30 flex items-center justify-center">
          <Button 
            variant="outline" 
            onClick={() => handlePreview(attachments[0])}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Visualizar PDF
          </Button>
        </div>
      )}

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
              onClick={() => handleDownload(attachment)}
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </Button>
            {allowDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remover"
                    disabled={deleting === attachment.id}
                  >
                    {deleting === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover comprovante?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover "{attachment.nomeArquivo}"? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(attachment)}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      ))}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="!w-auto !h-auto !max-w-[98vw] !max-h-[98vh] flex flex-col p-0 m-0 overflow-auto">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
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
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {(previewType === 'image' || previewType === 'pdf') && previewUrl && (
            <div 
              ref={containerRef}
              className="flex items-center justify-center bg-muted/30 p-6 overflow-hidden relative"
              style={{ 
                width: '100%', 
                height: '100%',
                minHeight: '400px',
                maxHeight: 'calc(98vh - 120px)',
                cursor: zoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              {previewType === 'image' && (
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt={previewName}
                  style={{
                    maxWidth: zoom > 100 ? '100%' : 'none',
                    maxHeight: zoom > 100 ? '100%' : 'none',
                    width: 'auto',
                    height: 'auto',
                    transform: `scale(${zoom / 100}) translate(${imagePosition.x / (zoom / 100)}px, ${imagePosition.y / (zoom / 100)}px)`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                    display: 'block',
                    userSelect: 'none',
                  }}
                  className="object-contain"
                  draggable={false}
                  onError={(e) => {
                    toast({
                      title: 'Erro ao carregar imagem',
                      description: 'Não foi possível exibir a imagem',
                      variant: 'destructive',
                    });
                  }}
                  onLoad={(e) => {
                    // Reset zoom quando uma nova imagem carrega
                    setZoom(100);
                    setImagePosition({ x: 0, y: 0 });
                  }}
                />
              )}
              {previewType === 'pdf' && (
                <iframe
                  src={previewUrl}
                  title={previewName}
                  className="w-full h-[calc(95vh-8rem)] rounded-lg border-0"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}