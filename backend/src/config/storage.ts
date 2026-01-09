import path from 'path';
import fs from 'fs';

// Diretório base para armazenamento de arquivos
const STORAGE_BASE_DIR = process.env.STORAGE_PATH || path.join(process.cwd(), 'uploads');

// Diretórios específicos por bucket
const BUCKETS = {
  comprovantes: path.join(STORAGE_BASE_DIR, 'comprovantes'),
};

// Garantir que os diretórios existam
export const initializeStorage = (): void => {
  Object.values(BUCKETS).forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Diretório de storage criado: ${dir}`);
    }
  });
};

export const getBucketPath = (bucket: keyof typeof BUCKETS): string => {
  return BUCKETS[bucket];
};

export const getFilePath = (bucket: keyof typeof BUCKETS, fileName: string): string => {
  return path.join(BUCKETS[bucket], fileName);
};

export const fileExists = (bucket: keyof typeof BUCKETS, fileName: string): boolean => {
  return fs.existsSync(getFilePath(bucket, fileName));
};

export const deleteFile = (bucket: keyof typeof BUCKETS, fileName: string): boolean => {
  const filePath = getFilePath(bucket, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

export const getFileBuffer = (bucket: keyof typeof BUCKETS, fileName: string): Buffer | null => {
  const filePath = getFilePath(bucket, fileName);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
};

export const saveFile = (bucket: keyof typeof BUCKETS, fileName: string, content: Buffer): string => {
  const filePath = getFilePath(bucket, fileName);
  
  // Garantir que o diretório pai exista
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Gerar nome único para arquivo
export const generateUniqueFileName = (originalName: string): string => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${baseName}_${timestamp}_${random}${ext}`;
};

export default {
  initializeStorage,
  getBucketPath,
  getFilePath,
  fileExists,
  deleteFile,
  getFileBuffer,
  saveFile,
  generateUniqueFileName,
};
