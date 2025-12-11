import { useState } from 'react';
import { Plus, Edit, Trash2, CalendarDays } from 'lucide-react';
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
import { mockCalendarPeriods, formatDate } from '@/lib/mock-data';
import { CalendarPeriod } from '@/types';

const Calendario = () => {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<CalendarPeriod[]>(mockCalendarPeriods);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<CalendarPeriod | null>(null);

  const currentPeriod = periods.find((p) => p.status === 'aberto');

  const columns = [
    { key: 'periodo', header: 'Período (MM/AAAA)', className: 'font-medium' },
    {
      key: 'dataInicio',
      header: 'Início Acúmulo',
      render: (item: CalendarPeriod) => formatDate(item.dataInicio),
    },
    {
      key: 'dataFinal',
      header: 'Fim Acúmulo',
      render: (item: CalendarPeriod) => formatDate(item.dataFinal),
    },
    {
      key: 'abreLancamento',
      header: 'Abre Lançamento',
      render: (item: CalendarPeriod) => formatDate(item.abreLancamento),
    },
    {
      key: 'fechaLancamento',
      header: 'Fecha Lançamento',
      render: (item: CalendarPeriod) => formatDate(item.fechaLancamento),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: CalendarPeriod) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right',
      render: (item: CalendarPeriod) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
            disabled={item.status === 'fechado'}
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
            disabled={item.status === 'fechado'}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleEdit = (period: CalendarPeriod) => {
    setSelectedPeriod(period);
    setIsDialogOpen(true);
  };

  const handleDelete = (period: CalendarPeriod) => {
    if (confirm(`Deseja realmente excluir o período ${period.periodo}?`)) {
      setPeriods(periods.filter((p) => p.id !== period.id));
      toast({
        title: 'Período excluído',
        description: `Período ${period.periodo} foi removido.`,
      });
    }
  };

  const handleNew = () => {
    setSelectedPeriod(null);
    setIsDialogOpen(true);
  };

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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <p>• <strong>Período de Acúmulo:</strong> Dia 21 do mês anterior ao dia 20 do mês atual</p>
          <p>• <strong>Janela de Lançamento:</strong> Dias 10/11 até o dia 20 do mês de referência</p>
          <p>• <strong>Lançamento fora do período:</strong> Automaticamente direcionado ao próximo mês</p>
          <p>• <strong>Não é permitido:</strong> Lançar para dois meses à frente</p>
        </CardContent>
      </Card>

      {/* Table */}
      <DataTable
        data={periods}
        columns={columns}
        emptyMessage="Nenhum período cadastrado"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedPeriod ? 'Editar Período' : 'Novo Período'}
            </DialogTitle>
            <DialogDescription>
              Configure as datas do período de remuneração
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período (MM/AAAA)</Label>
              <Input
                defaultValue={selectedPeriod?.periodo || ''}
                placeholder="Ex: 01/2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início Acúmulo</Label>
                <Input
                  type="date"
                  defaultValue={
                    selectedPeriod?.dataInicio
                      ? new Date(selectedPeriod.dataInicio).toISOString().split('T')[0]
                      : ''
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final Acúmulo</Label>
                <Input
                  type="date"
                  defaultValue={
                    selectedPeriod?.dataFinal
                      ? new Date(selectedPeriod.dataFinal).toISOString().split('T')[0]
                      : ''
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Abre Lançamento</Label>
                <Input
                  type="date"
                  defaultValue={
                    selectedPeriod?.abreLancamento
                      ? new Date(selectedPeriod.abreLancamento).toISOString().split('T')[0]
                      : ''
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Dia em que colaboradores podem começar a lançar
                </p>
              </div>
              <div className="space-y-2">
                <Label>Fecha Lançamento</Label>
                <Input
                  type="date"
                  defaultValue={
                    selectedPeriod?.fechaLancamento
                      ? new Date(selectedPeriod.fechaLancamento).toISOString().split('T')[0]
                      : ''
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Última data para lançamentos do período
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: selectedPeriod ? 'Período atualizado' : 'Período criado',
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

export default Calendario;
