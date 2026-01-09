import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { AttachmentViewer } from '@/components/attachments/AttachmentViewer';
import { ExpenseTimeline } from '@/components/lancamentos/ExpenseTimeline';
import lancamentosService, { Lancamento } from '@/services/lancamentos.service';

const originLabels: Record<string, string> = {
  proprio: 'Próprio',
  conjuge: 'Cônjuge',
  filhos: 'Filhos',
};

const ValidacaoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [expense, setExpense] = useState<Lancamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (id) fetchExpense();
  }, [id]);

  const fetchExpense = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await lancamentosService.getById(id);
      setExpense(data);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      navigate('/validacao');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!expense) return;
    setProcessing(true);
    try {
      await lancamentosService.iniciarAnalise(expense.id);
      toast({ title: 'Análise iniciada' });
      fetchExpense();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!expense) return;
    setProcessing(true);
    try {
      await lancamentosService.aprovar(expense.id);
      toast({ title: 'Despesa aprovada' });
      navigate('/validacao');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!expense || !rejectionReason.trim()) {
      toast({ title: 'Motivo obrigatório', description: 'Por favor, informe o motivo da invalidação.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      await lancamentosService.rejeitar(expense.id, rejectionReason);
      toast({ title: 'Despesa invalidada' });
      navigate('/validacao');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!expense) return null;

  const canValidate = expense.status === 'enviado' || expense.status === 'em_analise';
  const colaboradorNome = expense.colaborador?.nome || '';
  const tipoDespesaNome = expense.tipo_despesa?.nome || '';
  const departamento = expense.colaborador?.departamento || '';

  return (
    <PageFormLayout
      title="Analisar Lançamento"
      description="Revise os dados e decida sobre a validação"
      backTo="/validacao"
      backLabel="Voltar"
      isViewMode={true}
      extraActions={
        canValidate && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
            {expense.status === 'enviado' && (
              <Button
                variant="outline"
                onClick={handleStartAnalysis}
                disabled={processing}
              >
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Clock className="mr-2 h-4 w-4" />
                Iniciar Análise
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processing}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <XCircle className="mr-2 h-4 w-4" />
              Invalidar
            </Button>
            <Button
              className="bg-success hover:bg-success/90"
              onClick={handleApprove}
              disabled={processing}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-6">
        {/* Expense Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Colaborador</Label>
            <p className="font-medium">{colaboradorNome}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Data do Lançamento</Label>
            <p className="font-medium">{formatDate(new Date(expense.created_at))}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Tipo de Despesa</Label>
            <p className="font-medium">{tipoDespesaNome}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Origem</Label>
            <p className="font-medium">{originLabels[expense.origem] || expense.origem}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Valor Lançado</Label>
            <p className="font-mono text-lg font-bold">{formatCurrency(expense.valor_lancado)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Status Atual</Label>
            <div className="mt-1">
              <StatusBadge status={expense.status} />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <Label className="text-muted-foreground">Descrição do Fato Gerador</Label>
          <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{expense.descricao_fato_gerador}</p>
        </div>

        {/* Attachments */}
        <div>
          <Label className="text-muted-foreground">Comprovantes Anexados</Label>
          <div className="mt-2">
            <AttachmentViewer lancamentoId={expense.id} />
          </div>
        </div>

        {/* Expense Timeline */}
        <ExpenseTimeline expenseId={expense.id} />

        <Separator />

        {/* Rejection Reason */}
        {canValidate && (
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

        {expense.status === 'invalido' && expense.motivo_invalidacao && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <Label className="text-destructive">Motivo da Invalidação</Label>
            <p className="mt-1 text-sm">{expense.motivo_invalidacao}</p>
          </div>
        )}
      </div>
    </PageFormLayout>
  );
};

export default ValidacaoDetalhe;
