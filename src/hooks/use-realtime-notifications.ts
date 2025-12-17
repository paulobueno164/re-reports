import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: 'new_expense' | 'expense_validated' | 'expense_rejected' | 'period_closing';
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  data?: any;
}

export function useRealtimeNotifications() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50
    setUnreadCount((prev) => prev + 1);

    // Show toast
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

    // RH and Financeiro receive notifications about new expense submissions
    if (isRH || isFinanceiro) {
      const channel = supabase
        .channel('lancamentos-notifications')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'lancamentos',
          },
          async (payload) => {
            const oldStatus = (payload.old as any)?.status;
            const newStatus = payload.new.status;

            // New expense submitted for analysis (INSERT event is handled separately)
            if (newStatus === 'enviado' && oldStatus !== 'enviado') {
              // Fetch collaborator name
              const { data: colaborador } = await supabase
                .from('colaboradores_elegiveis')
                .select('nome')
                .eq('id', payload.new.colaborador_id)
                .maybeSingle();

              addNotification({
                type: 'new_expense',
                title: 'Novo lançamento para análise',
                message: `${colaborador?.nome || 'Colaborador'} enviou uma despesa para validação.`,
                data: payload.new,
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lancamentos',
            filter: 'status=eq.enviado',
          },
          async (payload) => {
            const { data: colaborador } = await supabase
              .from('colaboradores_elegiveis')
              .select('nome')
              .eq('id', payload.new.colaborador_id)
              .maybeSingle();

            addNotification({
              type: 'new_expense',
              title: 'Novo lançamento para análise',
              message: `${colaborador?.nome || 'Colaborador'} enviou uma nova despesa.`,
              data: payload.new,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Colaboradores receive notifications about their expense validations
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lancamentos',
        },
        async (payload) => {
          const oldStatus = (payload.old as any)?.status;
          const newStatus = payload.new.status;

          // Check if this expense belongs to the current user
          const { data: colaborador } = await supabase
            .from('colaboradores_elegiveis')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (colaborador?.id !== payload.new.colaborador_id) return;

          if (newStatus === 'valido' && oldStatus !== 'valido') {
            addNotification({
              type: 'expense_validated',
              title: 'Despesa aprovada',
              message: 'Sua despesa foi validada pelo RH.',
              data: payload.new,
            });
          } else if (newStatus === 'invalido' && oldStatus !== 'invalido') {
            addNotification({
              type: 'expense_rejected',
              title: 'Despesa rejeitada',
              message: payload.new.motivo_invalidacao || 'Sua despesa foi invalidada.',
              data: payload.new,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, hasRole, addNotification]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
