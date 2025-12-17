import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Download, FileText, UserCheck, UserX, UserPlus, Key, Mail, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';
import { generateSimulationPDF, exportSimulationToExcel } from '@/lib/simulation-pdf';
import { ExpenseTypesManager, ExpenseTypesManagerRef, ExpenseTypeSelection } from '@/components/colaboradores/ExpenseTypesManager';

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
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  
  // Expense types for new colaborador
  const expenseTypesRef = useRef<ExpenseTypesManagerRef>(null);
  const [pendingExpenseTypes, setPendingExpenseTypes] = useState<ExpenseTypeSelection[]>([]);
  
  // User management states
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showChangeEmailDialog, setShowChangeEmailDialog] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [processingUser, setProcessingUser] = useState(false);

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
    cestaBeneficiosTeto: 0,
    temPida: false,
    pidaTeto: 0,
    ativo: true,
    feriasInicio: '',
    feriasFim: '',
    beneficioProporcional: false,
  });

  // Zero PI/DA when switch is disabled
  const handleTemPidaChange = (checked: boolean) => {
    setFormData({ 
      ...formData, 
      temPida: checked,
      pidaTeto: checked ? formData.pidaTeto : 0
    });
  };

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
      const colaboradorData = data as any;
      setFormData({
        matricula: colaboradorData.matricula,
        nome: colaboradorData.nome,
        email: colaboradorData.email,
        departamento: colaboradorData.departamento,
        salarioBase: Number(colaboradorData.salario_base),
        valeAlimentacao: Number(colaboradorData.vale_alimentacao),
        valeRefeicao: Number(colaboradorData.vale_refeicao),
        ajudaCusto: Number(colaboradorData.ajuda_custo),
        mobilidade: Number(colaboradorData.mobilidade),
        cestaBeneficiosTeto: Number(colaboradorData.cesta_beneficios_teto || 0),
        temPida: colaboradorData.tem_pida,
        pidaTeto: Number(colaboradorData.pida_teto),
        ativo: colaboradorData.ativo,
        feriasInicio: colaboradorData.ferias_inicio || '',
        feriasFim: colaboradorData.ferias_fim || '',
        beneficioProporcional: colaboradorData.beneficio_proporcional || false,
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

  const handleCreateUser = async () => {
    if (!newUserPassword || newUserPassword.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newUserPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }
    if (!formData.email || !formData.nome) {
      toast({ title: 'Erro', description: 'Preencha o nome e e-mail do colaborador primeiro.', variant: 'destructive' });
      return;
    }

    setProcessingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'create',
          email: formData.email.toLowerCase().trim(),
          password: newUserPassword,
          nome: formData.nome,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLinkedUserId(data.userId);
      setFoundUser({ id: data.userId, nome: formData.nome, email: formData.email });
      setShowCreateUserDialog(false);
      setNewUserPassword('');
      setConfirmPassword('');
      toast({ title: 'Sucesso', description: 'Usuário criado e vinculado com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingUser(false);
    }
  };

  const handleChangePassword = async () => {
    if (!linkedUserId) return;
    if (!newUserPassword || newUserPassword.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newUserPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }

    setProcessingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'update_password',
          userId: linkedUserId,
          password: newUserPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setShowChangePasswordDialog(false);
      setNewUserPassword('');
      setConfirmPassword('');
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingUser(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!linkedUserId) return;
    if (!newEmail || !newEmail.includes('@')) {
      toast({ title: 'Erro', description: 'Informe um e-mail válido.', variant: 'destructive' });
      return;
    }

    setProcessingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'update_email',
          userId: linkedUserId,
          email: newEmail.toLowerCase().trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setFormData({ ...formData, email: newEmail });
      if (foundUser) {
        setFoundUser({ ...foundUser, email: newEmail });
      }
      setShowChangeEmailDialog(false);
      setNewEmail('');
      toast({ title: 'Sucesso', description: 'E-mail alterado com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro ao alterar e-mail', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingUser(false);
    }
  };

  const handleUnlinkUser = () => {
    setLinkedUserId(null);
    setFoundUser(null);
    toast({ title: 'Vínculo removido', description: 'O usuário foi desvinculado do colaborador.' });
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
      cesta_beneficios_teto: formData.cestaBeneficiosTeto,
      tem_pida: formData.temPida,
      pida_teto: formData.pidaTeto,
      ativo: formData.ativo,
      user_id: linkedUserId || null,
      ferias_inicio: formData.feriasInicio || null,
      ferias_fim: formData.feriasFim || null,
      beneficio_proporcional: formData.beneficioProporcional,
    };

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('colaboradores_elegiveis')
          .update(dbData)
          .eq('id', id);
        if (error) throw error;
        toast({ title: 'Colaborador atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        const { data: newColaborador, error } = await supabase
          .from('colaboradores_elegiveis')
          .insert([dbData])
          .select('id')
          .single();
        if (error) throw error;
        
        // Save expense types for new colaborador
        const expenseTypesToSave = expenseTypesRef.current?.getSelectedTypes() || pendingExpenseTypes;
        if (expenseTypesToSave.length > 0 && newColaborador) {
          const expenseTypeLinks = expenseTypesToSave.map(et => ({
            colaborador_id: newColaborador.id,
            tipo_despesa_id: et.tipo_despesa_id,
            ativo: true,
          }));
          
          const { error: linkError } = await supabase
            .from('colaborador_tipos_despesas')
            .insert(expenseTypeLinks);
          
          if (linkError) {
            console.error('Erro ao vincular tipos de despesa:', linkError);
            // Don't fail the whole operation, just log the error
          }
        }
        
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
    <>
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
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto">
            <TabsTrigger value="dados" className="text-xs sm:text-sm">Dados Básicos</TabsTrigger>
            <TabsTrigger value="usuario" className="text-xs sm:text-sm">Acesso ao Sistema</TabsTrigger>
            <TabsTrigger value="remuneracao" className="text-xs sm:text-sm">Remuneração</TabsTrigger>
            <TabsTrigger value="despesas" className="text-xs sm:text-sm">Cesta de Benefícios</TabsTrigger>
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
                    disabled={linkedUserId !== null}
                  />
                  {linkedUserId && (
                    <p className="text-xs text-muted-foreground">
                      E-mail vinculado ao usuário. Use a aba "Acesso ao Sistema" para alterar.
                    </p>
                  )}
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

              <h3 className="text-sm font-semibold text-foreground">Período de Férias</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>Início das Férias</Label>
                  <Input
                    type="date"
                    value={formData.feriasInicio}
                    onChange={(e) => setFormData({ ...formData, feriasInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim das Férias</Label>
                  <Input
                    type="date"
                    value={formData.feriasFim}
                    onChange={(e) => setFormData({ ...formData, feriasFim: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 mt-3">
                <Switch
                  id="beneficioProporcional"
                  checked={formData.beneficioProporcional}
                  onCheckedChange={(checked) => setFormData({ ...formData, beneficioProporcional: checked })}
                />
                <Label htmlFor="beneficioProporcional">Aplicar benefício proporcional aos dias trabalhados</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="usuario" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Acesso ao Sistema
                </CardTitle>
                <CardDescription>
                  Gerencie o usuário de acesso deste colaborador ao sistema RE-Reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!linkedUserId ? (
                  <div className="space-y-4">
                    <Alert>
                      <UserX className="h-4 w-4" />
                      <AlertDescription>
                        Este colaborador ainda não possui usuário de acesso ao sistema.
                      </AlertDescription>
                    </Alert>
                    
                    <Button onClick={() => setShowCreateUserDialog(true)} disabled={!formData.email || !formData.nome}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Criar Usuário de Acesso
                    </Button>
                    
                    {(!formData.email || !formData.nome) && (
                      <p className="text-xs text-muted-foreground">
                        Preencha o nome e e-mail na aba "Dados Básicos" primeiro.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-success/50 bg-success/5">
                      <UserCheck className="h-4 w-4 text-success" />
                      <AlertDescription>
                        <div className="font-medium">Usuário vinculado</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          <strong>Nome:</strong> {foundUser?.nome || formData.nome}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <strong>E-mail de acesso:</strong> {foundUser?.email || formData.email}
                        </div>
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setNewEmail(foundUser?.email || formData.email);
                        setShowChangeEmailDialog(true);
                      }}>
                        <Mail className="h-4 w-4 mr-2" />
                        Alterar E-mail
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowChangePasswordDialog(true)}>
                        <Key className="h-4 w-4 mr-2" />
                        Alterar Senha
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleUnlinkUser} className="text-destructive hover:text-destructive">
                        <UserX className="h-4 w-4 mr-2" />
                        Desvincular
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="remuneracao" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Componentes Fixos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <Label>Cesta de Benefícios - Teto (R$)</Label>
                  <Input
                    type="number"
                    value={formData.cestaBeneficiosTeto}
                    onChange={(e) => setFormData({ ...formData, cestaBeneficiosTeto: parseFloat(e.target.value) || 0 })}
                  />
                  {formData.cestaBeneficiosTeto === 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Com o teto da Cesta de Benefícios zerado, o colaborador não poderá realizar lançamentos de despesas variáveis.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="temPida"
                  checked={formData.temPida}
                  onCheckedChange={(checked) => setFormData({ ...formData, temPida: checked })}
                />
                <Label htmlFor="temPida">Possui PI/DA (Propriedade Intelectual / Direitos Autorais)</Label>
              </div>

              {formData.temPida && (
                <div className="space-y-2 pt-2">
                  <Label>PI/DA - Teto (R$)</Label>
                  <Input
                    type="number"
                    value={formData.pidaTeto}
                    onChange={(e) => setFormData({ ...formData, pidaTeto: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>

            <Separator />

            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span>Simulação da Remuneração Estratégica</span>
                  <div className="flex gap-2 flex-wrap">
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
                            { nome: 'Cesta de Benefícios', valor: formData.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                            ...(formData.temPida ? [{ nome: 'PI/DA', valor: formData.pidaTeto, tipo: 'Teto Variável' }] : []),
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
                            { nome: 'Cesta de Benefícios', valor: formData.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                            ...(formData.temPida ? [{ nome: 'PI/DA', valor: formData.pidaTeto, tipo: 'Teto Variável' }] : []),
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
                    { nome: 'Cesta de Benefícios', valor: formData.cestaBeneficiosTeto, tipo: 'Teto Variável' },
                    ...(formData.temPida ? [{ nome: 'PI/DA', valor: formData.pidaTeto, tipo: 'Teto Variável' }] : []),
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
            {isEditing && id ? (
              <ExpenseTypesManager colaboradorId={id} />
            ) : (
              <ExpenseTypesManager 
                ref={expenseTypesRef}
                standalone 
                onSelectionChange={setPendingExpenseTypes}
              />
            )}
          </TabsContent>
        </Tabs>
      </PageFormLayout>

      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Usuário de Acesso</DialogTitle>
            <DialogDescription>
              Defina uma senha para o colaborador <strong>{formData.nome}</strong> acessar o sistema com o e-mail <strong>{formData.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={processingUser}>
              {processingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para o usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmar Nova Senha</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangePasswordDialog(false); setNewUserPassword(''); setConfirmPassword(''); }}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={processingUser}>
              {processingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Email Dialog */}
      <Dialog open={showChangeEmailDialog} onOpenChange={setShowChangeEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar E-mail</DialogTitle>
            <DialogDescription>
              Altere o e-mail de acesso do usuário. Isso também atualizará o e-mail no cadastro do colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Novo E-mail</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@email.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangeEmailDialog(false); setNewEmail(''); }}>Cancelar</Button>
            <Button onClick={handleChangeEmail} disabled={processingUser}>
              {processingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar E-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ColaboradorForm;
