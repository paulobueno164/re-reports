import { Users, Receipt, Clock, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  mockDashboardSummary,
  mockExpenses,
  mockCalendarPeriods,
  formatCurrency,
  formatDate,
} from '@/lib/mock-data';
import { Expense } from '@/types';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const summary = mockDashboardSummary;
  const recentExpenses = mockExpenses.slice(0, 5);
  const currentPeriod = mockCalendarPeriods.find((p) => p.status === 'aberto');

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

  const utilizationPercentage = 72;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`Período atual: ${summary.periodoAtual}`}
      >
        <Button asChild>
          <Link to="/lancamentos/novo">Novo Lançamento</Link>
        </Button>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Colaboradores Elegíveis"
          value={summary.totalColaboradoresElegiveis}
          description="Cadastrados no sistema"
          icon={Users}
        />
        <StatCard
          title="Lançamentos no Mês"
          value={summary.totalLancamentosMes}
          description={formatCurrency(summary.valorTotalMes)}
          icon={Receipt}
          variant="primary"
        />
        <StatCard
          title="Pendentes de Validação"
          value={summary.pendentesValidacao}
          description="Aguardando análise do RH"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Dias Restantes"
          value={summary.diasRestantes}
          description="Para fechamento do período"
          icon={Clock}
          variant="accent"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Expenses */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">
                Últimos Lançamentos
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/lancamentos">Ver Todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                data={recentExpenses}
                columns={expenseColumns}
                className="border-0 rounded-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-4">
          {/* Period Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Período Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Período</span>
                  <span className="font-medium">{currentPeriod?.periodo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Janela de Lançamento</span>
                  <span className="font-medium">
                    {currentPeriod && formatDate(currentPeriod.abreLancamento)} -{' '}
                    {currentPeriod && formatDate(currentPeriod.fechaLancamento)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={currentPeriod?.status || 'aberto'} />
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/calendario">Gerenciar Calendário</Link>
              </Button>
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
                  <span className="font-medium">{utilizationPercentage}%</span>
                </div>
                <Progress value={utilizationPercentage} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(28750)}</p>
                  <p className="text-xs text-muted-foreground">Utilizado</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(11250)}</p>
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
                  Validar Despesas ({summary.pendentesValidacao})
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
