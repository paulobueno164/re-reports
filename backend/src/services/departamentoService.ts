import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { Departamento } from '../types';
import * as auditService from './auditService';

export interface CreateDepartamentoInput {
    nome: string;
    ativo?: boolean;
}

export interface UpdateDepartamentoInput extends Partial<CreateDepartamentoInput> { }

export const getAllDepartamentos = async (
    filters?: { ativo?: boolean }
): Promise<Departamento[]> => {
    let sql = 'SELECT * FROM departamentos WHERE 1=1';
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

export const getDepartamentoById = async (id: string): Promise<Departamento | null> => {
    const result = await query(
        'SELECT * FROM departamentos WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
};

export const createDepartamento = async (
    input: CreateDepartamentoInput,
    executorId: string,
    executorName: string
): Promise<Departamento> => {
    const id = uuidv4();

    const result = await query(
        `INSERT INTO departamentos (id, nome, ativo, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
        [
            id,
            input.nome,
            input.ativo ?? true,
        ]
    );

    const novoDepartamento = result.rows[0];

    // Audit Log
    await auditService.createAuditLog({
        userId: executorId,
        userName: executorName,
        action: 'criar',
        entityType: 'departamento',
        entityId: novoDepartamento.id,
        entityDescription: `Criação do departamento ${novoDepartamento.nome}`,
        newValues: novoDepartamento,
    });

    return novoDepartamento;
};

export const updateDepartamento = async (
    id: string,
    input: UpdateDepartamentoInput,
    executorId: string,
    executorName: string
): Promise<Departamento | null> => {
    const oldValues = await getDepartamentoById(id);

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
        return getDepartamentoById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
        `UPDATE departamentos SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );

    const updatedDepartamento = result.rows[0] || null;

    if (updatedDepartamento) {
        // Audit Log
        await auditService.createAuditLog({
            userId: executorId,
            userName: executorName,
            action: 'atualizar',
            entityType: 'departamento',
            entityId: id,
            entityDescription: `Atualização do departamento ${updatedDepartamento.nome}`,
            oldValues: oldValues || undefined,
            newValues: updatedDepartamento,
        });
    }

    return updatedDepartamento;
};

export const deleteDepartamento = async (
    id: string,
    executorId: string,
    executorName: string
): Promise<boolean> => {
    const departamento = await getDepartamentoById(id);

    const result = await query(
        'DELETE FROM departamentos WHERE id = $1',
        [id]
    );

    if ((result.rowCount ?? 0) > 0) {
        // Audit Log
        await auditService.createAuditLog({
            userId: executorId,
            userName: executorName,
            action: 'excluir',
            entityType: 'departamento',
            entityId: id,
            entityDescription: `Exclusão do departamento ${departamento?.nome || id}`,
            oldValues: departamento || undefined,
        });
        return true;
    }
    return false;
};
