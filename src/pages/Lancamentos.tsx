import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Upload, Eye, Edit, Trash2, AlertCircle, Loader2, FileText, Image, Download, X, Lock, Paperclip, History } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import { AttachmentUploadSimple } from '@/components/attachments/AttachmentUploadSimple';
import { ExpenseTimeline } from '@/components/lancamentos/ExpenseTimeline';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  validarLancamentoCesta, 
  formatCurrency, 
  formatDate, 
  validarPeriodoLancamento,
  validarOrigemDespesa,
  verificarBloqueioAposLimite,
  gerarHashComprovante 
} from '@/lib/expense-validation';

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

interface ExpenseType {
  id: string;
  nome: string;
  origemPermitida: ('proprio' | 'conjuge' | 'filhos')[];
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

const originLabels: Record<string, string> = {
  proprio: 'Próprio (Colaborador)',
  conjuge: 'Cônjuge',
  filhos: 'Filhos',
};

const Lancamentos = () => {
  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingAttachmentHashes, setExistingAttachmentHashes] = useState<Set<string>>(new Set());
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [sendingToAnalysis, setSendingToAnalysis] = useState(false);

  // Form state
  const [formPeriodoId, setFormPeriodoId] = useState('');
  const [formTipoDespesaId, setFormTipoDespesaId] = useState('');
  const [formOrigem, setFormOrigem] = useState<'proprio' | 'conjuge' | 'filhos'>('proprio');
  const [formValor, setFormValor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  // Calculated values
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

  // Find the period where today falls within or after the launch window
  const today = new Date();
  const todayTime = today.getTime();
  
  // Find period where today is within the launch window (abre <= today <= fecha + end of day)
  const currentPeriod = periods.find((p) => {
    if (p.status !== 'aberto') return false;
    const abertura = p.abreLancamento.getTime();
    const fechamento = p.fechaLancamento.getTime() + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
    return todayTime >= abertura && todayTime <= fechamento;
  }) || periods.find((p) => p.status === 'aberto'); // Fallback to first open period
  
  // Next period is the one after current in the list (sorted DESC, so next is at lower index)
  const nextPeriod = periods.find((p, idx) => {
    if (!currentPeriod) return false;
    const currentIdx = periods.findIndex(pp => pp.id === currentPeriod.id);
    return currentIdx >= 0 && idx === currentIdx - 1 && p.status === 'aberto';
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  // Validate period on load
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

    // Fetch colaborador data for the logged user
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

    // Fetch expense types - first try colaborador-specific, fallback to all
    let typesData: any[] = [];
    
    if (colabData) {
      // Try to get colaborador-specific expense types
      const { data: vinculosData } = await supabase
        .from('colaborador_tipos_despesas')
        .select(`
          teto_individual,
          tipos_despesas (id, nome, origem_permitida)
        `)
        .eq('colaborador_id', colabData.id)
        .eq('ativo', true);

      if (vinculosData && vinculosData.length > 0) {
        typesData = vinculosData.map((v: any) => v.tipos_despesas).filter(Boolean);
      }
    }

    // Fallback to all variable expense types if no specific bindings
    if (typesData.length === 0) {
      const { data: allTypesData } = await supabase
        .from('tipos_despesas')
        .select('id, nome, origem_permitida')
        .eq('classificacao', 'variavel')
        .eq('ativo', true);
      
      typesData = allTypesData || [];
    }

    if (typesData.length > 0) {
      setExpenseTypes(typesData.map((t: any) => ({
        id: t.id,
        nome: t.nome,
        origemPermitida: t.origem_permitida as ('proprio' | 'conjuge' | 'filhos')[],
      })));
    }

    // Fetch periods
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

    // Fetch expenses
    let query = supabase
      .from('lancamentos')
      .select(`
        id,
        origem,
        valor_lancado,
        valor_considerado,
        valor_nao_considerado,
        descricao_fato_gerador,
        status,
        motivo_invalidacao,
        created_at,
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

      // Calculate total used for current period and check blocking
      const openPeriod = periodsData?.find(p => p.status === 'aberto');
      if (colabData && openPeriod) {
        const periodExpenses = mapped.filter(e => e.colaboradorId === colabData.id && e.periodoId === openPeriod.id);
        const usado = periodExpenses.reduce((sum, e) => sum + e.valorConsiderado, 0);
        setTotalUsado(usado);
        setSaldoDisponivel(Number(colabData.cesta_beneficios_teto) - usado);
        setPercentualUsado((usado / Number(colabData.cesta_beneficios_teto)) * 100);

        // Check if blocked after last entry
        const bloqueio = verificarBloqueioAposLimite(
          periodExpenses.map(e => ({ valorNaoConsiderado: e.valorNaoConsiderado }))
        );
        setBloqueadoPorUltimoLancamento(bloqueio.bloqueado);
      }
    }

    // Fetch existing attachment hashes to detect duplicates
    if (colabData) {
      const { data: anexos } = await supabase
        .from('anexos')
        .select('nome_arquivo, tamanho');
      
      if (anexos) {
        const hashes = new Set(anexos.map(a => gerarHashComprovante(a.nome_arquivo, a.tamanho)));
        setExistingAttachmentHashes(hashes);
      }
    }

    setLoading(false);
  };

  const filteredExpenses = expenses.filter(
    (exp) =>
      exp.colaboradorNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.tipoDespesaNome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'createdAt',
      header: 'Data',
      hideOnMobile: true,
      render: (item: Expense) => formatDate(item.createdAt),
    },
    { key: 'colaboradorNome', header: 'Colaborador', hideOnMobile: true },
    { key: 'tipoDespesaNome', header: 'Tipo' },
    {
      key: 'origem',
      header: 'Origem',
      hideOnMobile: true,
      render: (item: Expense) => {
        const labels: Record<string, string> = { proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' };
        return labels[item.origem] || item.origem;
      },
    },
    {
      key: 'valorLancado',
      header: 'Valor',
      className: 'text-right font-mono',
      render: (item: Expense) => formatCurrency(item.valorLancado),
    },
    {
      key: 'valorConsiderado',
      header: 'Considerado',
      hideOnMobile: true,
      className: 'text-right font-mono',
      render: (item: Expense) => (
        <span className={item.valorNaoConsiderado > 0 ? 'text-warning' : ''}>
          {formatCurrency(item.valorConsiderado)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Expense) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-[100px]',
      render: (item: Expense) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={(e) => {
              e.stopPropagation();
              handleView(item);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {item.status === 'rascunho' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hidden sm:inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(item);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hidden sm:inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const handleView = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsViewMode(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormPeriodoId(expense.periodoId);
    setFormTipoDespesaId(expense.tipoDespesaId);
    setFormOrigem(expense.origem as 'proprio' | 'conjuge' | 'filhos');
    setFormValor(expense.valorLancado.toString());
    setFormDescricao(expense.descricaoFatoGerador);
    setIsViewMode(false);
    setIsDialogOpen(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;

    const { error } = await supabase
      .from('lancamentos')
      .delete()
      .eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Lançamento excluído.' });
      fetchData();
    }
  };

  const handleNew = () => {
    // Check period validation
    if (periodoValidation && !periodoValidation.permitido) {
      toast({ 
        title: 'Período não disponível', 
        description: periodoValidation.mensagem, 
        variant: 'destructive' 
      });
      return;
    }

    // Check if blocked after limit exceeded
    if (bloqueadoPorUltimoLancamento) {
      toast({ 
        title: 'Limite atingido', 
        description: 'Você já fez um lançamento que ultrapassou o limite. Não é possível fazer novos lançamentos neste período.', 
        variant: 'destructive' 
      });
      return;
    }

    // Check if already at limit
    if (saldoDisponivel <= 0) {
      toast({ 
        title: 'Limite atingido', 
        description: 'Você já atingiu o limite da Cesta de Benefícios para este período.', 
        variant: 'destructive' 
      });
      return;
    }

    setSelectedExpense(null);
    // Use the correct period based on validation
    const targetPeriodId = periodoValidation?.periodoDestinoId || currentPeriod?.id || '';
    setFormPeriodoId(targetPeriodId);
    setFormTipoDespesaId('');
    setFormOrigem('proprio');
    setFormValor('');
    setFormDescricao('');
    setFormFile(null);
    setIsViewMode(false);
    setIsDialogOpen(true);
  };

  const handleSave = async (status: 'rascunho' | 'enviado') => {
    if (!colaborador) {
      toast({ title: 'Erro', description: 'Você não está cadastrado como colaborador elegível.', variant: 'destructive' });
      return;
    }

    const valorLancado = parseFloat(formValor);
    if (isNaN(valorLancado) || valorLancado <= 0) {
      toast({ title: 'Erro', description: 'Informe um valor válido.', variant: 'destructive' });
      return;
    }

    // Validate origin
    const selectedType = expenseTypes.find(t => t.id === formTipoDespesaId);
    if (selectedType) {
      const origemValidation = validarOrigemDespesa(formOrigem, selectedType.origemPermitida);
      if (!origemValidation.valido) {
        toast({ title: 'Origem inválida', description: origemValidation.mensagem, variant: 'destructive' });
        return;
      }
    }

    // Check for duplicate attachment
    if (formFile) {
      const hash = gerarHashComprovante(formFile.name, formFile.size);
      if (existingAttachmentHashes.has(hash)) {
        toast({ 
          title: 'Comprovante duplicado', 
          description: 'Este comprovante já foi utilizado em outro lançamento. Cada nota fiscal/recibo só pode ser lançado uma vez.', 
          variant: 'destructive' 
        });
        return;
      }
    }

    // Validate against limits
    const validation = validarLancamentoCesta({
      valorLancado,
      tetoColaborador: cestaTeto,
      totalJaUtilizado: totalUsado,
    });

    if (!validation.permitido) {
      toast({ title: 'Limite atingido', description: validation.mensagem, variant: 'destructive' });
      return;
    }

    if (validation.tipo === 'warning') {
      if (!confirm(validation.mensagem + '\n\nDeseja continuar?')) {
        return;
      }
    }

    try {
      const lancamentoData = {
        colaborador_id: colaborador.id,
        periodo_id: formPeriodoId,
        tipo_despesa_id: formTipoDespesaId,
        origem: formOrigem,
        valor_lancado: valorLancado,
        valor_considerado: validation.valorConsiderado,
        valor_nao_considerado: validation.valorNaoConsiderado,
        descricao_fato_gerador: formDescricao,
        status: status,
      };

      let lancamentoId: string;

      if (selectedExpense) {
        const { error } = await supabase
          .from('lancamentos')
          .update(lancamentoData)
          .eq('id', selectedExpense.id);

        if (error) throw error;
        lancamentoId = selectedExpense.id;
      } else {
        const { data, error } = await supabase
          .from('lancamentos')
          .insert([lancamentoData])
          .select('id')
          .single();

        if (error) throw error;
        lancamentoId = data.id;
      }

      // Upload attachment if provided (with hash for uniqueness)
      if (formFile && lancamentoId) {
        const fileExt = formFile.name.split('.').pop();
        const filePath = `${colaborador.id}/${lancamentoId}/${Date.now()}.${fileExt}`;

        // Generate file hash
        const buffer = await formFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const { error: uploadError } = await supabase.storage
          .from('comprovantes')
          .upload(filePath, formFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
        } else {
          // Create attachment record with hash
          const { error: anexoError } = await supabase.from('anexos').insert({
            lancamento_id: lancamentoId,
            nome_arquivo: formFile.name,
            storage_path: filePath,
            tamanho: formFile.size,
            tipo_arquivo: formFile.type || 'application/octet-stream',
            hash_comprovante: fileHash,
          });

          if (anexoError) {
            // Rollback storage upload if duplicate
            await supabase.storage.from('comprovantes').remove([filePath]);
            
            if (anexoError.message.includes('comprovante já foi utilizado') || anexoError.code === '23505') {
              toast({ 
                title: 'Comprovante duplicado', 
                description: 'Este comprovante já foi utilizado em outro lançamento.', 
                variant: 'destructive' 
              });
              return;
            }
            console.error('Error creating attachment:', anexoError);
          }
        }
      }

      toast({
        title: status === 'rascunho' ? 'Rascunho salvo' : 'Lançamento enviado',
        description: status === 'enviado' ? 'O lançamento foi enviado para análise.' : 'O rascunho foi salvo.',
      });

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      // Handle specific trigger errors
      let errorMessage = error.message;
      
      if (error.message.includes('Período não encontrado')) {
        errorMessage = 'O período selecionado não foi encontrado.';
      } else if (error.message.includes('período está fechado')) {
        errorMessage = 'Este período está fechado para lançamentos.';
      } else if (error.message.includes('ainda não iniciou')) {
        errorMessage = error.message; // Use the trigger message
      } else if (error.message.includes('encerrado')) {
        errorMessage = 'O período de lançamento foi encerrado. Seu lançamento será direcionado para o próximo mês.';
      }
      
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    }
  };

  const selectedType = expenseTypes.find(t => t.id === formTipoDespesaId);
  const canCreateNew = colaborador && periodoValidation?.permitido && !bloqueadoPorUltimoLancamento && saldoDisponivel > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Lançamentos de Despesas"
        description={`Período atual: ${currentPeriod?.periodo || 'N/A'}`}
      >
        <Button onClick={handleNew} disabled={!canCreateNew}>
          {!canCreateNew && bloqueadoPorUltimoLancamento ? (
            <Lock className="mr-2 h-4 w-4" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Novo Lançamento
        </Button>
      </PageHeader>

      {!colaborador && !hasRole('RH') && !hasRole('FINANCEIRO') && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            Você não está cadastrado como colaborador elegível. Entre em contato com o RH.
          </AlertDescription>
        </Alert>
      )}

      {/* Period validation alert */}
      {periodoValidation && !periodoValidation.permitido && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Período Bloqueado</AlertTitle>
          <AlertDescription>{periodoValidation.mensagem}</AlertDescription>
        </Alert>
      )}

      {periodoValidation && periodoValidation.periodoDestino === 'proximo' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Redirecionamento de Período</AlertTitle>
          <AlertDescription>{periodoValidation.mensagem}</AlertDescription>
        </Alert>
      )}

      {/* Blocked after limit exceeded */}
      {bloqueadoPorUltimoLancamento && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Lançamentos Bloqueados</AlertTitle>
          <AlertDescription>
            Você já fez um lançamento que ultrapassou o limite da Cesta de Benefícios. 
            Não é possível fazer novos lançamentos neste período.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {colaborador && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <Card className={bloqueadoPorUltimoLancamento ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Cesta de Benefícios
              </CardTitle>
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
                {bloqueadoPorUltimoLancamento && (
                  <p className="text-xs text-destructive font-medium mt-2">
                    Bloqueado - Limite ultrapassado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Lançamentos no Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold">{expenses.filter(e => e.periodoId === currentPeriod?.id).length}</p>
              <p className="text-xs text-muted-foreground">
                {expenses.filter(e => e.status === 'valido').length} válidos
              </p>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Janela de Lançamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm sm:text-lg font-semibold">
                {currentPeriod && formatDate(currentPeriod.abreLancamento)} -{' '}
                {currentPeriod && formatDate(currentPeriod.fechaLancamento)}
              </p>
              <p className={`text-xs ${periodoValidation?.permitido ? 'text-success' : 'text-destructive'}`}>
                {periodoValidation?.permitido ? 'Período aberto' : 'Período fechado'}
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
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filteredExpenses}
        columns={columns}
        emptyMessage="Nenhum lançamento encontrado"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {isViewMode ? 'Visualizar Lançamento' : selectedExpense ? 'Editar Lançamento' : 'Novo Lançamento'}
            </DialogTitle>
            <DialogDescription>
              {isViewMode ? 'Detalhes do lançamento' : 'Preencha os dados do lançamento'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!isViewMode && colaborador && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Saldo Disponível</AlertTitle>
                <AlertDescription>
                  Você possui <strong>{formatCurrency(saldoDisponivel)}</strong> disponíveis
                  de <strong>{formatCurrency(cestaTeto)}</strong> da Cesta de Benefícios.
                </AlertDescription>
              </Alert>
            )}

            {/* View Mode - Improved Layout */}
            {isViewMode && selectedExpense && (
              <div className="space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge 
                      status={selectedExpense.status as any} 
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Criado em {new Date(selectedExpense.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Main Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Mês Referência</p>
                    <p className="font-semibold text-lg">{selectedExpense.periodo}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tipo de Despesa</p>
                    <p className="font-semibold text-lg">{selectedExpense.tipoDespesaNome}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Origem da Despesa</p>
                    <p className="font-semibold text-lg">
                      {{ proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' }[selectedExpense.origem] || selectedExpense.origem}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Valor Lançado</p>
                    <p className="font-mono font-bold text-xl text-primary">{formatCurrency(selectedExpense.valorLancado)}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Descrição do Fato Gerador</p>
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <p className="text-sm whitespace-pre-wrap">{selectedExpense.descricaoFatoGerador}</p>
                  </div>
                </div>

                {/* Values breakdown if there's a difference */}
                {selectedExpense.valorNaoConsiderado > 0 && (
                  <Alert className="border-warning/50 bg-warning/10">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <AlertTitle className="text-warning">Valor Parcialmente Considerado</AlertTitle>
                    <AlertDescription>
                      <div className="grid grid-cols-3 gap-4 mt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Valor Lançado</p>
                          <p className="font-mono font-medium">{formatCurrency(selectedExpense.valorLancado)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Valor Considerado</p>
                          <p className="font-mono font-medium text-success">{formatCurrency(selectedExpense.valorConsiderado)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Não Considerado</p>
                          <p className="font-mono font-medium text-destructive">{formatCurrency(selectedExpense.valorNaoConsiderado)}</p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Rejection Reason - Show prominently when status is invalido */}
                {selectedExpense.status === 'invalido' && selectedExpense.motivoInvalidacao && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Lançamento Rejeitado</AlertTitle>
                    <AlertDescription className="mt-2">
                      <p className="font-medium">{selectedExpense.motivoInvalidacao}</p>
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                {/* Attachments Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Comprovantes Anexados
                      {attachmentCount > 0 && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {attachmentCount}
                        </span>
                      )}
                    </p>
                  </div>
                  <AttachmentList 
                    key={attachmentRefreshKey} 
                    lancamentoId={selectedExpense.id}
                    allowDelete={selectedExpense.status === 'rascunho'}
                    onDeleteComplete={() => setAttachmentRefreshKey(prev => prev + 1)}
                    onCountChange={setAttachmentCount}
                  />
                  
                  {/* Allow adding attachments when in draft status */}
                  {selectedExpense.status === 'rascunho' && (
                    <AttachmentUploadSimple 
                      lancamentoId={selectedExpense.id}
                      onUploadComplete={() => setAttachmentRefreshKey(prev => prev + 1)}
                    />
                  )}
                </div>

                <Separator />

                {/* Timeline Section */}
                <ExpenseTimeline expenseId={selectedExpense.id} />
              </div>
            )}

            {/* Edit/Create Mode */}
            {!isViewMode && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mês Referência</Label>
                    <Select value={formPeriodoId} onValueChange={setFormPeriodoId} disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((period) => (
                          <SelectItem key={period.id} value={period.id}>
                            {period.periodo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {periodoValidation?.periodoDestino === 'proximo' && (
                      <p className="text-xs text-warning">Lançamento será registrado no próximo período</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Despesa</Label>
                    <Select value={formTipoDespesaId} onValueChange={(value) => {
                      setFormTipoDespesaId(value);
                      const type = expenseTypes.find(t => t.id === value);
                      if (type && !type.origemPermitida.includes(formOrigem)) {
                        setFormOrigem(type.origemPermitida[0]);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Origem da Despesa</Label>
                    <Select 
                      value={formOrigem} 
                      onValueChange={(value) => setFormOrigem(value as 'proprio' | 'conjuge' | 'filhos')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['proprio', 'conjuge', 'filhos'] as const).map((origem) => {
                          const isAllowed = !selectedType || selectedType.origemPermitida.includes(origem);
                          return (
                            <SelectItem 
                              key={origem} 
                              value={origem} 
                              disabled={!isAllowed}
                            >
                              {originLabels[origem]}
                              {!isAllowed && ' (não permitida)'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedType && (
                      <p className="text-xs text-muted-foreground">
                        Origens permitidas: {selectedType.origemPermitida.map(o => 
                          ({ proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' }[o])
                        ).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Valor da Despesa (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formValor}
                      onChange={(e) => setFormValor(e.target.value)}
                      placeholder="0,00"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição do Fato Gerador</Label>
                  <Textarea
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Descreva o motivo/natureza da despesa..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Anexo do Comprovante</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Arraste arquivos ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: PDF, XLSX, DOC, DOCX, PNG, JPG (máx. 5MB)
                    </p>
                    <p className="text-xs text-warning mt-1">
                      ⚠️ Cada comprovante só pode ser utilizado uma vez
                    </p>
                    <Input
                      type="file"
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.xlsx,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                    />
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => document.getElementById('file-upload')?.click()}>
                      Selecionar Arquivo
                    </Button>
                    {formFile && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                        <FileText className="h-4 w-4" />
                        <span>{formFile.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFormFile(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {isViewMode ? 'Fechar' : 'Cancelar'}
            </Button>
            {isViewMode && selectedExpense?.status === 'rascunho' && (
              <>
                <Button 
                  variant="secondary"
                  onClick={() => {
                    // Switch to edit mode with form populated
                    setFormPeriodoId(selectedExpense.periodoId);
                    setFormTipoDespesaId(selectedExpense.tipoDespesaId);
                    setFormOrigem(selectedExpense.origem as 'proprio' | 'conjuge' | 'filhos');
                    setFormValor(selectedExpense.valorLancado.toString());
                    setFormDescricao(selectedExpense.descricaoFatoGerador);
                    setFormFile(null);
                    setIsViewMode(false);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={sendingToAnalysis}>
                      {sendingToAnalysis ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar para Análise'
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Enviar para análise?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3">
                          <p>
                            Após o envio, o lançamento não poderá mais ser editado ou excluído. 
                            Certifique-se de que todas as informações e comprovantes estão corretos.
                          </p>
                          {attachmentCount === 0 && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Atenção: Sem comprovantes</AlertTitle>
                              <AlertDescription>
                                Este lançamento não possui comprovantes anexados. 
                                Recomendamos anexar os documentos antes de enviar.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          setSendingToAnalysis(true);
                          try {
                            const { error } = await supabase
                              .from('lancamentos')
                              .update({ status: 'enviado' })
                              .eq('id', selectedExpense.id);
                            
                            if (error) throw error;
                            
                            toast({ title: 'Sucesso', description: 'Lançamento enviado para análise.' });
                            setIsDialogOpen(false);
                            fetchData();
                          } catch (error: any) {
                            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                          } finally {
                            setSendingToAnalysis(false);
                          }
                        }}
                      >
                        {attachmentCount === 0 ? 'Enviar mesmo assim' : 'Confirmar Envio'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {!isViewMode && (
              <>
                <Button variant="secondary" onClick={() => handleSave('rascunho')}>
                  Salvar Rascunho
                </Button>
                <Button onClick={() => handleSave('enviado')}>
                  Enviar para Análise
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Lancamentos;
