import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

// Generate a hash for uniqueness validation
async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function useAttachments(lancamentoId?: string) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = async (id: string) => {
    const { data, error } = await supabase
      .from('anexos')
      .select('*')
      .eq('lancamento_id', id);

    if (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }

    const mapped = data.map((a: any) => ({
      id: a.id,
      lancamentoId: a.lancamento_id,
      nomeArquivo: a.nome_arquivo,
      tipoArquivo: a.tipo_arquivo,
      tamanho: a.tamanho,
      storagePath: a.storage_path,
      hashComprovante: a.hash_comprovante,
      createdAt: new Date(a.created_at),
    }));

    setAttachments(mapped);
    return mapped;
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

      // Generate file hash for uniqueness validation
      const fileHash = await generateFileHash(file);

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${lancamentoId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Save metadata to anexos table with hash
      const { error: insertError } = await supabase.from('anexos').insert({
        lancamento_id: lancamentoId,
        nome_arquivo: file.name,
        tipo_arquivo: file.type,
        tamanho: file.size,
        storage_path: fileName,
        hash_comprovante: fileHash,
      });

      if (insertError) {
        // Rollback storage upload
        await supabase.storage.from('comprovantes').remove([fileName]);
        
        // Check if it's a duplicate error
        if (insertError.message.includes('comprovante já foi utilizado') || 
            insertError.code === '23505') {
          throw new Error('Este comprovante já foi utilizado em outro lançamento. Cada nota fiscal/recibo só pode ser lançado uma única vez.');
        }
        throw insertError;
      }

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
      // Delete from storage
      await supabase.storage.from('comprovantes').remove([attachment.storagePath]);

      // Delete from database
      const { error } = await supabase.from('anexos').delete().eq('id', attachment.id);

      if (error) throw error;

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
      const { data, error } = await supabase.storage
        .from('comprovantes')
        .download(attachment.storagePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
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
      const { data, error } = await supabase.storage
        .from('comprovantes')
        .createSignedUrl(attachment.storagePath, 60 * 5); // 5 min expiry

      if (error) throw error;
      return data.signedUrl;
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
