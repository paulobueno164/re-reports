import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../config/database';
import { Anexo } from '../types';

export interface CreateAnexoInput {
  lancamento_id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  storage_path: string;
  tamanho: number;
  file_content?: Buffer; // Para calcular hash
}

export const getAnexosByLancamentoId = async (lancamentoId: string): Promise<Anexo[]> => {
  const result = await query(
    'SELECT * FROM anexos WHERE lancamento_id = $1 ORDER BY created_at',
    [lancamentoId]
  );
  return result.rows;
};

export const getAnexoById = async (id: string): Promise<Anexo | null> => {
  const result = await query('SELECT * FROM anexos WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const calculateFileHash = (fileContent: Buffer): string => {
  return crypto.createHash('sha256').update(fileContent).digest('hex');
};

export const checkDuplicateHash = async (hash: string, excludeId?: string): Promise<boolean> => {
  let sql = 'SELECT id FROM anexos WHERE hash_comprovante = $1';
  const params: any[] = [hash];

  if (excludeId) {
    sql += ' AND id != $2';
    params.push(excludeId);
  }

  const result = await query(sql, params);
  return result.rows.length > 0;
};

export const createAnexo = async (input: CreateAnexoInput): Promise<Anexo> => {
  const id = uuidv4();
  let hashComprovante: string | null = null;

  // Calcular hash se conteúdo do arquivo foi fornecido
  if (input.file_content) {
    hashComprovante = calculateFileHash(input.file_content);

    // Verificar duplicidade
    const isDuplicate = await checkDuplicateHash(hashComprovante);
    if (isDuplicate) {
      throw new Error(
        'Este comprovante já foi utilizado em outro lançamento. Cada nota fiscal/recibo só pode ser lançado uma única vez.'
      );
    }
  }

  const result = await query(
    `INSERT INTO anexos (
      id, lancamento_id, nome_arquivo, tipo_arquivo, storage_path, tamanho, hash_comprovante, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
    [
      id,
      input.lancamento_id,
      input.nome_arquivo,
      input.tipo_arquivo,
      input.storage_path,
      input.tamanho,
      hashComprovante,
    ]
  );

  return result.rows[0];
};

export const deleteAnexo = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM anexos WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};

export const deleteAnexosByLancamentoId = async (lancamentoId: string): Promise<number> => {
  const result = await query('DELETE FROM anexos WHERE lancamento_id = $1', [lancamentoId]);
  return result.rowCount ?? 0;
};
