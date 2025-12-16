import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit, Loader2, AlertCircle } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import { AttachmentUploadSimple } from '@/components/attachments/AttachmentUploadSimple';
import { ExpenseTimeline } from '@/components/lancamentos/ExpenseTimeline';
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
import { formatCurrency, formatDate } from '@/lib/expense-validation';

interface Expense {
  id: string;
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
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const [sendingToAnalysis, setSendingToAnalysis] = useState(false);

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
        descricao_fato_gerador, status, motivo_invalidacao, created_at,
        colaboradores_elegiveis (nome),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!expense) return null;

  const originLabels: Record<string, string> = { proprio: 'Próprio', conjuge: 'Cônjuge', filhos: 'Filhos' };

  return (
    <PageFormLayout
      title="Detalhes do Lançamento"
      description={`Criado em ${expense.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
      backTo="/lancamentos"
      backLabel="Voltar para lista"
      isViewMode
      extraActions={
        expense.status === 'rascunho' && (
          <div className="flex gap-2">
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
          </div>
        )
      }
    >
      <div className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3">
          <StatusBadge status={expense.status as any} />
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
        <div className="grid grid-cols-2 gap-6">
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
              <div className="grid grid-cols-3 gap-4 mt-2">
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
