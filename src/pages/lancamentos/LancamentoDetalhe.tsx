import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit, Loader2, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import { AttachmentUploadSimple } from '@/components/attachments/AttachmentUploadSimple';
import { ExpenseTimeline } from '@/components/lancamentos/ExpenseTimeline';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/expense-validation';
import { createAuditLog } from '@/lib/audit-log';

interface Expense {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  periodoId: string;
  periodo: string;
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

const LancamentoDetalhe = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const [sendingToAnalysis, setSendingToAnalysis] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isRHorFinanceiro = hasRole('RH') || hasRole('FINANCEIRO');
  const canValidate = isRHorFinanceiro && (expense?.status === 'enviado' || expense?.status === 'em_analise');

  useEffect(() => {
    fetchExpense();
  }, [id]);

  const fetchExpense = async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('lancamentos')
      .select(`
        id, origem, valor_lancado, valor_considerado, valor_nao_considerado,
        descricao_fato_gerador, status, motivo_invalidacao, created_at, colaborador_id,
        colaboradores_elegiveis (id, nome),
        calendario_periodos (id, periodo),
        tipos_despesas (nome)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      navigate('/lancamentos');
    } else if (data) {
      setExpense({
        id: data.id,
        colaboradorId: (data.colaboradores_elegiveis as any)?.id || data.colaborador_id,
        colaboradorNome: (data.colaboradores_elegiveis as any)?.nome || '',
        periodoId: (data.calendario_periodos as any)?.id,
        periodo: (data.calendario_periodos as any)?.periodo || '',
        tipoDespesaNome: (data.tipos_despesas as any)?.nome || '',
        origem: data.origem,
        valorLancado: Number(data.valor_lancado),
        valorConsiderado: Number(data.valor_considerado),
        valorNaoConsiderado: Number(data.valor_nao_considerado),
        descricaoFatoGerador: data.descricao_fato_gerador,
        status: data.status,
        motivoInvalidacao: data.motivo_invalidacao,
        createdAt: new Date(data.created_at),
      });

      // Count attachments
      const { count } = await supabase
        .from('anexos')
        .select('*', { count: 'exact', head: true })
        .eq('lancamento_id', id);
      setAttachmentCount(count || 0);
    }
    setLoading(false);
  };

  const handleSendToAnalysis = async () => {
    if (!expense) return;
    setSendingToAnalysis(true);
    try {
      const { error } = await supabase.from('lancamentos').update({ status: 'enviado' }).eq('id', expense.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Lançamento enviado para análise.' });
      fetchExpense();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSendingToAnalysis(false);
    }
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
      // Navigate back to collaborator's expenses
      navigate(`/lancamentos/colaborador/${expense.colaboradorId}?periodo=${expense.periodoId}`);
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
      navigate(`/lancamentos/colaborador/${expense.colaboradorId}?periodo=${expense.periodoId}`);
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

  const originLabels: Record<string, string> = { proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' };

  // Determine back path based on context
  const backPath = isRHorFinanceiro && expense.colaboradorId 
    ? `/lancamentos/colaborador/${expense.colaboradorId}?periodo=${expense.periodoId}`
    : '/lancamentos';

  return (
    <PageFormLayout
      title="Detalhes do Lançamento"
      description={`Criado em ${expense.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
      backTo={backPath}
      backLabel="Voltar"
      isViewMode
      extraActions={
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          {/* Collaborator actions - edit and send to analysis */}
          {expense.status === 'rascunho' && (
            <>
              <Button variant="outline" onClick={() => navigate(`/lancamentos/${id}/editar`)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={sendingToAnalysis}>
                    {sendingToAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Enviar para Análise
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Enviar para análise?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>Após o envio, o lançamento não poderá mais ser editado ou excluído.</p>
                        {attachmentCount === 0 && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Atenção: Sem comprovantes</AlertTitle>
                            <AlertDescription>Este lançamento não possui comprovantes anexados.</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSendToAnalysis}>
                      {attachmentCount === 0 ? 'Enviar mesmo assim' : 'Confirmar Envio'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          
          {/* RH validation actions */}
          {canValidate && (
            <>
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
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3">
          <StatusBadge status={expense.status as any} />
          {isRHorFinanceiro && expense.colaboradorNome && (
            <span className="text-sm text-muted-foreground">
              Colaborador: <span className="font-medium text-foreground">{expense.colaboradorNome}</span>
            </span>
          )}
        </div>

        {/* Rejection reason */}
        {expense.status === 'invalido' && expense.motivoInvalidacao && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Motivo da Invalidação</AlertTitle>
            <AlertDescription>{expense.motivoInvalidacao}</AlertDescription>
          </Alert>
        )}

        {/* Main Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Mês Referência</p>
            <p className="font-semibold text-lg">{expense.periodo}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Tipo de Despesa</p>
            <p className="font-semibold text-lg">{expense.tipoDespesaNome}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Origem da Despesa</p>
            <p className="font-semibold text-lg">{originLabels[expense.origem] || expense.origem}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Valor Lançado</p>
            <p className="font-mono font-bold text-xl text-primary">{formatCurrency(expense.valorLancado)}</p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Descrição do Fato Gerador</p>
          <div className="p-4 bg-muted/50 rounded-lg border">
            <p className="text-sm whitespace-pre-wrap">{expense.descricaoFatoGerador}</p>
          </div>
        </div>

        {/* Value breakdown */}
        {expense.valorNaoConsiderado > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Valor Parcialmente Considerado</AlertTitle>
            <AlertDescription>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Lançado</p>
                  <p className="font-mono font-medium">{formatCurrency(expense.valorLancado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Considerado</p>
                  <p className="font-mono font-medium text-success">{formatCurrency(expense.valorConsiderado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Não Considerado</p>
                  <p className="font-mono font-medium text-destructive">{formatCurrency(expense.valorNaoConsiderado)}</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Attachments */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Comprovantes Anexados</h3>
          <AttachmentList 
            lancamentoId={expense.id} 
            onCountChange={setAttachmentCount}
            allowDelete={expense.status === 'rascunho'}
            onDeleteComplete={() => setAttachmentRefreshKey(k => k + 1)}
          />
          {expense.status === 'rascunho' && (
            <AttachmentUploadSimple
              lancamentoId={expense.id}
              onUploadComplete={() => setAttachmentRefreshKey(k => k + 1)}
            />
          )}
        </div>

        <Separator />

        {/* Rejection Reason Input for RH */}
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

        {/* Timeline */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Histórico de Ações</h3>
          <ExpenseTimeline expenseId={expense.id} />
        </div>
      </div>
    </PageFormLayout>
  );
};

export default LancamentoDetalhe;
