import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, Loader2, FileText, X, AlertCircle, CreditCard } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  validarLancamentoCesta, 
  formatCurrency, 
  validarPeriodoLancamento,
  validarOrigemDespesa,
  gerarHashComprovante 
} from '@/lib/expense-validation';
import { AttachmentUploadSimple } from '@/components/attachments/AttachmentUploadSimple';
import { AttachmentList } from '@/components/attachments/AttachmentList';

interface ExpenseType {
  id: string;
  nome: string;
  origemPermitida: ('proprio' | 'conjuge' | 'filhos')[];
}

interface CalendarPeriod {
  id: string;
  periodo: string;
  status: string;
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

  const today = new Date();
  const todayTime = today.getTime();
  
  const currentPeriod = periods.find((p) => {
    if (p.status !== 'aberto') return false;
    const abertura = p.abreLancamento.getTime();
    const fechamento = p.fechaLancamento.getTime() + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
    return todayTime >= abertura && todayTime <= fechamento;
  }) || periods.find((p) => p.status === 'aberto');

  useEffect(() => {
    fetchData();
  }, [user, id]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch colaborador
    const { data: colabData } = await supabase
      .from('colaboradores_elegiveis')
      .select('id, nome, cesta_beneficios_teto')
      .eq('user_id', user.id)
      .maybeSingle();

    if (colabData) {
      setColaborador({
        id: colabData.id,
        nome: colabData.nome,
      });
      setCestaTeto(Number(colabData.cesta_beneficios_teto) || 0);
    }

    // Fetch expense types
    let typesData: any[] = [];
    if (colabData) {
      const { data: vinculosData } = await supabase
        .from('colaborador_tipos_despesas')
        .select(`teto_individual, tipos_despesas (id, nome, origem_permitida)`)
        .eq('colaborador_id', colabData.id)
        .eq('ativo', true);

      if (vinculosData && vinculosData.length > 0) {
        typesData = vinculosData.map((v: any) => v.tipos_despesas).filter(Boolean);
      }
    }

    if (typesData.length === 0) {
      const { data: allTypesData } = await supabase
        .from('tipos_despesas')
        .select('id, nome, origem_permitida')
        .eq('classificacao', 'variavel')
        .eq('ativo', true);
      typesData = allTypesData || [];
    }

    setExpenseTypes(typesData.map((t: any) => ({
      id: t.id,
      nome: t.nome,
      origemPermitida: t.origem_permitida as ('proprio' | 'conjuge' | 'filhos')[],
    })));

    // Fetch periods
    const { data: periodsData } = await supabase
      .from('calendario_periodos')
      .select('id, periodo, status, abre_lancamento, fecha_lancamento')
      .order('periodo', { ascending: false });

    if (periodsData) {
      const mappedPeriods = periodsData.map(p => ({
        id: p.id,
        periodo: p.periodo,
        status: p.status,
        abreLancamento: new Date(p.abre_lancamento),
        fechaLancamento: new Date(p.fecha_lancamento),
      }));
      setPeriods(mappedPeriods);

      // Set default period
      const openPeriod = mappedPeriods.find(p => p.status === 'aberto');
      if (openPeriod && !isEditing) {
        setFormPeriodoId(openPeriod.id);
      }
    }

    // Fetch existing expense if editing
    if (isEditing && id) {
      const { data: expenseData, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        navigate('/lancamentos');
      } else if (expenseData) {
        setFormPeriodoId(expenseData.periodo_id);
        setFormTipoDespesaId(expenseData.tipo_despesa_id);
        setFormOrigem(expenseData.origem as 'proprio' | 'conjuge' | 'filhos');
        setFormValor(expenseData.valor_lancado.toString());
        setFormDescricao(expenseData.descricao_fato_gerador);
        setFormNumeroDocumento((expenseData as any).numero_documento || '');
        setFormParcelamentoAtivo((expenseData as any).parcelamento_ativo || false);
        setFormParcelamentoValorTotal((expenseData as any).parcelamento_valor_total?.toString() || '');
        setFormParcelamentoTotalParcelas((expenseData as any).parcelamento_total_parcelas?.toString() || '');
      }
    }

    // Calculate totals
    if (colabData) {
      const { data: expenses } = await supabase
        .from('lancamentos')
        .select('valor_considerado, status')
        .eq('colaborador_id', colabData.id)
        .eq('periodo_id', periodsData?.find(p => p.status === 'aberto')?.id || '')
        .eq('status', 'valido');

      if (expenses) {
        const usado = expenses.reduce((sum, e) => sum + Number(e.valor_considerado), 0);
        setTotalUsado(usado);
        setSaldoDisponivel((Number(colabData.cesta_beneficios_teto) || 0) - usado);
      }

      // Fetch existing hashes
      const { data: anexos } = await supabase.from('anexos').select('nome_arquivo, tamanho');
      if (anexos) {
        const hashes = new Set(anexos.map(a => gerarHashComprovante(a.nome_arquivo, a.tamanho)));
        setExistingAttachmentHashes(hashes);
      }
    }

    setLoading(false);
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
      if (!confirm(validation.mensagem + '\n\nDeseja continuar?')) return;
    }

