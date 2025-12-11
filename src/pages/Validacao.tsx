import { useState } from 'react';
import { Search, CheckCircle, XCircle, Eye, AlertCircle } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { mockExpenses, formatCurrency, formatDate, getOriginLabel } from '@/lib/mock-data';
import { Expense } from '@/types';

const Validacao = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>(
    mockExpenses.filter((e) => e.status === 'enviado' || e.status === 'em_analise')
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const pendingCount = expenses.filter((e) => e.status === 'enviado' || e.status === 'em_analise').length;

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
            className="text-success hover:text-success"
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(item);
            }}
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedExpense(item);
              setRejectionReason('');
              setIsDialogOpen(true);
            }}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleView = (expense: Expense) => {
    setSelectedExpense(expense);
    setRejectionReason('');
    setIsDialogOpen(true);
  };

  const handleApprove = (expense: Expense) => {
    setExpenses(
      expenses.map((e) =>
        e.id === expense.id ? { ...e, status: 'valido' as const } : e
      )
    );
    toast({
      title: 'Despesa aprovada',
      description: `Lançamento de ${expense.colaboradorNome} foi marcado como válido.`,
    });
  };

  const handleReject = () => {
    if (!selectedExpense) return;
    if (!rejectionReason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Por favor, informe o motivo da invalidação.',
        variant: 'destructive',
      });
      return;
    }

    setExpenses(
      expenses.map((e) =>
        e.id === selectedExpense.id
          ? { ...e, status: 'invalido' as const, motivoInvalidacao: rejectionReason }
          : e
      )
    );
    toast({
      title: 'Despesa invalidada',
      description: `Lançamento de ${selectedExpense.colaboradorNome} foi marcado como inválido.`,
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Validação de Despesas"
        description="Analise e valide os lançamentos de despesas dos colaboradores"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Pendentes de Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">
              lançamentos aguardando validação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Aprovados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">5</p>
            <p className="text-xs text-muted-foreground">despesas validadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Rejeitados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">1</p>
            <p className="text-xs text-muted-foreground">despesas invalidadas</p>
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
        <Select defaultValue="pending">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        data={filteredExpenses}
        columns={columns}
        emptyMessage="Nenhum lançamento pendente de validação"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Analisar Lançamento</DialogTitle>
            <DialogDescription>
              Revise os dados e decida sobre a validação
            </DialogDescription>
          </DialogHeader>

          {selectedExpense && (
            <div className="space-y-6 py-4">
              {/* Expense Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Colaborador</Label>
                  <p className="font-medium">{selectedExpense.colaboradorNome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data do Lançamento</Label>
                  <p className="font-medium">{formatDate(selectedExpense.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tipo de Despesa</Label>
                  <p className="font-medium">{selectedExpense.tipoDespesaNome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Origem</Label>
                  <p className="font-medium">{getOriginLabel(selectedExpense.origem)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor Lançado</Label>
                  <p className="font-mono text-lg font-bold">
                    {formatCurrency(selectedExpense.valorLancado)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status Atual</Label>
                  <div className="mt-1">
                    <StatusBadge status={selectedExpense.status} />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground">Descrição do Fato Gerador</Label>
                <p className="mt-1 p-3 bg-muted rounded-lg text-sm">
                  {selectedExpense.descricaoFatoGerador}
                </p>
              </div>

              {/* Attachments */}
              <div>
                <Label className="text-muted-foreground">Comprovantes Anexados</Label>
                {selectedExpense.anexos && selectedExpense.anexos.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedExpense.anexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <span className="text-sm">{anexo.nomeArquivo}</span>
                        <Button variant="outline" size="sm">
                          Visualizar
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    Nenhum comprovante anexado
                  </p>
                )}
              </div>

              <Separator />

              {/* Rejection Reason */}
              <div className="space-y-2">
                <Label>Motivo da Invalidação (se aplicável)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Descreva o motivo caso precise invalidar esta despesa..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Invalidar
            </Button>
            <Button
              className="bg-success hover:bg-success/90"
              onClick={() => {
                if (selectedExpense) {
                  handleApprove(selectedExpense);
                  setIsDialogOpen(false);
                }
              }}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Validacao;
