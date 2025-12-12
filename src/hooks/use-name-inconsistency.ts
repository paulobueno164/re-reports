import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    
    // Fetch all colaboradores with user_id linked
    const { data: colaboradores, error } = await supabase
      .from('colaboradores_elegiveis')
      .select('id, nome, email, user_id')
      .not('user_id', 'is', null);

    if (error || !colaboradores) {
      setLoading(false);
      return;
    }

    // Get user_ids to fetch profiles
    const userIds = colaboradores.map(c => c.user_id).filter(Boolean) as string[];
    
    if (userIds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch profiles for those users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .in('id', userIds);

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Find inconsistencies
    const found: NameInconsistency[] = [];
    
    for (const colab of colaboradores) {
      const profile = profiles.find(p => p.id === colab.user_id);
      if (profile && profile.nome.trim().toLowerCase() !== colab.nome.trim().toLowerCase()) {
        found.push({
          colaboradorId: colab.id,
          colaboradorNome: colab.nome,
          profileNome: profile.nome,
          email: colab.email,
        });
      }
    }

    setInconsistencies(found);
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
