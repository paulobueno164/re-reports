import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import crypto from 'crypto';
import storage, { generateUniqueFileName, saveFile, deleteFile, getFileBuffer, fileExists } from '../config/storage';

export interface UploadedFile {
  originalName: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  hash: string;
}

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

// Tipos de arquivo permitidos
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
];

// Tamanho máximo: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const validateFile = (file: UploadInput): void => {
  // Validar tipo de arquivo
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    throw new Error(
      `Tipo de arquivo não permitido: ${file.mimeType}. Permitidos: PDF, PNG, JPEG, XLSX, DOC, DOCX`
    );
  }

  // Validar tamanho
  if (file.buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande. Tamanho máximo: 5MB`);
  }
};

export const calculateHash = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const uploadFile = async (
  bucket: 'comprovantes',
  file: UploadInput,
  colaboradorId: string
): Promise<UploadedFile> => {
  // Validar arquivo
  validateFile(file);

  // Gerar hash do arquivo
  const hash = calculateHash(file.buffer);

  // Criar estrutura de diretórios: bucket/colaborador_id/
  const subDir = colaboradorId;
  const fileName = generateUniqueFileName(file.originalName);
  const storagePath = `${subDir}/${fileName}`;

  // Salvar arquivo
  const fullPath = saveFile(bucket, storagePath, file.buffer);

  return {
    originalName: file.originalName,
    fileName,
    storagePath,
    mimeType: file.mimeType,
    size: file.buffer.length,
    hash,
  };
};

export const downloadFile = (
  bucket: 'comprovantes',
  storagePath: string
): Buffer | null => {
  return getFileBuffer(bucket, storagePath);
};

export const removeFile = (bucket: 'comprovantes', storagePath: string): boolean => {
  return deleteFile(bucket, storagePath);
};

export const checkFileExists = (bucket: 'comprovantes', storagePath: string): boolean => {
  return fileExists(bucket, storagePath);
};

export default {
  uploadFile,
  downloadFile,
  removeFile,
  checkFileExists,
  validateFile,
  calculateHash,
};
