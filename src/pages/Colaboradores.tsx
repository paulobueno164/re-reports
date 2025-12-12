import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Download, Loader2, FileText, Link, UserCheck, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';
import { generateSimulationPDF, exportSimulationToExcel } from '@/lib/simulation-pdf';
import { ExpenseTypesManager } from '@/components/colaboradores/ExpenseTypesManager';
import { useNameInconsistency } from '@/hooks/use-name-inconsistency';
import { NameInconsistencyAlert } from '@/components/ui/name-inconsistency-alert';

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
  cestaBeneficiosTeto: number;
  temPida: boolean;
  pidaTeto: number;
  ativo: boolean;
}

const departments = [
  'Tecnologia da Informação',
  'Financeiro',
  'Recursos Humanos',
  'Marketing',
  'Comercial',
  'Operações',
  'Jurídico',
];

const Colaboradores = () => {
  const { toast } = useToast();
  const { hasInconsistency } = useNameInconsistency();
  const [employees, setEmployees] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartamento, setFilterDepartamento] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Colaborador | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // User linking state
  const [foundUser, setFoundUser] = useState<{ id: string; nome: string; email: string } | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);

  // Form state
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
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('colaboradores_elegiveis')
      .select('*')
      .order('nome');

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (data) {
      setEmployees(
        data.map((e) => ({
          id: e.id,
          matricula: e.matricula,
          nome: e.nome,
          email: e.email,
          departamento: e.departamento,
          salarioBase: Number(e.salario_base),
          valeAlimentacao: Number(e.vale_alimentacao),
          valeRefeicao: Number(e.vale_refeicao),
          ajudaCusto: Number(e.ajuda_custo),
          mobilidade: Number(e.mobilidade),
          transporte: Number(e.transporte),
          cestaBeneficiosTeto: Number(e.cesta_beneficios_teto),
          temPida: e.tem_pida,
          pidaTeto: Number(e.pida_teto),
          ativo: e.ativo,
        }))
      );
    }
    setLoading(false);
  };

  // Search for existing user by email
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

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.matricula.includes(searchTerm) ||
      emp.departamento.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDepartamento === 'all' || emp.departamento === filterDepartamento;
    return matchesSearch && matchesDept;
  });

  const columns = [
    { key: 'matricula', header: 'Matrícula', className: 'font-mono' },
    { 
      key: 'nome', 
      header: 'Nome',
      render: (item: Colaborador) => {
        const inconsistency = hasInconsistency(item.id);
        return (
          <span className="inline-flex items-center gap-1">
            {item.nome}
            {inconsistency && (
              <NameInconsistencyAlert 
                colaboradorNome={inconsistency.colaboradorNome} 
                profileNome={inconsistency.profileNome} 
              />
            )}
          </span>
        );
      },
    },
    { key: 'departamento', header: 'Departamento' },
    {
      key: 'cestaBeneficiosTeto',
      header: 'Teto Cesta',
      className: 'text-right font-mono',
      render: (item: Colaborador) => formatCurrency(item.cestaBeneficiosTeto),
    },
    {
      key: 'temPida',
      header: 'PI/DA',
      render: (item: Colaborador) =>
        item.temPida ? (
          <span className="text-success font-medium">Sim</span>
        ) : (
          <span className="text-muted-foreground">Não</span>
        ),
    },
    {
      key: 'ativo',
      header: 'Status',
      render: (item: Colaborador) =>
        item.ativo ? (
          <span className="status-badge status-valid">Ativo</span>
        ) : (
          <span className="status-badge status-draft">Inativo</span>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right',
      render: (item: Colaborador) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleView(item)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleView = (employee: Colaborador) => {
    setSelectedEmployee(employee);
    setFormData({
      matricula: employee.matricula,
      nome: employee.nome,
      email: employee.email,
      departamento: employee.departamento,
      salarioBase: employee.salarioBase,
      valeAlimentacao: employee.valeAlimentacao,
      valeRefeicao: employee.valeRefeicao,
      ajudaCusto: employee.ajudaCusto,
      mobilidade: employee.mobilidade,
      transporte: employee.transporte,
      cestaBeneficiosTeto: employee.cestaBeneficiosTeto,
      temPida: employee.temPida,
      pidaTeto: employee.pidaTeto,
      ativo: employee.ativo,
    });
    setFoundUser(null);
    setLinkedUserId(null);
    setIsViewMode(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (employee: Colaborador) => {
    setSelectedEmployee(employee);
    setFormData({
      matricula: employee.matricula,
      nome: employee.nome,
      email: employee.email,
      departamento: employee.departamento,
      salarioBase: employee.salarioBase,
      valeAlimentacao: employee.valeAlimentacao,
      valeRefeicao: employee.valeRefeicao,
      ajudaCusto: employee.ajudaCusto,
      mobilidade: employee.mobilidade,
      transporte: employee.transporte,
      cestaBeneficiosTeto: employee.cestaBeneficiosTeto,
      temPida: employee.temPida,
      pidaTeto: employee.pidaTeto,
      ativo: employee.ativo,
    });
    setFoundUser(null);
    setLinkedUserId(null);
    setIsViewMode(false);
    setIsDialogOpen(true);
  };

  const handleDelete = async (employee: Colaborador) => {
    if (!confirm(`Deseja realmente excluir o colaborador ${employee.nome}?`)) return;

    const { error } = await supabase.from('colaboradores_elegiveis').delete().eq('id', employee.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Colaborador excluído', description: `${employee.nome} foi removido.` });
      fetchEmployees();
    }
  };

  const handleNewEmployee = () => {
    setSelectedEmployee(null);
    setFormData({
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
    setFoundUser(null);
    setLinkedUserId(null);
    setIsViewMode(false);
    setIsDialogOpen(true);
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
    
    // Include user_id if linking
    if (linkedUserId) {
      dbData.user_id = linkedUserId;
    }

    try {
      if (selectedEmployee) {
        const { error } = await supabase
          .from('colaboradores_elegiveis')
          .update(dbData)
          .eq('id', selectedEmployee.id);
        if (error) throw error;
        toast({ title: 'Colaborador atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        const { error } = await supabase.from('colaboradores_elegiveis').insert([dbData]);
        if (error) throw error;
        toast({ title: 'Colaborador criado', description: 'O colaborador foi cadastrado com sucesso.' });
      }
      setIsDialogOpen(false);
      fetchEmployees();
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Colaboradores Elegíveis"
        description="Gerencie os colaboradores que utilizam a Remuneração Estratégica"
      >
        <Button onClick={handleNewEmployee}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Colaborador
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, matrícula ou departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Departamento" />
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

      {/* Table */}
      <DataTable data={filteredEmployees} columns={columns} emptyMessage="Nenhum colaborador encontrado" />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isViewMode ? 'Visualizar Colaborador' : selectedEmployee ? 'Editar Colaborador' : 'Novo Colaborador'}
            </DialogTitle>
            <DialogDescription>
              {isViewMode
                ? 'Detalhes da parametrização do colaborador'
                : 'Preencha os dados do colaborador e sua parametrização de remuneração'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="space-y-4 py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados Básicos</TabsTrigger>
              <TabsTrigger value="remuneracao">Remuneração</TabsTrigger>
              <TabsTrigger value="despesas" disabled={!selectedEmployee}>Tipos de Despesa</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Dados Básicos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input
                      value={formData.matricula}
                      onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                      disabled={isViewMode}
                      placeholder="Ex: 12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      disabled={isViewMode}
                      placeholder="Nome do colaborador"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isViewMode}
                      placeholder="email@empresa.com.br"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Select
                      value={formData.departamento}
                      onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                      disabled={isViewMode}
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
                    disabled={isViewMode}
                  />
                  <Label htmlFor="ativo">Colaborador Ativo</Label>
                </div>
                
                {/* User Linking Section */}
                {!isViewMode && (
                  <Separator className="my-4" />
                )}
                {!isViewMode && (
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
                )}
              </div>
            </TabsContent>

            <TabsContent value="remuneracao" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Componentes Fixos</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Salário Base (R$)</Label>
                    <Input
                      type="number"
                      value={formData.salarioBase}
                      onChange={(e) => setFormData({ ...formData, salarioBase: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vale Alimentação (R$)</Label>
                    <Input
                      type="number"
                      value={formData.valeAlimentacao}
                      onChange={(e) => setFormData({ ...formData, valeAlimentacao: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vale Refeição (R$)</Label>
                    <Input
                      type="number"
                      value={formData.valeRefeicao}
                      onChange={(e) => setFormData({ ...formData, valeRefeicao: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ajuda de Custo (R$)</Label>
                    <Input
                      type="number"
                      value={formData.ajudaCusto}
                      onChange={(e) => setFormData({ ...formData, ajudaCusto: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mobilidade (R$)</Label>
                    <Input
                      type="number"
                      value={formData.mobilidade}
                      onChange={(e) => setFormData({ ...formData, mobilidade: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transporte (R$)</Label>
                    <Input
                      type="number"
                      value={formData.transporte}
                      onChange={(e) => setFormData({ ...formData, transporte: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Componentes Variáveis</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cesta de Benefícios - Teto (R$)</Label>
                    <Input
                      type="number"
                      value={formData.cestaBeneficiosTeto}
                      onChange={(e) => setFormData({ ...formData, cestaBeneficiosTeto: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PI/DA - Teto (R$)</Label>
                    <Input
                      type="number"
                      value={formData.pidaTeto}
                      onChange={(e) => setFormData({ ...formData, pidaTeto: parseFloat(e.target.value) || 0 })}
                      disabled={isViewMode || !formData.temPida}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="temPida"
                    checked={formData.temPida}
                    onCheckedChange={(checked) => setFormData({ ...formData, temPida: checked })}
                    disabled={isViewMode}
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
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>Salário Base</span>
                      <span className="text-right font-mono">{formatCurrency(formData.salarioBase)}</span>
                      <span className="text-right text-muted-foreground">Fixo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>Vale Alimentação</span>
                      <span className="text-right font-mono">{formatCurrency(formData.valeAlimentacao)}</span>
                      <span className="text-right text-muted-foreground">Fixo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>Vale Refeição</span>
                      <span className="text-right font-mono">{formatCurrency(formData.valeRefeicao)}</span>
                      <span className="text-right text-muted-foreground">Fixo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>Ajuda de Custo</span>
                      <span className="text-right font-mono">{formatCurrency(formData.ajudaCusto)}</span>
                      <span className="text-right text-muted-foreground">Fixo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>Mobilidade</span>
                      <span className="text-right font-mono">{formatCurrency(formData.mobilidade)}</span>
                      <span className="text-right text-muted-foreground">Fixo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>Transporte</span>
                      <span className="text-right font-mono">{formatCurrency(formData.transporte)}</span>
                      <span className="text-right text-muted-foreground">Fixo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>Cesta de Benefícios</span>
                      <span className="text-right font-mono">{formatCurrency(formData.cestaBeneficiosTeto)}</span>
                      <span className="text-right text-muted-foreground">Teto Variável</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span>PI/DA</span>
                      <span className="text-right font-mono">{formatCurrency(formData.pidaTeto)}</span>
                      <span className="text-right text-muted-foreground">Teto Variável</span>
                    </div>
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
              {selectedEmployee && (
                <ExpenseTypesManager 
                  colaboradorId={selectedEmployee.id} 
                  disabled={isViewMode}
                />
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {isViewMode ? 'Fechar' : 'Cancelar'}
            </Button>
            {!isViewMode && (
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Colaboradores;
