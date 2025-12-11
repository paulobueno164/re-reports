import { useState } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { mockPayrollEvents, mockExpenseTypes } from '@/lib/mock-data';
import { ExpenseTypePayrollEvent } from '@/types';

const EventosFolha = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<ExpenseTypePayrollEvent[]>(mockPayrollEvents);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExpenseTypePayrollEvent | null>(null);

  const filteredEvents = events.filter(
    (event) =>
      event.tipoDespesaNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.codigoEvento.includes(searchTerm) ||
      event.descricaoEvento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'tipoDespesaNome', header: 'Tipo de Despesa' },
    { key: 'codigoEvento', header: 'Código do Evento', className: 'font-mono' },
    { key: 'descricaoEvento', header: 'Descrição do Evento de Folha' },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right',
      render: (item: ExpenseTypePayrollEvent) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleEdit = (event: ExpenseTypePayrollEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  const handleDelete = (event: ExpenseTypePayrollEvent) => {
    if (confirm(`Deseja realmente excluir o vínculo para "${event.tipoDespesaNome}"?`)) {
      setEvents(events.filter((e) => e.id !== event.id));
      toast({
        title: 'Vínculo excluído',
        description: 'O vínculo foi removido com sucesso.',
      });
    }
  };

  const handleNew = () => {
    setSelectedEvent(null);
    setIsDialogOpen(true);
  };

  // Get expense types not yet linked
  const unlinkedExpenseTypes = mockExpenseTypes.filter(
    (type) => !events.some((e) => e.tipoDespesaId === type.id)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Eventos de Folha de Pagamento"
        description="Vincule os tipos de despesas aos códigos de eventos da folha de pagamento"
      >
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Vínculo
        </Button>
      </PageHeader>

      {/* Info Card */}
      <Card className="bg-info/5 border-info/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-info">
            Importante
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Este cadastro vincula cada tipo de despesa ao código de evento correspondente
            no sistema de Folha de Pagamentos. Esses códigos são utilizados na exportação
            mensal para integração com a folha.
          </p>
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
      <DataTable
        data={filteredEvents}
        columns={columns}
        emptyMessage="Nenhum vínculo cadastrado"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? 'Editar Vínculo' : 'Novo Vínculo'}
            </DialogTitle>
            <DialogDescription>
              Vincule um tipo de despesa a um evento de folha de pagamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Despesa</Label>
              <Select
                defaultValue={selectedEvent?.tipoDespesaId || ''}
                disabled={!!selectedEvent}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de despesa" />
                </SelectTrigger>
                <SelectContent>
                  {selectedEvent ? (
                    <SelectItem value={selectedEvent.tipoDespesaId}>
                      {selectedEvent.tipoDespesaNome}
                    </SelectItem>
                  ) : (
                    unlinkedExpenseTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!selectedEvent && unlinkedExpenseTypes.length === 0 && (
                <p className="text-xs text-warning">
                  Todos os tipos de despesa já possuem vínculo.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Código do Evento</Label>
              <Input
                defaultValue={selectedEvent?.codigoEvento || ''}
                placeholder="Ex: 108930"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Código numérico utilizado pelo sistema de folha de pagamentos
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descrição do Evento</Label>
              <Input
                defaultValue={selectedEvent?.descricaoEvento || ''}
                placeholder="Ex: Equipamentos de uso"
              />
              <p className="text-xs text-muted-foreground">
                Nome do evento conforme cadastrado na folha
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: selectedEvent ? 'Vínculo atualizado' : 'Vínculo criado',
                  description: 'Os dados foram salvos com sucesso.',
                });
                setIsDialogOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventosFolha;
