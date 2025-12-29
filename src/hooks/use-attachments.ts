import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import anexosService, { Anexo } from '@/services/anexos.service';

export interface Attachment {
  id: string;
  lancamentoId: string;
  nomeArquivo: string;
  tipoArquivo: string;
  tamanho: number;
  storagePath: string;
  hashComprovante?: string;
  createdAt: Date;
}

export function useAttachments(lancamentoId?: string) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const mapAnexo = (a: Anexo): Attachment => ({
    id: a.id,
    lancamentoId: a.lancamento_id,
    nomeArquivo: a.nome_arquivo,
    tipoArquivo: a.tipo_arquivo,
    tamanho: a.tamanho,
    storagePath: a.storage_path,
    hashComprovante: a.hash_comprovante || undefined,
    createdAt: new Date(a.created_at),
  });

  const fetchAttachments = async (id: string) => {
    try {
      const data = await anexosService.getByLancamentoId(id);
      const mapped = data.map(mapAnexo);
      setAttachments(mapped);
      return mapped;
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
  };

  const uploadAttachment = async (lancamentoId: string, file: File) => {
    setUploading(true);

    try {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Arquivo deve ter no máximo 5MB');
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/jpg',
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error('Tipo de arquivo não permitido');
      }

      await anexosService.upload(lancamentoId, file);

      toast({
        title: 'Arquivo enviado',
        description: `${file.name} foi anexado com sucesso.`,
      });

      await fetchAttachments(lancamentoId);
    } catch (error: any) {
      toast({
        title: 'Erro no upload',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    try {
      await anexosService.delete(attachment.id);

      toast({
        title: 'Arquivo removido',
        description: `${attachment.nomeArquivo} foi removido.`,
      });

      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const blob = await anexosService.download(attachment.storagePath);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: 'Erro ao baixar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getPreviewUrl = async (attachment: Attachment): Promise<string | null> => {
    try {
      // For Express backend, we use the file URL directly
      return anexosService.getFileUrl(attachment.storagePath);
    } catch (error) {
      console.error('Error getting preview URL:', error);
      return null;
    }
  };

  return {
    attachments,
    uploading,
    fetchAttachments,
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    getPreviewUrl,
  };
}
