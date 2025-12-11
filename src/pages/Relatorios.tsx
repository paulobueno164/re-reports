import { useState } from 'react';
import { FileText, Download, Users, Building, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { mockEmployees, mockCalendarPeriods, formatCurrency, departments } from '@/lib/mock-data';

const Relatorios = () => {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const currentPeriod = mockCalendarPeriods.find((p) => p.status === 'aberto');

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedEmployees(mockEmployees.map((e) => e.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees([...selectedEmployees, employeeId]);
    } else {
      setSelectedEmployees(selectedEmployees.filter((id) => id !== employeeId));
    }
  };

  const handleGenerateReport = (type: 'pdf' | 'excel' | 'batch') => {
    const count = type === 'batch' ? selectedEmployees.length : 1;
    toast({
      title: 'Relatório gerado',
      description: `${count} extrato(s) ${type === 'pdf' ? 'em PDF' : type === 'excel' ? 'em Excel' : 'em lote (ZIP)'} será(ão) baixado(s).`,
    });
  };

  // Example data for preview
  const exampleData = {
    colaborador: mockEmployees[0],
    periodo: currentPeriod?.periodo || '12/2025',
    resumo: [
      { componente: 'Salário Base', valorParametrizado: 8000, valorUtilizado: 8000, percentual: 100 },
      { componente: 'Vale Alimentação', valorParametrizado: 600, valorUtilizado: 600, percentual: 100 },
      { componente: 'Vale Refeição', valorParametrizado: 800, valorUtilizado: 800, percentual: 100 },
      { componente: 'Ajuda de Custo', valorParametrizado: 500, valorUtilizado: 500, percentual: 100 },
      { componente: 'Mobilidade', valorParametrizado: 400, valorUtilizado: 400, percentual: 100 },
      { componente: 'Transporte', valorParametrizado: 300, valorUtilizado: 300, percentual: 100 },
      { componente: 'Cesta de Benefícios', valorParametrizado: 2000, valorUtilizado: 1500, percentual: 75 },
      { componente: 'PI/DA (base)', valorParametrizado: 1500, valorUtilizado: 1500, percentual: 100 },
      { componente: 'PI/DA (diferença)', valorParametrizado: 0, valorUtilizado: 500, percentual: 0 },
    ],
    rendimentoTotal: 14100,
    utilizacao: {
      limiteCesta: 2000,
      totalUtilizado: 1500,
      percentual: 75,
      diferencaPida: 500,
    },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Relatórios"
        description="Gere extratos da Remuneração Estratégica"
      />

      <Tabs defaultValue="individual" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Em Lote
          </TabsTrigger>
        </TabsList>

        {/* Individual Report */}
        <TabsContent value="individual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gerar Extrato Individual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select
                    value={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCalendarPeriods.map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.periodo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => handleGenerateReport('pdf')}>
                  <Download className="mr-2 h-4 w-4" />
                  Gerar PDF
                </Button>
                <Button variant="outline" onClick={() => handleGenerateReport('excel')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Prévia do Extrato
                <span className="text-sm font-normal text-muted-foreground">
                  {exampleData.colaborador.nome} - {exampleData.periodo}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Table */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Resumo Geral</h3>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-4 py-2 font-medium">Componente</th>
                        <th className="text-right px-4 py-2 font-medium">Parametrizado</th>
                        <th className="text-right px-4 py-2 font-medium">Utilizado</th>
                        <th className="text-right px-4 py-2 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exampleData.resumo.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2">{item.componente}</td>
                          <td className="px-4 py-2 text-right font-mono">
                            {formatCurrency(item.valorParametrizado)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {formatCurrency(item.valorUtilizado)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {item.percentual > 0 ? `${item.percentual}%` : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-primary/5 font-bold">
                        <td className="px-4 py-2">Rendimento Total</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {formatCurrency(exampleData.rendimentoTotal)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {formatCurrency(exampleData.rendimentoTotal)}
                        </td>
                        <td className="px-4 py-2 text-right">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              {/* Utilization Analysis */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Análise de Utilização - Cesta de Benefícios</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">
                      {formatCurrency(exampleData.utilizacao.limiteCesta)}
                    </p>
                    <p className="text-xs text-muted-foreground">Limite Total</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(exampleData.utilizacao.totalUtilizado)}
                    </p>
                    <p className="text-xs text-muted-foreground">Utilizado</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">
                      {exampleData.utilizacao.percentual}%
                    </p>
                    <p className="text-xs text-muted-foreground">Percentual</p>
                  </div>
                  <div className="p-4 bg-warning/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-warning">
                      {formatCurrency(exampleData.utilizacao.diferencaPida)}
                    </p>
                    <p className="text-xs text-muted-foreground">Convertido PI/DA</p>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress value={exampleData.utilizacao.percentual} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Report */}
        <TabsContent value="batch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gerar Relatórios em Lote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select
                    value={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCalendarPeriods.map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.periodo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Filtrar por Departamento</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Selecionar Colaboradores</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="selectAll"
                      checked={selectAll}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                    <Label htmlFor="selectAll" className="font-normal">
                      Selecionar Todos
                    </Label>
                  </div>
                </div>

                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {mockEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={emp.id}
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={(checked) =>
                            handleSelectEmployee(emp.id, !!checked)
                          }
                        />
                        <div>
                          <p className="font-medium">{emp.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.matricula} • {emp.departamento}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground">
                  {selectedEmployees.length} colaborador(es) selecionado(s)
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleGenerateReport('batch')}
                  disabled={selectedEmployees.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Gerar ZIP com PDFs ({selectedEmployees.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
