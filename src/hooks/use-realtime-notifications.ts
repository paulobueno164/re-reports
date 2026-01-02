import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { lancamentosService } from '@/services/lancamentos.service';
import { colaboradoresService } from '@/services/colaboradores.service';

interface Notification {
  id: string;
  type: 'new_expense' | 'expense_validated' | 'expense_rejected' | 'period_closing';
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  data?: any;
}

const POLLING_INTERVAL = 30000; // 30 segundos

export function useRealtimeNotifications() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastCheckRef = useRef<Date>(new Date());
  const knownIdsRef = useRef<Set<string>>(new Set());

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
    setUnreadCount((prev) => prev + 1);

    toast({
      title: notification.title,
      description: notification.message,
    });
  }, [toast]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!user) return;

    const isRH = hasRole('RH');
    const isFinanceiro = hasRole('FINANCEIRO');

    const checkForNewExpenses = async () => {
      try {
        const lancamentos = await lancamentosService.getAll();
        const lastCheck = lastCheckRef.current;

        for (const lancamento of lancamentos) {
          // Pular se já conhecemos este lançamento
          if (knownIdsRef.current.has(lancamento.id)) continue;

          const createdAt = new Date(lancamento.created_at);
          const updatedAt = new Date(lancamento.updated_at);

          // RH/Financeiro: notificar sobre novos lançamentos enviados
          if ((isRH || isFinanceiro) && lancamento.status === 'enviado') {
            if (createdAt > lastCheck || updatedAt > lastCheck) {
              try {
                const colaborador = await colaboradoresService.getById(lancamento.colaborador_id);
                addNotification({
                  type: 'new_expense',
                  title: 'Novo lançamento para análise',
                  message: `${colaborador?.nome || 'Colaborador'} enviou uma despesa para validação.`,
                  data: lancamento,
                });
              } catch {
                addNotification({
                  type: 'new_expense',
                  title: 'Novo lançamento para análise',
                  message: 'Um colaborador enviou uma despesa para validação.',
                  data: lancamento,
                });
              }
            }
          }

          // Colaborador: notificar sobre validações/rejeições das próprias despesas
          if (!isRH && !isFinanceiro) {
            try {
              const meuColaborador = await colaboradoresService.getByUserId(user.id);
              if (meuColaborador && lancamento.colaborador_id === meuColaborador.id) {
                if (updatedAt > lastCheck) {
                  if (lancamento.status === 'valido') {
                    addNotification({
                      type: 'expense_validated',
                      title: 'Despesa aprovada',
                      message: 'Sua despesa foi validada pelo RH.',
                      data: lancamento,
                    });
                  } else if (lancamento.status === 'invalido') {
                    addNotification({
                      type: 'expense_rejected',
                      title: 'Despesa rejeitada',
                      message: lancamento.motivo_invalidacao || 'Sua despesa foi invalidada.',
                      data: lancamento,
                    });
                  }
                }
              }
            } catch {
              // Ignorar erros ao buscar colaborador
            }
          }

          knownIdsRef.current.add(lancamento.id);
        }

        lastCheckRef.current = new Date();
      } catch (error) {
        console.error('Erro ao verificar novos lançamentos:', error);
      }
    };

    // Inicializar IDs conhecidos
    const initKnownIds = async () => {
      try {
        const lancamentos = await lancamentosService.getAll();
        lancamentos.forEach(l => knownIdsRef.current.add(l.id));
        lastCheckRef.current = new Date();
      } catch (error) {
        console.error('Erro ao inicializar IDs conhecidos:', error);
      }
    };

    initKnownIds();

    const interval = setInterval(checkForNewExpenses, POLLING_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [user, hasRole, addNotification]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
