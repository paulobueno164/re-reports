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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { BatchApprovalPanel } from '@/components/validation/BatchApprovalPanel';
import { createAuditLog } from '@/lib/audit-log';
import { useNameInconsistency } from '@/hooks/use-name-inconsistency';
import { NameInconsistencyAlert } from '@/components/ui/name-inconsistency-alert';

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
    const { data } = await supabase.from('colaboradores_elegiveis').select('departamento');
    if (data) setDepartments([...new Set(data.map((d) => d.departamento))]);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    let query = supabase
      .from('lancamentos')
      .select(`
        id, origem, valor_lancado, valor_considerado, valor_nao_considerado,
        descricao_fato_gerador, status, created_at, motivo_invalidacao, colaborador_id,
        colaboradores_elegiveis (id, nome, departamento),
        tipos_despesas (nome)
      `)
      .order('created_at', { ascending: false });

    if (filterStatus === 'pending') query = query.in('status', ['enviado', 'em_analise']);
    else if (filterStatus === 'enviado') query = query.eq('status', 'enviado');
    else if (filterStatus === 'em_analise') query = query.eq('status', 'em_analise');

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (data) {
      const now = new Date();
      const mapped = data.map((e: any) => {
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
          colaboradorId: e.colaboradores_elegiveis?.id || e.colaborador_id || '',
          colaboradorNome: e.colaboradores_elegiveis?.nome || '',
          tipoDespesaNome: e.tipos_despesas?.nome || '',
          departamento: e.colaboradores_elegiveis?.departamento || '',
          origem: e.origem,
          valorLancado: Number(e.valor_lancado),
          valorConsiderado: Number(e.valor_considerado),
          valorNaoConsiderado: Number(e.valor_nao_considerado),
          descricaoFatoGerador: e.descricao_fato_gerador,
          status: e.status,
          createdAt,
          motivoInvalidacao: e.motivo_invalidacao,
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
    }
    setLoading(false);
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
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'em_analise' })
      .eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user?.id).maybeSingle();
      await createAuditLog({
        userId: user?.id || '',
        userName: profile?.nome || user?.email || '',
        action: 'iniciar_analise',
        entityType: 'lancamento',
        entityId: expense.id,
        entityDescription: `${expense.colaboradorNome} - ${expense.tipoDespesaNome} - ${formatCurrency(expense.valorLancado)}`,
        oldValues: { status: expense.status },
        newValues: { status: 'em_analise' },
      });
      toast({ title: 'Análise iniciada', description: `Lançamento de ${expense.colaboradorNome} está em análise.` });
      fetchExpenses();
    }
    setProcessing(false);
  };

  const handleApprove = async (expense: Expense) => {
    setProcessing(true);
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'valido', validado_por: user?.id, validado_em: new Date().toISOString() })
      .eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user?.id).maybeSingle();
      await createAuditLog({
        userId: user?.id || '',
        userName: profile?.nome || user?.email || '',
        action: 'aprovar',
        entityType: 'lancamento',
        entityId: expense.id,
        entityDescription: `${expense.colaboradorNome} - ${expense.tipoDespesaNome} - ${formatCurrency(expense.valorLancado)}`,
        oldValues: { status: expense.status },
        newValues: { status: 'valido' },
      });
      toast({ title: 'Despesa aprovada', description: `Lançamento de ${expense.colaboradorNome} foi marcado como válido.` });
      fetchExpenses();
    }
    setProcessing(false);
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
            <p className="text-xs text-muted-foreground">despesas invalidadas</p>
          </CardContent>
        </Card>
      </div>

      {/* SLA Alert */}
      {stats.slaViolations > 0 && (
        <Alert variant="destructive" className="animate-pulse">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Alerta de SLA</AlertTitle>
          <AlertDescription>
            {stats.slaViolations} despesa(s) estão há mais de 48h sem validação. Priorize a análise desses itens.
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-row gap-4 items-end flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[200px] max-w-md">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por colaborador ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Todos Pendentes</SelectItem>
                <SelectItem value="enviado">Aguardando Análise</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground invisible">Ação</Label>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-10">
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filtros Avançados</span>
            </Button>
          </div>
        </div>

        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent>
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  <div className="space-y-2">
                    <Label>Valor Máximo</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={filterValueMax}
                      onChange={(e) => setFilterValueMax(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="ghost" onClick={() => {
                    setFilterDepartment('all');
                    setFilterDateStart('');
                    setFilterDateEnd('');
                    setFilterValueMin('');
                    setFilterValueMax('');
                  }}>
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Batch Approval Panel */}
      <BatchApprovalPanel
        expenses={filteredExpenses}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onComplete={() => {
          setSelectedIds([]);
          fetchExpenses();
        }}
      />

      {/* Table */}
      <DataTable
        data={filteredExpenses}
        columns={columns}
        emptyMessage="Nenhum lançamento pendente de validação"
      />
    </div>
  );
};

export default ValidacaoLista;
