import { useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  mockExpenses,
  mockExpenseTypes,
  mockCalendarPeriods,
  formatCurrency,
  formatDate,
  getOriginLabel,
} from '@/lib/mock-data';
import { Expense, ExpenseOrigin } from '@/types';

const Lancamentos = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // Simulação de valores para demonstração
  const cestaBeneficiosTeto = 2000;
  const totalUsado = 1500;
  const saldoDisponivel = cestaBeneficiosTeto - totalUsado;
  const percentualUsado = (totalUsado / cestaBeneficiosTeto) * 100;

  const currentPeriod = mockCalendarPeriods.find((p) => p.status === 'aberto');

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
      render: (item: Expense) => getOriginLabel(item.origem),
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
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
            disabled={item.status !== 'rascunho' && item.status !== 'enviado'}
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
            disabled={item.status !== 'rascunho'}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
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
    setIsViewMode(false);
    setIsDialogOpen(true);
  };

  const handleDelete = (expense: Expense) => {
    if (confirm('Deseja realmente excluir este lançamento?')) {
      setExpenses(expenses.filter((e) => e.id !== expense.id));
      toast({
        title: 'Lançamento excluído',
        description: 'O lançamento foi removido com sucesso.',
      });
    }
  };

  const handleNew = () => {
    setSelectedExpense(null);
    setIsViewMode(false);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Lançamentos de Despesas"
        description={`Período atual: ${currentPeriod?.periodo || 'N/A'}`}
      >
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lançamento
        </Button>
      </PageHeader>

      {/* Summary Cards */}
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
              <Progress value={percentualUsado} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Saldo: {formatCurrency(saldoDisponivel)}</span>
                <span>Teto: {formatCurrency(cestaBeneficiosTeto)}</span>
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
            <p className="text-2xl font-bold">{expenses.length}</p>
            <p className="text-xs text-muted-foreground">
              {expenses.filter((e) => e.status === 'valido').length} válidos
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

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por colaborador ou tipo de despesa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="valido">Válido</SelectItem>
            <SelectItem value="invalido">Inválido</SelectItem>
          </SelectContent>
        </Select>
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
              {isViewMode
                ? 'Visualizar Lançamento'
                : selectedExpense
                ? 'Editar Lançamento'
                : 'Novo Lançamento'}
            </DialogTitle>
            <DialogDescription>
              {isViewMode
                ? 'Detalhes do lançamento de despesa'
                : 'Preencha os dados do lançamento'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Saldo Alert */}
            {!isViewMode && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Saldo Disponível</AlertTitle>
                <AlertDescription>
                  Você possui <strong>{formatCurrency(saldoDisponivel)}</strong> disponíveis
                  de <strong>{formatCurrency(cestaBeneficiosTeto)}</strong> da Cesta de Benefícios.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês Referência</Label>
                <Select
                  defaultValue={selectedExpense?.periodoId || currentPeriod?.id || ''}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCalendarPeriods
                      .filter((p) => p.status === 'aberto')
                      .map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.periodo}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Despesa</Label>
                <Select
                  defaultValue={selectedExpense?.tipoDespesaId || ''}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockExpenseTypes
                      .filter((t) => t.classificacao === 'variavel' && t.ativo)
                      .map((type) => (
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
                  defaultValue={selectedExpense?.origem || 'proprio'}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proprio">Próprio (Colaborador)</SelectItem>
                    <SelectItem value="conjuge">Cônjuge</SelectItem>
                    <SelectItem value="filhos">Filhos</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Disponibilidade conforme tipo de despesa selecionado
                </p>
              </div>

              <div className="space-y-2">
                <Label>Valor da Despesa (R$)</Label>
                <Input
                  type="number"
                  defaultValue={selectedExpense?.valorLancado || ''}
                  disabled={isViewMode}
                  placeholder="0,00"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição do Fato Gerador</Label>
              <Textarea
                defaultValue={selectedExpense?.descricaoFatoGerador || ''}
                disabled={isViewMode}
                placeholder="Descreva o motivo/natureza da despesa..."
                rows={3}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Anexo do Comprovante</Label>
              {isViewMode ? (
                selectedExpense?.anexos && selectedExpense.anexos.length > 0 ? (
                  <div className="space-y-2">
                    {selectedExpense.anexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <span className="text-sm">{anexo.nomeArquivo}</span>
                        <Button variant="outline" size="sm">
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum anexo vinculado a este lançamento.
                  </p>
                )
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Arraste arquivos ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: PDF, XLSX, DOC, DOCX, PNG, JPG (máx. 5MB)
                  </p>
                  <Input type="file" className="hidden" accept=".pdf,.xlsx,.doc,.docx,.png,.jpg,.jpeg" />
                  <Button variant="outline" size="sm" className="mt-3">
                    Selecionar Arquivo
                  </Button>
                </div>
              )}
            </div>

            {isViewMode && selectedExpense?.status === 'invalido' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Despesa Invalidada</AlertTitle>
                <AlertDescription>
                  {selectedExpense.motivoInvalidacao || 'Motivo não informado.'}
                </AlertDescription>
              </Alert>
            )}

            {isViewMode && selectedExpense?.valorNaoConsiderado && selectedExpense.valorNaoConsiderado > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Valor Parcialmente Considerado</AlertTitle>
                <AlertDescription>
                  <strong>Valor lançado:</strong> {formatCurrency(selectedExpense.valorLancado)}
                  <br />
                  <strong>Valor considerado:</strong> {formatCurrency(selectedExpense.valorConsiderado)}
                  <br />
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
                <Button
                  variant="secondary"
                  onClick={() => {
                    toast({
                      title: 'Rascunho salvo',
                      description: 'O lançamento foi salvo como rascunho.',
                    });
                    setIsDialogOpen(false);
                  }}
                >
                  Salvar Rascunho
                </Button>
                <Button
                  onClick={() => {
                    toast({
                      title: 'Lançamento enviado',
                      description: 'O lançamento foi enviado para análise.',
                    });
                    setIsDialogOpen(false);
                  }}
                >
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
