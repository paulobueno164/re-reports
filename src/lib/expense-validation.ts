// Utilitário para validação de limites da Cesta de Benefícios
// Implementa as regras do descritivo RE-Reports

interface LancamentoValidation {
  valorLancado: number;
  tetoColaborador: number;
  totalJaUtilizado: number;
}

interface ValidationResult {
  permitido: boolean;
  valorConsiderado: number;
  valorNaoConsiderado: number;
  bloqueadoAposEste: boolean;
  mensagem: string;
  tipo: 'success' | 'warning' | 'error';
}

interface PeriodoValidationResult {
  permitido: boolean;
  periodoDestino: 'atual' | 'proximo' | 'bloqueado';
  periodoDestinoId?: string;
  mensagem: string;
}

interface CalendarPeriodInfo {
  id: string;
  periodo: string;
  abreLancamento: Date;
  fechaLancamento: Date;
  status: string;
}

/**
 * Valida um lançamento de despesa contra os limites da Cesta de Benefícios
 * 
 * Regras implementadas:
 * 1. Se total + valor <= teto: permite normalmente
 * 2. Se total >= teto: bloqueia completamente
 * 3. Se total < teto mas total + valor > teto: permite como ÚLTIMO lançamento
 *    - valor_considerado = teto - total
 *    - valor_nao_considerado = valor - valor_considerado
 *    - após este, bloqueia completamente
 */
export function validarLancamentoCesta(params: LancamentoValidation): ValidationResult {
  const { valorLancado, tetoColaborador, totalJaUtilizado } = params;
  
  const saldoDisponivel = tetoColaborador - totalJaUtilizado;
  
  // Caso 1: Já atingiu o limite
  if (saldoDisponivel <= 0) {
    return {
      permitido: false,
      valorConsiderado: 0,
      valorNaoConsiderado: valorLancado,
      bloqueadoAposEste: true,
      mensagem: `Limite da Cesta de Benefícios já atingido (${formatCurrency(tetoColaborador)}). Não é possível fazer novos lançamentos.`,
      tipo: 'error',
    };
  }
  
  // Caso 2: Valor cabe completamente no saldo
  if (valorLancado <= saldoDisponivel) {
    const novoTotal = totalJaUtilizado + valorLancado;
    const percentualUtilizado = (novoTotal / tetoColaborador) * 100;
    
    return {
      permitido: true,
      valorConsiderado: valorLancado,
      valorNaoConsiderado: 0,
      bloqueadoAposEste: false,
      mensagem: `Lançamento dentro do limite. Saldo restante: ${formatCurrency(saldoDisponivel - valorLancado)} (${percentualUtilizado.toFixed(1)}% utilizado)`,
      tipo: 'success',
    };
  }
  
  // Caso 3: Valor ultrapassa o saldo - permitir como último lançamento
  const valorConsiderado = saldoDisponivel;
  const valorNaoConsiderado = valorLancado - saldoDisponivel;
  
  return {
    permitido: true,
    valorConsiderado,
    valorNaoConsiderado,
    bloqueadoAposEste: true,
    mensagem: `Atenção: Seu lançamento de ${formatCurrency(valorLancado)} ultrapassa o limite disponível.\n` +
      `Será considerado: ${formatCurrency(valorConsiderado)}\n` +
      `Não será considerado: ${formatCurrency(valorNaoConsiderado)}\n` +
      `Este será o último lançamento permitido no período.`,
    tipo: 'warning',
  };
}

/**
 * Verifica se já houve um lançamento que ultrapassou o limite (bloqueio após último lançamento)
 * 
 * IMPORTANTE: O bloqueio só deve ser aplicado se NÃO houver saldo disponível.
 * Se o limite foi aumentado e há saldo disponível, o bloqueio deve ser removido.
 */
export function verificarBloqueioAposLimite(
  lancamentosNoPeriodo: { valorNaoConsiderado: number }[],
  saldoDisponivel: number
): { bloqueado: boolean; mensagem: string } {
  // Verifica se existe algum lançamento com valor_nao_considerado > 0
  const temLancamentoQueUltrapassou = lancamentosNoPeriodo.some(l => l.valorNaoConsiderado > 0);
  
  // Se há saldo disponível, não deve haver bloqueio (mesmo que tenha havido um lançamento que ultrapassou anteriormente)
  // O bloqueio só deve ser aplicado se não houver saldo disponível
  if (temLancamentoQueUltrapassou && saldoDisponivel <= 0) {
    return {
      bloqueado: true,
      mensagem: 'Já foi feito um lançamento que ultrapassou o limite. Não é possível fazer novos lançamentos neste período.',
    };
  }
  
  return { bloqueado: false, mensagem: '' };
}

