import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Eye, AlertCircle, Loader2, Filter, CalendarIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { AttachmentViewer } from '@/components/attachments/AttachmentViewer';
import { BatchApprovalPanel } from '@/components/validation/BatchApprovalPanel';
import { createAuditLog } from '@/lib/audit-log';

interface Expense {
  id: string;
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
}

const originLabels: Record<string, string> = {
  proprio: 'Próprio',
  conjuge: 'Cônjuge',
  filhos: 'Filhos',
};

const Validacao = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
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

  const [stats, setStats] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0 });

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
        descricao_fato_gerador, status, created_at, motivo_invalidacao,
        colaboradores_elegiveis (nome, departamento),
        tipos_despesas (nome)
      `)
      .order('created_at', { ascending: false });

    if (filterStatus === 'pending') query = query.in('status', ['enviado', 'em_analise']);

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (data) {
      const mapped = data.map((e: any) => ({
        id: e.id,
        colaboradorNome: e.colaboradores_elegiveis?.nome || '',
        tipoDespesaNome: e.tipos_despesas?.nome || '',
        departamento: e.colaboradores_elegiveis?.departamento || '',
        origem: e.origem,
        valorLancado: Number(e.valor_lancado),
        valorConsiderado: Number(e.valor_considerado),
        valorNaoConsiderado: Number(e.valor_nao_considerado),
        descricaoFatoGerador: e.descricao_fato_gerador,
        status: e.status,
        createdAt: new Date(e.created_at),
        motivoInvalidacao: e.motivo_invalidacao,
      }));
      setExpenses(mapped);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setStats({
        pending: mapped.filter((e) => e.status === 'enviado' || e.status === 'em_analise').length,
        approvedToday: mapped.filter((e) => e.status === 'valido' && new Date(e.createdAt) >= today).length,
        rejectedToday: mapped.filter((e) => e.status === 'invalido' && new Date(e.createdAt) >= today).length,
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

  const columns = [
    {
      key: 'select',
      header: '',
      className: 'w-10',
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
      render: (item: Expense) => formatDate(item.createdAt),
    },
    { key: 'colaboradorNome', header: 'Colaborador' },
    { key: 'tipoDespesaNome', header: 'Tipo de Despesa' },
    {
      key: 'origem',
      header: 'Origem',
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
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleView(item)}>
            <Eye className="h-4 w-4" />
          </Button>
          {(item.status === 'enviado' || item.status === 'em_analise') && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-success hover:text-success"
                onClick={() => handleApprove(item)}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setSelectedExpense(item);
                  setRejectionReason('');
                  setIsDialogOpen(true);
                }}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const handleView = (expense: Expense) => {
    setSelectedExpense(expense);
    setRejectionReason('');
    setIsDialogOpen(true);
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
      // Create audit log
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

  const handleReject = async () => {
    if (!selectedExpense || !rejectionReason.trim()) {
      toast({ title: 'Motivo obrigatório', description: 'Por favor, informe o motivo da invalidação.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'invalido', motivo_invalidacao: rejectionReason, validado_por: user?.id, validado_em: new Date().toISOString() })
      .eq('id', selectedExpense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      // Create audit log
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user?.id).maybeSingle();
      await createAuditLog({
        userId: user?.id || '',
        userName: profile?.nome || user?.email || '',
        action: 'rejeitar',
        entityType: 'lancamento',
        entityId: selectedExpense.id,
        entityDescription: `${selectedExpense.colaboradorNome} - ${selectedExpense.tipoDespesaNome} - ${formatCurrency(selectedExpense.valorLancado)}`,
        oldValues: { status: selectedExpense.status },
        newValues: { status: 'invalido', motivo: rejectionReason },
      });
      toast({ title: 'Despesa invalidada', description: `Lançamento de ${selectedExpense.colaboradorNome} foi marcado como inválido.` });
      setIsDialogOpen(false);
      fetchExpenses();
    }
    setProcessing(false);
  };

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Pendentes de Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">lançamentos aguardando validação</p>
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
            <p className="text-3xl font-bold text-success">{stats.approvedToday}</p>
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
            <p className="text-3xl font-bold text-destructive">{stats.rejectedToday}</p>
            <p className="text-xs text-muted-foreground">despesas invalidadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
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
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" />
            Filtros Avançados
          </Button>
        </div>

        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent>
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analisar Lançamento</DialogTitle>
            <DialogDescription>Revise os dados e decida sobre a validação</DialogDescription>
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
                  <p className="font-medium">{originLabels[selectedExpense.origem] || selectedExpense.origem}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor Lançado</Label>
                  <p className="font-mono text-lg font-bold">{formatCurrency(selectedExpense.valorLancado)}</p>
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
                <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{selectedExpense.descricaoFatoGerador}</p>
              </div>

              {/* Attachments */}
              <div>
                <Label className="text-muted-foreground">Comprovantes Anexados</Label>
                <div className="mt-2">
                  <AttachmentViewer lancamentoId={selectedExpense.id} />
                </div>
              </div>

              <Separator />

              {/* Rejection Reason */}
              {(selectedExpense.status === 'enviado' || selectedExpense.status === 'em_analise') && (
                <div className="space-y-2">
                  <Label>Motivo da Invalidação (se aplicável)</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Descreva o motivo caso precise invalidar esta despesa..."
                    rows={3}
                  />
                </div>
              )}

              {selectedExpense.status === 'invalido' && selectedExpense.motivoInvalidacao && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <Label className="text-destructive">Motivo da Invalidação</Label>
                  <p className="mt-1 text-sm">{selectedExpense.motivoInvalidacao}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            {selectedExpense && (selectedExpense.status === 'enviado' || selectedExpense.status === 'em_analise') && (
              <>
                <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim() || processing}>
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                  disabled={processing}
                >
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aprovar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Validacao;
