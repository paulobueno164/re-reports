import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Loader2, Users, Calendar, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Filter } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/expense-validation';
import { cn } from '@/lib/utils';

interface CalendarPeriod {
  id: string;
  periodo: string;
  status: string;
  abreLancamento: Date;
  fechaLancamento: Date;
}

interface ColaboradorResumo {
  id: string;
  nome: string;
  matricula: string;
  departamento: string;
  cestaBeneficiosTeto: number;
  totalLancado: number;
  totalConsiderado: number;
  qtdLancamentos: number;
  qtdPendentes: number;
  qtdValidos: number;
}

type SortField = 'nome' | 'departamento' | 'totalConsiderado' | 'qtdLancamentos';
type SortDirection = 'asc' | 'desc';

const LancamentosLista = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [colaboradores, setColaboradores] = useState<ColaboradorResumo[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showOnlySemLancamentos, setShowOnlySemLancamentos] = useState(false);

  const isRHorFinanceiro = hasRole('RH') || hasRole('FINANCEIRO');

  // Determine current period based on today's date
  const getCurrentPeriod = (periodsData: CalendarPeriod[]) => {
    const today = new Date();
    const todayTime = today.getTime();
    
    // First try to find open period where today is within launch window
    const currentOpen = periodsData.find((p) => {
      if (p.status !== 'aberto') return false;
      const abertura = p.abreLancamento.getTime();
      const fechamento = p.fechaLancamento.getTime() + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
      return todayTime >= abertura && todayTime <= fechamento;
    });
    
    if (currentOpen) return currentOpen;
    
    // Fall back to most recent open period
    return periodsData.find((p) => p.status === 'aberto') || periodsData[0];
  };

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" /> 
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Redirect COLABORADOR users to their own expenses page
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!user || isRHorFinanceiro) return;
      
      // COLABORADOR role - redirect to own expenses
      const { data: colabData } = await supabase
        .from('colaboradores_elegiveis')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (colabData) {
        setRedirecting(true);
        navigate(`/lancamentos/colaborador/${colabData.id}`, { replace: true });
      }
    };
    
    checkAndRedirect();
  }, [user, isRHorFinanceiro, navigate]);

  useEffect(() => {
    if (isRHorFinanceiro) {
      fetchPeriods();
    }
  }, [isRHorFinanceiro]);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchColaboradores();
    }
  }, [selectedPeriodId]);

  const fetchPeriods = async () => {
    const { data: periodsData, error } = await supabase
      .from('calendario_periodos')
      .select('id, periodo, status, abre_lancamento, fecha_lancamento')
      .order('periodo', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar períodos', variant: 'destructive' });
      return;
    }

    if (periodsData) {
      const mapped = periodsData.map(p => ({
        id: p.id,
        periodo: p.periodo,
        status: p.status,
        abreLancamento: new Date(p.abre_lancamento),
        fechaLancamento: new Date(p.fecha_lancamento),
      }));
      setPeriods(mapped);
      
      // Set default to current period
      const current = getCurrentPeriod(mapped);
      if (current) {
        setSelectedPeriodId(current.id);
      }
    }
  };

  const fetchColaboradores = async () => {
    setLoading(true);

    // Fetch all eligible collaborators
    const { data: colabData, error: colabError } = await supabase
      .from('colaboradores_elegiveis')
      .select('id, nome, matricula, departamento, cesta_beneficios_teto')
      .eq('ativo', true)
      .order('nome');

    if (colabError) {
      toast({ title: 'Erro', description: 'Erro ao carregar colaboradores', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Get unique departments
    const uniqueDepts = [...new Set(colabData?.map(c => c.departamento) || [])].sort();
    setDepartamentos(uniqueDepts);

    // Fetch expenses for selected period
    const { data: expensesData, error: expError } = await supabase
      .from('lancamentos')
      .select('colaborador_id, valor_lancado, valor_considerado, status')
      .eq('periodo_id', selectedPeriodId);

    if (expError) {
      toast({ title: 'Erro', description: 'Erro ao carregar lançamentos', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Map collaborators with expense summary
    const colaboradoresResumo: ColaboradorResumo[] = (colabData || []).map(colab => {
      const colabExpenses = expensesData?.filter(e => e.colaborador_id === colab.id) || [];
      const totalLancado = colabExpenses.reduce((sum, e) => sum + Number(e.valor_lancado), 0);
      const totalConsiderado = colabExpenses.reduce((sum, e) => sum + Number(e.valor_considerado), 0);
      const qtdPendentes = colabExpenses.filter(e => ['enviado', 'em_analise'].includes(e.status)).length;
      const qtdValidos = colabExpenses.filter(e => e.status === 'valido').length;

      return {
        id: colab.id,
        nome: colab.nome,
        matricula: colab.matricula,
        departamento: colab.departamento,
        cestaBeneficiosTeto: Number(colab.cesta_beneficios_teto),
        totalLancado,
        totalConsiderado,
        qtdLancamentos: colabExpenses.length,
        qtdPendentes,
        qtdValidos,
      };
    });

    setColaboradores(colaboradoresResumo);
    setLoading(false);
  };

  const filteredAndSortedColaboradores = useMemo(() => {
    // First filter
    let result = colaboradores.filter(colab => {
      const matchesDept = selectedDepartamento === 'todos' || colab.departamento === selectedDepartamento;
      const matchesSearch = colab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           colab.matricula.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSemLancamentos = !showOnlySemLancamentos || colab.qtdLancamentos === 0;
      return matchesDept && matchesSearch && matchesSemLancamentos;
    });

    // Then sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'nome':
          comparison = a.nome.localeCompare(b.nome);
          break;
        case 'departamento':
          comparison = a.departamento.localeCompare(b.departamento);
          break;
        case 'totalConsiderado':
          comparison = a.totalConsiderado - b.totalConsiderado;
          break;
        case 'qtdLancamentos':
          comparison = a.qtdLancamentos - b.qtdLancamentos;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [colaboradores, selectedDepartamento, searchTerm, sortField, sortDirection, showOnlySemLancamentos]);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  const columns = [
    { key: 'matricula', header: 'Matrícula', hideOnMobile: true },
    { 
      key: 'nome', 
      header: (
        <button 
          onClick={() => handleSort('nome')} 
          className="flex items-center hover:text-foreground transition-colors"
        >
          Colaborador
          <SortIcon field="nome" />
        </button>
      ),
      render: (item: ColaboradorResumo) => (
        <div className="flex items-center gap-2">
          <span className={cn(item.qtdLancamentos === 0 && "text-muted-foreground")}>
            {item.nome}
          </span>
          {item.qtdLancamentos === 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-warning/50 text-warning bg-warning/10">
              <AlertCircle className="h-3 w-3 mr-1" />
              Sem lançamentos
            </Badge>
          )}
        </div>
      )
    },
    { 
      key: 'departamento', 
      header: (
        <button 
          onClick={() => handleSort('departamento')} 
          className="flex items-center hover:text-foreground transition-colors"
        >
          Departamento
          <SortIcon field="departamento" />
        </button>
      ),
      hideOnMobile: true 
    },
    { 
      key: 'qtdLancamentos', 
      header: (
        <button 
          onClick={() => handleSort('qtdLancamentos')} 
          className="flex items-center justify-center w-full hover:text-foreground transition-colors"
        >
          Lançamentos
          <SortIcon field="qtdLancamentos" />
        </button>
      ),
      className: 'text-center',
      render: (item: ColaboradorResumo) => (
        <div className="text-center">
          <span className={cn(
            "font-medium",
            item.qtdLancamentos === 0 && "text-muted-foreground"
          )}>
            {item.qtdLancamentos}
          </span>
          {item.qtdPendentes > 0 && (
            <span className="ml-1 text-xs text-warning">({item.qtdPendentes} pend.)</span>
          )}
        </div>
      )
    },
    { 
      key: 'totalConsiderado', 
      header: (
        <button 
          onClick={() => handleSort('totalConsiderado')} 
          className="flex items-center justify-end w-full hover:text-foreground transition-colors"
        >
          Utilizado
          <SortIcon field="totalConsiderado" />
        </button>
      ),
      className: 'text-right font-mono',
      hideOnMobile: true,
      render: (item: ColaboradorResumo) => (
        <div className="text-right">
          <div className={cn(
            "font-medium",
            item.qtdLancamentos === 0 && "text-muted-foreground"
          )}>
            {formatCurrency(item.totalConsiderado)}
          </div>
          <div className="text-xs text-muted-foreground">
            de {formatCurrency(item.cestaBeneficiosTeto)}
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-[80px]',
      render: (item: ColaboradorResumo) => (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9"
          onClick={() => navigate(`/lancamentos/colaborador/${item.id}?periodo=${selectedPeriodId}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // Summary stats
  const totalColaboradores = filteredAndSortedColaboradores.length;
  const totalComLancamentos = filteredAndSortedColaboradores.filter(c => c.qtdLancamentos > 0).length;
  const totalSemLancamentos = totalColaboradores - totalComLancamentos;
  const totalValorConsiderado = filteredAndSortedColaboradores.reduce((sum, c) => sum + c.totalConsiderado, 0);

  if (loading && periods.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Lançamentos de Despesas" 
        description={`Visualização por colaborador - Período: ${selectedPeriod?.periodo || 'Selecione'}`}
      />

      {/* Period and Department Filters */}
      <div className="flex flex-row gap-4 items-end flex-wrap">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger className="w-[180px]">
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

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Departamento</Label>
          <Select value={selectedDepartamento} onValueChange={setSelectedDepartamento}>
            <SelectTrigger className="w-[180px]">
              <Users className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Departamentos</SelectItem>
              {departamentos.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-[200px] max-w-md">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou matrícula..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-9" 
            />
          </div>
        </div>

        <Button
          variant={showOnlySemLancamentos ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlySemLancamentos(!showOnlySemLancamentos)}
          className="h-10 whitespace-nowrap"
        >
          <Filter className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Sem lançamentos</span>
          <span className="sm:hidden">Pendentes</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">{totalColaboradores}</p>
            <p className="text-xs text-muted-foreground">
              {totalComLancamentos} com lançamentos
            </p>
          </CardContent>
        </Card>

        <Card className={totalSemLancamentos > 0 ? 'border-warning/50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Sem Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-xl sm:text-2xl font-bold",
              totalSemLancamentos > 0 && "text-warning"
            )}>
              {totalSemLancamentos}
            </p>
            <p className="text-xs text-muted-foreground">
              colaboradores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Total Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">
              {filteredAndSortedColaboradores.reduce((sum, c) => sum + c.qtdLancamentos, 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {filteredAndSortedColaboradores.reduce((sum, c) => sum + c.qtdValidos, 0)} válidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Valor Considerado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold font-mono">
              {formatCurrency(totalValorConsiderado)}
            </p>
            <p className="text-xs text-muted-foreground">no período</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable 
          data={filteredAndSortedColaboradores} 
          columns={columns} 
          emptyMessage="Nenhum colaborador encontrado" 
        />
      )}
    </div>
  );
};

export default LancamentosLista;