    setSaving(true);
    try {
      const totalParcelas = formParcelamentoAtivo ? parseInt(formParcelamentoTotalParcelas) || 1 : null;
      const valorTotal = formParcelamentoAtivo ? parseFloat(formParcelamentoValorTotal) || valorLancado : null;
      
      const lancamentoData = {
        colaborador_id: colaborador.id,
        periodo_id: formPeriodoId,
        tipo_despesa_id: formTipoDespesaId,
        origem: formOrigem,
        valor_lancado: valorLancado,
        valor_considerado: validation.valorConsiderado,
        valor_nao_considerado: validation.valorNaoConsiderado,
        descricao_fato_gerador: formDescricao,
        numero_documento: formNumeroDocumento || null,
        status: status,
        parcelamento_ativo: formParcelamentoAtivo,
        parcelamento_valor_total: valorTotal,
        parcelamento_numero_parcela: formParcelamentoAtivo ? 1 : null,
        parcelamento_total_parcelas: totalParcelas,
      };

      let lancamentoId: string;

      if (isEditing && id) {
        const { error } = await supabase.from('lancamentos').update(lancamentoData).eq('id', id);
        if (error) throw error;
        lancamentoId = id;
      } else {
        const { data, error } = await supabase.from('lancamentos').insert([lancamentoData]).select('id').single();
        if (error) throw error;
        lancamentoId = data.id;
      }

      // Upload attachment
      if (formFile && lancamentoId) {
        const fileExt = formFile.name.split('.').pop();
        const filePath = `${colaborador.id}/${lancamentoId}/${Date.now()}.${fileExt}`;
        const buffer = await formFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const { error: uploadError } = await supabase.storage.from('comprovantes').upload(filePath, formFile);

        if (!uploadError) {
          await supabase.from('anexos').insert({
            lancamento_id: lancamentoId,
            nome_arquivo: formFile.name,
            storage_path: filePath,
            tamanho: formFile.size,
            tipo_arquivo: formFile.type || 'application/octet-stream',
            hash_comprovante: fileHash,
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

  const selectedType = expenseTypes.find(t => t.id === formTipoDespesaId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
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
                <Label>Quantidade de Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  value={formParcelamentoTotalParcelas}
                  onChange={(e) => setFormParcelamentoTotalParcelas(e.target.value)}
                  placeholder="Ex: 12"
                />
              </div>
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">
                  O lançamento será criado automaticamente todo mês até completar todas as parcelas informadas.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Anexo do Comprovante</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Arraste arquivos ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground">Formatos aceitos: PDF, XLSX, DOC, DOCX, PNG, JPG (máx. 5MB)</p>
            <p className="text-xs text-warning mt-1">⚠️ Cada comprovante só pode ser utilizado uma vez</p>
            <Input type="file" className="hidden" id="file-upload" accept=".pdf,.xlsx,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => setFormFile(e.target.files?.[0] || null)} />
            <Button variant="outline" size="sm" className="mt-3" onClick={() => document.getElementById('file-upload')?.click()}>
              Selecionar Arquivo
            </Button>
            {formFile && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                <span>{formFile.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFormFile(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {isEditing && id && (
          <div className="space-y-2">
            <Label>Anexos Existentes</Label>
            <AttachmentList lancamentoId={id} allowDelete onDeleteComplete={() => setAttachmentRefreshKey(k => k + 1)} />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => navigate('/lancamentos')} disabled={saving}>Cancelar</Button>
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar para Análise
          </Button>
        </div>
      </div>
    </PageFormLayout>
  );
};

export default LancamentoForm;
