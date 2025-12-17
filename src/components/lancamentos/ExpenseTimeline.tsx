import { useState, useEffect } from 'react';
import { 
  History, 
  Plus, 
  Edit, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock,
  Search,
  Loader2,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/expense-validation';

interface TimelineEvent {
  id: string;
  type: 'criar' | 'atualizar' | 'enviar' | 'iniciar_analise' | 'aprovar' | 'rejeitar';
  timestamp: Date;
  userName: string;
  description?: string;
  oldValues?: any;
  newValues?: any;
}

const eventConfig: Record<string, { icon: any; color: string; label: string }> = {
  criar: { 
    icon: Plus, 
    color: 'bg-primary/10 text-primary border-primary/30', 
    label: 'Lançamento criado' 
  },
  atualizar: { 
    icon: Edit, 
    color: 'bg-warning/10 text-warning border-warning/30', 
    label: 'Lançamento editado' 
  },
  enviar: { 
    icon: Send, 
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', 
    label: 'Enviado para análise' 
  },
  iniciar_analise: { 
    icon: Search, 
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/30', 
    label: 'Análise iniciada' 
  },
  aprovar: { 
    icon: CheckCircle, 
    color: 'bg-success/10 text-success border-success/30', 
    label: 'Aprovado' 
  },
  rejeitar: { 
    icon: XCircle, 
    color: 'bg-destructive/10 text-destructive border-destructive/30', 
    label: 'Rejeitado' 
  },
};

interface ExpenseTimelineProps {
  expenseId: string;
}

export const ExpenseTimeline = ({ expenseId }: ExpenseTimelineProps) => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (expenseId) {
      fetchTimeline();
    }
  }, [expenseId]);

  const fetchTimeline = async () => {
    setLoading(true);

    // Fetch the expense to get creation info
    const { data: expense } = await supabase
      .from('lancamentos')
      .select('*, colaboradores_elegiveis(nome)')
      .eq('id', expenseId)
      .single();

    // Fetch audit logs for this expense
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'lancamento')
      .eq('entity_id', expenseId)
      .order('created_at', { ascending: true });

    const timelineEvents: TimelineEvent[] = [];

    // Add creation event (from expense record itself if no audit log)
    if (expense) {
      const hasCreateLog = logs?.some(l => l.action === 'criar');
      if (!hasCreateLog) {
        timelineEvents.push({
          id: 'create-' + expense.id,
          type: 'criar',
          timestamp: new Date(expense.created_at),
          userName: expense.colaboradores_elegiveis?.nome || 'Colaborador',
          description: 'Lançamento criado e enviado para análise',
        });
      }
    }

    // Add audit log events
    logs?.forEach(log => {
      let eventType = log.action as TimelineEvent['type'];
      
      // Map status changes to appropriate event types
      const newValues = log.new_values as Record<string, any> | null;
      if (log.action === 'atualizar' && newValues?.status === 'enviado') {
        eventType = 'enviar';
      }

      timelineEvents.push({
        id: log.id,
        type: eventType,
        timestamp: new Date(log.created_at),
        userName: log.user_name,
        description: log.entity_description || undefined,
        oldValues: log.old_values,
        newValues: log.new_values,
      });
    });

    // Sort by timestamp
    timelineEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    setEvents(timelineEvents);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico do Lançamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico do Lançamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum histórico disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico do Lançamento ({events.length} eventos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 pr-4">
          <div className="relative pl-6">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {events.map((event, index) => {
                const config = eventConfig[event.type] || eventConfig.atualizar;
                const IconComponent = config.icon;
                
                return (
                  <div key={event.id} className="relative flex gap-3">
                    {/* Timeline dot */}
                    <div className={`absolute -left-6 w-6 h-6 rounded-full border-2 flex items-center justify-center ${config.color}`}>
                      <IconComponent className="h-3 w-3" />
                    </div>
                    
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          por {event.userName}
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(event.timestamp)} às{' '}
                        {event.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      
                      {event.newValues?.motivo && (
                        <p className="text-xs text-destructive mt-1 bg-destructive/5 p-2 rounded">
                          Motivo: {String(event.newValues.motivo)}
                        </p>
                      )}
                      
                      {event.description && !event.newValues?.motivo && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
