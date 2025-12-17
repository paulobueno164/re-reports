import { query } from '../config/database';
import { sendEmail } from '../config/email';

export interface PendingExpenseInfo {
  id: string;
  colaborador_nome: string;
  tipo_despesa_nome: string;
  valor_lancado: number;
  periodo: string;
  created_at: string;
  days_pending: number;
}

export const getPendingExpensesOlderThan = async (days: number): Promise<PendingExpenseInfo[]> => {
  const result = await query(
    `SELECT 
      l.id,
      c.nome as colaborador_nome,
      td.nome as tipo_despesa_nome,
      l.valor_lancado,
      cp.periodo,
      l.created_at,
      EXTRACT(DAY FROM NOW() - l.created_at)::integer as days_pending
    FROM lancamentos l
    JOIN colaboradores_elegiveis c ON c.id = l.colaborador_id
    JOIN tipos_despesas td ON td.id = l.tipo_despesa_id
    JOIN calendario_periodos cp ON cp.id = l.periodo_id
    WHERE l.status IN ('enviado', 'em_analise')
      AND l.created_at < NOW() - INTERVAL '${days} days'
    ORDER BY l.created_at ASC`,
    []
  );

  return result.rows;
};

export const getRHUsers = async (): Promise<{ email: string; nome: string }[]> => {
  const result = await query(
    `SELECT p.email, p.nome
     FROM profiles p
     JOIN user_roles ur ON ur.user_id = p.id
     WHERE ur.role = 'RH'`,
    []
  );

  return result.rows;
};

export const sendPendingExpensesAlert = async (): Promise<{ sent: number; pending: number }> => {
  const pendingExpenses = await getPendingExpensesOlderThan(3);

  if (pendingExpenses.length === 0) {
    console.log('No pending expenses older than 3 days');
    return { sent: 0, pending: 0 };
  }

  const rhUsers = await getRHUsers();

  if (rhUsers.length === 0) {
    console.log('No RH users found to notify');
    return { sent: 0, pending: pendingExpenses.length };
  }

  // Agrupar por período
  const byPeriod = new Map<string, PendingExpenseInfo[]>();
  for (const expense of pendingExpenses) {
    const existing = byPeriod.get(expense.periodo) || [];
    existing.push(expense);
    byPeriod.set(expense.periodo, existing);
  }

  // Construir HTML do email
  let htmlContent = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4a90a4; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .warning { color: #e74c3c; font-weight: bold; }
        h2 { color: #2c3e50; }
        h3 { color: #4a90a4; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h2>Alerta: Despesas Pendentes de Validação</h2>
      <p>Existem <strong class="warning">${pendingExpenses.length}</strong> despesas aguardando validação há mais de 3 dias.</p>
  `;

  for (const [periodo, expenses] of byPeriod) {
    htmlContent += `
      <h3>Período: ${periodo}</h3>
      <table>
        <tr>
          <th>Colaborador</th>
          <th>Tipo de Despesa</th>
          <th>Valor</th>
          <th>Dias Pendente</th>
        </tr>
    `;

    for (const expense of expenses) {
      htmlContent += `
        <tr>
          <td>${expense.colaborador_nome}</td>
          <td>${expense.tipo_despesa_nome}</td>
          <td>R$ ${expense.valor_lancado.toFixed(2)}</td>
          <td class="warning">${expense.days_pending} dias</td>
        </tr>
      `;
    }

    htmlContent += '</table>';
  }

  htmlContent += `
      <p>Por favor, acesse o sistema para validar estas despesas.</p>
      <p style="color: #7f8c8d; font-size: 12px;">Este é um email automático do sistema RE-Reports.</p>
    </body>
    </html>
  `;

  // Enviar email para cada usuário RH
  let sentCount = 0;
  for (const rhUser of rhUsers) {
    try {
      await sendEmail({
        to: rhUser.email,
        subject: `[RE-Reports] ${pendingExpenses.length} Despesas Pendentes de Validação`,
        html: htmlContent,
      });
      sentCount++;
      console.log(`Email sent to ${rhUser.email}`);
    } catch (error) {
      console.error(`Failed to send email to ${rhUser.email}:`, error);
    }
  }

  return { sent: sentCount, pending: pendingExpenses.length };
};
