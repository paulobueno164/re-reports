import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { GrupoDespesa } from '../types';
import * as auditService from './auditService';

export interface CreateGrupoDespesaInput {
    nome: string;
    ativo?: boolean;
}

export interface UpdateGrupoDespesaInput extends Partial<CreateGrupoDespesaInput> { }

export const getAllGruposDespesa = async (
    filters?: { ativo?: boolean }
): Promise<GrupoDespesa[]> => {
    let sql = 'SELECT * FROM grupos_despesa WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.ativo !== undefined) {
        sql += ` AND ativo = $${paramIndex}`;
        params.push(filters.ativo);
        paramIndex++;
    }

    sql += ' ORDER BY nome';

    const result = await query(sql, params);
    return result.rows;
};

export const getGrupoDespesaById = async (id: string): Promise<GrupoDespesa | null> => {
    const result = await query(
        'SELECT * FROM grupos_despesa WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
};

export const createGrupoDespesa = async (
    input: CreateGrupoDespesaInput,
    executorId: string,
    executorName: string
): Promise<GrupoDespesa> => {
    const id = uuidv4();

    const result = await query(
        `INSERT INTO grupos_despesa (id, nome, ativo, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
        [
            id,
            input.nome,
            input.ativo ?? true,
        ]
    );

    const novoGrupo = result.rows[0];

    // Audit Log
    await auditService.createAuditLog({
        userId: executorId,
        userName: executorName,
        action: 'criar',
        entityType: 'grupo_despesa',
        entityId: novoGrupo.id,
        entityDescription: `Criação do grupo de despesa ${novoGrupo.nome}`,
        newValues: novoGrupo,
    });

    return novoGrupo;
};

export const updateGrupoDespesa = async (
    id: string,
    input: UpdateGrupoDespesaInput,
    executorId: string,
    executorName: string
): Promise<GrupoDespesa | null> => {
    const oldValues = await getGrupoDespesaById(id);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined) {
            fields.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    });

    if (fields.length === 0) {
        return getGrupoDespesaById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
        `UPDATE grupos_despesa SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );

    const updatedGrupo = result.rows[0] || null;

    if (updatedGrupo) {
        // Audit Log
        await auditService.createAuditLog({
            userId: executorId,
            userName: executorName,
            action: 'atualizar',
            entityType: 'grupo_despesa',
            entityId: id,
            entityDescription: `Atualização do grupo de despesa ${updatedGrupo.nome}`,
            oldValues: oldValues || undefined,
            newValues: updatedGrupo,
        });
    }

    return updatedGrupo;
};

export const deleteGrupoDespesa = async (
    id: string,
    executorId: string,
    executorName: string
): Promise<boolean> => {
    const grupo = await getGrupoDespesaById(id);

    const result = await query(
        'DELETE FROM grupos_despesa WHERE id = $1',
        [id]
    );

    if ((result.rowCount ?? 0) > 0) {
        // Audit Log
        await auditService.createAuditLog({
            userId: executorId,
            userName: executorName,
            action: 'excluir',
            entityType: 'grupo_despesa',
            entityId: id,
            entityDescription: `Exclusão do grupo de despesa ${grupo?.nome || id}`,
            oldValues: grupo || undefined,
        });
        return true;
    }
    return false;
};
