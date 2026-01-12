import { useState, useEffect } from 'react';
import { Users, Receipt, Clock, AlertTriangle, TrendingUp, Loader2, CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/expense-validation';
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
  Legend,
  LineChart,
  Line,
} from 'recharts';
import periodosService from '@/services/periodos.service';
import colaboradoresService from '@/services/colaboradores.service';
import lancamentosService from '@/services/lancamentos.service';

interface Period {
  id: string;
  periodo: string;
  status: string;
  data_inicio: string;
  data_final: string;
  fecha_lancamento: string;
}

interface DashboardData {
  totalColaboradores: number;
  totalLancamentosMes: number;
  valorTotalMes: number;
  pendentesValidacao: number;
  diasParaLancamento: number;
  diasRestantes: number;
  expensesByCategory: { name: string; value: number }[];
  expensesByStatus: { name: string; value: number; color: string }[];
  expensesByMonth: { month: string; value: number }[];
  expensesByCategoryRejected: { name: string; value: number }[];
  expensesByMonthRejected: { month: string; value: number }[];
  topColaboradores: { name: string; value: number }[];
  utilizationPercentage: number;
}

const STATUS_COLORS: Record<string, string> = {
  enviado: '#f59e0b',
  em_analise: '#3b82f6',
  valido: '#10b981',
  invalido: '#ef4444',
};

// Helper function para formatar valores dos eixos dos gráficos
const formatAxisValue = (value: number): string => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
};

