import { useState, useEffect } from 'react';
import { Users, Receipt, Clock, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { periodosService, CalendarioPeriodo } from '@/services/periodos.service';
import { colaboradoresService } from '@/services/colaboradores.service';
import { lancamentosService } from '@/services/lancamentos.service';
import { findCurrentPeriod } from '@/lib/utils';
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
  LineChart,
  Line,
} from 'recharts';

interface Expense {
  id: string;
  colaboradorNome: string;
  tipoDespesaNome: string;
  valorLancado: number;
  status: string;
  createdAt: Date;
}

interface DashboardData {
  totalColaboradores: number;
  totalLancamentosMes: number;
  valorTotalMes: number;
  pendentesValidacao: number;
  periodoAtual: string | null;
  diasRestantes: number;
  recentExpenses: Expense[];
  expensesByCategory: { name: string; value: number }[];
  expensesByStatus: { name: string; value: number; color: string }[];
  expensesByMonth: { month: string; value: number }[];
  topColaboradores: { name: string; value: number }[];
  utilizationData: { used: number; available: number; total: number; percentage: number };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS: Record<string, string> = {
  enviado: '#f59e0b',
  em_analise: '#3b82f6',
  valido: '#10b981',
  invalido: '#ef4444',
};

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<CalendarioPeriodo[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('todos');
  const [data, setData] = useState<DashboardData>({
    totalColaboradores: 0,
    totalLancamentosMes: 0,
    valorTotalMes: 0,
    pendentesValidacao: 0,
    periodoAtual: null,
    diasRestantes: 0,
    recentExpenses: [],
    expensesByCategory: [],
    expensesByStatus: [],
    expensesByMonth: [],
    topColaboradores: [],
    utilizationData: { used: 0, available: 0, total: 0, percentage: 0 },
  });

  // Fetch all periods and departments on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch periods
        const allPeriods = await periodosService.getAll();
        if (allPeriods && allPeriods.length > 0) {
          setPeriods(allPeriods);
          const currentPeriod = findCurrentPeriod(allPeriods);
          if (currentPeriod) {
            setSelectedPeriodId(currentPeriod.id);
          }
        }

        // Fetch departments
        const colaboradores = await colaboradoresService.getAll();
        if (colaboradores) {
          const uniqueDepts = [...new Set(colaboradores.filter(c => c.ativo).map(c => c.departamento))].sort();
          setDepartments(uniqueDepts);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchDashboardData();
    }
  }, [user, selectedPeriodId, selectedDepartment]);

  const fetchDashboardData = async () => {
    if (!user || !selectedPeriodId) return;
    setLoading(true);

    try {
      const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
      
      // Calculate days remaining
      const diasRestantes = selectedPeriod
        ? Math.max(0, Math.ceil((new Date(selectedPeriod.fecha_lancamento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Fetch colaboradores
      const allColaboradores = await colaboradoresService.getAll();
      const filteredColaboradores = selectedDepartment === 'todos' 
        ? allColaboradores.filter(c => c.ativo)
        : allColaboradores.filter(c => c.ativo && c.departamento === selectedDepartment);
      const colaboradorIds = filteredColaboradores.map(c => c.id);

      // Fetch lancamentos for the period
      const allLancamentos = await lancamentosService.getAll({ periodo_id: selectedPeriodId });
      
      // Filter by department if needed
      const lancamentos = selectedDepartment === 'todos'
        ? allLancamentos
        : allLancamentos.filter((l: any) => colaboradorIds.includes(l.colaborador_id));

      // Fetch all pending lancamentos
      const allPendingLancamentos = await lancamentosService.getAll({ status: 'enviado' });
      const allEmAnaliseLancamentos = await lancamentosService.getAll({ status: 'em_analise' });
      const pendingFiltered = [...allPendingLancamentos, ...allEmAnaliseLancamentos].filter((l: any) => 
        selectedDepartment === 'todos' || colaboradorIds.includes(l.colaborador_id)
      );

      // Calculate totals
      const totalLancamentosMes = lancamentos.length;
      const valorTotalMes = lancamentos.reduce((sum: number, l: any) => sum + Number(l.valor_considerado), 0);
      const pendentesValidacao = pendingFiltered.length;

      // Recent expenses
      const recentExpenses: Expense[] = lancamentos.slice(0, 5).map((l: any) => ({
        id: l.id,
        colaboradorNome: l.colaborador?.nome || '',
        tipoDespesaNome: l.tipo_despesa?.nome || '',
        valorLancado: Number(l.valor_lancado),
        status: l.status,
        createdAt: new Date(l.created_at),
      }));

      // Expenses by category
      const categoryMap = new Map<string, number>();
      lancamentos.forEach((l: any) => {
        const grupo = l.tipo_despesa?.grupo || 'Outros';
        categoryMap.set(grupo, (categoryMap.get(grupo) || 0) + Number(l.valor_considerado));
      });
      const expensesByCategory = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // Expenses by status
      const statusMap = new Map<string, number>();
      lancamentos.forEach((l: any) => {
        statusMap.set(l.status, (statusMap.get(l.status) || 0) + 1);
      });
      const statusLabels: Record<string, string> = {
        enviado: 'Enviado',
        em_analise: 'Em Análise',
        valido: 'Válido',
        invalido: 'Inválido',
      };
      const expensesByStatus = Array.from(statusMap.entries()).map(([status, value]) => ({
        name: statusLabels[status] || status,
        value,
        color: STATUS_COLORS[status] || '#94a3b8',
      }));

      // Top colaboradores
      const colaboradorMap = new Map<string, number>();
      lancamentos.forEach((l: any) => {
        const nome = l.colaborador?.nome || 'Desconhecido';
        colaboradorMap.set(nome, (colaboradorMap.get(nome) || 0) + Number(l.valor_considerado));
      });
      const topColaboradores = Array.from(colaboradorMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Utilization
      const totalUtilizado = lancamentos.filter((l: any) => l.status === 'valido').reduce((sum: number, l: any) => sum + Number(l.valor_considerado), 0);
      const utilizationData = {
        used: totalUtilizado,
        available: 0,
        total: totalUtilizado,
        percentage: 100,
      };

      // Expenses by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const allLancamentosRecent = await lancamentosService.getAll({});
      const monthMap = new Map<string, number>();
      allLancamentosRecent.forEach((l: any) => {
        const date = new Date(l.created_at);
        if (date >= sixMonthsAgo) {
          const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
          monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + Number(l.valor_considerado));
        }
      });
      const expensesByMonth = Array.from(monthMap.entries())
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => {
          const [am, ay] = a.month.split('/').map(Number);
          const [bm, by] = b.month.split('/').map(Number);
          return ay === by ? am - bm : ay - by;
        });

      setData({
        totalColaboradores: filteredColaboradores.length,
        totalLancamentosMes,
        valorTotalMes,
        pendentesValidacao,
        periodoAtual: selectedPeriod?.periodo || null,
        diasRestantes,
        recentExpenses,
        expensesByCategory,
        expensesByStatus,
        expensesByMonth,
        topColaboradores,
        utilizationData,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const expenseColumns = [
    { key: 'colaboradorNome', header: 'Colaborador' },
    { key: 'tipoDespesaNome', header: 'Tipo', hideOnMobile: true },
    {
      key: 'valorLancado',
      header: 'Valor',
      className: 'text-right font-mono',
      render: (item: Expense) => formatCurrency(item.valorLancado),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Expense) => <StatusBadge status={item.status} />,
    },
    {
      key: 'createdAt',
      header: 'Data',
      hideOnMobile: true,
      render: (item: Expense) => formatDate(item.createdAt),
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
      <PageHeader title="Dashboard" description={`Período: ${data.periodoAtual || 'N/A'}${selectedDepartment !== 'todos' ? ` • ${selectedDepartment}` : ''}`}>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.periodo} {p.status === 'fechado' && '(Fechado)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Departamentos</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link to="/lancamentos">Novo Lançamento</Link>
          </Button>
        </div>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Colaboradores Elegíveis"
          value={data.totalColaboradores}
          description="Cadastrados no sistema"
          icon={Users}
          href="/colaboradores"
        />
        <StatCard
          title="Lançamentos no Mês"
          value={data.totalLancamentosMes}
          description={formatCurrency(data.valorTotalMes)}
          icon={Receipt}
          variant="primary"
          href="/lancamentos"
        />
        <StatCard
          title="Pendentes de Validação"
          value={data.pendentesValidacao}
          description="Aguardando análise do RH"
          icon={AlertTriangle}
          variant="warning"
          href="/validacao"
        />
        <StatCard
          title="Dias Restantes"
          value={data.diasRestantes}
          description="Para fechamento do período"
          icon={Clock}
          variant="accent"
          href="/calendario"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {data.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.expensesByCategory} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => {
                      if (value >= 1000) {
                        return `R$ ${(value / 1000).toFixed(0)}k`;
                      }
                      return `R$ ${value.toFixed(0)}`;
                    }}
                    domain={[0, (dataMin: number, dataMax: number) => {
                      if (!isFinite(dataMax) || dataMax === 0) {
                        return 100;
                      }
                      const headroom = Math.max(dataMax * 0.2, dataMax * 0.1);
                      return Math.ceil(dataMax + headroom);
                    }]}
                  />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Valor']}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.expensesByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.expensesByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {data.expensesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Expenses and Top Colaboradores */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              {data.expensesByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.expensesByMonth} margin={{ left: 0, right: 20, top: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis 
                      tickFormatter={(value) => {
                        if (value >= 1000) {
                          return `R$ ${(value / 1000).toFixed(0)}k`;
                        }
                        return `R$ ${value.toFixed(0)}`;
                      }}
                      domain={[0, (dataMin: number, dataMax: number) => {
                        if (!isFinite(dataMax) || dataMax === 0) {
                          return 100;
                        }
                        const headroom = Math.max(dataMax * 0.2, dataMax * 0.1);
                        return Math.ceil(dataMax + headroom);
                      }]}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Valor']}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Sem dados para exibir
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Expenses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Últimos Lançamentos</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/lancamentos">Ver Todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                data={data.recentExpenses}
                columns={expenseColumns}
                className="border-0 rounded-none"
                emptyMessage="Nenhum lançamento encontrado"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-4">
          {/* Top Colaboradores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Top Colaboradores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topColaboradores.length > 0 ? (
                data.topColaboradores.map((colab, index) => (
                  <div key={colab.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}.</span>
                      <span className="text-sm truncate max-w-[120px]">{colab.name}</span>
                    </div>
                    <span className="text-sm font-mono font-medium">{formatCurrency(colab.value)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Utilization Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Utilização Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Cesta de Benefícios</span>
                  <span className="font-medium">{data.utilizationData.percentage}%</span>
                </div>
                <Progress value={data.utilizationData.percentage} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold text-foreground">{formatCurrency(data.utilizationData.used)}</p>
                  <p className="text-xs text-muted-foreground">Utilizado</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold text-foreground">{formatCurrency(data.utilizationData.available)}</p>
                  <p className="text-xs text-muted-foreground">Disponível</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/validacao">
                  <AlertTriangle className="mr-2 h-4 w-4 text-warning" />
                  Validar Despesas ({data.pendentesValidacao})
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/relatorios">
                  <Receipt className="mr-2 h-4 w-4" />
                  Gerar Extrato
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/colaboradores">
                  <Users className="mr-2 h-4 w-4" />
                  Gerenciar Colaboradores
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;