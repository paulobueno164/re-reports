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
 * - Lançamentos permitidos entre dias 11-20 do mês
 * - Antes do dia 11: bloqueado
 * - Após dia 20: vai para próximo mês automaticamente
 */
export function validarPeriodoLancamento(
  dataAtual: Date,
  abreLancamento: Date,
  fechaLancamento: Date
): { permitido: boolean; periodoDestino: 'atual' | 'proximo'; mensagem: string } {
  const agora = dataAtual.getTime();
  const abertura = abreLancamento.getTime();
  const fechamento = fechaLancamento.getTime();
  
  // Antes da abertura
  if (agora < abertura) {
    return {
      permitido: false,
      periodoDestino: 'atual',
      mensagem: `O período de lançamento ainda não está aberto. Abertura: ${formatDate(abreLancamento)}`,
    };
  }
  
  // Dentro do período
  if (agora >= abertura && agora <= fechamento) {
    return {
      permitido: true,
      periodoDestino: 'atual',
      mensagem: `Período aberto para lançamentos até ${formatDate(fechaLancamento)}`,
    };
  }
  
  // Após o fechamento - direciona para próximo mês
  return {
    permitido: true,
    periodoDestino: 'proximo',
    mensagem: `Período atual fechado. Seu lançamento será registrado no próximo período.`,
  };
}

/**
 * Valida se a origem é permitida para o tipo de despesa
 */
export function validarOrigemDespesa(
  origem: 'proprio' | 'conjuge' | 'filhos',
  origensPermitidas: ('proprio' | 'conjuge' | 'filhos')[]
): boolean {
  return origensPermitidas.includes(origem);
}

// Helpers
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export { formatCurrency, formatDate };
