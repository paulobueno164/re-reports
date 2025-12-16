import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Trash2, Loader2, Lock, AlertCircle, MoreVertical, Calendar } from 'lucide-react';
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
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, validarPeriodoLancamento, verificarBloqueioAposLimite } from '@/lib/expense-validation';

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

  const isOwnProfile = colaborador?.id && user?.id;
  const canEdit = hasRole('RH') || hasRole('FINANCEIRO') || isOwnProfile;

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
    }
  }, [selectedPeriod, nextPeriod]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    // Fetch collaborator data
    const { data: colabData, error: colabError } = await supabase
      .from('colaboradores_elegiveis')
      .select('id, nome, matricula, departamento, cesta_beneficios_teto')
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

  const filteredExpenses = expenses.filter(
    (exp) => exp.tipoDespesaNome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
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
                <p className="text-xs text-muted-foreground">{expenses.filter(e => e.status === 'valido').length} válidos</p>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2 md:col-span-1">
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
        )}

        {/* Search */}
        <div className="flex">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar por tipo de despesa..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-9" 
            />
          </div>
        </div>

        {/* Expenses Table */}
        <DataTable 
          data={filteredExpenses} 
          columns={columns} 
          emptyMessage="Nenhum lançamento encontrado neste período" 
        />
      </div>
    </PageFormLayout>
  );
};

export default ColaboradorLancamentos;
