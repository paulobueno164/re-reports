import { useState, useEffect } from 'react';
import { Users, Receipt, Clock, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';
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

interface Period {
  id: string;
  periodo: string;
  status: string;
  data_inicio: string;
  fecha_lancamento: string;
}

interface DashboardData {
  totalColaboradores: number;
  totalLancamentosMes: number;
  valorTotalMes: number;
  pendentesValidacao: number;
  diasRestantes: number;
  expensesByCategory: { name: string; value: number }[];
  expensesByStatus: { name: string; value: number; color: string }[];
  expensesByMonth: { month: string; value: number }[];
  topColaboradores: { name: string; value: number }[];
  utilizationPercentage: number;
}

const STATUS_COLORS: Record<string, string> = {
  enviado: '#f59e0b',
  em_analise: '#3b82f6',
  valido: '#10b981',
  invalido: '#ef4444',
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
    diasRestantes: 0,
    expensesByCategory: [],
    expensesByStatus: [],
    expensesByMonth: [],
    topColaboradores: [],
    utilizationPercentage: 0,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: allPeriods } = await supabase
        .from('calendario_periodos')
        .select('id, periodo, status, data_inicio, fecha_lancamento')
        .order('data_inicio', { ascending: false });

      if (allPeriods && allPeriods.length > 0) {
        setPeriods(allPeriods);
        const today = new Date();
        let closestPeriod = allPeriods[0];
        let minDiff = Infinity;
        
        for (const p of allPeriods) {
          const diff = Math.abs(new Date(p.data_inicio).getTime() - today.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestPeriod = p;
          }
        }
        setSelectedPeriodId(closestPeriod.id);
        setCurrentPeriodName(closestPeriod.periodo);
      }

      const { data: colaboradores } = await supabase
        .from('colaboradores_elegiveis')
        .select('departamento')
        .eq('ativo', true);

      if (colaboradores) {
        const uniqueDepts = [...new Set(colaboradores.map(c => c.departamento))].sort();
        setDepartments(uniqueDepts);
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

      const diasRestantes = selectedPeriod
        ? Math.max(0, Math.ceil((new Date(selectedPeriod.fecha_lancamento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Fetch colaboradores
      let colaboradoresQuery = supabase
        .from('colaboradores_elegiveis')
        .select('id, cesta_beneficios_teto, departamento')
        .eq('ativo', true);
      
      if (selectedDepartment !== 'todos') {
        colaboradoresQuery = colaboradoresQuery.eq('departamento', selectedDepartment);
      }
      
      const { data: colaboradores } = await colaboradoresQuery;
      const totalColaboradores = colaboradores?.length || 0;

      // Fetch lancamentos
      const { data: allLancamentos } = await supabase
        .from('lancamentos')
        .select(`
          id,
          valor_lancado,
          valor_considerado,
          status,
          created_at,
          colaborador_id,
          colaboradores_elegiveis (id, nome, departamento),
          tipos_despesas (id, nome, grupo)
        `)
        .eq('periodo_id', selectedPeriodId);

      const lancamentos = selectedDepartment === 'todos'
        ? allLancamentos
        : allLancamentos?.filter((l: any) => l.colaboradores_elegiveis?.departamento === selectedDepartment);

      // Fetch ALL pending lancamentos
      const { data: allPendingRaw } = await supabase
        .from('lancamentos')
        .select('id, status, colaborador_id, colaboradores_elegiveis (departamento)')
        .in('status', ['enviado', 'em_analise']);

      const pendingLancamentos = selectedDepartment === 'todos'
        ? allPendingRaw
        : allPendingRaw?.filter((l: any) => l.colaboradores_elegiveis?.departamento === selectedDepartment);

      const totalLancamentosMes = lancamentos?.length || 0;
      const valorTotalMes = lancamentos?.reduce((sum, l) => sum + Number(l.valor_considerado), 0) || 0;
      const pendentesValidacao = pendingLancamentos?.length || 0;

      // Expenses by category
      const categoryMap = new Map<string, number>();
      lancamentos?.forEach((l: any) => {
        const grupo = l.tipos_despesas?.grupo || 'Outros';
        categoryMap.set(grupo, (categoryMap.get(grupo) || 0) + Number(l.valor_considerado));
      });
      const expensesByCategory = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Expenses by status
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

      // Utilization
      const totalCestaTeto = colaboradores?.reduce((sum, c) => sum + Number(c.cesta_beneficios_teto), 0) || 0;
      const totalUtilizado = lancamentos?.filter((l) => l.status === 'valido').reduce((sum, l) => sum + Number(l.valor_considerado), 0) || 0;
      const utilizationPercentage = totalCestaTeto > 0 ? Math.round((totalUtilizado / totalCestaTeto) * 100) : 0;

      // Expenses by month (last 6 months)
      const { data: allLancamentosMonths } = await supabase
        .from('lancamentos')
        .select('valor_considerado, created_at')
        .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

      const monthMap = new Map<string, number>();
      allLancamentosMonths?.forEach((l: any) => {
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
        totalColaboradores,
        totalLancamentosMes,
        valorTotalMes,
        pendentesValidacao,
        diasRestantes,
        expensesByCategory,
        expensesByStatus,
        expensesByMonth,
        topColaboradores,
        utilizationPercentage,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedPeriodId) {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 - Colaboradores */}
            <Card className="bg-card border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Colaboradores Elegíveis</p>
                    <p className="text-3xl font-bold mt-1">{data.totalColaboradores}</p>
                    <p className="text-xs text-muted-foreground mt-1">Cadastrados no sistema</p>
                  </div>
                  <div className="p-2.5 bg-muted rounded-lg">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2 - Lançamentos (Primary Gradient) */}
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-foreground/80">Lançamentos no Mês</p>
                    <p className="text-3xl font-bold mt-1">{data.totalLancamentosMes}</p>
                    <p className="text-xs text-primary-foreground/80 mt-1">{formatCurrency(data.valorTotalMes)}</p>
                  </div>
                  <div className="p-2.5 bg-primary-foreground/20 rounded-lg">
                    <Receipt className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3 - Pendentes */}
            <Card className="bg-card border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pendentes de Validação</p>
                    <p className="text-3xl font-bold mt-1">{data.pendentesValidacao}</p>
                    <p className="text-xs text-muted-foreground mt-1">Aguardando análise do RH</p>
                  </div>
                  <div className="p-2.5 bg-warning/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 4 - Dias Restantes */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Dias Restantes</p>
                    <p className="text-3xl font-bold mt-1">{data.diasRestantes}</p>
                    <p className="text-xs text-slate-400 mt-1">Para fechamento do período</p>
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
            {/* Expenses by Category */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.expensesByCategory} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
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

            {/* Status Distribution */}
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
                      <Tooltip
                        formatter={(value: number, name: string) => [value, name]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
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
            {/* Monthly Evolution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Evolução Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expensesByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.expensesByMonth} margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column: Top Colaboradores + Utilização */}
            <div className="space-y-6">
              {/* Top Colaboradores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Top Colaboradores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topColaboradores.length > 0 ? (
                    <div className="space-y-3">
                      {data.topColaboradores.map((colab, index) => (
                        <div key={colab.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                            <span className="text-sm font-medium truncate max-w-[180px]">{colab.name}</span>
                          </div>
                          <span className="text-sm font-mono font-semibold">{formatCurrency(colab.value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem dados para exibir</p>
                  )}
                </CardContent>
              </Card>

              {/* Utilização Geral */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Utilização Geral
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cesta de Benefícios</span>
                      <span className="text-sm font-semibold">{data.utilizationPercentage}%</span>
                    </div>
                    <Progress value={data.utilizationPercentage} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardRH;
