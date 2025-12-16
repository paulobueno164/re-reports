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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { AttachmentViewer } from '@/components/attachments/AttachmentViewer';
import { ExpenseTimeline } from '@/components/lancamentos/ExpenseTimeline';
import { createAuditLog } from '@/lib/audit-log';

interface Expense {
  id: string;
  colaboradorId: string;
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

const ValidacaoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (id) fetchExpense();
  }, [id]);

  const fetchExpense = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lancamentos')
      .select(`
        id, origem, valor_lancado, valor_considerado, valor_nao_considerado,
        descricao_fato_gerador, status, created_at, motivo_invalidacao, colaborador_id,
        colaboradores_elegiveis (id, nome, departamento),
        tipos_despesas (nome)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (data) {
      setExpense({
        id: data.id,
        colaboradorId: data.colaboradores_elegiveis?.id || data.colaborador_id || '',
        colaboradorNome: data.colaboradores_elegiveis?.nome || '',
        tipoDespesaNome: data.tipos_despesas?.nome || '',
        departamento: data.colaboradores_elegiveis?.departamento || '',
        origem: data.origem,
        valorLancado: Number(data.valor_lancado),
        valorConsiderado: Number(data.valor_considerado),
        valorNaoConsiderado: Number(data.valor_nao_considerado),
        descricaoFatoGerador: data.descricao_fato_gerador,
        status: data.status,
        createdAt: new Date(data.created_at),
        motivoInvalidacao: data.motivo_invalidacao || undefined,
      });
    } else {
      toast({ title: 'Erro', description: 'Lançamento não encontrado', variant: 'destructive' });
      navigate('/validacao');
    }
    setLoading(false);
  };

  const handleStartAnalysis = async () => {
    if (!expense) return;
    setProcessing(true);
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'em_analise' })
      .eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user?.id).maybeSingle();
      await createAuditLog({
        userId: user?.id || '',
        userName: profile?.nome || user?.email || '',
        action: 'iniciar_analise',
        entityType: 'lancamento',
        entityId: expense.id,
        entityDescription: `${expense.colaboradorNome} - ${expense.tipoDespesaNome} - ${formatCurrency(expense.valorLancado)}`,
        oldValues: { status: expense.status },
        newValues: { status: 'em_analise' },
      });
      toast({ title: 'Análise iniciada' });
      fetchExpense();
    }
    setProcessing(false);
  };

  const handleApprove = async () => {
    if (!expense) return;
    setProcessing(true);
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'valido', validado_por: user?.id, validado_em: new Date().toISOString() })
      .eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
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
      toast({ title: 'Despesa aprovada' });
      navigate('/validacao');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!expense || !rejectionReason.trim()) {
      toast({ title: 'Motivo obrigatório', description: 'Por favor, informe o motivo da invalidação.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'invalido', motivo_invalidacao: rejectionReason, validado_por: user?.id, validado_em: new Date().toISOString() })
      .eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user?.id).maybeSingle();
      await createAuditLog({
        userId: user?.id || '',
        userName: profile?.nome || user?.email || '',
        action: 'rejeitar',
        entityType: 'lancamento',
        entityId: expense.id,
        entityDescription: `${expense.colaboradorNome} - ${expense.tipoDespesaNome} - ${formatCurrency(expense.valorLancado)}`,
        oldValues: { status: expense.status },
        newValues: { status: 'invalido', motivo: rejectionReason },
      });
      toast({ title: 'Despesa invalidada' });
      navigate('/validacao');
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

  if (!expense) return null;

  const canValidate = expense.status === 'enviado' || expense.status === 'em_analise';

  return (
    <PageFormLayout
      title="Analisar Lançamento"
      description="Revise os dados e decida sobre a validação"
      backTo="/validacao"
      backLabel="Voltar"
      isViewMode={true}
      extraActions={
        canValidate && (
          <div className="flex flex-wrap gap-2">
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
            <p className="font-medium">{expense.colaboradorNome}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Data do Lançamento</Label>
            <p className="font-medium">{formatDate(expense.createdAt)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Tipo de Despesa</Label>
            <p className="font-medium">{expense.tipoDespesaNome}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Origem</Label>
            <p className="font-medium">{originLabels[expense.origem] || expense.origem}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Valor Lançado</Label>
            <p className="font-mono text-lg font-bold">{formatCurrency(expense.valorLancado)}</p>
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
          <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{expense.descricaoFatoGerador}</p>
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

        {expense.status === 'invalido' && expense.motivoInvalidacao && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <Label className="text-destructive">Motivo da Invalidação</Label>
            <p className="mt-1 text-sm">{expense.motivoInvalidacao}</p>
          </div>
        )}
      </div>
    </PageFormLayout>
  );
};

export default ValidacaoDetalhe;
