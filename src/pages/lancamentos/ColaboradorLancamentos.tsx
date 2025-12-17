import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Trash2, Loader2, Lock, MoreVertical, Calendar, Filter, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, validarPeriodoLancamento, verificarBloqueioAposLimite } from '@/lib/expense-validation';
import { exportColaboradorExpenses } from '@/lib/excel-export';

interface Expense {
  id: string;
  periodoId: string;
  periodo: string;
  tipoDespesaId: string;
  tipoDespesaNome: string;
  origem: string;
  valorLancado: number;
  valorConsiderado: number;
  valorNaoConsiderado: number;
  descricaoFatoGerador: string;
  status: string;
  motivoInvalidacao: string | null;
  createdAt: Date;
}

type StatusFilter = 'todos' | 'pendentes' | 'rascunho' | 'valido' | 'invalido';

interface CalendarPeriod {
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
  userId: string | null;
}

const ColaboradorLancamentos = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(searchParams.get('periodo') || '');
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [loading, setLoading] = useState(true);
  const [totalUsado, setTotalUsado] = useState(0);
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);
  const [percentualUsado, setPercentualUsado] = useState(0);
  const [bloqueadoPorUltimoLancamento, setBloqueadoPorUltimoLancamento] = useState(false);
  const [periodoValidation, setPeriodoValidation] = useState<{
    permitido: boolean;
    periodoDestino: 'atual' | 'proximo' | 'bloqueado';
    periodoDestinoId?: string;
    mensagem: string;
  } | null>(null);

  // Batch approval states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [batchRejectionReason, setBatchRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const isOwnProfile = colaborador?.userId === user?.id;
  const canEdit = hasRole('RH') || hasRole('FINANCEIRO') || isOwnProfile;
  const isRHorFinanceiro = hasRole('RH') || hasRole('FINANCEIRO');
  
  // Pending expenses for batch operations
  const pendingExpenses = useMemo(() => 
    expenses.filter(e => e.status === 'enviado' || e.status === 'em_analise'),
    [expenses]
  );
  
  // Count pending validation items
  const pendingValidation = pendingExpenses.length;

  // Status counts
  const statusCounts = useMemo(() => ({
    rascunho: expenses.filter(e => e.status === 'rascunho').length,
    enviado: expenses.filter(e => e.status === 'enviado').length,
    em_analise: expenses.filter(e => e.status === 'em_analise').length,
    valido: expenses.filter(e => e.status === 'valido').length,
    invalido: expenses.filter(e => e.status === 'invalido').length,
  }), [expenses]);

  // Export function
  const handleExportExcel = () => {
    if (!colaborador || !selectedPeriod || expenses.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    const origemLabels: Record<string, string> = { proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' };
    
    exportColaboradorExpenses({
      colaborador: {
        nome: colaborador.nome,
        matricula: colaborador.matricula,
        departamento: colaborador.departamento,
      },
      periodo: selectedPeriod.periodo,
      expenses: expenses.map(e => ({
        data: formatDate(e.createdAt),
        tipoDespesa: e.tipoDespesaNome,
        origem: origemLabels[e.origem] || e.origem,
        valorLancado: e.valorLancado,
        valorConsiderado: e.valorConsiderado,
        valorNaoConsiderado: e.valorNaoConsiderado,
        status: e.status,
        descricao: e.descricaoFatoGerador,
      })),
      totais: {
        total: expenses.reduce((sum, e) => sum + e.valorLancado, 0),
        totalConsiderado: totalUsado,
        cestaTeto: colaborador.cestaBeneficiosTeto,
      },
      statusCounts,
    });

    toast({ title: 'Exportação concluída', description: 'Arquivo Excel gerado com sucesso.' });
  };

  // Get current and next period for validation
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
  const nextPeriod = periods.find((p, idx) => {
    if (!selectedPeriod) return false;
    const currentIdx = periods.findIndex(pp => pp.id === selectedPeriod.id);
    return currentIdx >= 0 && idx === currentIdx - 1 && p.status === 'aberto';
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchExpenses();
      // Update URL param
      setSearchParams({ periodo: selectedPeriodId });
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriod) {
      const validation = validarPeriodoLancamento(
        new Date(),
        {
          id: selectedPeriod.id,
          periodo: selectedPeriod.periodo,
          abreLancamento: selectedPeriod.abreLancamento,
          fechaLancamento: selectedPeriod.fechaLancamento,
          status: selectedPeriod.status,
        },
        nextPeriod ? {
          id: nextPeriod.id,
          periodo: nextPeriod.periodo,
          abreLancamento: nextPeriod.abreLancamento,
          fechaLancamento: nextPeriod.fechaLancamento,
          status: nextPeriod.status,
        } : null
      );
      setPeriodoValidation(validation);
      
      // Debug log
      console.log('DEBUG Validacao Periodo:', {
        selectedPeriod: selectedPeriod.periodo,
        status: selectedPeriod.status,
        abreLancamento: selectedPeriod.abreLancamento,
        fechaLancamento: selectedPeriod.fechaLancamento,
        dataAtual: new Date(),
        validation,
        colaboradorUserId: colaborador?.userId,
        userId: user?.id,
        isOwnProfile: colaborador?.userId === user?.id,
      });
    }
  }, [selectedPeriod, nextPeriod, colaborador, user]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    // Fetch collaborator data
    const { data: colabData, error: colabError } = await supabase
      .from('colaboradores_elegiveis')
      .select('id, nome, matricula, departamento, cesta_beneficios_teto, user_id')
      .eq('id', id)
      .single();

    if (colabError || !colabData) {
      toast({ title: 'Erro', description: 'Colaborador não encontrado', variant: 'destructive' });
      navigate('/lancamentos');
      return;
    }

    setColaborador({
      id: colabData.id,
      nome: colabData.nome,
      matricula: colabData.matricula,
      departamento: colabData.departamento,
      cestaBeneficiosTeto: Number(colabData.cesta_beneficios_teto),
      userId: colabData.user_id,
    });

    // Fetch periods
    const { data: periodsData } = await supabase
      .from('calendario_periodos')
      .select('id, periodo, status, abre_lancamento, fecha_lancamento')
      .order('periodo', { ascending: false });

    if (periodsData) {
      const mapped = periodsData.map(p => ({
        id: p.id,
        periodo: p.periodo,
        status: p.status,
        abreLancamento: new Date(p.abre_lancamento),
        fechaLancamento: new Date(p.fecha_lancamento),
      }));
      setPeriods(mapped);
      
      // Set default period if not already set
      if (!selectedPeriodId && mapped.length > 0) {
        const urlPeriod = searchParams.get('periodo');
        if (urlPeriod && mapped.some(p => p.id === urlPeriod)) {
          setSelectedPeriodId(urlPeriod);
        } else {
          // Default to current open period
          const current = mapped.find(p => p.status === 'aberto') || mapped[0];
          setSelectedPeriodId(current.id);
        }
      }
    }

    setLoading(false);
  };

  const fetchExpenses = async () => {
    if (!id || !selectedPeriodId) return;

    const { data: expensesData, error } = await supabase
      .from('lancamentos')
      .select(`
        id, origem, valor_lancado, valor_considerado, valor_nao_considerado,
        descricao_fato_gerador, status, motivo_invalidacao, created_at,
        calendario_periodos (id, periodo),
        tipos_despesas (id, nome)
      `)
      .eq('colaborador_id', id)
      .eq('periodo_id', selectedPeriodId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar lançamentos', variant: 'destructive' });
      return;
    }

    if (expensesData) {
      const mapped = expensesData.map((e: any) => ({
        id: e.id,
        periodoId: e.calendario_periodos?.id,
        periodo: e.calendario_periodos?.periodo || '',
        tipoDespesaId: e.tipos_despesas?.id,
        tipoDespesaNome: e.tipos_despesas?.nome || '',
        origem: e.origem,
        valorLancado: Number(e.valor_lancado),
        valorConsiderado: Number(e.valor_considerado),
        valorNaoConsiderado: Number(e.valor_nao_considerado),
        descricaoFatoGerador: e.descricao_fato_gerador,
        status: e.status,
        motivoInvalidacao: e.motivo_invalidacao,
        createdAt: new Date(e.created_at),
      }));

      setExpenses(mapped);

      // Calculate totals
      if (colaborador) {
        const usado = mapped.reduce((sum, e) => sum + e.valorConsiderado, 0);
        setTotalUsado(usado);
        setSaldoDisponivel(colaborador.cestaBeneficiosTeto - usado);
        setPercentualUsado((usado / colaborador.cestaBeneficiosTeto) * 100);

        const bloqueio = verificarBloqueioAposLimite(
          mapped.map(e => ({ valorNaoConsiderado: e.valorNaoConsiderado }))
        );
        setBloqueadoPorUltimoLancamento(bloqueio.bloqueado);
      }
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;

    const { error } = await supabase.from('lancamentos').delete().eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Lançamento excluído.' });
      fetchExpenses();
    }
  };

  const handleNew = () => {
    if (periodoValidation && !periodoValidation.permitido) {
      toast({ title: 'Período não disponível', description: periodoValidation.mensagem, variant: 'destructive' });
      return;
    }
    if (bloqueadoPorUltimoLancamento) {
      toast({ title: 'Limite atingido', description: 'Já foi feito um lançamento que ultrapassou o limite.', variant: 'destructive' });
      return;
    }
    if (saldoDisponivel <= 0) {
      toast({ title: 'Limite atingido', description: 'Limite da Cesta de Benefícios atingido.', variant: 'destructive' });
      return;
    }
    navigate('/lancamentos/novo');
  };

  // Batch approval handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pendingExpenses.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;

    setProcessing(true);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lancamentos')
      .update({
        status: 'valido',
        validado_por: user?.id,
        validado_em: now,
      })
      .in('id', selectedIds);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Aprovação em lote concluída',
        description: `${selectedIds.length} despesa(s) foram aprovadas com sucesso.`,
      });
      setSelectedIds([]);
      fetchExpenses();
    }
    setProcessing(false);
    setShowApproveDialog(false);
  };

  const handleBatchReject = async () => {
    if (selectedIds.length === 0 || !batchRejectionReason.trim()) return;

    setProcessing(true);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lancamentos')
      .update({
        status: 'invalido',
        motivo_invalidacao: batchRejectionReason,
        validado_por: user?.id,
        validado_em: now,
      })
      .in('id', selectedIds);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Rejeição em lote concluída',
        description: `${selectedIds.length} despesa(s) foram rejeitadas.`,
      });
      setSelectedIds([]);
      setBatchRejectionReason('');
      fetchExpenses();
    }
    setProcessing(false);
    setShowRejectDialog(false);
  };

  const selectedTotal = useMemo(() => 
    pendingExpenses.filter(e => selectedIds.includes(e.id)).reduce((sum, e) => sum + e.valorLancado, 0),
    [pendingExpenses, selectedIds]
  );

  // Filtered expenses with status filter
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch = exp.tipoDespesaNome?.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = true;
      
      switch (statusFilter) {
        case 'pendentes':
          matchesStatus = exp.status === 'enviado' || exp.status === 'em_analise';
          break;
        case 'rascunho':
          matchesStatus = exp.status === 'rascunho';
          break;
        case 'valido':
          matchesStatus = exp.status === 'valido';
          break;
        case 'invalido':
          matchesStatus = exp.status === 'invalido';
          break;
        default:
          matchesStatus = true;
      }
      
      return matchesSearch && matchesStatus;
    });
  }, [expenses, searchTerm, statusFilter]);

  const columns = [
    // Checkbox column for RH/FINANCEIRO batch selection (only for pending items)
    ...(isRHorFinanceiro && pendingExpenses.length > 0 ? [{
      key: 'select',
      header: (
        <Checkbox
          checked={selectedIds.length === pendingExpenses.length && pendingExpenses.length > 0}
          onCheckedChange={(checked) => handleSelectAll(!!checked)}
          aria-label="Selecionar todos"
        />
      ),
      className: 'w-[40px]',
      render: (item: Expense) => {
        const isPending = item.status === 'enviado' || item.status === 'em_analise';
        if (!isPending) return null;
        return (
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onCheckedChange={() => handleToggleSelect(item.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Selecionar ${item.tipoDespesaNome}`}
          />
        );
      },
    }] : []),
    { key: 'createdAt', header: 'Data', hideOnMobile: true, render: (item: Expense) => formatDate(item.createdAt) },
    { key: 'tipoDespesaNome', header: 'Tipo de Despesa' },
    { key: 'origem', header: 'Origem', hideOnMobile: true, render: (item: Expense) => ({ proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' }[item.origem] || item.origem) },
    { key: 'valorLancado', header: 'Valor', className: 'text-right font-mono', render: (item: Expense) => formatCurrency(item.valorLancado) },
    { key: 'valorConsiderado', header: 'Considerado', hideOnMobile: true, className: 'text-right font-mono', render: (item: Expense) => <span className={item.valorNaoConsiderado > 0 ? 'text-warning' : ''}>{formatCurrency(item.valorConsiderado)}</span> },
    { key: 'status', header: 'Status', render: (item: Expense) => <StatusBadge status={item.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-[100px]',
      render: (item: Expense) => (
        <div className="flex justify-end gap-1">
          <div className="hidden sm:flex gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(`/lancamentos/${item.id}`)}>
              <Eye className="h-4 w-4" />
            </Button>
            {item.status === 'rascunho' && canEdit && (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(`/lancamentos/${item.id}/editar`)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDelete(item)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/lancamentos/${item.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </DropdownMenuItem>
                {item.status === 'rascunho' && canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => navigate(`/lancamentos/${item.id}/editar`)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ];

  const canCreateNew = canEdit && periodoValidation?.permitido && !bloqueadoPorUltimoLancamento && saldoDisponivel > 0;

  // Debug no momento da renderização
  console.log('DEBUG RENDER:', {
    canEdit,
    isOwnProfile,
    selectedPeriodStatus: selectedPeriod?.status,
    showButton: canEdit && selectedPeriod?.status === 'aberto',
    canCreateNew,
    saldoDisponivel,
    bloqueadoPorUltimoLancamento,
    periodoPermitido: periodoValidation?.permitido,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageFormLayout
      title={colaborador?.nome || 'Lançamentos'}
      description={`${colaborador?.matricula} • ${colaborador?.departamento}`}
      backTo="/lancamentos"
      extraActions={
        canEdit && selectedPeriod?.status === 'aberto' ? (
          <Button onClick={handleNew} disabled={!canCreateNew} size="sm">
            {!canCreateNew && bloqueadoPorUltimoLancamento ? <Lock className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            <span className="hidden sm:inline">Novo Lançamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 sm:max-w-[250px]">
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger>
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periods.map(period => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.periodo} {period.status === 'aberto' ? '(Aberto)' : '(Fechado)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Alerts */}
        {periodoValidation && !periodoValidation.permitido && selectedPeriod?.status === 'aberto' && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Período Bloqueado</AlertTitle>
            <AlertDescription>{periodoValidation.mensagem}</AlertDescription>
          </Alert>
        )}

        {bloqueadoPorUltimoLancamento && selectedPeriod?.status === 'aberto' && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Lançamentos Bloqueados</AlertTitle>
            <AlertDescription>Já foi feito um lançamento que ultrapassou o limite. Não é possível fazer novos lançamentos neste período.</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        {colaborador && (
          <div className="space-y-4">
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${isRHorFinanceiro ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3 sm:gap-4`}>
              <Card className={bloqueadoPorUltimoLancamento ? 'border-destructive/50' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Cesta de Benefícios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span>Utilizado</span>
                      <span className="font-mono font-medium">{formatCurrency(totalUsado)}</span>
                    </div>
                    <Progress value={Math.min(percentualUsado, 100)} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Saldo: {formatCurrency(saldoDisponivel)}</span>
                      <span>Teto: {formatCurrency(colaborador.cestaBeneficiosTeto)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Lançamentos no Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl sm:text-2xl font-bold">{expenses.length}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    {statusCounts.rascunho > 0 && <span>{statusCounts.rascunho} rascunho</span>}
                    {statusCounts.enviado > 0 && <span className="text-warning">{statusCounts.enviado} enviado</span>}
                    {statusCounts.em_analise > 0 && <span className="text-warning">{statusCounts.em_analise} análise</span>}
                    {statusCounts.valido > 0 && <span className="text-success">{statusCounts.valido} válido</span>}
                    {statusCounts.invalido > 0 && <span className="text-destructive">{statusCounts.invalido} inválido</span>}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Validation Card - RH/FINANCEIRO only */}
              {isRHorFinanceiro && (
                <Card className={pendingValidation > 0 ? 'border-warning/50' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pendentes de Validação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl sm:text-2xl font-bold ${pendingValidation > 0 ? 'text-warning' : ''}`}>
                      {pendingValidation}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statusCounts.enviado} enviado • {statusCounts.em_analise} em análise
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className={isRHorFinanceiro ? '' : 'sm:col-span-2 md:col-span-1'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Período Selecionado</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-lg font-semibold">{selectedPeriod?.periodo}</p>
                  <p className={`text-xs ${selectedPeriod?.status === 'aberto' ? 'text-success' : 'text-muted-foreground'}`}>
                    {selectedPeriod?.status === 'aberto' ? 'Período aberto' : 'Período fechado'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Export Button */}
            {expenses.length > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Search and Status Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar por tipo de despesa..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-9" 
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="rascunho">Rascunhos</SelectItem>
              <SelectItem value="valido">Válidos</SelectItem>
              <SelectItem value="invalido">Inválidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Batch Approval Controls - RH/FINANCEIRO */}
        {isRHorFinanceiro && selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedIds.length}</span> selecionado(s)
              {' • '}
              Total: <span className="font-mono font-medium text-foreground">{formatCurrency(selectedTotal)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowRejectDialog(true)}
                disabled={processing}
              >
                <XCircle className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Rejeitar</span>
              </Button>
              <Button
                size="sm"
                className="bg-success hover:bg-success/90"
                onClick={() => setShowApproveDialog(true)}
                disabled={processing}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Aprovar</span>
              </Button>
            </div>
          </div>
        )}

        {/* Expenses Table */}
        <DataTable 
          data={filteredExpenses} 
          columns={columns} 
          emptyMessage="Nenhum lançamento encontrado neste período" 
        />
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Confirmar Aprovação em Lote
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Você está prestes a aprovar <strong>{selectedIds.length} despesa(s)</strong> totalizando:</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(selectedTotal)}</p>
              <p className="text-sm">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchApprove}
              disabled={processing}
              className="bg-success hover:bg-success/90"
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Rejeitar Despesas em Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4 mt-2">
                <p>
                  Você está prestes a rejeitar <strong>{selectedIds.length} despesa(s)</strong>.
                  Informe o motivo da rejeição que será aplicado a todas:
                </p>
                <div className="space-y-2">
                  <Label>Motivo da Rejeição</Label>
                  <Textarea
                    value={batchRejectionReason}
                    onChange={(e) => setBatchRejectionReason(e.target.value)}
                    placeholder="Descreva o motivo da rejeição em lote..."
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchReject}
              disabled={processing || !batchRejectionReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFormLayout>
  );
};

export default ColaboradorLancamentos;
