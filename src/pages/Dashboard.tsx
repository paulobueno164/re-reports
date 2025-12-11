import { useState, useEffect } from 'react';
import { Users, Receipt, Clock, AlertTriangle, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
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
  Legend,
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
  rascunho: '#94a3b8',
  enviado: '#f59e0b',
  em_analise: '#3b82f6',
  valido: '#10b981',
  invalido: '#ef4444',
};

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch current period
      const { data: periods } = await supabase
        .from('calendario_periodos')
        .select('*')
        .eq('status', 'aberto')
        .order('periodo', { ascending: false })
        .limit(1);

      const currentPeriod = periods?.[0];
      const diasRestantes = currentPeriod
        ? Math.max(0, Math.ceil((new Date(currentPeriod.fecha_lancamento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Fetch total colaboradores
      const { count: totalColaboradores } = await supabase
        .from('colaboradores_elegiveis')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);

      // Fetch lancamentos for the current period
      let lancamentosQuery = supabase
        .from('lancamentos')
        .select(`
          id,
          valor_lancado,
          valor_considerado,
          status,
          created_at,
          colaboradores_elegiveis (id, nome, cesta_beneficios_teto),
          tipos_despesas (id, nome, grupo)
        `)
        .order('created_at', { ascending: false });

      if (currentPeriod) {
        lancamentosQuery = lancamentosQuery.eq('periodo_id', currentPeriod.id);
      }

      const { data: lancamentos } = await lancamentosQuery;

      // Calculate totals
      const totalLancamentosMes = lancamentos?.length || 0;
      const valorTotalMes = lancamentos?.reduce((sum, l) => sum + Number(l.valor_considerado), 0) || 0;
      const pendentesValidacao = lancamentos?.filter((l) => l.status === 'enviado' || l.status === 'em_analise').length || 0;

      // Recent expenses
      const recentExpenses: Expense[] = (lancamentos || []).slice(0, 5).map((l: any) => ({
        id: l.id,
        colaboradorNome: l.colaboradores_elegiveis?.nome || '',
        tipoDespesaNome: l.tipos_despesas?.nome || '',
        valorLancado: Number(l.valor_lancado),
        status: l.status,
        createdAt: new Date(l.created_at),
      }));

      // Expenses by category (group)
      const categoryMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        const grupo = l.tipos_despesas?.grupo || 'Outros';
        categoryMap.set(grupo, (categoryMap.get(grupo) || 0) + Number(l.valor_considerado));
      });
      const expensesByCategory = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // Expenses by status
      const statusMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        statusMap.set(l.status, (statusMap.get(l.status) || 0) + 1);
      });
      const statusLabels: Record<string, string> = {
        rascunho: 'Rascunho',
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
      lancamentos?.forEach((l: any) => {
        const nome = l.colaboradores_elegiveis?.nome || 'Desconhecido';
        colaboradorMap.set(nome, (colaboradorMap.get(nome) || 0) + Number(l.valor_considerado));
      });
      const topColaboradores = Array.from(colaboradorMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Utilization calculation
      const { data: colaboradores } = await supabase
        .from('colaboradores_elegiveis')
        .select('id, cesta_beneficios_teto')
        .eq('ativo', true);

      const totalCestaTeto = colaboradores?.reduce((sum, c) => sum + Number(c.cesta_beneficios_teto), 0) || 0;
      const totalUtilizado = lancamentos?.filter((l) => l.status === 'valido').reduce((sum, l) => sum + Number(l.valor_considerado), 0) || 0;
      const utilizationData = {
        used: totalUtilizado,
        available: Math.max(0, totalCestaTeto - totalUtilizado),
        total: totalCestaTeto,
        percentage: totalCestaTeto > 0 ? Math.round((totalUtilizado / totalCestaTeto) * 100) : 0,
      };

      // Expenses by month (last 6 months)
      const { data: allLancamentos } = await supabase
        .from('lancamentos')
        .select('valor_considerado, created_at')
        .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

      const monthMap = new Map<string, number>();
      allLancamentos?.forEach((l: any) => {
        const date = new Date(l.created_at);
        const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + Number(l.valor_considerado));
      });
      const expensesByMonth = Array.from(monthMap.entries())
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => {
          const [am, ay] = a.month.split('/').map(Number);
          const [bm, by] = b.month.split('/').map(Number);
          return ay === by ? am - bm : ay - by;
        });

      setData({
        totalColaboradores: totalColaboradores || 0,
        totalLancamentosMes,
        valorTotalMes,
        pendentesValidacao,
        periodoAtual: currentPeriod?.periodo || null,
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
    { key: 'tipoDespesaNome', header: 'Tipo de Despesa' },
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
      <PageHeader title="Dashboard" description={`Período atual: ${data.periodoAtual || 'N/A'}`}>
        <Button asChild>
          <Link to="/lancamentos">Novo Lançamento</Link>
        </Button>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Colaboradores Elegíveis"
          value={data.totalColaboradores}
          description="Cadastrados no sistema"
          icon={Users}
        />
        <StatCard
          title="Lançamentos no Mês"
          value={data.totalLancamentosMes}
          description={formatCurrency(data.valorTotalMes)}
          icon={Receipt}
          variant="primary"
        />
        <StatCard
          title="Pendentes de Validação"
          value={data.pendentesValidacao}
          description="Aguardando análise do RH"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Dias Restantes"
          value={data.diasRestantes}
          description="Para fechamento do período"
          icon={Clock}
          variant="accent"
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
                <BarChart data={data.expensesByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
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
                  <LineChart data={data.expensesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
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
