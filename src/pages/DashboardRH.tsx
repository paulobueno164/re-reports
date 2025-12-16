import { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle, Activity, BarChart3, Loader2, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { StatCard } from '@/components/ui/stat-card';

interface Period {
  id: string;
  periodo: string;
  status: string;
  data_inicio: string;
}

interface ValidationMetrics {
  totalPending: number;
  totalApprovedToday: number;
  totalRejectedToday: number;
  totalApprovedMonth: number;
  totalRejectedMonth: number;
  avgValidationTime: number;
  approvalRate: number;
  pendingValue: number;
  approvedValue: number;
  rejectedValue: number;
  totalColaboradores: number;
  utilizationData: { used: number; available: number; total: number; percentage: number };
}

interface DepartmentMetrics {
  departamento: string;
  totalLancamentos: number;
  aprovados: number;
  rejeitados: number;
  pendentes: number;
  valorTotal: number;
}

const DashboardRH = () => {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('todos');
  const [currentPeriodName, setCurrentPeriodName] = useState<string>('');
  const [metrics, setMetrics] = useState<ValidationMetrics>({
    totalPending: 0,
    totalApprovedToday: 0,
    totalRejectedToday: 0,
    totalApprovedMonth: 0,
    totalRejectedMonth: 0,
    avgValidationTime: 0,
    approvalRate: 0,
    pendingValue: 0,
    approvedValue: 0,
    rejectedValue: 0,
    totalColaboradores: 0,
    utilizationData: { used: 0, available: 0, total: 0, percentage: 0 },
  });
  const [departmentMetrics, setDepartmentMetrics] = useState<DepartmentMetrics[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);

  // Fetch periods and departments on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch periods
      const { data: allPeriods } = await supabase
        .from('calendario_periodos')
        .select('id, periodo, status, data_inicio')
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

      // Fetch departments
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
      fetchMetrics();
    }
  }, [selectedPeriodId, selectedDepartment]);

  const fetchMetrics = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Update current period name
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
    if (selectedPeriod) {
      setCurrentPeriodName(selectedPeriod.periodo);
    }

    // Fetch total colaboradores (filtered by department)
    let colaboradoresQuery = supabase
      .from('colaboradores_elegiveis')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true);
    
    if (selectedDepartment !== 'todos') {
      colaboradoresQuery = colaboradoresQuery.eq('departamento', selectedDepartment);
    }
    
    const { count: totalColaboradores } = await colaboradoresQuery;

    // Fetch colaboradores for cesta calculation (filtered by department)
    let colaboradoresCestaQuery = supabase
      .from('colaboradores_elegiveis')
      .select('id, cesta_beneficios_teto, departamento')
      .eq('ativo', true);
    
    if (selectedDepartment !== 'todos') {
      colaboradoresCestaQuery = colaboradoresCestaQuery.eq('departamento', selectedDepartment);
    }
    
    const { data: colaboradores } = await colaboradoresCestaQuery;

    // Fetch lancamentos for the selected period
    const { data: allLancamentos } = await supabase
      .from('lancamentos')
      .select('id, status, valor_lancado, valor_considerado, created_at, validado_em, colaborador_id, periodo_id, colaboradores_elegiveis(departamento)')
      .eq('periodo_id', selectedPeriodId);

    // Filter by department if needed
    const lancamentos = selectedDepartment === 'todos'
      ? allLancamentos
      : allLancamentos?.filter((l: any) => l.colaboradores_elegiveis?.departamento === selectedDepartment);

    let utilizationData = { used: 0, available: 0, total: 0, percentage: 0 };

    if (lancamentos && colaboradores) {
      const pending = lancamentos.filter((l) => l.status === 'enviado' || l.status === 'em_analise');
      const approvedToday = lancamentos.filter((l) => l.status === 'valido' && l.validado_em && new Date(l.validado_em) >= today);
      const rejectedToday = lancamentos.filter((l) => l.status === 'invalido' && l.validado_em && new Date(l.validado_em) >= today);
      const approvedMonth = lancamentos.filter((l) => l.status === 'valido' && l.validado_em && new Date(l.validado_em) >= monthStart);
      const rejectedMonth = lancamentos.filter((l) => l.status === 'invalido' && l.validado_em && new Date(l.validado_em) >= monthStart);

      const totalValidatedMonth = approvedMonth.length + rejectedMonth.length;
      const approvalRate = totalValidatedMonth > 0 ? Math.round((approvedMonth.length / totalValidatedMonth) * 100) : 0;

      // Calculate average validation time
      const validatedWithTime = lancamentos.filter((l) => l.validado_em && l.created_at);
      let avgTime = 0;
      if (validatedWithTime.length > 0) {
        const totalMinutes = validatedWithTime.reduce((acc, l) => {
          const created = new Date(l.created_at);
          const validated = new Date(l.validado_em!);
          return acc + (validated.getTime() - created.getTime()) / 60000;
        }, 0);
        avgTime = Math.round(totalMinutes / validatedWithTime.length);
      }

      // Cesta utilization (filtered colaboradores)
      const totalCestaTeto = colaboradores.reduce((sum, c) => sum + Number(c.cesta_beneficios_teto), 0);
      const totalUtilizado = lancamentos.filter((l) => l.status === 'valido').reduce((sum, l) => sum + Number(l.valor_considerado), 0);
      utilizationData = {
        used: totalUtilizado,
        available: Math.max(0, totalCestaTeto - totalUtilizado),
        total: totalCestaTeto,
        percentage: totalCestaTeto > 0 ? Math.round((totalUtilizado / totalCestaTeto) * 100) : 0,
      };

      setMetrics({
        totalPending: pending.length,
        totalApprovedToday: approvedToday.length,
        totalRejectedToday: rejectedToday.length,
        totalApprovedMonth: approvedMonth.length,
        totalRejectedMonth: rejectedMonth.length,
        avgValidationTime: avgTime,
        approvalRate,
        pendingValue: pending.reduce((acc, l) => acc + Number(l.valor_lancado), 0),
        approvedValue: approvedMonth.reduce((acc, l) => acc + Number(l.valor_considerado), 0),
        rejectedValue: rejectedMonth.reduce((acc, l) => acc + Number(l.valor_lancado), 0),
        totalColaboradores: totalColaboradores || 0,
        utilizationData,
      });

      // Department metrics
      const deptMap: Record<string, DepartmentMetrics> = {};
      lancamentos.forEach((l: any) => {
        const dept = l.colaboradores_elegiveis?.departamento || 'Não definido';
        if (!deptMap[dept]) {
          deptMap[dept] = { departamento: dept, totalLancamentos: 0, aprovados: 0, rejeitados: 0, pendentes: 0, valorTotal: 0 };
        }
        deptMap[dept].totalLancamentos++;
        deptMap[dept].valorTotal += Number(l.valor_lancado);
        if (l.status === 'valido') deptMap[dept].aprovados++;
        else if (l.status === 'invalido') deptMap[dept].rejeitados++;
        else if (l.status === 'enviado' || l.status === 'em_analise') deptMap[dept].pendentes++;
      });
      setDepartmentMetrics(Object.values(deptMap));

      // Daily trend (last 7 days)
      const days: Record<string, { date: string; aprovados: number; rejeitados: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days[key] = { date: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }), aprovados: 0, rejeitados: 0 };
      }
      lancamentos.forEach((l) => {
        if (l.validado_em) {
          const key = l.validado_em.split('T')[0];
          if (days[key]) {
            if (l.status === 'valido') days[key].aprovados++;
            else if (l.status === 'invalido') days[key].rejeitados++;
          }
        }
      });
      setDailyTrend(Object.values(days));
    }

    // Fetch recent audit activity
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'lancamento')
      .order('created_at', { ascending: false })
      .limit(10);

    if (auditLogs) {
      setRecentActivity(auditLogs);
    }

    setLoading(false);
  };

  if (loading && !selectedPeriodId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusData = [
    { name: 'Aprovados', value: metrics.totalApprovedMonth, color: 'hsl(var(--success))' },
    { name: 'Rejeitados', value: metrics.totalRejectedMonth, color: 'hsl(var(--destructive))' },
    { name: 'Pendentes', value: metrics.totalPending, color: 'hsl(var(--warning))' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard RH"
        description={`Período: ${currentPeriodName || 'N/A'}${selectedDepartment !== 'todos' ? ` • ${selectedDepartment}` : ''}`}
      >
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
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Colaboradores Elegíveis"
              value={metrics.totalColaboradores}
              description="Cadastrados no sistema"
              icon={Users}
              href="/colaboradores"
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Utilização Cesta de Benefícios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{metrics.utilizationData.percentage}%</p>
                <Progress value={metrics.utilizationData.percentage} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(metrics.utilizationData.used)} de {formatCurrency(metrics.utilizationData.total)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Taxa de Aprovação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{metrics.approvalRate}%</p>
                <Progress value={metrics.approvalRate} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.totalApprovedMonth} aprovados / {metrics.totalApprovedMonth + metrics.totalRejectedMonth} validados
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Validation KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-warning/5 border-warning/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">{metrics.totalPending}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(metrics.pendingValue)} em valor</p>
              </CardContent>
            </Card>

            <Card className="bg-success/5 border-success/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Aprovados Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-success">{metrics.totalApprovedToday}</p>
                <p className="text-xs text-muted-foreground">{metrics.totalApprovedMonth} no mês</p>
              </CardContent>
            </Card>

            <Card className="bg-destructive/5 border-destructive/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Rejeitados Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-destructive">{metrics.totalRejectedToday}</p>
                <p className="text-xs text-muted-foreground">{metrics.totalRejectedMonth} no mês</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Valor Aprovado (Mês)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(metrics.approvedValue)}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(metrics.rejectedValue)} rejeitados</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Tendência Diária (7 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ aprovados: { label: 'Aprovados', color: 'hsl(var(--success))' }, rejeitados: { label: 'Rejeitados', color: 'hsl(var(--destructive))' } }} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="aprovados" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))' }} />
                      <Line type="monotone" dataKey="rejeitados" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: 'hsl(var(--destructive))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Distribuição por Status (Mês)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Department Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Métricas por Departamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ aprovados: { label: 'Aprovados', color: 'hsl(var(--success))' }, rejeitados: { label: 'Rejeitados', color: 'hsl(var(--destructive))' }, pendentes: { label: 'Pendentes', color: 'hsl(var(--warning))' } }} className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentMetrics} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="departamento" className="text-xs" width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="aprovados" stackId="a" fill="hsl(var(--success))" />
                    <Bar dataKey="rejeitados" stackId="a" fill="hsl(var(--destructive))" />
                    <Bar dataKey="pendentes" stackId="a" fill="hsl(var(--warning))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada ainda</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className={`p-2 rounded-full ${activity.action === 'aprovar' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {activity.action === 'aprovar' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.action === 'aprovar' ? 'Aprovou' : 'Rejeitou'}: {activity.entity_description || activity.entity_id}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(new Date(activity.created_at))}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardRH;
