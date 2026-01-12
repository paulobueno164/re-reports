import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { Anexo } from '../types';
import { removeFile } from '../services/storageService';

export interface CreateAnexoInput {
  lancamento_id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  storage_path: string;
  tamanho: number;
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

export const createAnexo = async (input: CreateAnexoInput): Promise<Anexo> => {
  const id = uuidv4();

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
      null, // hash_comprovante agora é sempre null
    ]
  );

  return result.rows[0];
};

export const deleteAnexo = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM anexos WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};

export const deleteAnexosByLancamentoId = async (lancamentoId: string): Promise<number> => {
  // Primeiro, buscar todos os anexos para remover os arquivos
  const anexos = await getAnexosByLancamentoId(lancamentoId);
  
  // Remover arquivos do storage
  for (const anexo of anexos) {
    try {
      removeFile('comprovantes', anexo.storage_path);
    } catch (error) {
      console.error(`Erro ao remover arquivo ${anexo.storage_path}:`, error);
    }
  }
  
  // Remover registros do banco
  const result = await query('DELETE FROM anexos WHERE lancamento_id = $1', [lancamentoId]);
  return result.rowCount ?? 0;
};
