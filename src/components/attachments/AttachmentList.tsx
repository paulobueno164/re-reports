import { useEffect, useState } from 'react';
import { FileText, Image, Download, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface Attachment {
  id: string;
  nomeArquivo: string;
  tipoArquivo: string;
  tamanho: number;
  storagePath: string;
}

interface AttachmentListProps {
  lancamentoId: string;
}

export function AttachmentList({ lancamentoId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchAttachments();
  }, [lancamentoId]);

  const fetchAttachments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('anexos')
      .select('*')
      .eq('lancamento_id', lancamentoId);

    if (!error && data) {
      setAttachments(
        data.map((a) => ({
          id: a.id,
          nomeArquivo: a.nome_arquivo,
          tipoArquivo: a.tipo_arquivo,
          tamanho: a.tamanho,
          storagePath: a.storage_path,
        }))
      );
    }
    setLoading(false);
  };

  const handleDownload = async (attachment: Attachment) => {
    const { data, error } = await supabase.storage
      .from('comprovantes')
      .download(attachment.storagePath);

    if (!error && data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    const { data, error } = await supabase.storage
      .from('comprovantes')
      .createSignedUrl(attachment.storagePath, 60 * 5);

    if (!error && data) {
      if (attachment.tipoArquivo.startsWith('image/')) {
        setPreviewUrl(data.signedUrl);
        setPreviewOpen(true);
      } else {
        window.open(data.signedUrl, '_blank');
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
    <div className="space-y-2">
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
          </div>
        </div>
      ))}

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