/**
 * Calcula a diferença não utilizada da Cesta de Benefícios que será convertida em PI/DA
 * 
 * Regra: Se usado < limite, a diferença vai automaticamente para PI/DA (tributável)
 */
export function calcularDiferencaPida(
  cestaBeneficiosTeto: number,
  cestaBeneficiosUtilizado: number
): number {
  if (cestaBeneficiosUtilizado >= cestaBeneficiosTeto) {
    return 0;
  }
  return cestaBeneficiosTeto - cestaBeneficiosUtilizado;
}

/**
 * Valida se o período está aberto para lançamentos
 * 
 * Regras:
 * - Lançamentos permitidos entre dias 11-20 do mês (conforme calendário)
 * - Antes do dia de abertura: bloqueado
 * - Após dia de fechamento: vai para próximo mês automaticamente
 */
export function validarPeriodoLancamento(
  dataAtual: Date,
  periodoAtual: CalendarPeriodInfo | null,
  proximoPeriodo: CalendarPeriodInfo | null
): PeriodoValidationResult {
  // Se não há período atual, bloqueia
  if (!periodoAtual) {
    return {
      permitido: false,
      periodoDestino: 'bloqueado',
      mensagem: 'Não há período configurado para lançamentos.',
    };
  }

  const agora = dataAtual.getTime();
  const abertura = periodoAtual.abreLancamento.getTime();
  const fechamento = periodoAtual.fechaLancamento.getTime();
  // Adiciona 23:59:59 ao fechamento para incluir o dia inteiro
  const fechamentoFimDoDia = fechamento + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
  
  // Antes da abertura - BLOQUEADO
  if (agora < abertura) {
    return {
      permitido: false,
      periodoDestino: 'bloqueado',
      mensagem: `O período de lançamento ainda não está aberto. Abertura: ${formatDate(periodoAtual.abreLancamento)}`,
    };
  }
  
  // Dentro do período - PERMITE PARA PERÍODO ATUAL
  if (agora >= abertura && agora <= fechamentoFimDoDia) {
    return {
      permitido: true,
      periodoDestino: 'atual',
      periodoDestinoId: periodoAtual.id,
      mensagem: `Período aberto para lançamentos até ${formatDate(periodoAtual.fechaLancamento)}`,
    };
  }
  
  // Após o fechamento - REDIRECIONA PARA PRÓXIMO MÊS
  if (proximoPeriodo) {
    return {
      permitido: true,
      periodoDestino: 'proximo',
      periodoDestinoId: proximoPeriodo.id,
      mensagem: `Período atual fechado. Seu lançamento será registrado no período ${proximoPeriodo.periodo}.`,
    };
  }
  
  // Não há próximo período configurado
  return {
    permitido: false,
    periodoDestino: 'bloqueado',
    mensagem: 'Período atual fechado e não há próximo período configurado.',
  };
}

/**
 * Valida se a origem é permitida para o tipo de despesa
 */
export function validarOrigemDespesa(
  origem: 'proprio' | 'conjuge' | 'filhos',
  origensPermitidas: ('proprio' | 'conjuge' | 'filhos')[]
): { valido: boolean; mensagem: string } {
  if (!origensPermitidas.includes(origem)) {
    const labelOrigem: Record<string, string> = {
      proprio: 'Próprio',
      conjuge: 'Cônjuge',
      filhos: 'Filhos',
    };
    const permitidasLabels = origensPermitidas.map(o => labelOrigem[o]).join(', ');
    return {
      valido: false,
      mensagem: `Origem "${labelOrigem[origem]}" não é permitida para este tipo de despesa. Origens permitidas: ${permitidasLabels}`,
    };
  }
  return { valido: true, mensagem: '' };
}

/**
 * Gera hash simplificado para detecção de duplicidade de comprovantes
 * Usa: nome do arquivo + tamanho
 */
export function gerarHashComprovante(nomeArquivo: string, tamanho: number): string {
  return `${nomeArquivo.toLowerCase().trim()}_${tamanho}`;
}

// Helpers
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(date: Date): string {
  // Use UTC to avoid timezone shift issues with date-only strings
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

export { formatCurrency, formatDate };
