import { useState, useEffect } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  CartesianGrid, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ExportMetrics {
  totalExports: number;
  totalRecords: number;
  totalValue: number;
  lastExportDate: Date | null;
}

interface PendingClosing {
  id: string;
  periodo: string;
  status: string;
  totalColaboradores: number;
  totalEventos: number;
  valorTotal: number;
  dataPeriodo: string;
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
  const [metrics, setMetrics] = useState<ExportMetrics>({
    totalExports: 0,
    totalRecords: 0,
    totalValue: 0,
    lastExportDate: null,
  });
  const [pendingClosings, setPendingClosings] = useState<PendingClosing[]>([]);
  const [recentExports, setRecentExports] = useState<Export[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [departmentValues, setDepartmentValues] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch exports
    const { data: exports } = await supabase
      .from('exportacoes')
      .select('*, calendario_periodos(periodo)')
      .order('data_exportacao', { ascending: false });

    if (exports) {
      setRecentExports(exports.slice(0, 10).map(e => ({
        id: e.id,
        nome_arquivo: e.nome_arquivo,
        data_exportacao: e.data_exportacao,
        qtd_registros: e.qtd_registros,
        periodo: e.calendario_periodos?.periodo || 'N/A',
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

    // Fetch fechamentos for pending closings and value calculation
    const { data: fechamentos } = await supabase
      .from('fechamentos')
      .select('*, calendario_periodos(periodo, data_inicio)')
      .order('data_processamento', { ascending: false });

    if (fechamentos) {
      const totalValue = fechamentos.reduce((acc, f) => acc + Number(f.valor_total), 0);
      setMetrics(prev => ({ ...prev, totalValue }));

      // Group by month for chart
      const monthlyMap: Record<string, { month: string; valor: number; eventos: number }> = {};
      fechamentos.forEach(f => {
        const date = new Date(f.data_processamento);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { month: monthLabel, valor: 0, eventos: 0 };
        }
        monthlyMap[monthKey].valor += Number(f.valor_total);
        monthlyMap[monthKey].eventos += f.total_eventos;
      });

      setMonthlyData(Object.values(monthlyMap).slice(-6));
    }

    // Fetch pending periods (open periods without fechamento)
    const { data: periodos } = await supabase
      .from('calendario_periodos')
      .select('*')
      .eq('status', 'aberto')
      .order('data_inicio', { ascending: false });

    if (periodos) {
      // Check which have fechamentos
      const pendingList: PendingClosing[] = [];
      
      for (const periodo of periodos) {
        const { data: fechamento } = await supabase
          .from('fechamentos')
          .select('*')
          .eq('periodo_id', periodo.id)
          .maybeSingle();

        // Count pending expenses for this period
        const { count: pendingCount } = await supabase
          .from('lancamentos')
          .select('*', { count: 'exact', head: true })
          .eq('periodo_id', periodo.id)
          .in('status', ['enviado', 'em_analise']);

        // Get approved expenses value
        const { data: approvedExpenses } = await supabase
          .from('lancamentos')
          .select('valor_considerado')
          .eq('periodo_id', periodo.id)
          .eq('status', 'valido');

        const totalApprovedValue = approvedExpenses?.reduce((acc, e) => acc + Number(e.valor_considerado), 0) || 0;

        if (!fechamento || fechamento.status !== 'sucesso') {
          pendingList.push({
            id: periodo.id,
            periodo: periodo.periodo,
            status: pendingCount && pendingCount > 0 ? 'pendente_validacao' : 'pronto',
            totalColaboradores: 0,
            totalEventos: approvedExpenses?.length || 0,
            valorTotal: totalApprovedValue,
            dataPeriodo: periodo.data_inicio,
          });
        }
      }

      setPendingClosings(pendingList);
    }

    // Fetch department values
    const { data: lancamentos } = await supabase
      .from('lancamentos')
      .select('valor_considerado, colaboradores_elegiveis(departamento)')
      .eq('status', 'valido');

    if (lancamentos) {
      const deptMap: Record<string, number> = {};
      lancamentos.forEach((l: any) => {
        const dept = l.colaboradores_elegiveis?.departamento || 'Outros';
        deptMap[dept] = (deptMap[dept] || 0) + Number(l.valor_considerado);
      });

      const deptData = Object.entries(deptMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      setDepartmentValues(deptData);
    }

    setLoading(false);
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
          {item.status === 'pronto' ? 'Pronto para Fechar' : 'Pendente Validação'}
        </Badge>
      ),
    },
    {
      key: 'totalEventos',
      header: 'Eventos',
      className: 'text-right',
    },
    {
      key: 'valorTotal',
      header: 'Valor Total',
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
          <span className="text-sm font-mono truncate max-w-48">{item.nome_arquivo}</span>
        </div>
      )
    },
    { key: 'periodo', header: 'Período' },
    { 
      key: 'qtd_registros', 
      header: 'Registros',
      className: 'text-right',
    },
    {
      key: 'data_exportacao',
      header: 'Data',
      render: (item: Export) => formatDate(new Date(item.data_exportacao)),
    },
  ];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

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
        title="Dashboard Financeiro"
        description="Métricas de exportação e fechamentos para integração com folha de pagamento"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Total Exportações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.totalExports}</p>
            <p className="text-xs text-muted-foreground">{metrics.totalRecords} registros processados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />
              Valor Total Processado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{formatCurrency(metrics.totalValue)}</p>
            <p className="text-xs text-muted-foreground">Em todos os fechamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Fechamentos Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{pendingClosings.length}</p>
            <p className="text-xs text-muted-foreground">
              {pendingClosings.filter(p => p.status === 'pronto').length} prontos para processar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Última Exportação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {metrics.lastExportDate ? formatDate(metrics.lastExportDate) : 'Nenhuma'}
            </p>
            <p className="text-xs text-muted-foreground">Data da última exportação</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Monthly Values */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Valores Mensais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">Nenhum dado disponível</p>
              </div>
            ) : (
              <ChartContainer 
                config={{ valor: { label: 'Valor', color: 'hsl(var(--primary))' } }} 
                className="h-64"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis 
                      className="text-xs" 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Distribuição por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {departmentValues.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">Nenhum dado disponível</p>
              </div>
            ) : (
              <ChartContainer config={{}} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentValues}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name.substring(0, 10)}... ${(percent * 100).toFixed(0)}%`}
                    >
                      {departmentValues.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Closings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Fechamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingClosings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-success opacity-50" />
              <p>Todos os períodos foram fechados!</p>
            </div>
          ) : (
            <DataTable 
              data={pendingClosings} 
              columns={pendingColumns} 
              emptyMessage="Nenhum fechamento pendente" 
            />
          )}
        </CardContent>
      </Card>

      {/* Recent Exports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exportações Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentExports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma exportação realizada ainda</p>
            </div>
          ) : (
            <DataTable 
              data={recentExports} 
              columns={exportColumns} 
              emptyMessage="Nenhuma exportação encontrada" 
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardFinanceiro;
