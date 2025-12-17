import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Users, User, Loader2, AlertCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/expense-validation';
import { generatePDFReport } from '@/lib/pdf-export';
import { exportToExcel } from '@/lib/excel-export';
import { generateZipWithPDFs } from '@/lib/zip-export';

interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  departamento: string;
  email: string;
  salario_base: number;
  vale_alimentacao: number;
  vale_refeicao: number;
  ajuda_custo: number;
  mobilidade: number;
  transporte: number;
  cesta_beneficios_teto: number;
  tem_pida: boolean;
  pida_teto: number;
}

interface Periodo {
  id: string;
  periodo: string;
  status: string;
}

const Relatorios = () => {
  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedColaborador, setSelectedColaborador] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [includePendentes, setIncludePendentes] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [myColaboradorId, setMyColaboradorId] = useState<string | null>(null);


  const isRHorFinanceiro = hasRole('RH') || hasRole('FINANCEIRO');

  const departments = [...new Set(colaboradores.map((c) => c.departamento))];

  // Memoized options for comboboxes
  const periodOptions: ComboboxOption[] = useMemo(() => 
    periodos.map((p) => ({
      value: p.id,
      label: `${p.periodo}${p.status === 'aberto' ? ' (Atual)' : ''}`,
      description: p.status === 'aberto' ? 'Período aberto' : 'Período fechado',
    })), [periodos]);

  const colaboradorOptions: ComboboxOption[] = useMemo(() => 
    colaboradores.map((c) => ({
      value: c.id,
      label: c.nome,
      description: `${c.matricula} • ${c.departamento}`,
    })), [colaboradores]);

  const departmentOptions: ComboboxOption[] = useMemo(() => [
    { value: 'all', label: 'Todos os departamentos' },
    ...departments.map((d) => ({ value: d, label: d })),
  ], [departments]);

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (selectedPeriod && selectedColaborador) {
      fetchPreviewData();
    }
  }, [selectedPeriod, selectedColaborador]);

  // Auto-select colaborador for COLABORADOR role
  useEffect(() => {
    if (myColaboradorId && !selectedColaborador) {
      setSelectedColaborador(myColaboradorId);
    }
  }, [myColaboradorId]);

  const fetchData = async () => {
    setLoading(true);
    
    // For COLABORADOR, first fetch their own colaborador ID
    if (user && !isRHorFinanceiro) {
      const { data: myColab } = await supabase
        .from('colaboradores_elegiveis')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (myColab) {
        setMyColaboradorId(myColab.id);
        setSelectedColaborador(myColab.id);
      }
    }
    
    const [colaboradoresRes, periodosRes] = await Promise.all([
      supabase.from('colaboradores_elegiveis').select('*').eq('ativo', true).order('nome'),
      supabase.from('calendario_periodos').select('id, periodo, status').order('periodo', { ascending: false }),
    ]);
    if (colaboradoresRes.data) setColaboradores(colaboradoresRes.data);
    if (periodosRes.data) {
      setPeriodos(periodosRes.data);
      // Auto-select first period
      const openPeriod = periodosRes.data.find(p => p.status === 'aberto');
      if (openPeriod && !selectedPeriod) {
        setSelectedPeriod(openPeriod.id);
      } else if (!selectedPeriod && periodosRes.data.length > 0) {
        setSelectedPeriod(periodosRes.data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchPreviewData = async () => {
    const colaborador = colaboradores.find((c) => c.id === selectedColaborador);
    if (!colaborador) return;
    const periodo = periodos.find((p) => p.id === selectedPeriod);

    const { data: lancamentos } = await supabase
      .from('lancamentos')
      .select('id, valor_lancado, valor_considerado, status, origem, created_at, tipos_despesas (nome, grupo)')
      .eq('colaborador_id', selectedColaborador)
      .eq('periodo_id', selectedPeriod);

    const despesas = lancamentos || [];
    const aprovados = despesas.filter((d: any) => d.status === 'valido');
    const pendentes = despesas.filter((d: any) => d.status === 'enviado' || d.status === 'em_analise');
    const categorias: Record<string, number> = {};
    aprovados.forEach((d: any) => {
      const grupo = d.tipos_despesas?.grupo || 'Outros';
      categorias[grupo] = (categorias[grupo] || 0) + Number(d.valor_considerado);
    });

    const totalCesta = aprovados.reduce((acc: number, d: any) => acc + Number(d.valor_considerado), 0);
    const totalPendente = pendentes.reduce((acc: number, d: any) => acc + Number(d.valor_lancado), 0);
    const diferencaPida = Math.max(0, colaborador.cesta_beneficios_teto - totalCesta);

    const resumo = [
      { componente: 'Salário Base', valorParametrizado: colaborador.salario_base, valorUtilizado: colaborador.salario_base, percentual: 100 },
      { componente: 'Vale Alimentação', valorParametrizado: colaborador.vale_alimentacao, valorUtilizado: colaborador.vale_alimentacao, percentual: 100 },
      { componente: 'Vale Refeição', valorParametrizado: colaborador.vale_refeicao, valorUtilizado: colaborador.vale_refeicao, percentual: 100 },
      { componente: 'Ajuda de Custo', valorParametrizado: colaborador.ajuda_custo, valorUtilizado: colaborador.ajuda_custo, percentual: 100 },
      { componente: 'Mobilidade', valorParametrizado: colaborador.mobilidade, valorUtilizado: colaborador.mobilidade, percentual: 100 },
      { componente: 'Transporte', valorParametrizado: colaborador.transporte, valorUtilizado: colaborador.transporte, percentual: 100 },
      { componente: 'Cesta de Benefícios', valorParametrizado: colaborador.cesta_beneficios_teto, valorUtilizado: totalCesta, percentual: colaborador.cesta_beneficios_teto > 0 ? Math.round((totalCesta / colaborador.cesta_beneficios_teto) * 100) : 0 },
    ];

    if (colaborador.tem_pida) {
      resumo.push({ componente: 'PI/DA (base)', valorParametrizado: colaborador.pida_teto, valorUtilizado: colaborador.pida_teto, percentual: 100 });
      if (diferencaPida > 0) resumo.push({ componente: 'PI/DA (diferença)', valorParametrizado: 0, valorUtilizado: diferencaPida, percentual: 0 });
    }

    setPreviewData({
      colaborador: { nome: colaborador.nome, matricula: colaborador.matricula, departamento: colaborador.departamento, email: colaborador.email },
      periodo: periodo?.periodo || '',
      resumo,
      rendimentoTotal: resumo.reduce((acc, r) => acc + r.valorUtilizado, 0),
      utilizacao: { limiteCesta: colaborador.cesta_beneficios_teto, totalUtilizado: totalCesta, totalPendente, percentual: colaborador.cesta_beneficios_teto > 0 ? Math.round((totalCesta / colaborador.cesta_beneficios_teto) * 100) : 0, diferencaPida },
      despesas: despesas.map((d: any) => ({ tipo: d.tipos_despesas?.nome || '', origem: d.origem, valor: Number(d.valor_lancado), status: d.status, data: new Date(d.created_at) })),
      totaisPorCategoria: Object.entries(categorias).map(([categoria, valor]) => ({ categoria, valor })),
      totalLancamentos: despesas.length,
      qtdAprovados: aprovados.length,
      qtdPendentes: pendentes.length,
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    const filtered = selectedDepartment === 'all' ? colaboradores : colaboradores.filter((c) => c.departamento === selectedDepartment);
    setSelectedEmployees(checked ? filtered.map((e) => e.id) : []);
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    setSelectedEmployees(checked ? [...selectedEmployees, employeeId] : selectedEmployees.filter((id) => id !== employeeId));
  };

  const handleGeneratePDF = async () => {
    if (!previewData) return;
    setGenerating(true);
    try {
      // Filter despesas based on includePendentes option
      const filteredDespesas = includePendentes 
        ? previewData.despesas 
        : previewData.despesas.filter((d: any) => d.status === 'valido');
      
      const reportData = {
        ...previewData,
        despesas: filteredDespesas,
      };
      
      const blob = await generatePDFReport(reportData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Extrato_${previewData.colaborador.nome.replace(/\s/g, '_')}_${previewData.periodo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF gerado', description: includePendentes ? 'Extrato com pendentes baixado.' : 'Extrato em PDF baixado com sucesso.' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao gerar o PDF.', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleGenerateExcel = async () => {
    if (!previewData) return;
    setGenerating(true);
    try {
      const excelData = previewData.resumo.map((item: any) => ({
        matricula: previewData.colaborador.matricula,
        nome: previewData.colaborador.nome,
        departamento: previewData.colaborador.departamento,
        codigoEvento: '',
        descricaoEvento: item.componente,
        valor: item.valorUtilizado,
        periodo: previewData.periodo,
      }));
      exportToExcel(excelData, previewData.periodo);
      toast({ title: 'Excel gerado', description: 'O extrato em Excel foi baixado com sucesso.' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao gerar o Excel.', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleGenerateBatch = async () => {
    if (selectedEmployees.length === 0 || !selectedPeriod) return;
    setGenerating(true);
    toast({ title: 'Gerando relatórios em lote', description: `Processando ${selectedEmployees.length} relatório(s)...` });
    const periodo = periodos.find((p) => p.id === selectedPeriod);
    
    const pdfFiles: { name: string; blob: Blob }[] = [];
    
    for (const empId of selectedEmployees) {
      const colaborador = colaboradores.find((c) => c.id === empId);
      if (!colaborador || !periodo) continue;
      const { data: lancamentos } = await supabase.from('lancamentos').select('id, valor_lancado, valor_considerado, status, origem, created_at, tipos_despesas (nome, grupo)').eq('colaborador_id', empId).eq('periodo_id', selectedPeriod);
      const despesas = lancamentos || [];
      const aprovados = despesas.filter((d: any) => d.status === 'valido');
      const totalCesta = aprovados.reduce((acc: number, d: any) => acc + Number(d.valor_considerado), 0);
      const diferencaPida = Math.max(0, colaborador.cesta_beneficios_teto - totalCesta);
      const resumo = [
        { componente: 'Salário Base', valorParametrizado: colaborador.salario_base, valorUtilizado: colaborador.salario_base, percentual: 100 },
        { componente: 'Vale Alimentação', valorParametrizado: colaborador.vale_alimentacao, valorUtilizado: colaborador.vale_alimentacao, percentual: 100 },
        { componente: 'Vale Refeição', valorParametrizado: colaborador.vale_refeicao, valorUtilizado: colaborador.vale_refeicao, percentual: 100 },
        { componente: 'Ajuda de Custo', valorParametrizado: colaborador.ajuda_custo, valorUtilizado: colaborador.ajuda_custo, percentual: 100 },
        { componente: 'Mobilidade', valorParametrizado: colaborador.mobilidade, valorUtilizado: colaborador.mobilidade, percentual: 100 },
        { componente: 'Transporte', valorParametrizado: colaborador.transporte, valorUtilizado: colaborador.transporte, percentual: 100 },
        { componente: 'Cesta de Benefícios', valorParametrizado: colaborador.cesta_beneficios_teto, valorUtilizado: totalCesta, percentual: colaborador.cesta_beneficios_teto > 0 ? Math.round((totalCesta / colaborador.cesta_beneficios_teto) * 100) : 0 },
      ];
      if (colaborador.tem_pida) {
        resumo.push({ componente: 'PI/DA (base)', valorParametrizado: colaborador.pida_teto, valorUtilizado: colaborador.pida_teto, percentual: 100 });
        if (diferencaPida > 0) resumo.push({ componente: 'PI/DA (diferença)', valorParametrizado: 0, valorUtilizado: diferencaPida, percentual: 0 });
      }
      const reportData = {
        colaborador: { nome: colaborador.nome, matricula: colaborador.matricula, departamento: colaborador.departamento, email: colaborador.email },
        periodo: periodo.periodo,
        resumo,
        rendimentoTotal: resumo.reduce((acc, r) => acc + r.valorUtilizado, 0),
        utilizacao: { limiteCesta: colaborador.cesta_beneficios_teto, totalUtilizado: totalCesta, percentual: colaborador.cesta_beneficios_teto > 0 ? Math.round((totalCesta / colaborador.cesta_beneficios_teto) * 100) : 0, diferencaPida },
        despesas: despesas.map((d: any) => ({ tipo: d.tipos_despesas?.nome || '', origem: d.origem, valor: Number(d.valor_lancado), status: d.status, data: new Date(d.created_at) })),
        totaisPorCategoria: [],
      };
      const blob = await generatePDFReport(reportData);
      pdfFiles.push({
        name: `Extrato_${colaborador.matricula}_${colaborador.nome.replace(/\s/g, '_')}_${periodo.periodo}.pdf`,
        blob,
      });
    }
    
    // Generate ZIP with all PDFs
    const zipBlob = await generateZipWithPDFs(pdfFiles);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorios_${periodo?.periodo}_${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'ZIP gerado', description: `${selectedEmployees.length} PDF(s) baixados em um único arquivo ZIP.` });
    setGenerating(false);
  };

  const filteredColaboradores = useMemo(() => {
    let result = colaboradores;
    if (selectedDepartment !== 'all') {
      result = result.filter((c) => c.departamento === selectedDepartment);
    }
    if (batchSearch.trim()) {
      const search = batchSearch.toLowerCase();
      result = result.filter((c) => 
        c.nome.toLowerCase().includes(search) || 
        c.matricula.toLowerCase().includes(search)
      );
    }
    return result;
  }, [colaboradores, selectedDepartment, batchSearch]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Relatórios" description="Gere extratos da Remuneração Estratégica em PDF" />
      <Tabs defaultValue="individual" className="space-y-6">
        {isRHorFinanceiro && (
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2"><User className="h-4 w-4" />Individual</TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2"><Users className="h-4 w-4" />Em Lote</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="individual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRHorFinanceiro ? 'Gerar Extrato Individual' : 'Gerar Meu Extrato'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`grid grid-cols-1 ${isRHorFinanceiro ? 'sm:grid-cols-2' : ''} gap-4`}>
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Combobox
                    options={periodOptions}
                    value={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                    placeholder="Buscar período..."
                    searchPlaceholder="Buscar por período..."
                    emptyMessage="Nenhum período encontrado."
                  />
                </div>
                {isRHorFinanceiro && (
                  <div className="space-y-2">
                    <Label>Colaborador</Label>
                    <Combobox
                      options={colaboradorOptions}
                      value={selectedColaborador}
                      onValueChange={setSelectedColaborador}
                      placeholder="Buscar colaborador..."
                      searchPlaceholder="Buscar por nome ou matrícula..."
                      emptyMessage="Nenhum colaborador encontrado."
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <Button onClick={handleGeneratePDF} disabled={!previewData || generating}>{generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Download className="mr-2 h-4 w-4" />Gerar PDF</Button>
                  <Button variant="outline" onClick={handleGenerateExcel} disabled={!previewData || generating}><FileText className="mr-2 h-4 w-4" />Gerar Excel</Button>
                </div>
                {previewData?.qtdPendentes > 0 && (
                  <div className="flex items-center space-x-2">
                    <Checkbox id="includePendentes" checked={includePendentes} onCheckedChange={(c) => setIncludePendentes(!!c)} />
                    <Label htmlFor="includePendentes" className="font-normal text-sm">Incluir pendentes no relatório</Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {previewData && (
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center justify-between">Prévia do Extrato<span className="text-sm font-normal text-muted-foreground">{previewData.colaborador.nome} - {previewData.periodo}</span></CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {/* Alert when no expenses in period */}
                {previewData.totalLancamentos === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Nenhum lançamento encontrado neste período. Os valores exibidos são apenas os componentes fixos parametrizados para o colaborador.
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Alert for pending expenses */}
                {previewData.qtdPendentes > 0 && (
                  <Alert className="border-warning/50 bg-warning/10">
                    <Clock className="h-4 w-4 text-warning" />
                    <AlertDescription className="flex items-center gap-2">
                      <span>{previewData.qtdPendentes} lançamento(s) pendente(s) de validação</span>
                      <Badge variant="outline" className="border-warning text-warning">
                        {formatCurrency(previewData.utilizacao.totalPendente)}
                      </Badge>
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <h3 className="text-sm font-semibold mb-3">Resumo Geral</h3>
                  <div className="rounded-lg border overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[400px]">
                      <thead><tr className="bg-muted/50"><th className="text-left px-3 sm:px-4 py-2 font-medium">Componente</th><th className="text-right px-3 sm:px-4 py-2 font-medium hidden sm:table-cell">Parametrizado</th><th className="text-right px-3 sm:px-4 py-2 font-medium">Utilizado</th><th className="text-right px-3 sm:px-4 py-2 font-medium hidden sm:table-cell">%</th></tr></thead>
                      <tbody>
                        {previewData.resumo.map((item: any, i: number) => <tr key={i} className="border-t"><td className="px-3 sm:px-4 py-2">{item.componente}</td><td className="px-3 sm:px-4 py-2 text-right font-mono hidden sm:table-cell">{formatCurrency(item.valorParametrizado)}</td><td className="px-3 sm:px-4 py-2 text-right font-mono">{formatCurrency(item.valorUtilizado)}</td><td className="px-3 sm:px-4 py-2 text-right hidden sm:table-cell">{item.percentual > 0 ? `${item.percentual}%` : '-'}</td></tr>)}
                        <tr className="border-t bg-primary/5 font-bold"><td className="px-3 sm:px-4 py-2">Rendimento Total</td><td className="px-3 sm:px-4 py-2 text-right font-mono hidden sm:table-cell">{formatCurrency(previewData.rendimentoTotal)}</td><td className="px-3 sm:px-4 py-2 text-right font-mono">{formatCurrency(previewData.rendimentoTotal)}</td><td className="px-3 sm:px-4 py-2 text-right hidden sm:table-cell">100%</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3">Análise de Utilização - Cesta de Benefícios</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center"><p className="text-2xl font-bold">{formatCurrency(previewData.utilizacao.limiteCesta)}</p><p className="text-xs text-muted-foreground">Limite Total</p></div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center"><p className="text-2xl font-bold text-primary">{formatCurrency(previewData.utilizacao.totalUtilizado)}</p><p className="text-xs text-muted-foreground">Aprovado</p></div>
                    {previewData.utilizacao.totalPendente > 0 && (
                      <div className="p-4 bg-warning/10 rounded-lg text-center"><p className="text-2xl font-bold text-warning">{formatCurrency(previewData.utilizacao.totalPendente)}</p><p className="text-xs text-muted-foreground">Pendente</p></div>
                    )}
                    <div className="p-4 bg-muted/50 rounded-lg text-center"><p className="text-2xl font-bold">{previewData.utilizacao.percentual}%</p><p className="text-xs text-muted-foreground">Percentual</p></div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center"><p className="text-2xl font-bold text-muted-foreground">{formatCurrency(previewData.utilizacao.diferencaPida)}</p><p className="text-xs text-muted-foreground">Conv. PI/DA</p></div>
                  </div>
                  <div className="mt-3"><Progress value={previewData.utilizacao.percentual} className="h-2" /></div>
                </div>
                
                {/* Detailed expenses list */}
                {previewData.despesas.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Lançamentos do Período</h3>
                      <div className="rounded-lg border overflow-hidden overflow-x-auto">
                        <table className="w-full text-sm min-w-[400px]">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left px-3 sm:px-4 py-2 font-medium">Tipo</th>
                              <th className="text-left px-3 sm:px-4 py-2 font-medium hidden sm:table-cell">Origem</th>
                              <th className="text-right px-3 sm:px-4 py-2 font-medium">Valor</th>
                              <th className="text-center px-3 sm:px-4 py-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.despesas.map((d: any, i: number) => (
                              <tr key={i} className="border-t">
                                <td className="px-3 sm:px-4 py-2 truncate max-w-[120px] sm:max-w-none">{d.tipo}</td>
                                <td className="px-3 sm:px-4 py-2 capitalize hidden sm:table-cell">{d.origem}</td>
                                <td className="px-3 sm:px-4 py-2 text-right font-mono">{formatCurrency(d.valor)}</td>
                                <td className="px-3 sm:px-4 py-2 text-center">
                                  <Badge variant={
                                    d.status === 'valido' ? 'default' : 
                                    d.status === 'invalido' ? 'destructive' : 
                                    d.status === 'rascunho' ? 'secondary' : 'outline'
                                  } className="text-xs">
                                    {d.status === 'valido' ? 'Aprovado' : 
                                     d.status === 'invalido' ? 'Rejeitado' : 
                                     d.status === 'enviado' ? 'Pendente' : 
                                     d.status === 'em_analise' ? 'Em Análise' : 'Rascunho'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {isRHorFinanceiro && (
        <TabsContent value="batch" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Gerar Relatórios em Lote</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Combobox
                    options={periodOptions}
                    value={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                    placeholder="Buscar período..."
                    searchPlaceholder="Buscar por período..."
                    emptyMessage="Nenhum período encontrado."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Filtrar por Departamento</Label>
                  <Combobox
                    options={departmentOptions}
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                    placeholder="Todos os departamentos"
                    searchPlaceholder="Buscar departamento..."
                    emptyMessage="Nenhum departamento encontrado."
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar por nome ou matrícula..."
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="selectAll" checked={selectAll} onCheckedChange={(c) => handleSelectAll(!!c)} />
                    <Label htmlFor="selectAll" className="font-normal">Selecionar Todos</Label>
                  </div>
                </div>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {filteredColaboradores.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum colaborador encontrado com os filtros aplicados.
                    </div>
                  ) : (
                    filteredColaboradores.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                        <div className="flex items-center space-x-3">
                          <Checkbox id={emp.id} checked={selectedEmployees.includes(emp.id)} onCheckedChange={(c) => handleSelectEmployee(emp.id, !!c)} />
                          <div><p className="font-medium">{emp.nome}</p><p className="text-xs text-muted-foreground">{emp.matricula} • {emp.departamento}</p></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{selectedEmployees.length} colaborador(es) selecionado(s) de {filteredColaboradores.length} exibido(s)</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleGenerateBatch} disabled={selectedEmployees.length === 0 || !selectedPeriod || generating}>{generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Download className="mr-2 h-4 w-4" />Baixar ZIP ({selectedEmployees.length} PDFs)</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Relatorios;
