import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Loader2, Download, FileText, Link, UserCheck, UserX } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';
import { generateSimulationPDF, exportSimulationToExcel } from '@/lib/simulation-pdf';
import { ExpenseTypesManager } from '@/components/colaboradores/ExpenseTypesManager';

const departments = [
  'Tecnologia da Informação',
  'Financeiro',
  'Recursos Humanos',
  'Marketing',
  'Comercial',
  'Operações',
  'Jurídico',
];

const ColaboradorForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [foundUser, setFoundUser] = useState<{ id: string; nome: string; email: string } | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    matricula: '',
    nome: '',
    email: '',
    departamento: '',
    salarioBase: 0,
    valeAlimentacao: 0,
    valeRefeicao: 0,
    ajudaCusto: 0,
    mobilidade: 0,
    transporte: 0,
    cestaBeneficiosTeto: 0,
    temPida: false,
    pidaTeto: 0,
    ativo: true,
  });

  useEffect(() => {
    if (isEditing) {
      fetchColaborador();
    }
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
      setFormData({
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
        cestaBeneficiosTeto: Number(data.cesta_beneficios_teto),
        temPida: data.tem_pida,
        pidaTeto: Number(data.pida_teto),
        ativo: data.ativo,
      });
      if (data.user_id) {
        setLinkedUserId(data.user_id);
        // Fetch linked user info
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, nome, email')
          .eq('id', data.user_id)
          .single();
        if (profile) {
          setFoundUser(profile);
        }
      }
    }
    setLoading(false);
  };

  const searchUserByEmail = async (email: string) => {
    if (!email || !email.includes('@')) {
      setFoundUser(null);
      return;
    }
    
    setSearchingUser(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    
    setFoundUser(profile);
    setSearchingUser(false);
  };

  const handleLinkUser = () => {
    if (foundUser) {
      setLinkedUserId(foundUser.id);
      toast({ 
        title: 'Usuário vinculado', 
        description: `${foundUser.nome} será vinculado ao salvar.` 
      });
    }
  };

  const handleUnlinkUser = () => {
    setLinkedUserId(null);
    toast({ title: 'Vínculo removido' });
  };

  const handleSave = async () => {
    if (!formData.matricula || !formData.nome || !formData.email || !formData.departamento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const dbData: any = {
      matricula: formData.matricula,
      nome: formData.nome,
      email: formData.email,
      departamento: formData.departamento,
      salario_base: formData.salarioBase,
      vale_alimentacao: formData.valeAlimentacao,
      vale_refeicao: formData.valeRefeicao,
      ajuda_custo: formData.ajudaCusto,
      mobilidade: formData.mobilidade,
      transporte: formData.transporte,
      cesta_beneficios_teto: formData.cestaBeneficiosTeto,
      tem_pida: formData.temPida,
      pida_teto: formData.pidaTeto,
      ativo: formData.ativo,
    };
    
    if (linkedUserId) {
      dbData.user_id = linkedUserId;
    }

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('colaboradores_elegiveis')
          .update(dbData)
          .eq('id', id);
        if (error) throw error;
        toast({ title: 'Colaborador atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        const { error } = await supabase.from('colaboradores_elegiveis').insert([dbData]);
        if (error) throw error;
        toast({ title: 'Colaborador criado', description: 'O colaborador foi cadastrado com sucesso.' });
      }
      navigate('/colaboradores');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const calculateRendimentoTotal = () => {
    return (
      formData.salarioBase +
      formData.valeAlimentacao +
      formData.valeRefeicao +
      formData.ajudaCusto +
      formData.mobilidade +
      formData.transporte +
      formData.cestaBeneficiosTeto +
      formData.pidaTeto
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageFormLayout
      title={isEditing ? 'Editar Colaborador' : 'Novo Colaborador'}
      description="Preencha os dados do colaborador e sua parametrização de remuneração"
      backTo="/colaboradores"
      backLabel="Voltar para lista"
      onSave={handleSave}
      onCancel={() => navigate('/colaboradores')}
      saving={saving}
    >
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dados">Dados Básicos</TabsTrigger>
          <TabsTrigger value="remuneracao">Remuneração</TabsTrigger>
          <TabsTrigger value="despesas" disabled={!isEditing}>Tipos de Despesa</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Dados Básicos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input
                  value={formData.matricula}
                  onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                  placeholder="Ex: 12345"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do colaborador"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@empresa.com.br"
                />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={formData.departamento}
                  onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Colaborador Ativo</Label>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Link className="h-4 w-4" />
                Vincular a Usuário Existente
              </h3>
              <p className="text-xs text-muted-foreground">
                Busque um usuário já cadastrado no sistema pelo e-mail para vincular a este colaborador.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => searchUserByEmail(formData.email)}
                  disabled={!formData.email || searchingUser}
                >
                  {searchingUser ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Buscar Usuário
                </Button>
              </div>
              
              {foundUser && !linkedUserId && (
                <Alert className="border-success/50 bg-success/5">
                  <UserCheck className="h-4 w-4 text-success" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{foundUser.nome}</span>
                      <span className="text-muted-foreground ml-2">({foundUser.email})</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleLinkUser}>
                      <Link className="h-4 w-4 mr-2" />
                      Vincular
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              {linkedUserId && foundUser && (
                <Alert className="border-primary/50 bg-primary/5">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Vinculado a: {foundUser.nome}</span>
                      <span className="text-muted-foreground ml-2">({foundUser.email})</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={handleUnlinkUser}>
                      <UserX className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              {foundUser === null && formData.email && !searchingUser && (
                <Alert className="border-muted">
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  <AlertDescription>
                    Nenhum usuário encontrado com este e-mail. O colaborador poderá ser vinculado posteriormente quando o usuário se cadastrar.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="remuneracao" className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Componentes Fixos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Salário Base (R$)</Label>
                <Input
                  type="number"
                  value={formData.salarioBase}
                  onChange={(e) => setFormData({ ...formData, salarioBase: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vale Alimentação (R$)</Label>
                <Input
                  type="number"
                  value={formData.valeAlimentacao}
                  onChange={(e) => setFormData({ ...formData, valeAlimentacao: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vale Refeição (R$)</Label>
                <Input
                  type="number"
                  value={formData.valeRefeicao}
                  onChange={(e) => setFormData({ ...formData, valeRefeicao: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ajuda de Custo (R$)</Label>
                <Input
                  type="number"
                  value={formData.ajudaCusto}
                  onChange={(e) => setFormData({ ...formData, ajudaCusto: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mobilidade (R$)</Label>
                <Input
                  type="number"
                  value={formData.mobilidade}
                  onChange={(e) => setFormData({ ...formData, mobilidade: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Transporte (R$)</Label>
                <Input
                  type="number"
                  value={formData.transporte}
                  onChange={(e) => setFormData({ ...formData, transporte: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Componentes Variáveis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cesta de Benefícios - Teto (R$)</Label>
                <Input
                  type="number"
                  value={formData.cestaBeneficiosTeto}
                  onChange={(e) => setFormData({ ...formData, cestaBeneficiosTeto: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>PI/DA - Teto (R$)</Label>
                <Input
                  type="number"
                  value={formData.pidaTeto}
                  onChange={(e) => setFormData({ ...formData, pidaTeto: parseFloat(e.target.value) || 0 })}
                  disabled={!formData.temPida}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="temPida"
                checked={formData.temPida}
                onCheckedChange={(checked) => setFormData({ ...formData, temPida: checked })}
              />
              <Label htmlFor="temPida">Possui PI/DA (Propriedade Intelectual / Direitos Autorais)</Label>
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
                        colaborador: { nome: formData.nome, matricula: formData.matricula, departamento: formData.departamento, email: formData.email },
                        componentes: [
                          { nome: 'Salário Base', valor: formData.salarioBase, tipo: 'Fixo' },
                          { nome: 'Vale Alimentação', valor: formData.valeAlimentacao, tipo: 'Fixo' },
                          { nome: 'Vale Refeição', valor: formData.valeRefeicao, tipo: 'Fixo' },
                          { nome: 'Ajuda de Custo', valor: formData.ajudaCusto, tipo: 'Fixo' },
                          { nome: 'Mobilidade', valor: formData.mobilidade, tipo: 'Fixo' },
                          { nome: 'Transporte', valor: formData.transporte, tipo: 'Fixo' },
                          { nome: 'Cesta de Benefícios', valor: formData.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                          { nome: 'PI/DA', valor: formData.pidaTeto, tipo: 'Teto Variável' },
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
                        colaborador: { nome: formData.nome, matricula: formData.matricula, departamento: formData.departamento, email: formData.email },
                        componentes: [
                          { nome: 'Salário Base', valor: formData.salarioBase, tipo: 'Fixo' },
                          { nome: 'Vale Alimentação', valor: formData.valeAlimentacao, tipo: 'Fixo' },
                          { nome: 'Vale Refeição', valor: formData.valeRefeicao, tipo: 'Fixo' },
                          { nome: 'Ajuda de Custo', valor: formData.ajudaCusto, tipo: 'Fixo' },
                          { nome: 'Mobilidade', valor: formData.mobilidade, tipo: 'Fixo' },
                          { nome: 'Transporte', valor: formData.transporte, tipo: 'Fixo' },
                          { nome: 'Cesta de Benefícios', valor: formData.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                          { nome: 'PI/DA', valor: formData.pidaTeto, tipo: 'Teto Variável' },
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
                  { nome: 'Salário Base', valor: formData.salarioBase, tipo: 'Fixo' },
                  { nome: 'Vale Alimentação', valor: formData.valeAlimentacao, tipo: 'Fixo' },
                  { nome: 'Vale Refeição', valor: formData.valeRefeicao, tipo: 'Fixo' },
                  { nome: 'Ajuda de Custo', valor: formData.ajudaCusto, tipo: 'Fixo' },
                  { nome: 'Mobilidade', valor: formData.mobilidade, tipo: 'Fixo' },
                  { nome: 'Transporte', valor: formData.transporte, tipo: 'Fixo' },
                  { nome: 'Cesta de Benefícios', valor: formData.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                  { nome: 'PI/DA', valor: formData.pidaTeto, tipo: 'Teto Variável' },
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
          {isEditing && id && <ExpenseTypesManager colaboradorId={id} />}
        </TabsContent>
      </Tabs>
    </PageFormLayout>
  );
};

export default ColaboradorForm;
