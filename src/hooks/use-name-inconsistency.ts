import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { colaboradoresService } from '@/services/colaboradores.service';
import { authService } from '@/services/auth.service';

interface NameInconsistency {
  colaboradorId: string;
  colaboradorNome: string; // Nome definido pelo RH
  profileNome: string;     // Nome escolhido pelo usuário
  email: string;
}

interface UseNameInconsistencyResult {
  inconsistencies: NameInconsistency[];
  loading: boolean;
  hasInconsistency: (colaboradorId: string) => NameInconsistency | null;
  getDisplayName: (colaboradorId: string, colaboradorNome: string, isRHView: boolean) => string;
}

export function useNameInconsistency(): UseNameInconsistencyResult {
  const { hasRole } = useAuth();
  const [inconsistencies, setInconsistencies] = useState<NameInconsistency[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isRHorFinanceiro = hasRole('RH') || hasRole('FINANCEIRO');

  useEffect(() => {
    if (!isRHorFinanceiro) {
      setLoading(false);
      return;
    }
    
    fetchInconsistencies();
  }, [isRHorFinanceiro]);

  const fetchInconsistencies = async () => {
    setLoading(true);
    
    try {
      // Fetch all colaboradores with user_id linked
      const colaboradores = await colaboradoresService.getAll();
      const linkedColaboradores = colaboradores.filter(c => c.user_id);

      if (linkedColaboradores.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch profiles for those users
      const found: NameInconsistency[] = [];
      
      for (const colab of linkedColaboradores) {
        if (!colab.user_id) continue;
        
        try {
          const user = await authService.getUserById(colab.user_id);
          if (user && user.nome.trim().toLowerCase() !== colab.nome.trim().toLowerCase()) {
            found.push({
              colaboradorId: colab.id,
              colaboradorNome: colab.nome,
              profileNome: user.nome,
              email: colab.email,
            });
          }
        } catch (error) {
          // User not found or error fetching - skip
        }
      }

      setInconsistencies(found);
    } catch (error) {
      console.error('Error fetching inconsistencies:', error);
    }
    setLoading(false);
  };

  const hasInconsistency = (colaboradorId: string): NameInconsistency | null => {
    return inconsistencies.find(i => i.colaboradorId === colaboradorId) || null;
  };

  const getDisplayName = (colaboradorId: string, colaboradorNome: string, isRHView: boolean): string => {
    const inconsistency = hasInconsistency(colaboradorId);
    
    if (!inconsistency) {
      return colaboradorNome;
    }

    // RH vê o nome do colaborador (definido pelo RH)
    // Colaborador vê o nome do profile (escolhido por ele)
    return isRHView ? inconsistency.colaboradorNome : inconsistency.profileNome;
  };

  return {
    inconsistencies,
    loading,
    hasInconsistency,
    getDisplayName,
  };
}