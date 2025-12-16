import { useState, useEffect } from 'react';
import { Play, Download, FileSpreadsheet, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { exportToExcel } from '@/lib/excel-export';
import { formatCurrency, formatDate } from '@/lib/expense-validation';

interface CalendarPeriod {
  id: string;
  periodo: string;
  status: string;
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
  const [closingLogs, setClosingLogs] = useState<ClosingLog[]>([]);
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [pendingEnviado, setPendingEnviado] = useState(0);
  const [pendingEmAnalise, setPendingEmAnalise] = useState(0);
  const [totalLancamentos, setTotalLancamentos] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentPeriod = periods.find((p) => p.status === 'aberto');
  const pendingValidation = pendingEnviado + pendingEmAnalise;
  const canProcess = pendingValidation === 0 && hasRole('RH');
  const canExport = hasRole('FINANCEIRO');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch periods
    const { data: periodsData } = await supabase
      .from('calendario_periodos')
      .select('id, periodo, status')
      .order('periodo', { ascending: false });
    
    if (periodsData) {
      setPeriods(periodsData);
      const openPeriod = periodsData.find(p => p.status === 'aberto');
      if (openPeriod) {
        setSelectedPeriod(openPeriod.id);
      }
    }

    // Fetch pending validation count - separate by status
    const { count: enviadoCount } = await supabase
      .from('lancamentos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'enviado');
    
    const { count: emAnaliseCount } = await supabase
      .from('lancamentos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'em_analise');
    
    setPendingEnviado(enviadoCount || 0);
    setPendingEmAnalise(emAnaliseCount || 0);

    // Fetch total lancamentos
    const { count: totalCount } = await supabase
      .from('lancamentos')
      .select('*', { count: 'exact', head: true });
    
    setTotalLancamentos(totalCount || 0);

    // Fetch closing logs
    const { data: fechamentos } = await supabase
      .from('fechamentos')
      .select(`
        id,
        data_processamento,
        total_colaboradores,
        total_eventos,
        valor_total,
        status,
        calendario_periodos (periodo),
        profiles:usuario_id (nome)
      `)
      .order('data_processamento', { ascending: false });
    
    if (fechamentos) {
      setClosingLogs(fechamentos.map((f: any) => ({
        id: f.id,
        periodo: f.calendario_periodos?.periodo || '',
        dataProcessamento: new Date(f.data_processamento),
        usuario: f.profiles?.nome || 'Sistema',
        totalColaboradores: f.total_colaboradores,
        totalEventos: f.total_eventos,
        valorTotal: Number(f.valor_total),
        status: f.status,
      })));
    }

    setLoading(false);
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
      key: 'status',
      header: 'Status',
      render: (item: ClosingLog) => (
        <span
          className={`status-badge ${
            item.status === 'sucesso' ? 'status-valid' : 'status-invalid'
          }`}
        >
          {item.status === 'sucesso' ? 'OK' : 'Erro'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item: ClosingLog) => (
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
      ),
    },
  ];

  const handleProcess = async () => {
    if (!selectedPeriod || !user) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Get all valid expenses for the period
      const { data: lancamentos, error: lancError } = await supabase
        .from('lancamentos')
        .select(`
          id,
          valor_considerado,
          colaborador_id,
          colaboradores_elegiveis (id, matricula, nome, departamento, cesta_beneficios_teto, tem_pida, pida_teto),
          tipos_despesas (id, nome),
          tipos_despesas_eventos:tipos_despesas!inner (
            tipos_despesas_eventos (codigo_evento, descricao_evento)
          )
        `)
        .eq('periodo_id', selectedPeriod)
        .eq('status', 'valido');

      if (lancError) throw lancError;

      setProcessingProgress(30);

      // Calculate totals per colaborador for PI/DA conversion
      const colaboradorTotals = new Map<string, { 
        total: number; 
        teto: number; 
        temPida: boolean; 
        pidaTeto: number;
        nome: string;
        matricula: string;
      }>();
      
      lancamentos?.forEach((l: any) => {
        const colabId = l.colaborador_id;
        const current = colaboradorTotals.get(colabId) || { 
          total: 0, 
          teto: Number(l.colaboradores_elegiveis?.cesta_beneficios_teto || 0),
          temPida: l.colaboradores_elegiveis?.tem_pida || false,
          pidaTeto: Number(l.colaboradores_elegiveis?.pida_teto || 0),
          nome: l.colaboradores_elegiveis?.nome || '',
          matricula: l.colaboradores_elegiveis?.matricula || '',
        };
        current.total += Number(l.valor_considerado);
        colaboradorTotals.set(colabId, current);
      });

      setProcessingProgress(50);

      // Calculate PI/DA conversions (difference between teto and used)
      let totalPidaConvertido = 0;
      const pidaConversions: { 
        colaboradorId: string; 
        valorDiferenca: number; 
        valorBasePida: number;
        nome: string 
      }[] = [];
      
      colaboradorTotals.forEach((data, colabId) => {
        const diferenca = Math.max(0, data.teto - data.total);
        const basePida = data.temPida ? data.pidaTeto : 0;
        const totalPida = diferenca + basePida;
        
        if (totalPida > 0) {
          totalPidaConvertido += totalPida;
          pidaConversions.push({ 
            colaboradorId: colabId, 
            valorDiferenca: diferenca,
            valorBasePida: basePida,
            nome: data.nome 
          });
        }
      });

      setProcessingProgress(70);

      // Calculate totals
      const totalColaboradores = colaboradorTotals.size;
      const totalEventos = (lancamentos?.length || 0) + pidaConversions.length;
      const valorTotal = (lancamentos?.reduce((sum: number, l: any) => sum + Number(l.valor_considerado), 0) || 0) + totalPidaConvertido;

      // Create closing record
      const { data: fechamentoData, error: fechError } = await supabase
        .from('fechamentos')
        .insert({
          periodo_id: selectedPeriod,
          usuario_id: user.id,
          total_colaboradores: totalColaboradores,
          total_eventos: totalEventos,
          valor_total: valorTotal,
          status: 'sucesso',
        })
        .select('id')
        .single();

      if (fechError) throw fechError;

      // Insert PI/DA events into eventos_pida table
      if (pidaConversions.length > 0 && fechamentoData) {
        const pidaInserts = pidaConversions.map(pida => ({
          fechamento_id: fechamentoData.id,
          colaborador_id: pida.colaboradorId,
          periodo_id: selectedPeriod,
          valor_base_pida: pida.valorBasePida,
          valor_diferenca_cesta: pida.valorDiferenca,
          valor_total_pida: pida.valorBasePida + pida.valorDiferenca,
        }));

        const { error: pidaError } = await supabase
          .from('eventos_pida')
          .insert(pidaInserts);

        if (pidaError) {
          console.error('Erro ao inserir eventos PI/DA:', pidaError);
          // Log but don't fail the entire process
        }
      }

      setProcessingProgress(90);

      // Update period status to closed
      await supabase
        .from('calendario_periodos')
        .update({ status: 'fechado' })
        .eq('id', selectedPeriod);

      setProcessingProgress(100);

      const pidaMsg = pidaConversions.length > 0 
        ? ` ${pidaConversions.length} evento(s) PI/DA gerado(s) (${formatCurrency(totalPidaConvertido)}).`
        : '';

      toast({
        title: 'Fechamento concluído',
        description: `${lancamentos?.length || 0} lançamentos + ${pidaConversions.length} PI/DA para ${totalColaboradores} colaboradores.${pidaMsg}`,
      });

      setIsDialogOpen(false);
      fetchData();
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
      // Fetch data for export
      const period = periods.find(p => p.periodo === log.periodo);
      if (!period) return;

      // Fetch lancamentos
      const { data: lancamentos } = await supabase
        .from('lancamentos')
        .select(`
          valor_considerado,
          colaboradores_elegiveis (matricula, nome, departamento),
          tipos_despesas!inner (
            tipos_despesas_eventos (codigo_evento, descricao_evento)
          )
        `)
        .eq('periodo_id', period.id)
        .eq('status', 'valido');

      // Fetch eventos PI/DA for this closing
      const { data: eventosPida } = await supabase
        .from('eventos_pida')
        .select(`
          valor_total_pida,
          valor_base_pida,
          valor_diferenca_cesta,
          colaboradores_elegiveis (matricula, nome, departamento)
        `)
        .eq('fechamento_id', log.id);

      if ((!lancamentos || lancamentos.length === 0) && (!eventosPida || eventosPida.length === 0)) {
        toast({
          title: 'Sem dados',
          description: 'Não há lançamentos ou eventos PI/DA para exportar.',
          variant: 'destructive',
        });
        return;
      }

      // Map regular expenses
      const exportData = (lancamentos || []).map((l: any) => ({
        matricula: l.colaboradores_elegiveis?.matricula || '',
        nome: l.colaboradores_elegiveis?.nome || '',
        departamento: l.colaboradores_elegiveis?.departamento || '',
        codigoEvento: l.tipos_despesas?.tipos_despesas_eventos?.[0]?.codigo_evento || '',
        descricaoEvento: l.tipos_despesas?.tipos_despesas_eventos?.[0]?.descricao_evento || '',
        valor: Number(l.valor_considerado),
        periodo: log.periodo,
      }));

      // Add PI/DA events
      const pidaExportData = (eventosPida || []).map((e: any) => ({
        matricula: e.colaboradores_elegiveis?.matricula || '',
        nome: e.colaboradores_elegiveis?.nome || '',
        departamento: e.colaboradores_elegiveis?.departamento || '',
        codigoEvento: 'PIDA',
        descricaoEvento: 'PI/DA - Propriedade Intelectual / Direitos Autorais',
        valor: Number(e.valor_total_pida),
        periodo: log.periodo,
      }));

      const allExportData = [...exportData, ...pidaExportData];

      exportToExcel(allExportData, log.periodo);

      // Log the export
      if (user) {
        await supabase
          .from('exportacoes')
          .insert({
            periodo_id: period.id,
            fechamento_id: log.id,
            usuario_id: user.id,
            nome_arquivo: `RemuneracaoEstrategica_${log.periodo.replace('/', '')}.xlsx`,
            qtd_registros: allExportData.length,
          });
      }

      toast({
        title: 'Exportação concluída',
        description: `Arquivo Excel gerado com ${allExportData.length} registros (${exportData.length} despesas + ${pidaExportData.length} PI/DA).`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na exportação',
        description: error.message,
        variant: 'destructive',
      });
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Período Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentPeriod?.periodo || 'N/A'}</p>
            <span className={`status-badge ${currentPeriod?.status === 'aberto' ? 'status-valid' : 'status-draft'}`}>
              {currentPeriod?.status === 'aberto' ? 'Aberto' : 'Fechado'}
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
    </div>
  );
};

export default Fechamento;
