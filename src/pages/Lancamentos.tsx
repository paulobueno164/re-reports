import { useState, useEffect } from 'react';
import { Plus, Search, Upload, Eye, Edit, Trash2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
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
import { validarLancamentoCesta, formatCurrency, formatDate } from '@/lib/expense-validation';

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
  createdAt: Date;
}

interface ExpenseType {
  id: string;
  nome: string;
  origemPermitida: string[];
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

  // Form state
  const [formPeriodoId, setFormPeriodoId] = useState('');
  const [formTipoDespesaId, setFormTipoDespesaId] = useState('');
  const [formOrigem, setFormOrigem] = useState('proprio');
  const [formValor, setFormValor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  // Calculated values
  const [totalUsado, setTotalUsado] = useState(0);
  const [cestaTeto, setCestaTeto] = useState(0);
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);
  const [percentualUsado, setPercentualUsado] = useState(0);

  const currentPeriod = periods.find((p) => p.status === 'aberto');

  useEffect(() => {
    fetchData();
  }, [user]);

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

    // Fetch expense types
    const { data: typesData } = await supabase
      .from('tipos_despesas')
      .select('id, nome, origem_permitida')
      .eq('classificacao', 'variavel')
      .eq('ativo', true);

    if (typesData) {
      setExpenseTypes(typesData.map(t => ({
        id: t.id,
        nome: t.nome,
        origemPermitida: t.origem_permitida as string[],
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

    // Fetch expenses - RH/Financeiro see all, colaborador sees their own
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
        createdAt: new Date(e.created_at),
      }));

      setExpenses(mapped);

      // Calculate total used for current period
      if (colabData && currentPeriod) {
        const usado = mapped
          .filter(e => e.colaboradorId === colabData.id && e.periodoId === currentPeriod.id)
          .reduce((sum, e) => sum + e.valorConsiderado, 0);
        setTotalUsado(usado);
        setSaldoDisponivel(Number(colabData.cesta_beneficios_teto) - usado);
        setPercentualUsado((usado / Number(colabData.cesta_beneficios_teto)) * 100);
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
      render: (item: Expense) => formatDate(item.createdAt),
    },
    { key: 'colaboradorNome', header: 'Colaborador' },
    { key: 'tipoDespesaNome', header: 'Tipo de Despesa' },
    {
      key: 'origem',
      header: 'Origem',
      render: (item: Expense) => {
        const labels: Record<string, string> = { proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' };
        return labels[item.origem] || item.origem;
      },
    },
    {
      key: 'valorLancado',
      header: 'Valor Lançado',
      className: 'text-right font-mono',
      render: (item: Expense) => formatCurrency(item.valorLancado),
    },
    {
      key: 'valorConsiderado',
      header: 'Valor Considerado',
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
      header: 'Ações',
      className: 'text-right',
      render: (item: Expense) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
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
    setFormOrigem(expense.origem);
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
    setSelectedExpense(null);
    setFormPeriodoId(currentPeriod?.id || '');
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
        origem: formOrigem as 'proprio' | 'conjuge' | 'filhos',
        valor_lancado: valorLancado,
        valor_considerado: validation.valorConsiderado,
        valor_nao_considerado: validation.valorNaoConsiderado,
        descricao_fato_gerador: formDescricao,
        status: status as 'rascunho' | 'enviado',
      };

      if (selectedExpense) {
        const { error } = await supabase
          .from('lancamentos')
          .update(lancamentoData)
          .eq('id', selectedExpense.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lancamentos')
          .insert([lancamentoData]);

        if (error) throw error;
      }

      toast({
        title: status === 'rascunho' ? 'Rascunho salvo' : 'Lançamento enviado',
        description: status === 'enviado' ? 'O lançamento foi enviado para análise.' : 'O rascunho foi salvo.',
      });

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedType = expenseTypes.find(t => t.id === formTipoDespesaId);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Lançamentos de Despesas"
        description={`Período atual: ${currentPeriod?.periodo || 'N/A'}`}
      >
        <Button onClick={handleNew} disabled={!colaborador}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lançamento
        </Button>
      </PageHeader>

      {!colaborador && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            Você não está cadastrado como colaborador elegível. Entre em contato com o RH.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {colaborador && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cesta de Benefícios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lançamentos no Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{expenses.filter(e => e.periodoId === currentPeriod?.id).length}</p>
              <p className="text-xs text-muted-foreground">
                {expenses.filter(e => e.status === 'valido').length} válidos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Janela de Lançamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {currentPeriod && formatDate(currentPeriod.abreLancamento)} -{' '}
                {currentPeriod && formatDate(currentPeriod.fechaLancamento)}
              </p>
              <p className="text-xs text-success">Período aberto para lançamentos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês Referência</Label>
                {isViewMode ? (
                  <p className="font-medium">{selectedExpense?.periodo}</p>
                ) : (
                  <Select value={formPeriodoId} onValueChange={setFormPeriodoId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.filter(p => p.status === 'aberto').map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.periodo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo de Despesa</Label>
                {isViewMode ? (
                  <p className="font-medium">{selectedExpense?.tipoDespesaNome}</p>
                ) : (
                  <Select value={formTipoDespesaId} onValueChange={setFormTipoDespesaId}>
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
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Origem da Despesa</Label>
                {isViewMode ? (
                  <p className="font-medium">
                    {{ proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' }[selectedExpense?.origem || ''] || selectedExpense?.origem}
                  </p>
                ) : (
                  <Select value={formOrigem} onValueChange={setFormOrigem}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proprio" disabled={selectedType && !selectedType.origemPermitida.includes('proprio')}>
                        Próprio (Colaborador)
                      </SelectItem>
                      <SelectItem value="conjuge" disabled={selectedType && !selectedType.origemPermitida.includes('conjuge')}>
                        Cônjuge
                      </SelectItem>
                      <SelectItem value="filhos" disabled={selectedType && !selectedType.origemPermitida.includes('filhos')}>
                        Filhos
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Valor da Despesa (R$)</Label>
                {isViewMode ? (
                  <p className="font-mono text-lg font-bold">{formatCurrency(selectedExpense?.valorLancado || 0)}</p>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    placeholder="0,00"
                    className="font-mono"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição do Fato Gerador</Label>
              {isViewMode ? (
                <p className="p-3 bg-muted rounded-lg text-sm">{selectedExpense?.descricaoFatoGerador}</p>
              ) : (
                <Textarea
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder="Descreva o motivo/natureza da despesa..."
                  rows={3}
                />
              )}
            </div>

            {!isViewMode && (
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
                  <Input
                    type="file"
                    className="hidden"
                    accept=".pdf,.xlsx,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                  />
                  <Button variant="outline" size="sm" className="mt-3">
                    Selecionar Arquivo
                  </Button>
                </div>
              </div>
            )}

            {isViewMode && selectedExpense?.valorNaoConsiderado && selectedExpense.valorNaoConsiderado > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Valor Parcialmente Considerado</AlertTitle>
                <AlertDescription>
                  <strong>Valor lançado:</strong> {formatCurrency(selectedExpense.valorLancado)}<br />
                  <strong>Valor considerado:</strong> {formatCurrency(selectedExpense.valorConsiderado)}<br />
                  <strong>Valor não considerado:</strong> {formatCurrency(selectedExpense.valorNaoConsiderado)}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {isViewMode ? 'Fechar' : 'Cancelar'}
            </Button>
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
