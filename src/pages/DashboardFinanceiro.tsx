import { useState, useEffect } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  DollarSign,
  Clock,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { findCurrentPeriod } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import periodosService from '@/services/periodos.service';
import fechamentoService from '@/services/fechamento.service';
import lancamentosService from '@/services/lancamentos.service';
import colaboradoresService from '@/services/colaboradores.service';
import exportService from '@/services/export.service';

interface Period {
  id: string;
  periodo: string;
  status: string;
  data_inicio: string;
  data_final: string;
}

interface ExportMetrics {
  totalExports: number;
  totalRecords: number;
  totalValue: number;
  lastExportDate: Date | null;
  pendingClosings: number;
  readyToExport: number;
}

interface PendingClosing {
  id: string;
  periodo: string;
  status: string;
  totalEventos: number;
  valorTotal: number;
}

interface Export {
  id: string;
  nome_arquivo: string;
  data_exportacao: string;
  qtd_registros: number;
  periodo: string;
}

const DashboardFinanceiro = () => {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [currentPeriodName, setCurrentPeriodName] = useState<string>('');
  const [metrics, setMetrics] = useState<ExportMetrics>({
    totalExports: 0,
    totalRecords: 0,
    totalValue: 0,
    lastExportDate: null,
    pendingClosings: 0,
    readyToExport: 0,
  });
  const [pendingClosings, setPendingClosings] = useState<PendingClosing[]>([]);
  const [recentExports, setRecentExports] = useState<Export[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; value: number }[]>([]);
  const [departmentValues, setDepartmentValues] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const allPeriods = await periodosService.getAll();

        if (allPeriods && allPeriods.length > 0) {
          setPeriods(allPeriods);
          
          const currentPeriod = findCurrentPeriod(allPeriods);
          if (currentPeriod) {
            setSelectedPeriodId(currentPeriod.id);
            setCurrentPeriodName(currentPeriod.periodo);
          }
        }
      } catch (error) {
        console.error('Error fetching periods:', error);
      }
    };
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) return;
    fetchData();
  }, [selectedPeriodId]);

  const fetchData = async () => {
    setLoading(true);

    try {
      if (selectedPeriodId === 'todos') {
        setCurrentPeriodName('Todos os Períodos');
      } else {
        const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
        if (selectedPeriod) {
          setCurrentPeriodName(selectedPeriod.periodo);
        }
      }

      // Fetch exports
      const exports = await exportService.getAll(selectedPeriodId !== 'todos' ? selectedPeriodId : undefined);

      if (exports) {
        setRecentExports(exports.slice(0, 10).map(e => ({
          id: e.id,
          nome_arquivo: e.nome_arquivo,
          data_exportacao: e.data_exportacao,
          qtd_registros: e.qtd_registros,
          periodo: e.periodo_nome || 'N/A',
        })));

        const totalRecords = exports.reduce((acc, e) => acc + e.qtd_registros, 0);
        const lastExport = exports[0]?.data_exportacao ? new Date(exports[0].data_exportacao) : null;

        setMetrics(prev => ({
          ...prev,
          totalExports: exports.length,
          totalRecords,
          lastExportDate: lastExport,
        }));
      }

      // Fetch fechamentos for value calculation
      const fechamentos = await fechamentoService.getAll(selectedPeriodId !== 'todos' ? selectedPeriodId : undefined);

      if (fechamentos) {
        const totalValue = fechamentos.reduce((acc, f) => acc + Number(f.valor_total), 0);
        setMetrics(prev => ({ ...prev, totalValue }));

        const monthlyMap: Record<string, number> = {};
        fechamentos.forEach(f => {
          const date = new Date(f.data_processamento);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = 0;
          }
          monthlyMap[monthKey] += Number(f.valor_total);
        });

        const sortedMonths = Object.entries(monthlyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6)
          .map(([key, value]) => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return {
              month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
              value,
            };
          });

        setMonthlyData(sortedMonths);
      }

      // Fetch pending periods
      const openPeriods = periods.filter(p => p.status === 'aberto');

      if (openPeriods) {
        const pendingList: PendingClosing[] = [];
        let readyCount = 0;
        
        for (const periodo of openPeriods) {
          const fechamentos = await fechamentoService.getAll(periodo.id);
          const fechamento = fechamentos[0];

          const lancamentos = await lancamentosService.getAll({ periodo_id: periodo.id });
          const pendingCount = lancamentos.filter(l => ['enviado', 'em_analise'].includes(l.status)).length;
          const approvedExpenses = lancamentos.filter(l => l.status === 'valido');

          const totalApprovedValue = approvedExpenses.reduce((acc, e) => acc + Number(e.valor_considerado), 0);
          const isReady = pendingCount === 0;

          if (!fechamento || fechamento.status !== 'sucesso') {
            if (isReady) readyCount++;
            pendingList.push({
              id: periodo.id,
              periodo: periodo.periodo,
              status: isReady ? 'pronto' : 'pendente_validacao',
              totalEventos: approvedExpenses.length,
              valorTotal: totalApprovedValue,
            });
          }
        }

        setPendingClosings(pendingList);
        setMetrics(prev => ({ 
          ...prev, 
          pendingClosings: pendingList.length,
          readyToExport: readyCount,
        }));
      }

      // Fetch department values
      const lancamentos = await lancamentosService.getAll({
        periodo_id: selectedPeriodId !== 'todos' ? selectedPeriodId : undefined,
        status: 'valido',
      });
      const colaboradores = await colaboradoresService.getAll();

      if (lancamentos) {
        const deptMap: Record<string, number> = {};
        lancamentos.forEach((l: any) => {
          const colab = colaboradores.find(c => c.id === l.colaborador_id);
          const dept = colab?.departamento || 'Outros';
          deptMap[dept] = (deptMap[dept] || 0) + Number(l.valor_considerado);
        });

        const deptData = Object.entries(deptMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setDepartmentValues(deptData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingColumns = [
    { 
      key: 'periodo', 
      header: 'Período',
      render: (item: PendingClosing) => (
        <span className="font-medium">{item.periodo}</span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: PendingClosing) => (
        <Badge variant={item.status === 'pronto' ? 'default' : 'secondary'}>
          {item.status === 'pronto' ? 'Pronto' : 'Pendente'}
        </Badge>
      ),
    },
    {
      key: 'totalEventos',
      header: 'Eventos',
      className: 'text-right',
      hideOnMobile: true,
    },
    {
      key: 'valorTotal',
      header: 'Valor',
      className: 'text-right font-mono',
      render: (item: PendingClosing) => formatCurrency(item.valorTotal),
    },
  ];

  const exportColumns = [
    { 
      key: 'nome_arquivo', 
      header: 'Arquivo',
      render: (item: Export) => (
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-success" />
          <span className="text-sm font-mono truncate max-w-[100px] sm:max-w-48">{item.nome_arquivo}</span>
        </div>
      )
    },
    { key: 'periodo', header: 'Período', hideOnMobile: true },
    { 
      key: 'qtd_registros', 
      header: 'Reg.',
      className: 'text-right',
      hideOnMobile: true,
    },
    {
      key: 'data_exportacao',
      header: 'Data',
      render: (item: Export) => formatDate(new Date(item.data_exportacao)),
    },
  ];

  const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

  if (loading && !periods.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`Período: ${currentPeriodName}`}
      >
        <div className="flex flex-row gap-4 items-end flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Períodos</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.periodo} {p.status === 'fechado' && '(Fechado)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link to="/fechamento">Ir para Fechamento</Link>
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Exportações</p>
                    <p className="text-3xl font-bold mt-1">{metrics.totalExports}</p>
                    <p className="text-xs text-muted-foreground mt-1">{metrics.totalRecords} registros processados</p>
                  </div>
                  <div className="p-2.5 bg-muted rounded-lg">
                    <Download className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-foreground/80">Valor Processado</p>
                    <p className="text-3xl font-bold mt-1">{formatCurrency(metrics.totalValue)}</p>
                    <p className="text-xs text-primary-foreground/80 mt-1">Em todos os fechamentos</p>
                  </div>
                  <div className="p-2.5 bg-primary-foreground/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fechamentos Pendentes</p>
                    <p className="text-3xl font-bold mt-1">{metrics.pendingClosings}</p>
                    <p className="text-xs text-muted-foreground mt-1">{metrics.readyToExport} prontos para processar</p>
                  </div>
                  <div className="p-2.5 bg-warning/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Última Exportação</p>
                    <p className="text-2xl font-bold mt-1">
                      {metrics.lastExportDate ? formatDate(metrics.lastExportDate) : 'Nenhuma'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Data da última exportação</p>
                  </div>
                  <div className="p-2.5 bg-white/10 rounded-lg">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Valores Processados por Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyData} margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Valor']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Valores por Departamento</CardTitle>
              </CardHeader>
              <CardContent>
                {departmentValues.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={departmentValues}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={(entry) => entry.name}
                      >
                        {departmentValues.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value), 'Valor']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fechamentos Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingClosings.length > 0 ? (
                  <DataTable data={pendingClosings} columns={pendingColumns} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Todos os períodos foram fechados
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Últimas Exportações</CardTitle>
              </CardHeader>
              <CardContent>
                {recentExports.length > 0 ? (
                  <DataTable data={recentExports} columns={exportColumns} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma exportação realizada
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardFinanceiro;
