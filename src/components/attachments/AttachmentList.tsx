import { useEffect, useState } from 'react';
import { FileText, Image, Download, Eye, Loader2, Trash2 } from 'lucide-react';
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
  const [inlinePreviewUrl, setInlinePreviewUrl] = useState<string | null>(null);
  const [loadingInlinePreview, setLoadingInlinePreview] = useState(false);

  useEffect(() => {
    fetchAttachments();
    
    // Cleanup: revogar blob URLs quando o componente desmontar
    return () => {
      if (inlinePreviewUrl) {
        URL.revokeObjectURL(inlinePreviewUrl);
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [lancamentoId]);

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
    try {
      if (attachment.tipoArquivo.startsWith('image/')) {
        // Para imagens, fazer download e criar blob URL
        const blob = await anexosService.download(attachment.id);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewOpen(true);
      } else if (attachment.tipoArquivo === 'application/pdf') {
        // Para PDFs, fazer download e abrir em nova aba
        const blob = await anexosService.download(attachment.id);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Limpar o blob URL após um tempo para liberar memória
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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

      <Dialog open={previewOpen} onOpenChange={(open) => {
        setPreviewOpen(open);
        // Limpar blob URL quando fechar o dialog
        if (!open && previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }}>
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
                onError={(e) => {
                  toast({
                    title: 'Erro ao carregar imagem',
                    description: 'Não foi possível exibir a imagem',
                    variant: 'destructive',
                  });
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}