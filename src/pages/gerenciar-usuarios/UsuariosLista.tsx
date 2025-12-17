import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Loader2, UserCog, MoreVertical, Users, Info, ExternalLink, Plus, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExpenseTypesManager, ExpenseTypesManagerRef, ExpenseTypeSelection } from '@/components/colaboradores/ExpenseTypesManager';
import { formatCurrency } from '@/lib/expense-validation';

type AppRole = 'FINANCEIRO' | 'COLABORADOR' | 'RH';

interface UserWithRoles {
  id: string;
  email: string;
  nome: string;
  createdAt: string;
  roles: AppRole[];
  colaboradorId?: string;
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

const UsuariosLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New user + colaborador dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const expenseTypesRef = useRef<ExpenseTypesManagerRef>(null);
  const [pendingExpenseTypes, setPendingExpenseTypes] = useState<ExpenseTypeSelection[]>([]);
  
  const [newUserData, setNewUserData] = useState({
    // Basic data
    nome: '',
    email: '',
    password: '',
    confirmPassword: '',
    matricula: '',
    departamento: '',
    // Remuneration
    salarioBase: 0,
    valeAlimentacao: 0,
    valeRefeicao: 0,
    ajudaCusto: 0,
    mobilidade: 0,
    transporte: 0,
    cestaBeneficiosTeto: 0,
    temPida: false,
    pidaTeto: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, nome, created_at')
        .order('nome');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch colaboradores to link users
      const { data: colaboradores } = await supabase
        .from('colaboradores_elegiveis')
        .select('id, user_id');

      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        nome: profile.nome,
        createdAt: profile.created_at,
        roles: (roles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole),
        colaboradorId: (colaboradores || []).find(c => c.user_id === profile.id)?.id,
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUserWithColaborador = async () => {
    // Validations
    if (!newUserData.nome || !newUserData.email || !newUserData.password || !newUserData.matricula || !newUserData.departamento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    if (newUserData.password.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newUserData.password !== newUserData.confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }
    if (!newUserData.email.includes('@')) {
      toast({ title: 'Erro', description: 'Informe um e-mail válido.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      // 1. Create user via edge function
      const { data: userData, error: userError } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'create',
          email: newUserData.email.toLowerCase().trim(),
          password: newUserData.password,
          nome: newUserData.nome,
        },
      });

      if (userError) throw userError;
      if (userData?.error) throw new Error(userData.error);

      const userId = userData.userId;

      // 2. Create colaborador linked to user with remuneration data
      const { data: newColaborador, error: colaboradorError } = await supabase
        .from('colaboradores_elegiveis')
        .insert({
          matricula: newUserData.matricula,
          nome: newUserData.nome,
          email: newUserData.email.toLowerCase().trim(),
          departamento: newUserData.departamento,
          user_id: userId,
          ativo: true,
          salario_base: newUserData.salarioBase,
          vale_alimentacao: newUserData.valeAlimentacao,
          vale_refeicao: newUserData.valeRefeicao,
          ajuda_custo: newUserData.ajudaCusto,
          mobilidade: newUserData.mobilidade,
          transporte: newUserData.transporte,
          cesta_beneficios_teto: newUserData.cestaBeneficiosTeto,
          tem_pida: newUserData.temPida,
          pida_teto: newUserData.pidaTeto,
        })
        .select('id')
        .single();

      if (colaboradorError) throw colaboradorError;

      // 3. Save expense types if any selected
      const expenseTypesToSave = expenseTypesRef.current?.getSelectedTypes() || pendingExpenseTypes;
      if (expenseTypesToSave.length > 0 && newColaborador) {
        const expenseTypeLinks = expenseTypesToSave.map(et => ({
          colaborador_id: newColaborador.id,
          tipo_despesa_id: et.tipo_despesa_id,
          teto_individual: et.teto_individual,
          ativo: true,
        }));
        
        const { error: linkError } = await supabase
          .from('colaborador_tipos_despesas')
          .insert(expenseTypeLinks);
        
        if (linkError) {
          console.error('Erro ao vincular tipos de despesa:', linkError);
        }
      }

      toast({ title: 'Sucesso', description: 'Usuário e colaborador criados com sucesso.' });
      setShowCreateDialog(false);
      resetNewUserData();
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const resetNewUserData = () => {
    setNewUserData({
      nome: '',
      email: '',
      password: '',
      confirmPassword: '',
      matricula: '',
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
    });
    setPendingExpenseTypes([]);
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.nome.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'RH':
        return 'default';
      case 'FINANCEIRO':
        return 'secondary';
      case 'COLABORADOR':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const columns = [
    { 
      key: 'nome', 
      header: 'Nome',
      render: (item: UserWithRoles) => (
        <div className="font-medium truncate max-w-[120px] sm:max-w-none">{item.nome}</div>
      )
    },
    { 
      key: 'email', 
      header: 'E-mail',
      hideOnMobile: true,
      render: (item: UserWithRoles) => (
        <div className="text-muted-foreground">{item.email}</div>
      )
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (item: UserWithRoles) => (
        <div className="flex flex-wrap gap-1">
          {item.roles.length === 0 ? (
            <span className="text-muted-foreground text-sm">Sem roles</span>
          ) : (
            item.roles.map((role) => (
              <Badge key={role} variant={getRoleBadgeVariant(role)}>
                {role}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'vinculo',
      header: 'Colaborador',
      hideOnMobile: true,
      render: (item: UserWithRoles) => (
        item.colaboradorId ? (
          <Badge variant="outline" className="text-success border-success/30">
            Vinculado
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )
      ),
    },
    {
      key: 'createdAt',
      header: 'Cadastro',
      hideOnMobile: true,
      render: (item: UserWithRoles) => (
        <span className="text-muted-foreground text-sm">
          {format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item: UserWithRoles) => (
        <div className="flex justify-end gap-1">
          <div className="hidden sm:flex gap-1">
            <Button variant="outline" size="sm" onClick={() => navigate(`/gerenciar-usuarios/${item.id}/roles`)}>
              <UserCog className="h-4 w-4 mr-2" />
              Roles
            </Button>
            {item.colaboradorId && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/colaboradores/${item.colaboradorId}`)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Colaborador
              </Button>
            )}
          </div>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/gerenciar-usuarios/${item.id}/roles`)}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Gerenciar Roles
                </DropdownMenuItem>
                {item.colaboradorId && (
                  <DropdownMenuItem onClick={() => navigate(`/colaboradores/${item.colaboradorId}`)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver Colaborador
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Gerenciar Usuários"
          description="Visualize e gerencie as permissões dos usuários do sistema"
        >
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Novo Usuário + Colaborador</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm text-muted-foreground">Total de Usuários</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">
              {users.filter((u) => u.roles.includes('RH')).length}
            </div>
            <div className="text-sm text-muted-foreground">Usuários RH</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">
              {users.filter((u) => u.roles.includes('FINANCEIRO')).length}
            </div>
            <div className="text-sm text-muted-foreground">Usuários Financeiro</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">
              {users.filter((u) => u.colaboradorId).length}
            </div>
            <div className="text-sm text-muted-foreground">Vinculados</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <DataTable data={filteredUsers} columns={columns} emptyMessage="Nenhum usuário encontrado" />
      </div>

      {/* Create User + Colaborador Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetNewUserData();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Novo Usuário + Colaborador</DialogTitle>
            <DialogDescription>
              Crie um novo usuário de acesso e seu cadastro de colaborador com remuneração e tipos de despesa.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="dados" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados" className="text-xs sm:text-sm">Dados + Acesso</TabsTrigger>
              <TabsTrigger value="remuneracao" className="text-xs sm:text-sm">Remuneração</TabsTrigger>
              <TabsTrigger value="despesas" className="text-xs sm:text-sm">Tipos de Despesa</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1 px-1">
              <TabsContent value="dados" className="space-y-4 py-4 mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo *</Label>
                    <Input
                      value={newUserData.nome}
                      onChange={(e) => setNewUserData({ ...newUserData, nome: e.target.value })}
                      placeholder="Nome do colaborador"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                      placeholder="email@empresa.com.br"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Matrícula *</Label>
                    <Input
                      value={newUserData.matricula}
                      onChange={(e) => setNewUserData({ ...newUserData, matricula: e.target.value })}
                      placeholder="Ex: 12345"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Departamento *</Label>
                    <Select
                      value={newUserData.departamento}
                      onValueChange={(value) => setNewUserData({ ...newUserData, departamento: value })}
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
                  
                  <div className="space-y-2">
                    <Label>Senha de Acesso *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={newUserData.password}
                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Confirmar Senha *</Label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newUserData.confirmPassword}
                      onChange={(e) => setNewUserData({ ...newUserData, confirmPassword: e.target.value })}
                      placeholder="Repita a senha"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="remuneracao" className="space-y-4 py-4 mt-0">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Remuneração Fixa</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Salário Base</Label>
                      <Input
                        type="number"
                        value={newUserData.salarioBase || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, salarioBase: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Vale Alimentação</Label>
                      <Input
                        type="number"
                        value={newUserData.valeAlimentacao || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, valeAlimentacao: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Vale Refeição</Label>
                      <Input
                        type="number"
                        value={newUserData.valeRefeicao || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, valeRefeicao: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Ajuda de Custo</Label>
                      <Input
                        type="number"
                        value={newUserData.ajudaCusto || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, ajudaCusto: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Mobilidade</Label>
                      <Input
                        type="number"
                        value={newUserData.mobilidade || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, mobilidade: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Transporte</Label>
                      <Input
                        type="number"
                        value={newUserData.transporte || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, transporte: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Benefícios Variáveis</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Teto Cesta de Benefícios</Label>
                      <Input
                        type="number"
                        value={newUserData.cestaBeneficiosTeto || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, cestaBeneficiosTeto: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Teto PI/DA</Label>
                      <Input
                        type="number"
                        value={newUserData.pidaTeto || ''}
                        onChange={(e) => setNewUserData({ ...newUserData, pidaTeto: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                        disabled={!newUserData.temPida}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="temPida"
                      checked={newUserData.temPida}
                      onCheckedChange={(checked) => setNewUserData({ ...newUserData, temPida: checked, pidaTeto: checked ? newUserData.pidaTeto : 0 })}
                    />
                    <Label htmlFor="temPida" className="text-sm">Colaborador tem PI/DA</Label>
                  </div>
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Estes valores podem ser ajustados posteriormente na página de detalhes do colaborador.
                  </AlertDescription>
                </Alert>
              </TabsContent>
              
              <TabsContent value="despesas" className="py-4 mt-0">
                <ExpenseTypesManager
                  ref={expenseTypesRef}
                  standalone={true}
                  onSelectionChange={setPendingExpenseTypes}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUserWithColaborador} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsuariosLista;
