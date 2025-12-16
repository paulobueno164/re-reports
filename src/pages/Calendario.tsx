import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CalendarDays, Loader2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
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
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/expense-validation';

interface CalendarPeriod {
  id: string;
  periodo: string;
  dataInicio: Date;
  dataFinal: Date;
  abreLancamento: Date;
  fechaLancamento: Date;
  status: 'aberto' | 'fechado';
}

const Calendario = () => {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<CalendarPeriod | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    periodo: '',
    dataInicio: '',
    dataFinal: '',
    abreLancamento: '',
    fechaLancamento: '',
  });

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('calendario_periodos')
      .select('*')
      .order('periodo', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (data) {
      setPeriods(
        data.map((p) => ({
          id: p.id,
          periodo: p.periodo,
          dataInicio: new Date(p.data_inicio),
          dataFinal: new Date(p.data_final),
          abreLancamento: new Date(p.abre_lancamento),
          fechaLancamento: new Date(p.fecha_lancamento),
          status: p.status as 'aberto' | 'fechado',
        }))
      );
    }
    setLoading(false);
  };

  const currentPeriod = periods.find((p) => p.status === 'aberto');

  const columns = [
    { key: 'periodo', header: 'Período', className: 'font-medium' },
    {
      key: 'dataInicio',
      header: 'Início',
      hideOnMobile: true,
      render: (item: CalendarPeriod) => formatDate(item.dataInicio),
    },
    {
      key: 'dataFinal',
      header: 'Fim',
      hideOnMobile: true,
      render: (item: CalendarPeriod) => formatDate(item.dataFinal),
    },
    {
      key: 'abreLancamento',
      header: 'Abre',
      render: (item: CalendarPeriod) => formatDate(item.abreLancamento),
    },
    {
      key: 'fechaLancamento',
      header: 'Fecha',
      render: (item: CalendarPeriod) => formatDate(item.fechaLancamento),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: CalendarPeriod) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item: CalendarPeriod) => (
        <div className="flex justify-end gap-1">
          {/* Desktop: botões individuais */}
          <div className="hidden sm:flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleEdit(item)}
              disabled={item.status === 'fechado'}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDelete(item)}
              disabled={item.status === 'fechado'}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          {/* Mobile: dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => handleEdit(item)}
                  disabled={item.status === 'fechado'}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDelete(item)} 
                  className="text-destructive"
                  disabled={item.status === 'fechado'}
                >
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

  const handleEdit = (period: CalendarPeriod) => {
    setSelectedPeriod(period);
    setFormData({
      periodo: period.periodo,
      dataInicio: period.dataInicio.toISOString().split('T')[0],
      dataFinal: period.dataFinal.toISOString().split('T')[0],
      abreLancamento: period.abreLancamento.toISOString().split('T')[0],
      fechaLancamento: period.fechaLancamento.toISOString().split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (period: CalendarPeriod) => {
    if (!confirm(`Deseja realmente excluir o período ${period.periodo}?`)) return;

    const { error } = await supabase.from('calendario_periodos').delete().eq('id', period.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Período excluído', description: `Período ${period.periodo} foi removido.` });
      fetchPeriods();
    }
  };

  const handleNew = () => {
    setSelectedPeriod(null);
    setFormData({
      periodo: '',
      dataInicio: '',
      dataFinal: '',
      abreLancamento: '',
      fechaLancamento: '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.periodo || !formData.dataInicio || !formData.dataFinal || !formData.abreLancamento || !formData.fechaLancamento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const dbData = {
      periodo: formData.periodo,
      data_inicio: formData.dataInicio,
      data_final: formData.dataFinal,
      abre_lancamento: formData.abreLancamento,
      fecha_lancamento: formData.fechaLancamento,
      status: 'aberto' as const,
    };

    try {
      if (selectedPeriod) {
        const { error } = await supabase.from('calendario_periodos').update(dbData).eq('id', selectedPeriod.id);
        if (error) throw error;
        toast({ title: 'Período atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        const { error } = await supabase.from('calendario_periodos').insert([dbData]);
        if (error) throw error;
        toast({ title: 'Período criado', description: 'O período foi cadastrado.' });
      }
      setIsDialogOpen(false);
      fetchPeriods();
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
        title="Calendário de Períodos"
        description="Defina os períodos mensais e as janelas de lançamento para colaboradores"
      >
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Período
        </Button>
      </PageHeader>

      {/* Current Period Card */}
      {currentPeriod && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Período Atual em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Período</p>
                <p className="text-lg font-semibold">{currentPeriod.periodo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Acúmulo de Despesas</p>
                <p className="font-medium">
                  {formatDate(currentPeriod.dataInicio)} - {formatDate(currentPeriod.dataFinal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Janela de Lançamento</p>
                <p className="font-medium">
                  {formatDate(currentPeriod.abreLancamento)} - {formatDate(currentPeriod.fechaLancamento)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <StatusBadge status={currentPeriod.status} />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => handleEdit(currentPeriod)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Card */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Regras do Calendário</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            • <strong>Período de Acúmulo:</strong> Dia 21 do mês anterior ao dia 20 do mês atual
          </p>
          <p>
            • <strong>Janela de Lançamento:</strong> Dias 10/11 até o dia 20 do mês de referência
          </p>
          <p>
            • <strong>Lançamento fora do período:</strong> Automaticamente direcionado ao próximo mês
          </p>
          <p>
            • <strong>Não é permitido:</strong> Lançar para dois meses à frente
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <DataTable data={periods} columns={columns} emptyMessage="Nenhum período cadastrado" />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedPeriod ? 'Editar Período' : 'Novo Período'}</DialogTitle>
            <DialogDescription>Configure as datas do período de remuneração</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período (MM/AAAA)</Label>
              <Input
                value={formData.periodo}
                onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
                placeholder="Ex: 01/2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início Acúmulo</Label>
                <Input
                  type="date"
                  value={formData.dataInicio}
                  onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final Acúmulo</Label>
                <Input
                  type="date"
                  value={formData.dataFinal}
                  onChange={(e) => setFormData({ ...formData, dataFinal: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Abre Lançamento</Label>
                <Input
                  type="date"
                  value={formData.abreLancamento}
                  onChange={(e) => setFormData({ ...formData, abreLancamento: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Dia em que colaboradores podem começar a lançar</p>
              </div>
              <div className="space-y-2">
                <Label>Fecha Lançamento</Label>
                <Input
                  type="date"
                  value={formData.fechaLancamento}
                  onChange={(e) => setFormData({ ...formData, fechaLancamento: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Última data para lançamentos do período</p>
              </div>
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

export default Calendario;
