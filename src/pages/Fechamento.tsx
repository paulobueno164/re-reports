import { useState, useEffect } from 'react';
import { Play, Download, FileSpreadsheet, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { exportToExcel } from '@/lib/excel-export';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { findCurrentPeriod } from '@/lib/utils';
import { periodosService } from '@/services/periodos.service';
import { fechamentoService } from '@/services/fechamento.service';
import { lancamentosService } from '@/services/lancamentos.service';
import { eventosFolhaService } from '@/services/eventos-folha.service';
import { exportService } from '@/services/export.service';

interface CalendarPeriod {
  id: string;
  periodo: string;
  status: string;
  data_inicio: string;
  data_final: string;
}

interface ClosingLog {
  id: string;
  periodo: string;
  dataProcessamento: Date;
  usuario: string;
  totalColaboradores: number;
  totalEventos: number;
  valorTotal: number;
  status: string;
}

const Fechamento = () => {
  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [closingLogs, setClosingLogs] = useState<ClosingLog[]>([]);
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [pendingEnviado, setPendingEnviado] = useState(0);
  const [pendingEmAnalise, setPendingEmAnalise] = useState(0);
  const [totalLancamentos, setTotalLancamentos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fechamentoToDelete, setFechamentoToDelete] = useState<ClosingLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const viewingPeriod = periods.find(p => p.id === filterPeriod);
  const pendingValidation = pendingEnviado + pendingEmAnalise;
  const canProcess = pendingValidation === 0 && hasRole('RH');
  const canExport = hasRole('FINANCEIRO') || hasRole('RH');
  const canDelete = hasRole('RH');

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (filterPeriod) {
      fetchDataForPeriod(filterPeriod);
    }
  }, [filterPeriod]);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const periodsData = await periodosService.getAll();
      if (periodsData) {
        setPeriods(periodsData);
        const currentPeriod = findCurrentPeriod(periodsData);
        const openPeriod = periodsData.find(p => p.status === 'aberto');
        if (currentPeriod) {
          setFilterPeriod(currentPeriod.id);
        }
        setSelectedPeriod(openPeriod?.id || '');
      }
    } catch (error) {
      console.error('Erro ao buscar períodos:', error);
    }
    setLoading(false);
  };

  const fetchDataForPeriod = async (periodId: string) => {
    try {
      // Fetch lancamentos for counts
      const lancamentos = await lancamentosService.getAll({ periodo_id: periodId });
      const enviados = lancamentos.filter((l: any) => l.status === 'enviado').length;
      const emAnalise = lancamentos.filter((l: any) => l.status === 'em_analise').length;
      
      setPendingEnviado(enviados);
      setPendingEmAnalise(emAnalise);
      setTotalLancamentos(lancamentos.length);

      // Fetch fechamentos for this period
      const fechamentos = await fechamentoService.getAll(periodId);
      if (fechamentos) {
        setClosingLogs(fechamentos.map((f: any) => ({
          id: f.id,
          periodo: f.periodo?.periodo || '',
          dataProcessamento: new Date(f.data_processamento),
          usuario: f.usuario_nome || 'Sistema',
          totalColaboradores: f.total_colaboradores,
          totalEventos: f.total_eventos,
          valorTotal: Number(f.valor_total),
          status: f.status,
        })));
      } else {
        setClosingLogs([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do período:', error);
    }
  };

  const columns = [
    { key: 'periodo', header: 'Período', className: 'font-medium' },
    {
      key: 'dataProcessamento',
      header: 'Data',
      hideOnMobile: true,
      render: (item: ClosingLog) =>
        formatDate(item.dataProcessamento) +
        ' ' +
        item.dataProcessamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
    { key: 'usuario', header: 'Usuário', hideOnMobile: true },
    { key: 'totalColaboradores', header: 'Colab.', className: 'text-center', hideOnMobile: true },
    { key: 'totalEventos', header: 'Eventos', className: 'text-center', hideOnMobile: true },
    {
      key: 'valorTotal',
      header: 'Valor',
      className: 'text-right font-mono',
      render: (item: ClosingLog) => formatCurrency(item.valorTotal),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item: ClosingLog) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 sm:px-3"
            onClick={() => handleExport(item)}
            disabled={!canExport}
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 sm:px-3 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleDeleteClick(item)}
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Excluir</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const handleProcess = async () => {
    if (!selectedPeriod || !user) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      setProcessingProgress(30);
      
      const result = await fechamentoService.processar(selectedPeriod);
      
      setProcessingProgress(90);

      // Update period status to closed
      await periodosService.update(selectedPeriod, { status: 'fechado' });

      setProcessingProgress(100);

      const pidaCount = result.eventos_pida?.length || 0;
      const pidaMsg = pidaCount > 0 
        ? ` ${pidaCount} evento(s) PI/DA gerado(s) (${formatCurrency(result.resumo?.valor_pida || 0)}).`
        : '';

      toast({
        title: 'Fechamento concluído',
        description: `${result.resumo?.total_eventos || 0} eventos para ${result.resumo?.total_colaboradores || 0} colaboradores.${pidaMsg}`,
      });

      setIsDialogOpen(false);
      
      // Atualizar períodos e lista de fechamentos
      await fetchPeriods();
      
      // Atualizar a lista de fechamentos do período processado
      if (selectedPeriod) {
        await fetchDataForPeriod(selectedPeriod);
      }
    } catch (error: any) {
      toast({
        title: 'Erro no processamento',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (log: ClosingLog) => {
    try {
      const period = periods.find(p => p.periodo === log.periodo);
      if (!period) return;

      // Usar o serviço do backend para buscar dados de exportação
      const exportData = await exportService.getExportData(period.id);

      if (!exportData || exportData.length === 0) {
        toast({
          title: 'Sem dados',
          description: 'Não há dados para exportar.',
          variant: 'destructive',
        });
        return;
      }

      // Converter formato do backend para formato do Excel
      const excelData = exportData.map(row => ({
        matricula: row.matricula,
        nome: row.nome,
        codigo_evento: row.codigo_evento,
        descricao_evento: row.descricao_evento,
        valor: row.valor,
        periodo: row.periodo,
      }));

      exportToExcel(excelData, log.periodo);

      // Log the export
      if (user) {
        await exportService.createRecord(
          period.id,
          `RemuneracaoEstrategica_${log.periodo.replace('/', '')}.xlsx`,
          exportData.length,
          log.id
        );
      }

      toast({
        title: 'Exportação concluída',
        description: `Arquivo Excel gerado com ${exportData.length} registros.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na exportação',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (log: ClosingLog) => {
    setFechamentoToDelete(log);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!fechamentoToDelete) return;

    setIsDeleting(true);
    try {
      await fechamentoService.delete(fechamentoToDelete.id);
      toast({
        title: 'Fechamento excluído',
        description: `Fechamento do período ${fechamentoToDelete.periodo} foi excluído com sucesso.`,
      });
      setDeleteDialogOpen(false);
      setFechamentoToDelete(null);
      if (filterPeriod) {
        fetchDataForPeriod(filterPeriod);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Fechamento Mensal"
        description="Processe o fechamento e exporte dados para a Folha de Pagamento"
      >
        {hasRole('RH') && (
          <Button onClick={() => setIsDialogOpen(true)} disabled={!canProcess}>
            <Play className="mr-2 h-4 w-4" />
            Processar Fechamento
          </Button>
        )}
      </PageHeader>

      {/* Period Filter */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.periodo} {period.status === 'aberto' ? '(Aberto)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Período Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{viewingPeriod?.periodo || 'N/A'}</p>
            <span className={`status-badge ${viewingPeriod?.status === 'aberto' ? 'status-valid' : 'status-draft'}`}>
              {viewingPeriod?.status === 'aberto' ? 'Aberto' : 'Fechado'}
            </span>
          </CardContent>
        </Card>

        <Card className={pendingValidation > 0 ? 'bg-warning/5 border-warning/20' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className={`h-4 w-4 ${pendingValidation > 0 ? 'text-warning' : ''}`} />
              Pendentes de Validação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${pendingValidation > 0 ? 'text-warning' : 'text-success'}`}>
              {pendingValidation}
            </p>
            {pendingValidation > 0 ? (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>{pendingEnviado} aguardando análise</p>
                <p>{pendingEmAnalise} em análise</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Pronto para processar</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Total de Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLancamentos}</p>
            <p className="text-xs text-muted-foreground">no período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Último Fechamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {closingLogs[0]?.periodo || 'Nenhum'}
            </p>
            <p className="text-xs text-muted-foreground">
              {closingLogs[0] ? formatDate(closingLogs[0].dataProcessamento) : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert if pending */}
      {pendingValidation > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção!</AlertTitle>
          <AlertDescription>
            Existem {pendingValidation} lançamentos pendentes de validação.
            O fechamento só pode ser processado após a validação de todas as despesas.
          </AlertDescription>
        </Alert>
      )}

      {/* Closing History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Histórico de Fechamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={closingLogs}
            columns={columns}
            emptyMessage="Nenhum fechamento realizado"
            className="border-0 rounded-none"
          />
        </CardContent>
      </Card>

      {/* Processing Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>Processar Fechamento</DialogTitle>
            <DialogDescription>
              {isProcessing
                ? 'Aguarde enquanto o fechamento é processado...'
                : 'Confirme o período para processar o fechamento mensal'}
            </DialogDescription>
          </DialogHeader>

          {isProcessing ? (
            <div className="py-6 space-y-4">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">Processando...</p>
                <Progress value={processingProgress} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">
                  {processingProgress}% concluído
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Período a Processar</label>
                <Select
                  value={selectedPeriod}
                  onValueChange={setSelectedPeriod}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periods
                      .filter((p) => p.status === 'aberto')
                      .map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.periodo}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Após o processamento, o período será marcado como "Fechado" e não
                  será possível fazer alterações nos lançamentos.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            {!isProcessing && (
              <>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleProcess} disabled={!selectedPeriod}>
                  <Play className="mr-2 h-4 w-4" />
                  Processar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Excluir Fechamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o fechamento do período{' '}
              <strong>{fechamentoToDelete?.periodo}</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita. Todos os dados relacionados a este fechamento serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Fechamento;
