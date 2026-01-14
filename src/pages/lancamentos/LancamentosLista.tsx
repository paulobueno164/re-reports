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
import { PeriodSelect } from '@/components/ui/period-select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/expense-validation';
import { cn, findCurrentPeriod as findCurrentPeriodUtil } from '@/lib/utils';
import periodosService from '@/services/periodos.service';
import colaboradoresService from '@/services/colaboradores.service';
import lancamentosService from '@/services/lancamentos.service';

interface CalendarPeriod {
  id: string;
  periodo: string;
  status: string;
  dataInicio: Date;
  dataFinal: Date;
  abreLancamento: Date;
  fechaLancamento: Date;
}

interface ColaboradorResumo {
  id: string;
  nome: string;
  matricula: string;
  departamento: string;
  totalLancado: number;
  totalConsiderado: number;
  totalAprovado: number;
  totalPendente: number;
  totalRejeitado: number;
  qtdLancamentos: number;
  qtdPendentes: number;
  qtdValidos: number;
}

type SortField = 'nome' | 'departamento' | 'totalConsiderado' | 'qtdLancamentos';
type SortDirection = 'asc' | 'desc';
type LancamentoFilter = 'todos' | 'sem' | 'com';

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
  const [lancamentoFilter, setLancamentoFilter] = useState<LancamentoFilter>('todos');

  const isRHorFinanceiro = hasRole('RH') || hasRole('FINANCEIRO');

  const getCurrentPeriod = (periodsData: CalendarPeriod[]) => {
    return findCurrentPeriodUtil(periodsData) || periodsData[0];
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" /> 
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!user || isRHorFinanceiro) return;
      
      try {
        const colaborador = await colaboradoresService.getByUserId(user.id);
        if (colaborador) {
          setRedirecting(true);
          navigate(`/lancamentos/colaborador/${colaborador.id}`, { replace: true });
        }
      } catch (error) {
        // User not linked to colaborador
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
    try {
      const periodsData = await periodosService.getAll();
      const mapped: CalendarPeriod[] = periodsData.map(p => ({
        id: p.id,
        periodo: p.periodo,
        status: p.status,
        dataInicio: new Date(p.data_inicio),
        dataFinal: new Date(p.data_final),
        abreLancamento: new Date(p.abre_lancamento),
        fechaLancamento: new Date(p.fecha_lancamento),
      }));
      setPeriods(mapped);
      
      const current = getCurrentPeriod(mapped);
      if (current) {
        setSelectedPeriodId(current.id);
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao carregar períodos', variant: 'destructive' });
    }
  };

  const fetchColaboradores = async () => {
    setLoading(true);

    try {
      const colabData = await colaboradoresService.getAll({ ativo: true });
      
      const uniqueDepts = [...new Set(colabData.map(c => c.departamento))].sort();
      setDepartamentos(uniqueDepts);

      const expensesData = await lancamentosService.getAll({ periodo_id: selectedPeriodId });

      const colaboradoresResumo: ColaboradorResumo[] = colabData.map(colab => {
        const colabExpenses = expensesData.filter(e => e.colaborador_id === colab.id);
        const totalLancado = colabExpenses.reduce((sum, e) => sum + Number(e.valor_lancado), 0);
        
        // Calcular valores separados por status (mutuamente exclusivos)
        const aprovados = colabExpenses.filter(e => e.status === 'valido');
        const pendentes = colabExpenses.filter(e => ['enviado', 'em_analise'].includes(e.status));
        const rejeitados = colabExpenses.filter(e => e.status === 'invalido');
        
        const totalAprovado = aprovados.reduce((sum, e) => sum + Number(e.valor_considerado), 0);
        const totalPendente = pendentes.reduce((sum, e) => sum + Number(e.valor_considerado), 0);
        const totalRejeitado = rejeitados.reduce((sum, e) => sum + Number(e.valor_considerado), 0);
        
        // Manter totalConsiderado para compatibilidade (apenas aprovados + pendentes, excluindo rejeitados)
        const totalConsiderado = totalAprovado + totalPendente;
        
        const qtdPendentes = pendentes.length;
        const qtdValidos = aprovados.length;

        return {
          id: colab.id,
          nome: colab.nome,
          matricula: colab.matricula,
          departamento: colab.departamento,
          totalLancado,
          totalConsiderado,
          totalAprovado,
          totalPendente,
          totalRejeitado,
          qtdLancamentos: colabExpenses.length,
          qtdPendentes,
          qtdValidos,
        };
      });

      setColaboradores(colaboradoresResumo);
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao carregar colaboradores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedColaboradores = useMemo(() => {
    let result = colaboradores.filter(colab => {
      const matchesDept = selectedDepartamento === 'todos' || colab.departamento === selectedDepartamento;
      const matchesSearch = colab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           colab.matricula.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Nova lógica de filtro por lançamentos
      let matchesLancamentoFilter = true;
      switch (lancamentoFilter) {
        case 'sem':
          matchesLancamentoFilter = colab.qtdLancamentos === 0;
          break;
        case 'com':
          matchesLancamentoFilter = colab.qtdLancamentos > 0;
          break;
        case 'todos':
        default:
          matchesLancamentoFilter = true;
          break;
      }
      
      return matchesDept && matchesSearch && matchesLancamentoFilter;
    });

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
  }, [colaboradores, selectedDepartamento, searchTerm, sortField, sortDirection, lancamentoFilter]);

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

  const totalColaboradores = filteredAndSortedColaboradores.length;
  const totalComLancamentos = filteredAndSortedColaboradores.filter(c => c.qtdLancamentos > 0).length;
  const totalSemLancamentos = totalColaboradores - totalComLancamentos;
  const totalValorAprovado = filteredAndSortedColaboradores.reduce((sum, c) => sum + c.totalAprovado, 0);
  const totalValorPendente = filteredAndSortedColaboradores.reduce((sum, c) => sum + c.totalPendente, 0);
  const totalValorRejeitado = filteredAndSortedColaboradores.reduce((sum, c) => sum + c.totalRejeitado, 0);

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

      <div className="flex flex-row gap-4 items-end flex-wrap">
        <div className="flex flex-col space-y-1.5">
          <Label className="text-xs text-muted-foreground block">Período</Label>
          <PeriodSelect
            periods={periods.map(p => ({ id: p.id, periodo: p.periodo, status: p.status as 'aberto' | 'fechado' }))}
            value={selectedPeriodId}
            onValueChange={setSelectedPeriodId}
            className="w-[180px]"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label className="text-xs text-muted-foreground block">Departamento</Label>
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

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Filtrar</Label>
          <Select value={lancamentoFilter} onValueChange={(value) => setLancamentoFilter(value as LancamentoFilter)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sem">Sem lançamentos</SelectItem>
              <SelectItem value="com">Com lançamentos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
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

        {/* Valor Aprovado */}
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-success">
              Valor Aprovado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold font-mono text-success">
              {formatCurrency(totalValorAprovado)}
            </p>
            <p className="text-xs text-muted-foreground">
              apenas aprovados
            </p>
          </CardContent>
        </Card>

        {/* Valor Pendente */}
        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-warning">
              Valor Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold font-mono text-warning">
              {formatCurrency(totalValorPendente)}
            </p>
            <p className="text-xs text-muted-foreground">
              aguardando análise
            </p>
          </CardContent>
        </Card>

        {/* Valor Rejeitado */}
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-destructive">
              Valor Rejeitado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold font-mono text-destructive">
              {formatCurrency(totalValorRejeitado)}
            </p>
            <p className="text-xs text-muted-foreground">
              reprovados/inválidos
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={filteredAndSortedColaboradores}
        columns={columns}
        emptyMessage="Nenhum colaborador encontrado"
        onRowClick={(item) => navigate(`/lancamentos/colaborador/${item.id}?periodo=${selectedPeriodId}`)}
      />
    </div>
  );
};

export default LancamentosLista;
