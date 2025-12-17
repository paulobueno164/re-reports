import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit, Loader2, Download, FileText } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';
import { generateSimulationPDF, exportSimulationToExcel } from '@/lib/simulation-pdf';
import { ExpenseTypesManager } from '@/components/colaboradores/ExpenseTypesManager';

interface Colaborador {
  id: string;
  matricula: string;
  nome: string;
  email: string;
  departamento: string;
  salarioBase: number;
  valeAlimentacao: number;
  valeRefeicao: number;
  ajudaCusto: number;
  mobilidade: number;
  transporte: number;
  temPida: boolean;
  pidaTeto: number;
  ativo: boolean;
  userId: string | null;
}

const ColaboradorDetalhe = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [linkedUserName, setLinkedUserName] = useState<string | null>(null);

  useEffect(() => {
    fetchColaborador();
  }, [id]);

  const fetchColaborador = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('colaboradores_elegiveis')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      navigate('/colaboradores');
    } else if (data) {
      setColaborador({
        id: data.id,
        matricula: data.matricula,
        nome: data.nome,
        email: data.email,
        departamento: data.departamento,
        salarioBase: Number(data.salario_base),
        valeAlimentacao: Number(data.vale_alimentacao),
        valeRefeicao: Number(data.vale_refeicao),
        ajudaCusto: Number(data.ajuda_custo),
        mobilidade: Number(data.mobilidade),
        transporte: Number(data.transporte),
        temPida: data.tem_pida,
        pidaTeto: Number(data.pida_teto),
        ativo: data.ativo,
        userId: data.user_id,
      });

      if (data.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', data.user_id)
          .single();
        if (profile) {
          setLinkedUserName(profile.nome);
        }
      }
    }
    setLoading(false);
  };

  const calculateRendimentoTotal = () => {
    if (!colaborador) return 0;
    return (
      colaborador.salarioBase +
      colaborador.valeAlimentacao +
      colaborador.valeRefeicao +
      colaborador.ajudaCusto +
      colaborador.mobilidade +
      colaborador.transporte +
      colaborador.pidaTeto
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!colaborador) {
    return null;
  }

  return (
    <PageFormLayout
      title={colaborador.nome}
      description={`Matrícula: ${colaborador.matricula} • ${colaborador.departamento}`}
      backTo="/colaboradores"
      backLabel="Voltar para lista"
      isViewMode
      extraActions={
        <Button onClick={() => navigate(`/colaboradores/${id}/editar`)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      }
    >
      <div className="flex items-center gap-3 mb-6">
        <Badge variant={colaborador.ativo ? 'default' : 'secondary'}>
          {colaborador.ativo ? 'Ativo' : 'Inativo'}
        </Badge>
        {colaborador.temPida && (
          <Badge variant="outline">PI/DA Habilitado</Badge>
        )}
        {linkedUserName && (
          <Badge variant="outline" className="bg-primary/5">
            Vinculado: {linkedUserName}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dados">Dados Básicos</TabsTrigger>
          <TabsTrigger value="remuneracao">Remuneração</TabsTrigger>
          <TabsTrigger value="despesas">Tipos de Despesa</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Matrícula</p>
              <p className="font-medium font-mono">{colaborador.matricula}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Nome Completo</p>
              <p className="font-medium">{colaborador.nome}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium">{colaborador.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Departamento</p>
              <p className="font-medium">{colaborador.departamento}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="remuneracao" className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Componentes Fixos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Salário Base', value: colaborador.salarioBase },
                { label: 'Vale Alimentação', value: colaborador.valeAlimentacao },
                { label: 'Vale Refeição', value: colaborador.valeRefeicao },
                { label: 'Ajuda de Custo', value: colaborador.ajudaCusto },
                { label: 'Mobilidade', value: colaborador.mobilidade },
                { label: 'Transporte', value: colaborador.transporte },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="font-mono font-medium">{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Componentes Variáveis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cesta de Benefícios - Teto</p>
                <p className="font-mono font-medium">{formatCurrency(colaborador.cestaBeneficiosTeto)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">PI/DA - Teto</p>
                <p className="font-mono font-medium">
                  {colaborador.temPida ? formatCurrency(colaborador.pidaTeto) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                Simulação da Remuneração Estratégica
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const simulationData = {
                        colaborador: { nome: colaborador.nome, matricula: colaborador.matricula, departamento: colaborador.departamento, email: colaborador.email },
                        componentes: [
                          { nome: 'Salário Base', valor: colaborador.salarioBase, tipo: 'Fixo' },
                          { nome: 'Vale Alimentação', valor: colaborador.valeAlimentacao, tipo: 'Fixo' },
                          { nome: 'Vale Refeição', valor: colaborador.valeRefeicao, tipo: 'Fixo' },
                          { nome: 'Ajuda de Custo', valor: colaborador.ajudaCusto, tipo: 'Fixo' },
                          { nome: 'Mobilidade', valor: colaborador.mobilidade, tipo: 'Fixo' },
                          { nome: 'Transporte', valor: colaborador.transporte, tipo: 'Fixo' },
                          { nome: 'Cesta de Benefícios', valor: colaborador.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                          { nome: 'PI/DA', valor: colaborador.pidaTeto, tipo: 'Teto Variável' },
                        ],
                        rendimentoTotal: calculateRendimentoTotal(),
                      };
                      generateSimulationPDF(simulationData);
                      toast({ title: 'PDF gerado', description: 'Simulação exportada com sucesso.' });
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const simulationData = {
                        colaborador: { nome: colaborador.nome, matricula: colaborador.matricula, departamento: colaborador.departamento, email: colaborador.email },
                        componentes: [
                          { nome: 'Salário Base', valor: colaborador.salarioBase, tipo: 'Fixo' },
                          { nome: 'Vale Alimentação', valor: colaborador.valeAlimentacao, tipo: 'Fixo' },
                          { nome: 'Vale Refeição', valor: colaborador.valeRefeicao, tipo: 'Fixo' },
                          { nome: 'Ajuda de Custo', valor: colaborador.ajudaCusto, tipo: 'Fixo' },
                          { nome: 'Mobilidade', valor: colaborador.mobilidade, tipo: 'Fixo' },
                          { nome: 'Transporte', valor: colaborador.transporte, tipo: 'Fixo' },
                          { nome: 'Cesta de Benefícios', valor: colaborador.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                          { nome: 'PI/DA', valor: colaborador.pidaTeto, tipo: 'Teto Variável' },
                        ],
                        rendimentoTotal: calculateRendimentoTotal(),
                      };
                      exportSimulationToExcel(simulationData);
                      toast({ title: 'Excel gerado', description: 'Simulação exportada com sucesso.' });
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Excel
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                  <span>Componente</span>
                  <span className="text-right">Valor</span>
                  <span className="text-right">Tipo</span>
                </div>
                {[
                  { nome: 'Salário Base', valor: colaborador.salarioBase, tipo: 'Fixo' },
                  { nome: 'Vale Alimentação', valor: colaborador.valeAlimentacao, tipo: 'Fixo' },
                  { nome: 'Vale Refeição', valor: colaborador.valeRefeicao, tipo: 'Fixo' },
                  { nome: 'Ajuda de Custo', valor: colaborador.ajudaCusto, tipo: 'Fixo' },
                  { nome: 'Mobilidade', valor: colaborador.mobilidade, tipo: 'Fixo' },
                  { nome: 'Transporte', valor: colaborador.transporte, tipo: 'Fixo' },
                  { nome: 'Cesta de Benefícios', valor: colaborador.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                  { nome: 'PI/DA', valor: colaborador.pidaTeto, tipo: 'Teto Variável' },
                ].map((item) => (
                  <div key={item.nome} className="grid grid-cols-3 gap-2 text-sm">
                    <span>{item.nome}</span>
                    <span className="text-right font-mono">{formatCurrency(item.valor)}</span>
                    <span className="text-right text-muted-foreground">{item.tipo}</span>
                  </div>
                ))}
                <Separator />
                <div className="grid grid-cols-3 gap-2 text-sm font-bold">
                  <span>Rendimento Total</span>
                  <span className="text-right font-mono text-primary">{formatCurrency(calculateRendimentoTotal())}</span>
                  <span></span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despesas">
          <ExpenseTypesManager colaboradorId={colaborador.id} disabled />
        </TabsContent>
      </Tabs>
    </PageFormLayout>
  );
};

export default ColaboradorDetalhe;
