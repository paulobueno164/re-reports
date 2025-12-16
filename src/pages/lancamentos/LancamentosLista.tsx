import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Trash2, Loader2, Lock, AlertCircle, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
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
  colaboradorNome: string;
  colaboradorId: string;
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
  cestaBeneficiosTeto: number;
}

const LancamentosLista = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalUsado, setTotalUsado] = useState(0);
  const [cestaTeto, setCestaTeto] = useState(0);
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);
  const [percentualUsado, setPercentualUsado] = useState(0);
  const [bloqueadoPorUltimoLancamento, setBloqueadoPorUltimoLancamento] = useState(false);
  const [periodoValidation, setPeriodoValidation] = useState<{
    permitido: boolean;
    periodoDestino: 'atual' | 'proximo' | 'bloqueado';
    periodoDestinoId?: string;
    mensagem: string;
  } | null>(null);

  const today = new Date();
  const todayTime = today.getTime();
  
  const currentPeriod = periods.find((p) => {
    if (p.status !== 'aberto') return false;
    const abertura = p.abreLancamento.getTime();
    const fechamento = p.fechaLancamento.getTime() + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
    return todayTime >= abertura && todayTime <= fechamento;
  }) || periods.find((p) => p.status === 'aberto');
  
  const nextPeriod = periods.find((p, idx) => {
    if (!currentPeriod) return false;
    const currentIdx = periods.findIndex(pp => pp.id === currentPeriod.id);
    return currentIdx >= 0 && idx === currentIdx - 1 && p.status === 'aberto';
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (currentPeriod) {
      const validation = validarPeriodoLancamento(
        new Date(),
        {
          id: currentPeriod.id,
          periodo: currentPeriod.periodo,
          abreLancamento: currentPeriod.abreLancamento,
          fechaLancamento: currentPeriod.fechaLancamento,
          status: currentPeriod.status,
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
  }, [currentPeriod, nextPeriod]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: colabData } = await supabase
      .from('colaboradores_elegiveis')
      .select('id, nome, cesta_beneficios_teto')
      .eq('user_id', user.id)
      .maybeSingle();

    if (colabData) {
      setColaborador({
        id: colabData.id,
        nome: colabData.nome,
        cestaBeneficiosTeto: Number(colabData.cesta_beneficios_teto),
      });
      setCestaTeto(Number(colabData.cesta_beneficios_teto));
    }

    const { data: periodsData } = await supabase
      .from('calendario_periodos')
      .select('id, periodo, status, abre_lancamento, fecha_lancamento')
      .order('periodo', { ascending: false });

    if (periodsData) {
      setPeriods(periodsData.map(p => ({
        id: p.id,
        periodo: p.periodo,
        status: p.status,
        abreLancamento: new Date(p.abre_lancamento),
        fechaLancamento: new Date(p.fecha_lancamento),
      })));
    }

    let query = supabase
      .from('lancamentos')
      .select(`
        id, origem, valor_lancado, valor_considerado, valor_nao_considerado,
        descricao_fato_gerador, status, motivo_invalidacao, created_at,
        colaboradores_elegiveis (id, nome),
        calendario_periodos (id, periodo),
        tipos_despesas (id, nome)
      `)
      .order('created_at', { ascending: false });

    const { data: expensesData } = await query;

    if (expensesData) {
      const mapped = expensesData.map((e: any) => ({
        id: e.id,
        colaboradorId: e.colaboradores_elegiveis?.id,
        colaboradorNome: e.colaboradores_elegiveis?.nome || '',
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

      const openPeriod = periodsData?.find(p => p.status === 'aberto');
      if (colabData && openPeriod) {
        const periodExpenses = mapped.filter(e => e.colaboradorId === colabData.id && e.periodoId === openPeriod.id);
        const usado = periodExpenses.reduce((sum, e) => sum + e.valorConsiderado, 0);
        setTotalUsado(usado);
        setSaldoDisponivel(Number(colabData.cesta_beneficios_teto) - usado);
        setPercentualUsado((usado / Number(colabData.cesta_beneficios_teto)) * 100);

        const bloqueio = verificarBloqueioAposLimite(
          periodExpenses.map(e => ({ valorNaoConsiderado: e.valorNaoConsiderado }))
        );
        setBloqueadoPorUltimoLancamento(bloqueio.bloqueado);
      }
    }

    setLoading(false);
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;

    const { error } = await supabase.from('lancamentos').delete().eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Lançamento excluído.' });
      fetchData();
    }
  };

  const handleNew = () => {
    if (periodoValidation && !periodoValidation.permitido) {
      toast({ title: 'Período não disponível', description: periodoValidation.mensagem, variant: 'destructive' });
      return;
    }
    if (bloqueadoPorUltimoLancamento) {
      toast({ title: 'Limite atingido', description: 'Você já fez um lançamento que ultrapassou o limite.', variant: 'destructive' });
      return;
    }
    if (saldoDisponivel <= 0) {
      toast({ title: 'Limite atingido', description: 'Você já atingiu o limite da Cesta de Benefícios.', variant: 'destructive' });
      return;
    }
    navigate('/lancamentos/novo');
  };

  const filteredExpenses = expenses.filter(
    (exp) =>
      exp.colaboradorNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.tipoDespesaNome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'createdAt', header: 'Data', hideOnMobile: true, render: (item: Expense) => formatDate(item.createdAt) },
    { key: 'colaboradorNome', header: 'Colaborador', hideOnMobile: true },
    { key: 'tipoDespesaNome', header: 'Tipo' },
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
            {item.status === 'rascunho' && (
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
                {item.status === 'rascunho' && (
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

  const canCreateNew = colaborador && periodoValidation?.permitido && !bloqueadoPorUltimoLancamento && saldoDisponivel > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Lançamentos de Despesas" description={`Período atual: ${currentPeriod?.periodo || 'N/A'}`}>
        <Button onClick={handleNew} disabled={!canCreateNew}>
          {!canCreateNew && bloqueadoPorUltimoLancamento ? <Lock className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          Novo Lançamento
        </Button>
      </PageHeader>

      {!colaborador && !hasRole('RH') && !hasRole('FINANCEIRO') && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>Você não está cadastrado como colaborador elegível. Entre em contato com o RH.</AlertDescription>
        </Alert>
      )}

      {periodoValidation && !periodoValidation.permitido && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Período Bloqueado</AlertTitle>
          <AlertDescription>{periodoValidation.mensagem}</AlertDescription>
        </Alert>
      )}

      {bloqueadoPorUltimoLancamento && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Lançamentos Bloqueados</AlertTitle>
          <AlertDescription>Você já fez um lançamento que ultrapassou o limite. Não é possível fazer novos lançamentos neste período.</AlertDescription>
        </Alert>
      )}

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
                  <span>Teto: {formatCurrency(cestaTeto)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Lançamentos no Período</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold">{expenses.filter(e => e.periodoId === currentPeriod?.id).length}</p>
              <p className="text-xs text-muted-foreground">{expenses.filter(e => e.status === 'valido').length} válidos</p>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Janela de Lançamento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm sm:text-lg font-semibold">
                {currentPeriod && formatDate(currentPeriod.abreLancamento)} - {currentPeriod && formatDate(currentPeriod.fechaLancamento)}
              </p>
              <p className={`text-xs ${periodoValidation?.permitido ? 'text-success' : 'text-destructive'}`}>
                {periodoValidation?.permitido ? 'Período aberto' : 'Período fechado'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      <DataTable data={filteredExpenses} columns={columns} emptyMessage="Nenhum lançamento encontrado" />
    </div>
  );
};

export default LancamentosLista;
