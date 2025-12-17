import { useState, useEffect } from 'react';
import { Receipt, Clock, CheckCircle, XCircle, AlertTriangle, FileText, Loader2, TrendingUp, Send } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface Expense {
  id: string;
  tipoDespesaNome: string;
  valorLancado: number;
  valorConsiderado: number;
  status: string;
  createdAt: Date;
}

interface Period {
  id: string;
  periodo: string;
  status: string;
  abreLancamento: Date;
  fechaLancamento: Date;
}

interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  departamento: string;
  cestaBeneficiosTeto: number;
  valeAlimentacao: number;
  valeRefeicao: number;
  ajudaCusto: number;
  mobilidade: number;
  transporte: number;
  temPida: boolean;
  pidaTeto: number;
}

const STATUS_COLORS: Record<string, string> = {
  rascunho: '#94a3b8',
  enviado: '#f59e0b',
  em_analise: '#3b82f6',
  valido: '#10b981',
  invalido: '#ef4444',
};

const DashboardColaborador = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [statusCounts, setStatusCounts] = useState({
    rascunho: 0,
    enviado: 0,
    em_analise: 0,
    valido: 0,
    invalido: 0,
  });
  const [totalUsado, setTotalUsado] = useState(0);
  const [diasRestantes, setDiasRestantes] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (selectedPeriodId && colaborador) {
      fetchExpenses();
    }
  }, [selectedPeriodId, colaborador]);

  const fetchInitialData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch colaborador data
    const { data: colabData, error: colabError } = await supabase
      .from('colaboradores_elegiveis')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (colabError || !colabData) {
      setLoading(false);
      return;
    }

    setColaborador({
      id: colabData.id,
      nome: colabData.nome,
      matricula: colabData.matricula,
      departamento: colabData.departamento,
      cestaBeneficiosTeto: Number(colabData.cesta_beneficios_teto),
      valeAlimentacao: Number(colabData.vale_alimentacao),
      valeRefeicao: Number(colabData.vale_refeicao),
      ajudaCusto: Number(colabData.ajuda_custo),
      mobilidade: Number(colabData.mobilidade),
      transporte: Number(colabData.transporte),
      temPida: colabData.tem_pida,
      pidaTeto: Number(colabData.pida_teto),
    });

    // Fetch periods
    const { data: periodsData } = await supabase
      .from('calendario_periodos')
      .select('id, periodo, status, abre_lancamento, fecha_lancamento')
      .order('periodo', { ascending: false });

    if (periodsData && periodsData.length > 0) {
      const mapped = periodsData.map(p => ({
        id: p.id,
        periodo: p.periodo,
        status: p.status,
        abreLancamento: new Date(p.abre_lancamento),
        fechaLancamento: new Date(p.fecha_lancamento),
      }));
      setPeriods(mapped);
      
      // Find current open period
      const openPeriod = mapped.find(p => p.status === 'aberto');
      setSelectedPeriodId(openPeriod?.id || mapped[0].id);
    }

    setLoading(false);
  };

  const fetchExpenses = async () => {
    if (!colaborador) return;

    const { data: expensesData } = await supabase
      .from('lancamentos')
      .select(`
        id,
        valor_lancado,
        valor_considerado,
        status,
        created_at,
        tipos_despesas (nome)
      `)
      .eq('colaborador_id', colaborador.id)
      .eq('periodo_id', selectedPeriodId)
      .order('created_at', { ascending: false });

    if (expensesData) {
      const mapped: Expense[] = expensesData.map((e: any) => ({
        id: e.id,
        tipoDespesaNome: e.tipos_despesas?.nome || '',
        valorLancado: Number(e.valor_lancado),
        valorConsiderado: Number(e.valor_considerado),
        status: e.status,
        createdAt: new Date(e.created_at),
      }));
      setExpenses(mapped);

      // Calculate status counts
      const counts = {
        rascunho: mapped.filter(e => e.status === 'rascunho').length,
        enviado: mapped.filter(e => e.status === 'enviado').length,
        em_analise: mapped.filter(e => e.status === 'em_analise').length,
        valido: mapped.filter(e => e.status === 'valido').length,
        invalido: mapped.filter(e => e.status === 'invalido').length,
      };
      setStatusCounts(counts);

      // Calculate total used (valido only)
      const total = mapped
        .filter(e => e.status === 'valido')
        .reduce((sum, e) => sum + e.valorConsiderado, 0);
      setTotalUsado(total);
    }

    // Calculate dias restantes
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
    if (selectedPeriod) {
      const dias = Math.max(0, Math.ceil((selectedPeriod.fechaLancamento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      setDiasRestantes(dias);
    }
  };

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
  const saldoDisponivel = colaborador ? colaborador.cestaBeneficiosTeto - totalUsado : 0;
  const percentualUsado = colaborador && colaborador.cestaBeneficiosTeto > 0 
    ? Math.round((totalUsado / colaborador.cestaBeneficiosTeto) * 100) 
    : 0;

  const pendentesAnalise = statusCounts.enviado + statusCounts.em_analise;

  // Data for pie chart
  const statusData = [
    { name: 'Rascunho', value: statusCounts.rascunho, color: STATUS_COLORS.rascunho },
    { name: 'Enviado', value: statusCounts.enviado, color: STATUS_COLORS.enviado },
    { name: 'Em Análise', value: statusCounts.em_analise, color: STATUS_COLORS.em_analise },
    { name: 'Aprovado', value: statusCounts.valido, color: STATUS_COLORS.valido },
    { name: 'Recusado', value: statusCounts.invalido, color: STATUS_COLORS.invalido },
  ].filter(d => d.value > 0);

  // Remuneration components
  const remunerationComponents = colaborador ? [
    { label: 'Vale Alimentação', value: colaborador.valeAlimentacao },
    { label: 'Vale Refeição', value: colaborador.valeRefeicao },
    { label: 'Ajuda de Custo', value: colaborador.ajudaCusto },
    { label: 'Mobilidade', value: colaborador.mobilidade },
    { label: 'Transporte', value: colaborador.transporte },
    ...(colaborador.temPida ? [{ label: 'PI/DA', value: colaborador.pidaTeto }] : []),
  ].filter(c => c.value > 0) : [];

  const totalFixo = remunerationComponents.reduce((sum, c) => sum + c.value, 0);

  const expenseColumns = [
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

  if (!colaborador) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Dashboard" description="Visão geral dos seus benefícios" />
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Seu perfil de colaborador não foi encontrado. Entre em contato com o RH.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title={`Olá, ${colaborador.nome.split(' ')[0]}`} 
        description={`${colaborador.matricula} • ${colaborador.departamento}`}
      >
        <div className="flex flex-row gap-4 items-end flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.periodo} {p.status === 'aberto' ? '(Aberto)' : '(Fechado)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground invisible">Ação</Label>
            <Button asChild>
              <Link to={`/lancamentos/colaborador/${colaborador.id}`}>
                <Receipt className="mr-2 h-4 w-4" />
                Meus Lançamentos
              </Link>
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* Cesta de Benefícios - Main Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Cesta de Benefícios - {selectedPeriod?.periodo || ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold">{formatCurrency(totalUsado)}</p>
                <p className="text-sm text-muted-foreground">utilizado de {formatCurrency(colaborador.cestaBeneficiosTeto)}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-success">{formatCurrency(saldoDisponivel)}</p>
                <p className="text-sm text-muted-foreground">saldo disponível</p>
              </div>
            </div>
            <Progress value={Math.min(percentualUsado, 100)} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{percentualUsado}% utilizado</span>
              {selectedPeriod?.status === 'aberto' && diasRestantes > 0 && (
                <span className="text-primary">{diasRestantes} dias restantes para lançar</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total de Lançamentos"
          value={expenses.length}
          description={`No período ${selectedPeriod?.periodo || ''}`}
          icon={Receipt}
        />
        <StatCard
          title="Aprovados"
          value={statusCounts.valido}
          description={formatCurrency(totalUsado)}
          icon={CheckCircle}
          variant="primary"
        />
        <StatCard
          title="Pendentes"
          value={pendentesAnalise}
          description="Aguardando análise"
          icon={Clock}
          variant={pendentesAnalise > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Recusados"
          value={statusCounts.invalido}
          description="Não aprovados"
          icon={XCircle}
          variant={statusCounts.invalido > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Charts and Components Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, 'Lançamentos']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground">
                Nenhum lançamento neste período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fixed Components */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Componentes Fixos da Remuneração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {remunerationComponents.map((comp, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{comp.label}</span>
                  <span className="font-mono font-medium">{formatCurrency(comp.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Total Fixo</span>
                <span className="font-mono font-bold text-primary">{formatCurrency(totalFixo)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rascunhos Alert */}
      {statusCounts.rascunho > 0 && (
        <Alert>
          <Send className="h-4 w-4" />
          <AlertDescription>
            Você tem <strong>{statusCounts.rascunho} lançamento(s) em rascunho</strong> que ainda não foram enviados para análise.{' '}
            <Link to={`/lancamentos/colaborador/${colaborador.id}`} className="text-primary hover:underline">
              Clique aqui para revisar e enviar.
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Expenses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Últimos Lançamentos</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/lancamentos/colaborador/${colaborador.id}`}>Ver Todos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {expenses.length > 0 ? (
            <DataTable
              data={expenses.slice(0, 5)}
              columns={expenseColumns}
              onRowClick={(item) => navigate(`/lancamentos/${item.id}`)}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum lançamento encontrado neste período.</p>
              <Button asChild className="mt-4">
                <Link to={`/lancamentos/colaborador/${colaborador.id}`}>Fazer Primeiro Lançamento</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardColaborador;
