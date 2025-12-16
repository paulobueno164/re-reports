import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Loader2, Link2 } from 'lucide-react';
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

const EventosFolha = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<PayrollEvent[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PayrollEvent | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tipoDespesaId: '',
    codigoEvento: '',
    descricaoEvento: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch payroll events with expense type names
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

    // Fetch all expense types to show which ones are linked
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

  const filteredEvents = events.filter(
    (event) =>
      event.tipoDespesaNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.codigoEvento.includes(searchTerm) ||
      event.descricaoEvento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unlinkedExpenseTypes = expenseTypes.filter((t) => !t.hasEvent);

  const columns = [
    { 
      key: 'tipoDespesaNome', 
      header: 'Tipo de Despesa',
      render: (item: PayrollEvent) => (
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span>{item.tipoDespesaNome}</span>
        </div>
      ),
    },
    { key: 'codigoEvento', header: 'Código do Evento', className: 'font-mono text-primary' },
    { key: 'descricaoEvento', header: 'Descrição do Evento de Folha' },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right',
      render: (item: PayrollEvent) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleEdit = (event: PayrollEvent) => {
    setSelectedEvent(event);
    setFormData({
      tipoDespesaId: event.tipoDespesaId,
      codigoEvento: event.codigoEvento,
      descricaoEvento: event.descricaoEvento,
    });
    setIsDialogOpen(true);
  };

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

  const handleNew = () => {
    setSelectedEvent(null);
    setFormData({
      tipoDespesaId: '',
      codigoEvento: '',
      descricaoEvento: '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.tipoDespesaId || !formData.codigoEvento || !formData.descricaoEvento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const dbData = {
      tipo_despesa_id: formData.tipoDespesaId,
      codigo_evento: formData.codigoEvento,
      descricao_evento: formData.descricaoEvento,
    };

    try {
      if (selectedEvent) {
        const { error } = await supabase
          .from('tipos_despesas_eventos')
          .update(dbData)
          .eq('id', selectedEvent.id);
        if (error) throw error;
        toast({ title: 'Vínculo atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        const { error } = await supabase.from('tipos_despesas_eventos').insert([dbData]);
        if (error) throw error;
        toast({ title: 'Vínculo criado', description: 'O vínculo foi cadastrado com sucesso.' });
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
        <Button onClick={handleNew} disabled={unlinkedExpenseTypes.length === 0}>
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

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? 'Editar Vínculo' : 'Novo Vínculo'}</DialogTitle>
            <DialogDescription>Vincule um tipo de despesa a um evento de folha de pagamento</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Despesa</Label>
              <Select
                value={formData.tipoDespesaId}
                onValueChange={(value) => setFormData({ ...formData, tipoDespesaId: value })}
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
                <p className="text-xs text-warning">Todos os tipos de despesa já possuem vínculo.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Código do Evento</Label>
              <Input
                value={formData.codigoEvento}
                onChange={(e) => setFormData({ ...formData, codigoEvento: e.target.value })}
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
                value={formData.descricaoEvento}
                onChange={(e) => setFormData({ ...formData, descricaoEvento: e.target.value })}
                placeholder="Ex: Equipamentos de uso"
              />
              <p className="text-xs text-muted-foreground">Nome do evento conforme cadastrado na folha</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventosFolha;
