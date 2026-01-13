import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { Fechamento, EventoPida } from '../types';
import * as auditService from './auditService';

export interface FechamentoWithRelations extends Fechamento {
  periodo?: {
    id: string;
    periodo: string;
  };
}

export const getFechamentos = async (periodoId?: string): Promise<FechamentoWithRelations[]> => {
  let sql = `
    SELECT f.*, 
           json_build_object('id', cp.id, 'periodo', cp.periodo) as periodo,
           p.nome as usuario_nome
    FROM fechamentos f
    JOIN calendario_periodos cp ON cp.id = f.periodo_id
    LEFT JOIN profiles p ON p.id = f.usuario_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (periodoId) {
    sql += ' AND f.periodo_id = $1';
    params.push(periodoId);
  }

  sql += ' ORDER BY f.data_processamento DESC';

  const result = await query(sql, params);
  return result.rows;
};

export const getFechamentoById = async (id: string): Promise<FechamentoWithRelations | null> => {
  const result = await query(
    `SELECT f.*, json_build_object('id', cp.id, 'periodo', cp.periodo) as periodo
     FROM fechamentos f
     JOIN calendario_periodos cp ON cp.id = f.periodo_id
     WHERE f.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

export interface ProcessarFechamentoResult {
  fechamento: Fechamento;
  eventos_pida: EventoPida[];
  resumo: {
    total_colaboradores: number;
    total_eventos: number;
    valor_total: number;
    valor_pida: number;
  };
}

export const processarFechamento = async (
  periodoId: string,
  usuarioId: string,
  usuarioName: string
): Promise<ProcessarFechamentoResult> => {
  // Verificar se há lançamentos pendentes
  const pendingResult = await query(
    `SELECT COUNT(*) as count FROM lancamentos 
     WHERE periodo_id = $1 AND status IN ('enviado', 'em_analise')`,
    [periodoId]
  );

  const pendingCount = parseInt(pendingResult.rows[0].count);
  if (pendingCount > 0) {
    throw new Error(
      `Existem ${pendingCount} lançamentos pendentes de validação. Todos os lançamentos devem ser validados antes do fechamento.`
    );
  }

  return transaction(async (client) => {
    const fechamentoId = uuidv4();

    // Buscar lançamentos válidos do período
    const lancamentosResult = await client.query(
      `SELECT l.*, c.id as colaborador_id, c.nome as colaborador_nome,
              c.cesta_beneficios_teto, c.pida_teto, c.tem_pida
       FROM lancamentos l
       JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id
       WHERE l.periodo_id = $1 AND l.status = 'valido'`,
      [periodoId]
    );

    const lancamentos = lancamentosResult.rows;

    // Agrupar por colaborador
    const porColaborador = new Map<string, any[]>();
    for (const lanc of lancamentos) {
      const existing = porColaborador.get(lanc.colaborador_id) || [];
      existing.push(lanc);
      porColaborador.set(lanc.colaborador_id, existing);
    }

    // Buscar eventos de folha cadastrados
    const eventosResult = await client.query(
      'SELECT componente, codigo_evento FROM tipos_despesas_eventos',
      []
    );
    
    const eventosCadastrados = new Set<string>();
    for (const e of eventosResult.rows) {
      eventosCadastrados.add(e.componente);
    }

    // Buscar todos os colaboradores ativos para calcular componentes fixos
    const todosColaboradoresResult = await client.query(
      `SELECT 
        c.id,
        c.vale_alimentacao,
        c.vale_refeicao,
        c.ajuda_custo,
        c.mobilidade,
        c.pida_teto,
        c.tem_pida
      FROM colaboradores_elegiveis c
      WHERE c.ativo = true`,
      []
    );

    // Calcular totais de componentes fixos (apenas os que têm evento cadastrado)
    let valorTotalFixos = 0;
    let valorTotalPida = 0;
    for (const colab of todosColaboradoresResult.rows) {
      if (eventosCadastrados.has('vale_alimentacao')) {
        valorTotalFixos += Number(colab.vale_alimentacao) || 0;
      }
      if (eventosCadastrados.has('vale_refeicao')) {
        valorTotalFixos += Number(colab.vale_refeicao) || 0;
      }
      if (eventosCadastrados.has('ajuda_custo')) {
        valorTotalFixos += Number(colab.ajuda_custo) || 0;
      }
      if (eventosCadastrados.has('mobilidade')) {
        valorTotalFixos += Number(colab.mobilidade) || 0;
      }
      
      // PIDA só conta se o evento estiver cadastrado
      if (colab.tem_pida && eventosCadastrados.has('pida')) {
        valorTotalPida += Number(colab.pida_teto) || 0;
      }
    }

    // Calcular totais e eventos PIDA (sem inserir ainda)
    let totalColaboradores = porColaborador.size;
    let totalEventos = lancamentos.length;
    let valorTotalCesta = 0;
    const eventosPidaData: Array<{
      id: string;
      colaborador_id: string;
      periodo_id: string;
      valor_base_pida: number;
      valor_diferenca_cesta: number;
      valor_total_pida: number;
    }> = [];

    for (const [colaboradorId, lancs] of porColaborador) {
      const primeiro = lancs[0];
      // Garantir conversão numérica correta (evitar concatenação de strings)
      const cestaTeto = Number(primeiro.cesta_beneficios_teto) || 0;
      const pidaTeto = Number(primeiro.pida_teto) || 0;
      const temPida = primeiro.tem_pida || false;

      // Somar valor considerado de despesas variáveis (Cesta de Benefícios)
      // Calcular sempre (necessário para PIDA), mas só adicionar ao total se o evento estiver cadastrado
      const totalCesta = lancs.reduce((sum: number, l: any) => {
        const valor = Number(l.valor_considerado) || 0;
        return sum + valor;
      }, 0);
      
      if (eventosCadastrados.has('cesta_beneficios')) {
        valorTotalCesta += totalCesta;
      }

      // Se colaborador tem PIDA, calcular diferença da cesta (para eventos_pida, mas não usar no valor total)
      if (temPida && cestaTeto > 0) {
        const diferencaCesta = Math.max(0, cestaTeto - totalCesta);
        const valorTotalPidaCalculado = Number(pidaTeto) + Number(diferencaCesta);

        if (valorTotalPidaCalculado > 0) {
          eventosPidaData.push({
            id: uuidv4(),
            colaborador_id: colaboradorId,
            periodo_id: periodoId,
            valor_base_pida: pidaTeto,
            valor_diferenca_cesta: diferencaCesta,
            valor_total_pida: valorTotalPidaCalculado,
          });

          totalEventos++; // PIDA é um evento adicional
        }
      }
    }

    // Valor total = Componentes fixos + Cesta de Benefícios + PI/DA
    const valorTotalFinal = valorTotalFixos + valorTotalCesta + valorTotalPida;

    // Criar registro de fechamento PRIMEIRO (antes de inserir eventos_pida)
    const fechamentoResult = await client.query(
      `INSERT INTO fechamentos (
        id, periodo_id, usuario_id, data_processamento, status,
        total_colaboradores, total_eventos, valor_total, created_at
      ) VALUES ($1, $2, $3, NOW(), 'sucesso', $4, $5, $6, NOW()) RETURNING *`,
      [fechamentoId, periodoId, usuarioId, totalColaboradores, totalEventos, valorTotalFinal]
    );

    // Agora inserir os eventos_pida (após criar o fechamento)
    const eventosPida: EventoPida[] = [];
    for (const eventoData of eventosPidaData) {
      await client.query(
        `INSERT INTO eventos_pida (
          id, colaborador_id, periodo_id, fechamento_id,
          valor_base_pida, valor_diferenca_cesta, valor_total_pida, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [eventoData.id, eventoData.colaborador_id, eventoData.periodo_id, fechamentoId, eventoData.valor_base_pida, eventoData.valor_diferenca_cesta, eventoData.valor_total_pida]
      );

      eventosPida.push({
        id: eventoData.id,
        colaborador_id: eventoData.colaborador_id,
        periodo_id: eventoData.periodo_id,
        fechamento_id: fechamentoId,
        valor_base_pida: eventoData.valor_base_pida,
        valor_diferenca_cesta: eventoData.valor_diferenca_cesta,
        valor_total_pida: eventoData.valor_total_pida,
        created_at: new Date().toISOString(),
      });
    }

    // Fechar o período
    await client.query(
      `UPDATE calendario_periodos SET status = 'fechado' WHERE id = $1`,
      [periodoId]
    );

    const fechamentoFinal = fechamentoResult.rows[0];

    return {
      fechamento: fechamentoFinal,
      eventos_pida: eventosPida,
      resumo: {
        total_colaboradores: totalColaboradores,
        total_eventos: totalEventos,
        valor_total: valorTotalFinal,
        valor_pida: valorTotalPida,
      },
    };
  }).then(async (result) => {
    // Log de auditoria FORA da transação (após commit)
    await auditService.createAuditLog({
      userId: usuarioId,
      userName: usuarioName,
      action: 'processar',
      entityType: 'fechamento',
      entityId: result.fechamento.id,
      entityDescription: `Processamento de fechamento para período ${periodoId}`,
      newValues: {
        periodo_id: periodoId,
        total_colaboradores: result.resumo.total_colaboradores,
        total_eventos: result.resumo.total_eventos,
        valor_total: result.resumo.valor_total,
        valor_pida: result.resumo.valor_pida,
      },
    });

    return result;
  });
};

export const getEventosPida = async (periodoId?: string, fechamentoId?: string): Promise<EventoPida[]> => {
  let sql = `
    SELECT ep.*, c.nome as colaborador_nome, c.matricula
    FROM eventos_pida ep
    JOIN colaboradores_elegiveis c ON c.id = ep.colaborador_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (periodoId) {
    sql += ` AND ep.periodo_id = $${paramIndex}`;
    params.push(periodoId);
    paramIndex++;
  }

  if (fechamentoId) {
    sql += ` AND ep.fechamento_id = $${paramIndex}`;
    params.push(fechamentoId);
    paramIndex++;
  }

  sql += ' ORDER BY c.nome';

  const result = await query(sql, params);
  return result.rows;
};

export const getResumoFechamento = async (periodoId: string) => {
  // Contagem de lançamentos por status
  const statusResult = await query(
    `SELECT status, COUNT(*) as count, SUM(valor_considerado) as total
     FROM lancamentos
     WHERE periodo_id = $1
     GROUP BY status`,
    [periodoId]
  );

  // Contagem de pendentes
  const pendingResult = await query(
    `SELECT 
       SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) as enviados,
       SUM(CASE WHEN status = 'em_analise' THEN 1 ELSE 0 END) as em_analise
     FROM lancamentos
     WHERE periodo_id = $1`,
    [periodoId]
  );

  // Total de colaboradores com lançamentos
  const colaboradoresResult = await query(
    `SELECT COUNT(DISTINCT colaborador_id) as count
     FROM lancamentos
     WHERE periodo_id = $1`,
    [periodoId]
  );

  return {
    por_status: statusResult.rows,
    pendentes: pendingResult.rows[0],
    total_colaboradores: parseInt(colaboradoresResult.rows[0].count),
  };
};

export const deleteFechamento = async (
  id: string,
  usuarioId: string,
  usuarioName: string
): Promise<void> => {
  // Buscar fechamento antes de excluir para log de auditoria
  const fechamento = await getFechamentoById(id);
  if (!fechamento) {
    throw new Error('Fechamento não encontrado');
  }

  return transaction(async (client) => {
    // Verificar se há eventos_pida vinculados (deve excluir primeiro devido à FK)
    const eventosPida = await client.query(
      `SELECT id FROM eventos_pida WHERE fechamento_id = $1`,
      [id]
    );

    // Excluir eventos_pida primeiro
    if (eventosPida.rows.length > 0) {
      await client.query(
        `DELETE FROM eventos_pida WHERE fechamento_id = $1`,
        [id]
      );
    }

    // Excluir fechamento
    await client.query(
      `DELETE FROM fechamentos WHERE id = $1`,
      [id]
    );

    // Log de auditoria
    await auditService.createAuditLog({
      userId: usuarioId,
      userName: usuarioName,
      action: 'excluir',
      entityType: 'fechamento',
      entityId: id,
      entityDescription: `Exclusão de fechamento do período ${fechamento.periodo_id}`,
      oldValues: fechamento,
    });
  });
};
