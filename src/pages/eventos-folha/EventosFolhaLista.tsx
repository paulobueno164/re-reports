import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Loader2, MoreVertical } from 'lucide-react';
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
import { eventosFolhaService, EventoFolha, ComponenteRemuneracao } from '@/services/eventos-folha.service';

const COMPONENTES_REMUNERACAO = [
  { value: 'vale_alimentacao', label: 'Vale Alimentação' },
  { value: 'vale_refeicao', label: 'Vale Refeição' },
  { value: 'ajuda_custo', label: 'Ajuda de Custo' },
  { value: 'mobilidade', label: 'Mobilidade' },
  { value: 'cesta_beneficios', label: 'Cesta de Benefícios' },
  { value: 'pida', label: 'PI/DA' },
] as const;

interface PayrollEvent {
  id: string;
  componente: ComponenteRemuneracao;
  componenteLabel: string;
  codigoEvento: string;
  descricaoEvento: string;
}

const getComponenteLabel = (componente: string): string => {
  const found = COMPONENTES_REMUNERACAO.find(c => c.value === componente);
  return found?.label || componente;
};

const EventosFolhaLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<PayrollEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const eventsData = await eventosFolhaService.getAll();
      setEvents(
        eventsData.map((e) => ({
          id: e.id,
          componente: e.componente,
          componenteLabel: getComponenteLabel(e.componente),
          codigoEvento: e.codigo_evento,
          descricaoEvento: e.descricao_evento,
        }))
      );
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const filteredEvents = events.filter((event) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      event.componenteLabel.toLowerCase().includes(searchLower) ||
      event.codigoEvento.toLowerCase().includes(searchLower) ||
      event.descricaoEvento.toLowerCase().includes(searchLower)
    );
  });

  const usedComponentes = events.map(e => e.componente);
  const unusedComponentes = COMPONENTES_REMUNERACAO.filter(c => !usedComponentes.includes(c.value));

  const handleDelete = async (event: PayrollEvent) => {
    if (!confirm(`Deseja realmente excluir o evento para "${event.componenteLabel}"?`)) return;

    try {
      await eventosFolhaService.delete(event.id);
      toast({ title: 'Evento excluído', description: 'O evento foi removido com sucesso.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const columns = [
    { 
      key: 'componenteLabel', 
      header: 'Componente',
      render: (item: PayrollEvent) => (
        <span className="font-medium">{item.componenteLabel}</span>
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
        description="Configure os códigos de eventos da folha para cada componente de remuneração"
      >
        <Button onClick={() => navigate('/eventos-folha/novo')} disabled={unusedComponentes.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Evento
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eventos Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{events.length}</p>
            <p className="text-xs text-muted-foreground">de {COMPONENTES_REMUNERACAO.length} componentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{unusedComponentes.length}</p>
            <p className="text-xs text-muted-foreground">sem código configurado</p>
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
              {Math.round((events.length / COMPONENTES_REMUNERACAO.length) * 100)}%
            </p>
            <p className="text-xs text-muted-foreground">dos componentes configurados</p>
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
            Configure o código e descrição de evento da folha de pagamento para cada componente de remuneração.
            Esses códigos são utilizados na exportação mensal para integração com a folha.
          </p>
          {unusedComponentes.length > 0 && (
            <div className="mt-3">
              <p className="text-warning font-medium mb-2">Componentes sem evento:</p>
              <div className="flex flex-wrap gap-2">
                {unusedComponentes.map((comp) => (
                  <Badge key={comp.value} variant="outline" className="text-warning border-warning">
                    {comp.label}
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
            placeholder="Buscar por componente, código ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable data={filteredEvents} columns={columns} emptyMessage="Nenhum evento cadastrado" />
    </div>
  );
};

export default EventosFolhaLista;
