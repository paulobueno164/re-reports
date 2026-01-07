import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { PageFormLayout } from "@/components/ui/page-form-layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { ExpenseTimeline } from "@/components/lancamentos/ExpenseTimeline";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/expense-validation";
import lancamentosService, { Lancamento } from "@/services/lancamentos.service";
import { anexosService } from "@/services/anexos.service";

const LancamentoDetalhe = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const { hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<Lancamento | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const [sendingToAnalysis, setSendingToAnalysis] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReasonError, setShowReasonError] = useState(false);
  const rejectionReasonRef = useRef<HTMLTextAreaElement>(null);

  const isRHorFinanceiro = hasRole("RH") || hasRole("FINANCEIRO");
  const canValidate = (hasRole("RH") || hasRole("FINANCEIRO")) && (expense?.status === "enviado" || expense?.status === "em_analise");

  useEffect(() => {
    fetchExpense();
  }, [id]);

  const fetchExpense = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const data = await lancamentosService.getById(id);
      setExpense(data);

      // Count attachments
      const anexos = await anexosService.getByLancamentoId(id);
      setAttachmentCount(anexos.length);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      navigate("/lancamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAnalysis = async () => {
    if (!expense) return;
    setSendingToAnalysis(true);
    try {
      await lancamentosService.update(expense.id, {});
      toast({ title: "Sucesso", description: "Lançamento enviado para análise." });
      fetchExpense();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSendingToAnalysis(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!expense) return;
    setProcessing(true);
    try {
      await lancamentosService.iniciarAnalise(expense.id);
      toast({ title: "Análise iniciada" });
      fetchExpense();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!expense) return;
    setProcessing(true);
    try {
      await lancamentosService.aprovar(expense.id);
      toast({ title: "Despesa aprovada" });
      navigate(`/lancamentos/colaborador/${expense.colaborador_id}?periodo=${expense.periodo_id}`);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!expense || !rejectionReason.trim()) {
      setShowReasonError(true);
      rejectionReasonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      rejectionReasonRef.current?.focus();
      toast({
        title: "Motivo obrigatório",
        description: "Por favor, informe o motivo da invalidação.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      await lancamentosService.rejeitar(expense.id, rejectionReason);
      toast({ title: "Despesa invalidada" });
      navigate(`/lancamentos/colaborador/${expense.colaborador_id}?periodo=${expense.periodo_id}`);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
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

  const originLabels: Record<string, string> = { proprio: "Próprio", conjuge: "Cônjuge", filhos: "Filhos" };
  const colaboradorNome = expense.colaborador?.nome || "";
  const tipoDespesaNome = expense.tipo_despesa?.nome || "";
  const periodo = expense.periodo?.periodo || "";

  const backPath =
    isRHorFinanceiro && expense.colaborador_id
      ? `/lancamentos/colaborador/${expense.colaborador_id}?periodo=${expense.periodo_id}`
      : "/lancamentos";

  return (
    <PageFormLayout
      title="Detalhes do Lançamento"
      description={`Criado em ${new Date(expense.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
      backTo={backPath}
      backLabel="Voltar"
      isViewMode
      extraActions={
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          {canValidate && (
            <>
              {expense.status === "enviado" && (
                <Button variant="outline" onClick={handleStartAnalysis} disabled={processing}>
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Clock className="mr-2 h-4 w-4" />
                  Iniciar Análise
                </Button>
              )}
              <Button variant="destructive" onClick={handleReject} disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <XCircle className="mr-2 h-4 w-4" />
                Rejeitar
              </Button>
              <Button className="bg-success hover:bg-success/90" onClick={handleApprove} disabled={processing}>
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
          {isRHorFinanceiro && colaboradorNome && (
            <span className="text-sm text-muted-foreground">
              Colaborador: <span className="font-medium text-foreground">{colaboradorNome}</span>
            </span>
          )}
        </div>

        {/* Rejection reason */}
        {expense.status === "invalido" && expense.motivo_invalidacao && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Motivo da Invalidação</AlertTitle>
            <AlertDescription>{expense.motivo_invalidacao}</AlertDescription>
          </Alert>
        )}

        {/* Main Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Mês Referência</p>
            <p className="font-semibold text-lg">{periodo}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Tipo de Despesa</p>
            <p className="font-semibold text-lg">{tipoDespesaNome}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Origem da Despesa</p>
            <p className="font-semibold text-lg">{originLabels[expense.origem] || expense.origem}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Valor Lançado</p>
            <p className="font-mono font-bold text-xl text-primary">{formatCurrency(expense.valor_lancado)}</p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Descrição do Fato Gerador</p>
          <div className="p-4 bg-muted/50 rounded-lg border">
            <p className="text-sm whitespace-pre-wrap">{expense.descricao_fato_gerador}</p>
          </div>
        </div>

        {/* Value breakdown */}
        {expense.valor_nao_considerado > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Valor Parcialmente Considerado</AlertTitle>
            <AlertDescription>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Lançado</p>
                  <p className="font-mono font-medium">{formatCurrency(expense.valor_lancado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Considerado</p>
                  <p className="font-mono font-medium text-success">{formatCurrency(expense.valor_considerado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Não Considerado</p>
                  <p className="font-mono font-medium text-destructive">
                    {formatCurrency(expense.valor_nao_considerado)}
                  </p>
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
            allowDelete={false}
            onDeleteComplete={() => setAttachmentRefreshKey((k) => k + 1)}
          />
        </div>

        <Separator />

        {/* Rejection Reason Input for RH */}
        {canValidate && (
          <div className="space-y-2">
            <Label className={showReasonError ? "text-destructive" : ""}>
              Motivo da Invalidação (se aplicável)
            </Label>
            <Textarea
              ref={rejectionReasonRef}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (showReasonError) setShowReasonError(false);
              }}
              placeholder="Descreva o motivo caso precise invalidar esta despesa..."
              rows={3}
              className={showReasonError ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {showReasonError && (
              <p className="text-sm text-destructive">Preencha o motivo antes de rejeitar</p>
            )}
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