const DashboardRH = () => {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('todos');
  const [currentPeriodName, setCurrentPeriodName] = useState<string>('');
  const [data, setData] = useState<DashboardData>({
    totalColaboradores: 0,
    totalLancamentosMes: 0,
    valorTotalMes: 0,
    pendentesValidacao: 0,
    diasParaLancamento: 0,
    diasRestantes: 0,
    expensesByCategory: [],
    expensesByStatus: [],
    expensesByMonth: [],
    expensesByCategoryRejected: [],
    expensesByMonthRejected: [],
    topColaboradores: [],
    utilizationPercentage: 0,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const allPeriods = await periodosService.getAll();

        if (allPeriods && allPeriods.length > 0) {
          setPeriods(allPeriods);
          
          const currentPeriod = findCurrentPeriod(allPeriods);
          if (currentPeriod) {
            setSelectedPeriodId(currentPeriod.id);
            setCurrentPeriodName(currentPeriod.periodo);
          } else if (allPeriods.length > 0) {
            // Se não há período atual, seleciona o primeiro disponível
            setSelectedPeriodId(allPeriods[0].id);
            setCurrentPeriodName(allPeriods[0].periodo);
          }
        } else {
          setPeriods([]);
        }

        const depts = await colaboradoresService.getDepartamentos();
        setDepartments(depts || []);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setPeriods([]);
        setDepartments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchDashboardData();
    }
  }, [selectedPeriodId, selectedDepartment]);

  const fetchDashboardData = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);

    try {
      const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
      if (selectedPeriod) {
        setCurrentPeriodName(selectedPeriod.periodo);
      }

      const diasParaLancamento = selectedPeriod
        ? Math.max(0, Math.ceil((new Date(selectedPeriod.fecha_lancamento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      
      const diasRestantes = selectedPeriod
        ? Math.max(0, Math.ceil((new Date(selectedPeriod.data_final).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      const colaboradores = await colaboradoresService.getAll({ 
        ativo: true,
        departamento: selectedDepartment !== 'todos' ? selectedDepartment : undefined,
      });
      const totalColaboradores = colaboradores?.length || 0;

      const allLancamentos = await lancamentosService.getAll({ periodo_id: selectedPeriodId });

      const lancamentos = selectedDepartment === 'todos'
        ? allLancamentos
        : allLancamentos?.filter((l: any) => {
            const colab = colaboradores.find(c => c.id === l.colaborador_id);
            return colab?.departamento === selectedDepartment;
          });

      const pendingLancamentos = lancamentos?.filter((l: any) => 
        ['enviado', 'em_analise'].includes(l.status)
      );

      const totalLancamentosMes = lancamentos?.length || 0;
      const valorTotalMes = lancamentos?.reduce((sum, l) => sum + Number(l.valor_considerado), 0) || 0;
      const pendentesValidacao = pendingLancamentos?.length || 0;

      // Gráfico Despesas por Categoria (excluindo rejeitadas)
      const categoryMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        // Excluir lançamentos com status 'invalido'
        if (l.status !== 'invalido') {
          const grupo = l.tipo_despesa?.grupo || 'Outros';
          categoryMap.set(grupo, (categoryMap.get(grupo) || 0) + Number(l.valor_considerado));
        }
      });
      const expensesByCategory = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Gráfico Despesas por Categoria Rejeitadas (apenas 'invalido')
      const categoryRejectedMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        // Incluir apenas lançamentos com status 'invalido'
        if (l.status === 'invalido') {
          const grupo = l.tipo_despesa?.grupo || 'Outros';
          categoryRejectedMap.set(grupo, (categoryRejectedMap.get(grupo) || 0) + Number(l.valor_considerado));
        }
      });
      const expensesByCategoryRejected = Array.from(categoryRejectedMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      const statusMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
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

      const colaboradorMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        const colab = colaboradores.find(c => c.id === l.colaborador_id);
        const nome = colab?.nome || 'Desconhecido';
        colaboradorMap.set(nome, (colaboradorMap.get(nome) || 0) + Number(l.valor_considerado));
      });
      const topColaboradores = Array.from(colaboradorMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      const totalUtilizado = lancamentos?.filter((l) => l.status === 'valido').reduce((sum, l) => sum + Number(l.valor_considerado), 0) || 0;
      const utilizationPercentage = totalUtilizado > 0 ? 100 : 0;

      // Gráfico Evolução Mensal (excluindo rejeitadas)
      const monthMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        // Excluir lançamentos com status 'invalido'
        if (l.status !== 'invalido') {
          const date = new Date(l.created_at);
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

      // Gráfico Evolução Mensal de Despesas Rejeitadas (apenas 'invalido')
      const monthRejectedMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        // Incluir apenas lançamentos com status 'invalido'
        if (l.status === 'invalido') {
          const date = new Date(l.created_at);
          const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
          monthRejectedMap.set(monthKey, (monthRejectedMap.get(monthKey) || 0) + Number(l.valor_considerado));
        }
      });
      const expensesByMonthRejected = Array.from(monthRejectedMap.entries())
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => {
          const [am, ay] = a.month.split('/').map(Number);
          const [bm, by] = b.month.split('/').map(Number);
          return ay === by ? am - bm : ay - by;
        });

      setData({
        totalColaboradores,
        totalLancamentosMes,
        valorTotalMes,
        pendentesValidacao,
        diasParaLancamento,
        diasRestantes,
        expensesByCategory,
        expensesByStatus,
        expensesByMonth,
        expensesByCategoryRejected,
        expensesByMonthRejected,
        topColaboradores,
        utilizationPercentage,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Dashboard"
          description="Nenhum período cadastrado"
        />
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum período cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              É necessário cadastrar pelo menos um período no calendário para visualizar o dashboard.
            </p>
            <Button asChild>
              <Link to="/calendario">Ir para Calendário</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`Período: ${currentPeriodName || 'N/A'}`}
      >
        <div className="flex flex-row gap-4 items-end flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Departamento</Label>
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
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-card border">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Colaboradores Elegíveis</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{data.totalColaboradores}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">Cadastrados no sistema</p>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-muted rounded-lg flex-shrink-0">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-primary-foreground/80">Lançamentos no Mês</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{data.totalLancamentosMes}</p>
                    <p className="text-xs text-primary-foreground/80 mt-1 truncate">{formatCurrency(data.valorTotalMes)}</p>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-primary-foreground/20 rounded-lg flex-shrink-0">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Pendentes de Validação</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{data.pendentesValidacao}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">Aguardando análise</p>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-warning/10 rounded-lg flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-white/80">Prazo Lançamento</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{data.diasParaLancamento}</p>
                    <p className="text-xs text-white/80 mt-1 truncate">Dias p/ colaboradores</p>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-white/20 rounded-lg flex-shrink-0">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-slate-300">Período Acúmulo</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{data.diasRestantes}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">Dias até encerrar</p>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-white/10 rounded-lg flex-shrink-0">
                    <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.expensesByCategory} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        tickFormatter={formatAxisValue}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={100} 
                        tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Distribuição por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expensesByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.expensesByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.expensesByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'Lançamentos']} />
                      <Legend />
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

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Top 5 Colaboradores</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topColaboradores.length > 0 ? (
                  <div className="space-y-3">
                    {data.topColaboradores.map((colab, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="text-sm truncate max-w-[200px]">{colab.name}</span>
                        <span className="font-mono text-sm font-medium">{formatCurrency(colab.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Evolução Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expensesByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.expensesByMonth} margin={{ left: 0, right: 20, top: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tickFormatter={formatAxisValue}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        domain={[0, (dataMin: number, dataMax: number) => {
                          // Validar dataMax para evitar NaN
                          if (!isFinite(dataMax) || dataMax === 0) {
                            return 100; // Valor padrão quando não há dados
                          }
                          // Adicionar 20% de headroom no topo, mas no mínimo 10% do valor máximo
                          const headroom = Math.max(dataMax * 0.2, dataMax * 0.1);
                          return Math.ceil(dataMax + headroom);
                        }]}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Valor']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rejected Expenses Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Despesas por Categoria Rejeitadas</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expensesByCategoryRejected.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.expensesByCategoryRejected} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        tickFormatter={formatAxisValue}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={100} 
                        tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
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
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
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
                <CardTitle className="text-lg font-semibold">Evolução Mensal de Despesas Rejeitadas</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expensesByMonthRejected.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.expensesByMonthRejected} margin={{ left: 0, right: 20, top: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tickFormatter={formatAxisValue}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        domain={[0, (dataMin: number, dataMax: number) => {
                          // Validar dataMax para evitar NaN
                          if (!isFinite(dataMax) || dataMax === 0) {
                            return 100; // Valor padrão quando não há dados
                          }
                          const headroom = Math.max(dataMax * 0.2, dataMax * 0.1);
                          return Math.ceil(dataMax + headroom);
                        }]}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Valor']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/lancamentos">Ver Lançamentos</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/colaboradores">Gerenciar Colaboradores</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/fechamento">Ir para Fechamento</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardRH;
