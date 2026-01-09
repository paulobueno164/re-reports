import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Encontra o período vigente baseado na data atual.
 * O período vigente é aquele onde a data atual está entre data_inicio e data_final.
 * Se não encontrar, retorna o período mais recente.
 */
export function findCurrentPeriod<T extends { 
  id: string; 
  data_inicio?: string | Date; 
  data_final?: string | Date;
  dataInicio?: string | Date;
  dataFinal?: string | Date;
}>(periods: T[]): T | undefined {
  if (!periods || periods.length === 0) return undefined;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  
  // Find period where today is between data_inicio and data_final
  const currentPeriod = periods.find((p) => {
    const dataInicio = p.data_inicio || p.dataInicio;
    const dataFinal = p.data_final || p.dataFinal;
    
    if (!dataInicio || !dataFinal) return false;
    
    const inicio = new Date(dataInicio);
    inicio.setHours(0, 0, 0, 0);
    
    const final = new Date(dataFinal);
    final.setHours(23, 59, 59, 999);
    
    return todayTime >= inicio.getTime() && todayTime <= final.getTime();
  });
  
  if (currentPeriod) return currentPeriod;
  
  // Fallback: return most recent period (first in descending order)
  return periods[0];
}
