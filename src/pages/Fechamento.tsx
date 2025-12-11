import { useState } from 'react';
import { Play, Download, FileSpreadsheet, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { mockCalendarPeriods, mockExpenses, formatCurrency, formatDate } from '@/lib/mock-data';

interface ClosingLog {
  id: string;
  periodo: string;
  dataProcessamento: Date;
  usuario: string;
  totalColaboradores: number;
  totalEventos: number;
  valorTotal: number;
  status: 'sucesso' | 'erro';
}

const mockClosingLogs: ClosingLog[] = [
  {
    id: '1',
    periodo: '11/2025',
    dataProcessamento: new Date('2025-11-21T10:30:00'),
    usuario: 'Rita Couto',
    totalColaboradores: 4,
    totalEventos: 18,
    valorTotal: 28750,
    status: 'sucesso',
  },
];

const Fechamento = () => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [closingLogs, setClosingLogs] = useState<ClosingLog[]>(mockClosingLogs);

  const currentPeriod = mockCalendarPeriods.find((p) => p.status === 'aberto');
  const pendingValidation = mockExpenses.filter(
    (e) => e.status === 'enviado' || e.status === 'em_analise'
  ).length;

  const canProcess = pendingValidation === 0;

  const columns = [
    { key: 'periodo', header: 'Período', className: 'font-medium' },
    {
      key: 'dataProcessamento',
      header: 'Data Processamento',
      render: (item: ClosingLog) =>
        formatDate(item.dataProcessamento) +
        ' ' +
        item.dataProcessamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
    { key: 'usuario', header: 'Usuário' },
    { key: 'totalColaboradores', header: 'Colaboradores', className: 'text-center' },
    { key: 'totalEventos', header: 'Eventos', className: 'text-center' },
    {
      key: 'valorTotal',
      header: 'Valor Total',
      className: 'text-right font-mono',
      render: (item: ClosingLog) => formatCurrency(item.valorTotal),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ClosingLog) => (
        <span
          className={`status-badge ${
            item.status === 'sucesso' ? 'status-valid' : 'status-invalid'
          }`}
        >
          {item.status === 'sucesso' ? 'Sucesso' : 'Erro'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right',
      render: (item: ClosingLog) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport(item)}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      ),
    },
  ];

  const handleProcess = async () => {
    setIsProcessing(true);
    setProcessingProgress(0);

    // Simulate processing
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setProcessingProgress(i);
    }

    const newLog: ClosingLog = {
      id: String(closingLogs.length + 1),
      periodo: currentPeriod?.periodo || '12/2025',
      dataProcessamento: new Date(),
      usuario: 'Rita Couto',
      totalColaboradores: 4,
      totalEventos: 12,
      valorTotal: 35000,
      status: 'sucesso',
    };

    setClosingLogs([newLog, ...closingLogs]);
    setIsProcessing(false);
    setIsDialogOpen(false);

    toast({
      title: 'Fechamento concluído',
      description: `Período ${newLog.periodo} processado com sucesso. ${newLog.totalEventos} eventos gerados.`,
    });
  };

  const handleExport = (log: ClosingLog) => {
    toast({
      title: 'Exportação iniciada',
      description: `Arquivo RemuneracaoEstrategica_${log.periodo.replace('/', '')}_${formatDate(new Date()).replace(/\//g, '')}.xlsx será baixado.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Fechamento Mensal"
        description="Processe o fechamento e exporte dados para a Folha de Pagamento"
      >
        <Button onClick={() => setIsDialogOpen(true)} disabled={!canProcess}>
          <Play className="mr-2 h-4 w-4" />
          Processar Fechamento
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Período Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentPeriod?.periodo || 'N/A'}</p>
            <StatusBadge status={currentPeriod?.status || 'aberto'} />
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
            <p className="text-xs text-muted-foreground">
              {pendingValidation > 0 ? 'Valide antes do fechamento' : 'Pronto para processar'}
            </p>
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
            <p className="text-2xl font-bold">{mockExpenses.length}</p>
            <p className="text-xs text-muted-foreground">no período atual</p>
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
        <DialogContent>
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
                  value={selectedPeriod || currentPeriod?.id || ''}
                  onValueChange={setSelectedPeriod}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCalendarPeriods
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
                <Button onClick={handleProcess}>
                  <Play className="mr-2 h-4 w-4" />
                  Processar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Fechamento;
