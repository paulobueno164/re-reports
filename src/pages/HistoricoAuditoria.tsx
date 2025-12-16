import { useState, useEffect } from 'react';
import { History, Search, Filter, CheckCircle, XCircle, Plus, Trash2, Edit, Loader2, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/expense-validation';
import { exportAuditLogsToExcel } from '@/lib/audit-export';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_description: string | null;
  old_values: any;
  new_values: any;
  metadata: any;
}

const actionLabels: Record<string, { label: string; color: string; icon: any }> = {
  aprovar: { label: 'Aprovação', color: 'text-success bg-success/10', icon: CheckCircle },
  rejeitar: { label: 'Rejeição', color: 'text-destructive bg-destructive/10', icon: XCircle },
  criar: { label: 'Criação', color: 'text-primary bg-primary/10', icon: Plus },
  atualizar: { label: 'Atualização', color: 'text-warning bg-warning/10', icon: Edit },
  excluir: { label: 'Exclusão', color: 'text-destructive bg-destructive/10', icon: Trash2 },
};

const entityLabels: Record<string, string> = {
  lancamento: 'Lançamento',
  colaborador: 'Colaborador',
  tipo_despesa: 'Tipo de Despesa',
  periodo: 'Período',
  evento_folha: 'Evento de Folha',
};

const HistoricoAuditoria = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchLogs();
  }, [filterAction, filterEntity, filterUser]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    }
    if (filterEntity !== 'all') {
      query = query.eq('entity_type', filterEntity);
    }
    if (filterUser !== 'all') {
      query = query.eq('user_id', filterUser);
    }

    const { data, error } = await query;

    if (data) {
      setLogs(data);
      // Extract unique users
      const uniqueUsers = [...new Map(data.map((l) => [l.user_id, { id: l.user_id, name: l.user_name }])).values()];
      setUsers(uniqueUsers);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      toast.error('Não há registros para exportar');
      return;
    }
    
    exportAuditLogsToExcel(filteredLogs, {
      action: filterAction,
      entity: filterEntity,
    });
    
    toast.success(`Exportados ${filteredLogs.length} registros de auditoria`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Histórico de Auditoria"
        description="Rastreie todas as ações de aprovação e rejeição de despesas"
      >
        <Button onClick={handleExportExcel} className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exportar Excel</span>
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Usuário, descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="aprovar">Aprovação</SelectItem>
                  <SelectItem value="rejeitar">Rejeição</SelectItem>
                  <SelectItem value="criar">Criação</SelectItem>
                  <SelectItem value="atualizar">Atualização</SelectItem>
                  <SelectItem value="excluir">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Entidade</Label>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="tipo_despesa">Tipo de Despesa</SelectItem>
                  <SelectItem value="periodo">Período</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Registros ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de auditoria encontrado</p>
              <p className="text-sm">Os registros aparecerão aqui após ações de validação</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const actionInfo = actionLabels[log.action] || { label: log.action, color: 'text-muted-foreground bg-muted', icon: History };
                const IconComponent = actionInfo.icon;
                
                return (
                  <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className={`p-2 rounded-full ${actionInfo.color}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{log.user_name}</span>
                        <span className="text-muted-foreground">realizou</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                        <span className="text-muted-foreground">em</span>
                        <span className="font-medium">{entityLabels[log.entity_type] || log.entity_type}</span>
                      </div>
                      {log.entity_description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{log.entity_description}</p>
                      )}
                      {log.new_values?.motivo && (
                        <p className="text-sm text-destructive mt-1">Motivo: {log.new_values.motivo}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{formatDate(new Date(log.created_at))}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoricoAuditoria;
