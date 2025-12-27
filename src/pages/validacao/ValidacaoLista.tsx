import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Eye, AlertCircle, Loader2, Filter, Clock, Send, MoreVertical } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { BatchApprovalPanel } from '@/components/validation/BatchApprovalPanel';
import { useNameInconsistency } from '@/hooks/use-name-inconsistency';
import { NameInconsistencyAlert } from '@/components/ui/name-inconsistency-alert';
import lancamentosService, { Lancamento } from '@/services/lancamentos.service';
import { colaboradoresService } from '@/services/colaboradores.service';

interface Expense {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  tipoDespesaNome: string;
  departamento: string;
  origem: string;
  valorLancado: number;
  valorConsiderado: number;
  valorNaoConsiderado: number;
  descricaoFatoGerador: string;
  status: string;
  createdAt: Date;
  motivoInvalidacao?: string;
  tempoEmAnalise?: string;
  horasEmAnalise?: number;
}

const originLabels: Record<string, string> = {
  proprio: 'Próprio',
  conjuge: 'Cônjuge',
  filhos: 'Filhos',
};

const ValidacaoLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasInconsistency, getDisplayName } = useNameInconsistency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Advanced filters
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterValueMin, setFilterValueMin] = useState('');
  const [filterValueMax, setFilterValueMax] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const [stats, setStats] = useState({ enviado: 0, emAnalise: 0, approvedToday: 0, rejectedToday: 0, slaViolations: 0 });

  useEffect(() => {
    fetchExpenses();
    fetchDepartments();
  }, [filterStatus]);

  const fetchDepartments = async () => {
    try {
      const depts = await colaboradoresService.getDepartamentos();
      setDepartments(depts);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let statusFilter: 'enviado' | 'em_analise' | undefined;
      if (filterStatus === 'enviado') statusFilter = 'enviado';
      else if (filterStatus === 'em_analise') statusFilter = 'em_analise';

      const data = await lancamentosService.getAll({ status: statusFilter });
      
      // Filter pending if needed
      let filtered = data;
      if (filterStatus === 'pending') {
        filtered = data.filter(l => l.status === 'enviado' || l.status === 'em_analise');
      }

      const now = new Date();
      const mapped: Expense[] = filtered.map((e) => {
        const createdAt = new Date(e.created_at);
        const diffMs = now.getTime() - createdAt.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const remainingHours = diffHours % 24;
        
        let tempoEmAnalise = '';
        if (diffDays > 0) {
          tempoEmAnalise = `${diffDays}d ${remainingHours}h`;
        } else {
          tempoEmAnalise = `${diffHours}h`;
        }

        return {
          id: e.id,
          colaboradorId: e.colaborador?.id || e.colaborador_id || '',
          colaboradorNome: e.colaborador?.nome || '',
          tipoDespesaNome: e.tipo_despesa?.nome || '',
          departamento: e.colaborador?.departamento || '',
          origem: e.origem,
          valorLancado: Number(e.valor_lancado),
          valorConsiderado: Number(e.valor_considerado),
          valorNaoConsiderado: Number(e.valor_nao_considerado),
          descricaoFatoGerador: e.descricao_fato_gerador,
          status: e.status,
          createdAt,
          motivoInvalidacao: e.motivo_invalidacao || undefined,
          tempoEmAnalise,
          horasEmAnalise: diffHours,
        };
      });
      
      mapped.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      setExpenses(mapped);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const pendingItems = mapped.filter((e) => e.status === 'enviado' || e.status === 'em_analise');
      const slaViolations = pendingItems.filter((e) => (e.horasEmAnalise || 0) > 48).length;
      
      setStats({
        enviado: mapped.filter((e) => e.status === 'enviado').length,
        emAnalise: mapped.filter((e) => e.status === 'em_analise').length,
        approvedToday: mapped.filter((e) => e.status === 'valido' && new Date(e.createdAt) >= today).length,
        rejectedToday: mapped.filter((e) => e.status === 'invalido' && new Date(e.createdAt) >= today).length,
        slaViolations,
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      exp.colaboradorNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.tipoDespesaNome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDepartment === 'all' || exp.departamento === filterDepartment;
    const matchesDateStart = !filterDateStart || exp.createdAt >= new Date(filterDateStart);
    const matchesDateEnd = !filterDateEnd || exp.createdAt <= new Date(filterDateEnd + 'T23:59:59');
    const matchesValueMin = !filterValueMin || exp.valorLancado >= Number(filterValueMin);
    const matchesValueMax = !filterValueMax || exp.valorLancado <= Number(filterValueMax);
    return matchesSearch && matchesDept && matchesDateStart && matchesDateEnd && matchesValueMin && matchesValueMax;
  });

  const handleSelectionChange = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const getTempoColor = (hours: number) => {
    if (hours > 72) return 'text-destructive font-semibold animate-pulse';
    if (hours > 48) return 'text-destructive';
    if (hours > 24) return 'text-warning';
    return 'text-success';
  };

  const handleStartAnalysis = async (expense: Expense) => {
    setProcessing(true);
    try {
      await lancamentosService.iniciarAnalise(expense.id);
      toast({ title: 'Análise iniciada', description: `Lançamento de ${expense.colaboradorNome} está em análise.` });
      fetchExpenses();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (expense: Expense) => {
    setProcessing(true);
    try {
      await lancamentosService.aprovar(expense.id);
      toast({ title: 'Despesa aprovada', description: `Lançamento de ${expense.colaboradorNome} foi marcado como válido.` });
      fetchExpenses();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const columns = [
    {
      key: 'select',
      header: '',
      className: 'w-8 sm:w-10',
      render: (item: Expense) =>
        (item.status === 'enviado' || item.status === 'em_analise') ? (
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onCheckedChange={(checked) => handleSelectionChange(item.id, !!checked)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null,
    },
    {
      key: 'createdAt',
      header: 'Data',
      hideOnMobile: true,
      render: (item: Expense) => formatDate(item.createdAt),
    },
    {
      key: 'tempoEmAnalise',
      header: 'Tempo',
      hideOnMobile: true,
      render: (item: Expense) => (
        (item.status === 'enviado' || item.status === 'em_analise') ? (
          <span className={getTempoColor(item.horasEmAnalise || 0)}>
            {item.tempoEmAnalise}
          </span>
        ) : null
      ),
    },
    { 
      key: 'colaboradorNome', 
      header: 'Colaborador',
      render: (item: Expense) => {
        const inconsistency = hasInconsistency(item.colaboradorId);
        const displayName = getDisplayName(item.colaboradorId, item.colaboradorNome, true);
        return (
          <span className="inline-flex items-center gap-1">
            <span className="truncate max-w-[100px] sm:max-w-none">{displayName}</span>
            {inconsistency && (
              <NameInconsistencyAlert 
                colaboradorNome={inconsistency.colaboradorNome} 
                profileNome={inconsistency.profileNome} 
              />
            )}
          </span>
        );
      },
    },
    { key: 'tipoDespesaNome', header: 'Tipo', hideOnMobile: true },
    {
      key: 'origem',
      header: 'Origem',
      hideOnMobile: true,
      render: (item: Expense) => originLabels[item.origem] || item.origem,
    },
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
      key: 'actions',
      header: 'Ações',
      className: 'text-right',
      render: (item: Expense) => (
        <>
          {/* Mobile dropdown */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/validacao/${item.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </DropdownMenuItem>
                {item.status === 'enviado' && (
                  <DropdownMenuItem onClick={() => handleStartAnalysis(item)}>
                    <Clock className="mr-2 h-4 w-4 text-warning" />
                    Iniciar Análise
                  </DropdownMenuItem>
                )}
                {(item.status === 'enviado' || item.status === 'em_analise') && (
                  <DropdownMenuItem onClick={() => handleApprove(item)}>
                    <CheckCircle className="mr-2 h-4 w-4 text-success" />
                    Aprovar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop buttons */}
          <div className="hidden sm:flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/validacao/${item.id}`)}>
              <Eye className="h-4 w-4" />
            </Button>
            {(item.status === 'enviado' || item.status === 'em_analise') && (
              <>
                {item.status === 'enviado' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-warning hover:text-warning"
                    onClick={() => handleStartAnalysis(item)}
                    title="Iniciar Análise"
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-success hover:text-success"
                  onClick={() => handleApprove(item)}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </>
      ),
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
      <PageHeader
        title="Validação de Despesas"
        description="Analise e valide os lançamentos de despesas dos colaboradores"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-warning/5 border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors" onClick={() => setFilterStatus('enviado')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Send className="h-4 w-4 text-warning" />
              Aguardando Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{stats.enviado}</p>
            <p className="text-xs text-muted-foreground">novos lançamentos</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20 cursor-pointer hover:bg-blue-500/10 transition-colors" onClick={() => setFilterStatus('em_analise')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Em Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">{stats.emAnalise}</p>
            <p className="text-xs text-muted-foreground">sendo analisados</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilterStatus('all')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Aprovados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{stats.approvedToday}</p>
            <p className="text-xs text-muted-foreground">despesas validadas</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilterStatus('all')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Rejeitados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{stats.rejectedToday}</p>
            <p className="text-xs text-muted-foreground">despesas rejeitadas</p>
          </CardContent>
        </Card>
      </div>

      {/* SLA Violation Warning */}
      {stats.slaViolations > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção: SLA Violado</AlertTitle>
          <AlertDescription>
            {stats.slaViolations} despesa(s) estão aguardando análise há mais de 48 horas.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por colaborador ou tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="enviado">Aguardando</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={showFilters}>
        <CollapsibleContent>
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Mínimo</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={filterValueMin}
                  onChange={(e) => setFilterValueMin(e.target.value)}
                />
              </div>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Batch Approval Panel */}
      <BatchApprovalPanel
        expenses={filteredExpenses}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onComplete={fetchExpenses}
      />

      {/* Data Table */}
      <DataTable
        data={filteredExpenses}
        columns={columns}
        emptyMessage="Nenhuma despesa encontrada"
      />
    </div>
  );
};

export default ValidacaoLista;
