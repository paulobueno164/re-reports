import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { Fechamento, EventoPida } from '../types';

export interface FechamentoWithRelations extends Fechamento {
  periodo?: {
    id: string;
    periodo: string;
  };
}

export const getFechamentos = async (periodoId?: string): Promise<FechamentoWithRelations[]> => {
  let sql = `
    SELECT f.*, json_build_object('id', cp.id, 'periodo', cp.periodo) as periodo
    FROM fechamentos f
    JOIN calendario_periodos cp ON cp.id = f.periodo_id
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
  usuarioId: string
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

    // Calcular totais e eventos PIDA
    let totalColaboradores = porColaborador.size;
    let totalEventos = lancamentos.length;
    let valorTotal = 0;
    let valorPidaTotal = 0;
    const eventosPida: EventoPida[] = [];

    for (const [colaboradorId, lancs] of porColaborador) {
      const primeiro = lancs[0];
      const cestaTeto = primeiro.cesta_beneficios_teto || 0;
      const pidaTeto = primeiro.pida_teto || 0;
      const temPida = primeiro.tem_pida || false;

      // Somar valor considerado de despesas variáveis (Cesta de Benefícios)
      const totalCesta = lancs.reduce((sum: number, l: any) => sum + parseFloat(l.valor_considerado || 0), 0);
      valorTotal += totalCesta;

      // Se colaborador tem PIDA, calcular diferença da cesta
      if (temPida && cestaTeto > 0) {
        const diferencaCesta = Math.max(0, cestaTeto - totalCesta);
        const valorTotalPida = pidaTeto + diferencaCesta;

        if (valorTotalPida > 0) {
          const eventoPidaId = uuidv4();
          await client.query(
            `INSERT INTO eventos_pida (
              id, colaborador_id, periodo_id, fechamento_id,
              valor_base_pida, valor_diferenca_cesta, valor_total_pida, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [eventoPidaId, colaboradorId, periodoId, fechamentoId, pidaTeto, diferencaCesta, valorTotalPida]
          );

          eventosPida.push({
            id: eventoPidaId,
            colaborador_id: colaboradorId,
            periodo_id: periodoId,
            fechamento_id: fechamentoId,
            valor_base_pida: pidaTeto,
            valor_diferenca_cesta: diferencaCesta,
            valor_total_pida: valorTotalPida,
            created_at: new Date().toISOString(),
          });

          valorPidaTotal += valorTotalPida;
          totalEventos++; // PIDA é um evento adicional
        }
      }
    }

    // Criar registro de fechamento
    const fechamentoResult = await client.query(
      `INSERT INTO fechamentos (
        id, periodo_id, usuario_id, data_processamento, status,
        total_colaboradores, total_eventos, valor_total, created_at
      ) VALUES ($1, $2, $3, NOW(), 'sucesso', $4, $5, $6, NOW()) RETURNING *`,
      [fechamentoId, periodoId, usuarioId, totalColaboradores, totalEventos, valorTotal + valorPidaTotal]
    );

    // Fechar o período
    await client.query(
      `UPDATE calendario_periodos SET status = 'fechado' WHERE id = $1`,
      [periodoId]
    );

    return {
      fechamento: fechamentoResult.rows[0],
      eventos_pida: eventosPida,
      resumo: {
        total_colaboradores: totalColaboradores,
        total_eventos: totalEventos,
        valor_total: valorTotal + valorPidaTotal,
        valor_pida: valorPidaTotal,
      },
    };
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
