import { useState, useEffect } from 'react';
import { Users, HeadphonesIcon, TrendingUp, TrendingDown, Target, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface KPIData {
  // KPI 1: Colaboradores Atendidos
  totalElegiveis: number;
  colaboradoresComLancamento: number;
  percentualAtendidos: number;
  metaAtendidos: number;
  // KPI 2: Chamados de Suporte (simulated with audit logs)
  chamadosMesAtual: number;
  chamadosMesAnterior: number;
  variacaoChamados: number;
  metaChamados: number;
  // Additional metrics
  mediaLancamentosPorColaborador: number;
  valorMedioLancamento: number;
  taxaAprovacao: number;
  historicoAtendimento: { mes: string; percentual: number }[];
  historicoChamados: { mes: string; quantidade: number }[];
}

const KPIsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [data, setData] = useState<KPIData>({
    totalElegiveis: 0,
    colaboradoresComLancamento: 0,
    percentualAtendidos: 0,
    metaAtendidos: 90,
    chamadosMesAtual: 0,
    chamadosMesAnterior: 0,
    variacaoChamados: 0,
    metaChamados: 10,
    mediaLancamentosPorColaborador: 0,
    valorMedioLancamento: 0,
    taxaAprovacao: 0,
    historicoAtendimento: [],
    historicoChamados: [],
  });

  useEffect(() => {
    fetchKPIData();
  }, [selectedPeriod]);

  const fetchKPIData = async () => {
    setLoading(true);

    try {
      // Fetch total eligible colaboradores
      const { count: totalElegiveis } = await supabase
        .from('colaboradores_elegiveis')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);

      // Fetch periods
      const { data: periods } = await supabase
        .from('calendario_periodos')
        .select('id, periodo')
        .order('periodo', { ascending: false });

      const currentPeriod = periods?.[0];

      // Fetch lancamentos
      let lancamentosQuery = supabase
        .from('lancamentos')
        .select('id, colaborador_id, valor_considerado, status');

      if (selectedPeriod !== 'all' && selectedPeriod) {
        lancamentosQuery = lancamentosQuery.eq('periodo_id', selectedPeriod);
      } else if (currentPeriod) {
        lancamentosQuery = lancamentosQuery.eq('periodo_id', currentPeriod.id);
      }

      const { data: lancamentos } = await lancamentosQuery;

      // Calculate colaboradores with lancamentos
      const colaboradoresComLancamento = new Set(lancamentos?.map(l => l.colaborador_id) || []).size;
      const percentualAtendidos = totalElegiveis && totalElegiveis > 0 
        ? Math.round((colaboradoresComLancamento / totalElegiveis) * 100) 
        : 0;

      // Calculate average lancamentos per colaborador
      const mediaLancamentosPorColaborador = colaboradoresComLancamento > 0
        ? Math.round((lancamentos?.length || 0) / colaboradoresComLancamento * 10) / 10
        : 0;

      // Calculate average value
      const totalValor = lancamentos?.reduce((sum, l) => sum + Number(l.valor_considerado), 0) || 0;
      const valorMedioLancamento = lancamentos?.length 
        ? totalValor / lancamentos.length 
        : 0;

      // Calculate approval rate
      const aprovados = lancamentos?.filter(l => l.status === 'valido').length || 0;
      const enviados = lancamentos?.filter(l => ['valido', 'invalido'].includes(l.status)).length || 0;
      const taxaAprovacao = enviados > 0 ? Math.round((aprovados / enviados) * 100) : 0;

      // Fetch audit logs as proxy for "support tickets"
      // Count actions that might indicate support needs (errors, rejections, etc)
      const mesAtual = new Date();
      mesAtual.setDate(1);
      mesAtual.setHours(0, 0, 0, 0);

      const mesAnterior = new Date(mesAtual);
      mesAnterior.setMonth(mesAnterior.getMonth() - 1);

      const { count: chamadosMesAtual } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', mesAtual.toISOString())
        .in('action', ['rejeitar', 'invalidar']);

      const { count: chamadosMesAnterior } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', mesAnterior.toISOString())
        .lt('created_at', mesAtual.toISOString())
        .in('action', ['rejeitar', 'invalidar']);

      const variacaoChamados = chamadosMesAnterior && chamadosMesAnterior > 0
        ? Math.round(((chamadosMesAtual || 0) - chamadosMesAnterior) / chamadosMesAnterior * 100)
        : 0;

      // Historical data simulation (would come from real data in production)
      const historicoAtendimento = [];
      const historicoChamados = [];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mesLabel = `${d.getMonth() + 1}/${d.getFullYear()}`;
        
        // Simulated increasing trend
        historicoAtendimento.push({
          mes: mesLabel,
          percentual: Math.min(100, 70 + (5 - i) * 6 + Math.random() * 5),
        });
        
        // Simulated decreasing trend for support
        historicoChamados.push({
          mes: mesLabel,
          quantidade: Math.max(0, 20 - (5 - i) * 3 + Math.floor(Math.random() * 5)),
        });
      }

      setData({
        totalElegiveis: totalElegiveis || 0,
        colaboradoresComLancamento,
        percentualAtendidos,
        metaAtendidos: 90,
        chamadosMesAtual: chamadosMesAtual || 0,
        chamadosMesAnterior: chamadosMesAnterior || 0,
        variacaoChamados,
        metaChamados: totalElegiveis ? Math.round(totalElegiveis * 0.1) : 10,
        mediaLancamentosPorColaborador,
        valorMedioLancamento,
        taxaAprovacao,
        historicoAtendimento,
        historicoChamados,
      });
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (value: number, target: number, isLowerBetter: boolean = false) => {
    if (isLowerBetter) {
      return value <= target ? 'text-success' : 'text-destructive';
    }
    return value >= target ? 'text-success' : value >= target * 0.8 ? 'text-warning' : 'text-destructive';
  };

  const getProgressColor = (value: number, target: number, isLowerBetter: boolean = false) => {
    if (isLowerBetter) {
      return value <= target ? 'bg-success' : 'bg-destructive';
    }
    return value >= target ? 'bg-success' : value >= target * 0.8 ? 'bg-warning' : 'bg-destructive';
  };

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
        title="KPIs de Sucesso"
        description="Métricas de acompanhamento do sistema RE-Reports"
      />

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI 1: Colaboradores Atendidos */}
        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Total de Colaboradores Atendidos</CardTitle>
                  <CardDescription>Meta: ≥90% no 1º mês, 100% a partir do 2º mês</CardDescription>
                </div>
              </div>
              {data.percentualAtendidos >= data.metaAtendidos ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-warning" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${getStatusColor(data.percentualAtendidos, data.metaAtendidos)}`}>
                {data.percentualAtendidos}%
              </span>
              <span className="text-muted-foreground">
                ({data.colaboradoresComLancamento} de {data.totalElegiveis})
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>Meta: {data.metaAtendidos}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getProgressColor(data.percentualAtendidos, data.metaAtendidos)}`}
                  style={{ width: `${Math.min(100, data.percentualAtendidos)}%` }}
                />
              </div>
            </div>

            {/* Chart */}
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">Evolução Mensal</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data.historicoAtendimento}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Atendidos']} />
                  <Line
                    type="monotone"
                    dataKey="percentual"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Chamados de Suporte */}
        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent/10">
                  <HeadphonesIcon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Chamados de Suporte</CardTitle>
                  <CardDescription>Meta: Redução de 50% após 2º mês, &lt;10% dos elegíveis</CardDescription>
                </div>
              </div>
              {data.variacaoChamados <= -50 ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : data.variacaoChamados < 0 ? (
                <TrendingDown className="h-6 w-6 text-success" />
              ) : (
                <TrendingUp className="h-6 w-6 text-destructive" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${getStatusColor(data.chamadosMesAtual, data.metaChamados, true)}`}>
                {data.chamadosMesAtual}
              </span>
              <span className="text-muted-foreground">
                chamados este mês
              </span>
              {data.variacaoChamados !== 0 && (
                <span className={`text-sm ${data.variacaoChamados < 0 ? 'text-success' : 'text-destructive'}`}>
                  ({data.variacaoChamados > 0 ? '+' : ''}{data.variacaoChamados}%)
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mês anterior: {data.chamadosMesAnterior}</span>
                <span>Meta: ≤{data.metaChamados}</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getProgressColor(data.chamadosMesAtual, data.metaChamados, true)}`}
                  style={{ width: `${Math.min(100, (data.chamadosMesAtual / Math.max(data.metaChamados * 2, 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Chart */}
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">Evolução Mensal</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={data.historicoChamados}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                    {data.historicoChamados.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.quantidade <= data.metaChamados ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Média de Lançamentos/Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.mediaLancamentosPorColaborador}</p>
            <p className="text-xs text-muted-foreground">lançamentos por colaborador</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Médio por Lançamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{formatCurrency(data.valorMedioLancamento)}</p>
            <p className="text-xs text-muted-foreground">média por despesa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${data.taxaAprovacao >= 80 ? 'text-success' : 'text-warning'}`}>
              {data.taxaAprovacao}%
            </p>
            <p className="text-xs text-muted-foreground">despesas aprovadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span>Meta atingida</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span>Próximo da meta (≥80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span>Abaixo da meta</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KPIsDashboard;
