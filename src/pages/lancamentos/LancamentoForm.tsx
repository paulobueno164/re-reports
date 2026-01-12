import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, Loader2, FileText, X, AlertCircle, CreditCard, AlertTriangle } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  validarLancamentoCesta,
  formatCurrency,
  validarOrigemDespesa,
  gerarHashComprovante
} from '@/lib/expense-validation';
import { AttachmentUploadSimple } from '@/components/attachments/AttachmentUploadSimple';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import colaboradoresService from '@/services/colaboradores.service';
import periodosService from '@/services/periodos.service';
import tiposDespesasService from '@/services/tipos-despesas.service';
import lancamentosService from '@/services/lancamentos.service';
import anexosService from '@/services/anexos.service';
import { findCurrentPeriod } from '@/lib/utils';

interface ExpenseType {
  id: string;
  nome: string;
  origemPermitida: ('proprio' | 'conjuge' | 'filhos')[];
}

interface CalendarPeriod {
  id: string;
  periodo: string;
  status: string;
  dataInicio: Date;
  dataFinal: Date;
  abreLancamento: Date;
  fechaLancamento: Date;
}

const originLabels: Record<string, string> = {
  proprio: 'Próprio (Colaborador)',
  conjuge: 'Cônjuge',
  filhos: 'Filhos',
};

const LancamentoForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [colaborador, setColaborador] = useState<{ id: string; nome: string } | null>(null);
  const [existingAttachmentHashes, setExistingAttachmentHashes] = useState<Set<string>>(new Set());
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);

  // Form state
  const [formPeriodoId, setFormPeriodoId] = useState('');
  const [formTipoDespesaId, setFormTipoDespesaId] = useState('');
  const [formOrigem, setFormOrigem] = useState<'proprio' | 'conjuge' | 'filhos'>('proprio');
  const [formValor, setFormValor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formNumeroDocumento, setFormNumeroDocumento] = useState('');
  const [formParcelamentoAtivo, setFormParcelamentoAtivo] = useState(false);
  const [formParcelamentoValorTotal, setFormParcelamentoValorTotal] = useState('');
  const [formParcelamentoTotalParcelas, setFormParcelamentoTotalParcelas] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  // Calculated values
  const [totalUsado, setTotalUsado] = useState(0);
  const [cestaTeto, setCestaTeto] = useState(0);
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);

  // Dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<{
    valorLancado: number;
    valorConsiderado: number;
    valorNaoConsiderado: number;
    validation: any;
  } | null>(null);


  useEffect(() => {
    fetchData();
  }, [user, id]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch colaborador
      const colabData = await colaboradoresService.getByUserId(user.id);

      if (colabData) {
        setColaborador({
          id: colabData.id,
          nome: colabData.nome,
        });
        setCestaTeto(Number(colabData.cesta_beneficios_teto) || 0);

        // Fetch expense types for this colaborador
        const vinculosData = await colaboradoresService.getTiposDespesas(colabData.id);
        let typesData: ExpenseType[] = [];

        if (vinculosData && vinculosData.length > 0) {
          typesData = vinculosData
            .filter((v: any) => v.tipo_despesa)
            .map((v: any) => ({
              id: v.tipo_despesa.id,
              nome: v.tipo_despesa.nome,
              origemPermitida: v.tipo_despesa.origem_permitida as ('proprio' | 'conjuge' | 'filhos')[],
            }));
        }

        // NÃO fazer fallback para todos os tipos - se não tem tipos liberados, não pode criar lançamento
        setExpenseTypes(typesData);
      }

      // Fetch periods
      const periodsData = await periodosService.getAll();
      const mappedPeriods = periodsData.map(p => ({
        id: p.id,
        periodo: p.periodo,
        status: p.status,
        dataInicio: new Date(p.data_inicio),
        dataFinal: new Date(p.data_final),
        abreLancamento: new Date(p.abre_lancamento),
        fechaLancamento: new Date(p.fecha_lancamento),
      }));
      setPeriods(mappedPeriods);

      // Encontrar período vigente (data atual entre data_inicio e data_final)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();
      
      const vigentPeriod = mappedPeriods.find(p => {
        const inicio = new Date(p.dataInicio);
        inicio.setHours(0, 0, 0, 0);
        const fim = new Date(p.dataFinal);
        fim.setHours(23, 59, 59, 999);
        return todayTime >= inicio.getTime() && todayTime <= fim.getTime();
      });

      // Set default period - usar período vigente se existir, senão usar o primeiro com status aberto
      const defaultPeriod = vigentPeriod || mappedPeriods.find(p => p.status === 'aberto');
      if (defaultPeriod && !isEditing) {
        setFormPeriodoId(defaultPeriod.id);
      }

      // Fetch existing expense if editing
      if (isEditing && id) {
        const expenseData = await lancamentosService.getById(id);
        if (expenseData) {
          setFormPeriodoId(expenseData.periodo_id);
          setFormTipoDespesaId(expenseData.tipo_despesa_id);
          setFormOrigem(expenseData.origem as 'proprio' | 'conjuge' | 'filhos');
          setFormValor(expenseData.valor_lancado.toString());
          setFormDescricao(expenseData.descricao_fato_gerador);
          setFormNumeroDocumento(expenseData.numero_documento || '');
          setFormParcelamentoAtivo(expenseData.parcelamento_ativo || false);
          setFormParcelamentoValorTotal(expenseData.parcelamento_valor_total?.toString() || '');
          setFormParcelamentoTotalParcelas(expenseData.parcelamento_total_parcelas?.toString() || '');
        }
      }

      // Calculate totals - usar o período vigente ou o período selecionado no formulário
      if (colabData && defaultPeriod) {
        const expenses = await lancamentosService.getAll({
          colaborador_id: colabData.id,
          periodo_id: defaultPeriod.id,
          status: 'valido',
        });

        const usado = expenses.reduce((sum, e) => sum + Number(e.valor_considerado), 0);
        setTotalUsado(usado);
        setSaldoDisponivel((Number(colabData.cesta_beneficios_teto) || 0) - usado);
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }

    setLoading(false);
  };

  const executeSave = async (validation: any) => {
    if (!colaborador) {
      toast({ title: 'Erro', description: 'Você não está cadastrado como colaborador elegível.', variant: 'destructive' });
      return;
    }

    const valorLancado = parseFloat(formValor);
    
    setSaving(true);
    try {
      const totalParcelas = formParcelamentoAtivo ? parseInt(formParcelamentoTotalParcelas) || 1 : null;
      const valorTotal = formParcelamentoAtivo ? parseFloat(formParcelamentoValorTotal) || valorLancado : null;

      let lancamentoId: string;

      if (isEditing && id) {
        await lancamentosService.update(id, {
          tipo_despesa_id: formTipoDespesaId,
          origem: formOrigem,
          valor_lancado: valorLancado,
          valor_considerado: validation.valorConsiderado,
          valor_nao_considerado: validation.valorNaoConsiderado,
          descricao_fato_gerador: formDescricao,
          numero_documento: formNumeroDocumento || null,
        });
        lancamentoId = id;
      } else {
        const result = await lancamentosService.create({
          colaborador_id: colaborador.id,
          periodo_id: formPeriodoId,
          tipo_despesa_id: formTipoDespesaId,
          origem: formOrigem,
          descricao_fato_gerador: formDescricao,
          numero_documento: formNumeroDocumento || null,
          valor_lancado: valorLancado,
          valor_considerado: validation.valorConsiderado,
          valor_nao_considerado: validation.valorNaoConsiderado,
        });
        lancamentoId = result.id;
      }

      // Upload attachment após criar o lançamento
      if (formFile && lancamentoId) {
        try {
          await anexosService.upload(lancamentoId, formFile);
        } catch (error: any) {
          // Se o upload falhar, não bloquear o salvamento do lançamento
          console.error('Erro ao fazer upload do comprovante:', error);
          toast({
            title: 'Aviso',
            description: 'Lançamento salvo, mas houve erro ao fazer upload do comprovante. Você pode adicionar o comprovante depois.',
            variant: 'default',
          });
        }
      }

      toast({
        title: 'Lançamento enviado',
        description: 'O lançamento foi enviado para análise.',
      });

      navigate('/lancamentos');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const status: 'enviado' = 'enviado';
    if (!colaborador) {
      toast({ title: 'Erro', description: 'Você não está cadastrado como colaborador elegível.', variant: 'destructive' });
      return;
    }

    const valorLancado = parseFloat(formValor);
    if (isNaN(valorLancado) || valorLancado <= 0) {
      toast({ title: 'Erro', description: 'Informe um valor válido.', variant: 'destructive' });
      return;
    }

    const selectedType = expenseTypes.find(t => t.id === formTipoDespesaId);
    if (selectedType) {
      const origemValidation = validarOrigemDespesa(formOrigem, selectedType.origemPermitida);
      if (!origemValidation.valido) {
        toast({ title: 'Origem inválida', description: origemValidation.mensagem, variant: 'destructive' });
        return;
      }
    }

    if (formFile) {
      const hash = gerarHashComprovante(formFile.name, formFile.size);
      if (existingAttachmentHashes.has(hash)) {
        toast({ title: 'Comprovante duplicado', description: 'Este comprovante já foi utilizado.', variant: 'destructive' });
        return;
      }
    }

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
      // Em vez de window.confirm, abrir o dialog
      setPendingValidation({
        valorLancado,
        valorConsiderado: validation.valorConsiderado,
        valorNaoConsiderado: validation.valorNaoConsiderado,
        validation,
        });
      setShowConfirmDialog(true);
      return;
      }

    // Se não for warning, salvar direto
    await executeSave(validation);
  };

  const selectedType = expenseTypes.find(t => t.id === formTipoDespesaId);
  const hasNoBeneficios = expenseTypes.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Bloquear acesso se não tem benefícios liberados
  if (hasNoBeneficios && !isEditing) {
    return (
      <PageFormLayout
        title="Novo Lançamento"
        description="Preencha os dados do lançamento de despesa"
        backTo="/lancamentos"
        backLabel="Voltar para lista"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Benefícios não liberados</AlertTitle>
          <AlertDescription>
            Você não possui benefícios liberados para lançamento neste período. Procure o RH/Administrador.
          </AlertDescription>
        </Alert>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate('/lancamentos')}>
            Voltar
          </Button>
        </div>
      </PageFormLayout>
    );
  }

  return (
    <PageFormLayout
      title={isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
      description="Preencha os dados do lançamento de despesa"
      backTo="/lancamentos"
      backLabel="Voltar para lista"
      saving={saving}
    >
      <div className="space-y-6">
        {colaborador && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Saldo Disponível</AlertTitle>
            <AlertDescription>
              Você possui <strong>{formatCurrency(saldoDisponivel)}</strong> disponíveis de <strong>{formatCurrency(cestaTeto)}</strong> da Cesta de Benefícios.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mês Referência</Label>
            <Select value={formPeriodoId} onValueChange={setFormPeriodoId} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>{period.periodo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <SelectItem key={type.id} value={type.id}>{type.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Origem da Despesa</Label>
            <Select value={formOrigem} onValueChange={(value) => setFormOrigem(value as 'proprio' | 'conjuge' | 'filhos')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['proprio', 'conjuge', 'filhos'] as const).map((origem) => {
                  const isAllowed = !selectedType || selectedType.origemPermitida.includes(origem);
                  return (
                    <SelectItem key={origem} value={origem} disabled={!isAllowed}>
                      {originLabels[origem]}{!isAllowed && ' (não permitida)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor da Despesa (R$)</Label>
            <Input type="number" step="0.01" value={formValor} onChange={(e) => setFormValor(e.target.value)} placeholder="0,00" className="font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Número do Documento</Label>
            <Input
              value={formNumeroDocumento}
              onChange={(e) => setFormNumeroDocumento(e.target.value)}
              placeholder="Ex: NF-001234, REC-5678"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição do Fato Gerador</Label>
            <Textarea value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} placeholder="Descreva o motivo/natureza da despesa..." rows={3} />
          </div>
        </div>

        {/* Parcelamento */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="parcelamento" className="font-medium">Parcelamento</Label>
            </div>
            <Switch
              id="parcelamento"
              checked={formParcelamentoAtivo}
              onCheckedChange={setFormParcelamentoAtivo}
            />
          </div>

          {formParcelamentoAtivo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formParcelamentoValorTotal}
                  onChange={(e) => setFormParcelamentoValorTotal(e.target.value)}
                  placeholder="0,00"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor da Parcela (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  placeholder="0,00"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Número de Parcelas</Label>
                <Input
                  type="number"
                  value={formParcelamentoTotalParcelas}
                  onChange={(e) => setFormParcelamentoTotalParcelas(e.target.value)}
                  placeholder="Ex: 12"
                />
              </div>
            </div>
          )}
        </div>

        {/* Attachment Upload */}
        <div className="space-y-4">
          <Label>Comprovante</Label>
          {!isEditing && (
            <>
              <Alert variant="default" className="border-primary/30 bg-primary/5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Adicione comprovantes para validação do lançamento. O arquivo será enviado após salvar o lançamento.
                </AlertDescription>
              </Alert>
              <div className="border-2 border-dashed rounded-lg p-4">
                <Input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFormFile(file);
                    }
                  }}
                  className="cursor-pointer"
                />
                {formFile && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{formFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormFile(null)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {isEditing && id && (
            <div className="mt-4">
              <Label className="text-sm text-muted-foreground">Comprovantes já anexados:</Label>
              <AttachmentList lancamentoId={id} key={attachmentRefreshKey} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate('/lancamentos')} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !formTipoDespesaId || !formValor}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar para Análise
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog for Limit Exceeded */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Atenção: Limite Ultrapassado
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              {pendingValidation && (
                <>
                  <p className="text-base">
                    Seu lançamento de <strong className="font-semibold">{formatCurrency(pendingValidation.valorLancado)}</strong> ultrapassa o limite disponível.
                  </p>
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Será considerado:</span>
                      <span className="font-semibold text-success">{formatCurrency(pendingValidation.valorConsiderado)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Não será considerado:</span>
                      <span className="font-semibold text-destructive">{formatCurrency(pendingValidation.valorNaoConsiderado)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Este será o último lançamento permitido no período.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingValidation) {
                  await executeSave(pendingValidation.validation);
                }
                setShowConfirmDialog(false);
              }}
              disabled={saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Lançamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFormLayout>
  );
};

export default LancamentoForm;
