import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Loader2, Link2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PayrollEvent {
  id: string;
  tipoDespesaId: string;
  tipoDespesaNome: string;
  codigoEvento: string;
  descricaoEvento: string;
}

interface ExpenseType {
  id: string;
  nome: string;
  hasEvent: boolean;
}

const EventosFolhaLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<PayrollEvent[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: eventsData, error: eventsError } = await supabase
      .from('tipos_despesas_eventos')
      .select(`
        id,
        tipo_despesa_id,
        codigo_evento,
        descricao_evento,
        tipos_despesas (id, nome)
      `)
      .order('codigo_evento');

    if (eventsError) {
      toast({ title: 'Erro', description: eventsError.message, variant: 'destructive' });
    } else if (eventsData) {
      setEvents(
        eventsData.map((e: any) => ({
          id: e.id,
          tipoDespesaId: e.tipo_despesa_id,
          tipoDespesaNome: e.tipos_despesas?.nome || '',
          codigoEvento: e.codigo_evento,
          descricaoEvento: e.descricao_evento,
        }))
      );
    }

    const { data: typesData } = await supabase
      .from('tipos_despesas')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');

    if (typesData) {
      const linkedIds = eventsData?.map((e: any) => e.tipo_despesa_id) || [];
      setExpenseTypes(
        typesData.map((t) => ({
          id: t.id,
          nome: t.nome,
          hasEvent: linkedIds.includes(t.id),
        }))
      );
    }

    setLoading(false);
  };

  const filteredEvents = events.filter((event) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      event.tipoDespesaNome?.toLowerCase().includes(searchLower) ||
      event.codigoEvento.toLowerCase().includes(searchLower) ||
      event.descricaoEvento.toLowerCase().includes(searchLower)
    );
  });

  const unlinkedExpenseTypes = expenseTypes.filter((t) => !t.hasEvent);

  const handleDelete = async (event: PayrollEvent) => {
    if (!confirm(`Deseja realmente excluir o vínculo para "${event.tipoDespesaNome}"?`)) return;

    const { error } = await supabase
      .from('tipos_despesas_eventos')
      .delete()
      .eq('id', event.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vínculo excluído', description: 'O vínculo foi removido com sucesso.' });
      fetchData();
    }
  };

  const columns = [
    { 
      key: 'tipoDespesaNome', 
      header: 'Tipo',
      render: (item: PayrollEvent) => (
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="truncate max-w-[100px] sm:max-w-none">{item.tipoDespesaNome}</span>
        </div>
      ),
    },
    { key: 'codigoEvento', header: 'Código', className: 'font-mono text-primary' },
    { key: 'descricaoEvento', header: 'Descrição', hideOnMobile: true },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item: PayrollEvent) => (
        <div className="flex justify-end gap-1">
          <div className="hidden sm:flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/eventos-folha/${item.id}/editar`)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/eventos-folha/${item.id}/editar`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Eventos de Folha de Pagamento"
        description="Vincule os tipos de despesas aos códigos de eventos da folha de pagamento"
      >
        <Button onClick={() => navigate('/eventos-folha/novo')} disabled={unlinkedExpenseTypes.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Vínculo
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Vínculos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{events.length}</p>
            <p className="text-xs text-muted-foreground">tipos de despesa vinculados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tipos sem Vínculo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{unlinkedExpenseTypes.length}</p>
            <p className="text-xs text-muted-foreground">pendentes de configuração</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cobertura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {expenseTypes.length > 0 
                ? Math.round((events.length / expenseTypes.length) * 100) 
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">dos tipos vinculados</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-info/5 border-info/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-info">Importante</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Este cadastro vincula cada tipo de despesa ao código de evento correspondente no sistema
            de Folha de Pagamentos. Esses códigos são utilizados na exportação mensal para integração
            com a folha.
          </p>
          {unlinkedExpenseTypes.length > 0 && (
            <div className="mt-3">
              <p className="text-warning font-medium mb-2">Tipos sem vínculo:</p>
              <div className="flex flex-wrap gap-2">
                {unlinkedExpenseTypes.map((type) => (
                  <Badge key={type.id} variant="outline" className="text-warning border-warning">
                    {type.nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por tipo, código ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable data={filteredEvents} columns={columns} emptyMessage="Nenhum vínculo cadastrado" />
    </div>
  );
};

export default EventosFolhaLista;
