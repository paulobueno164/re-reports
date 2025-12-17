import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, UserCog, MoreVertical, Plus, Eye, EyeOff, Link, KeyRound, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type AppRole = 'FINANCEIRO' | 'COLABORADOR' | 'RH';

interface UserWithRoles {
  id: string;
  email: string;
  nome: string;
  createdAt: string;
  roles: AppRole[];
  colaboradorId?: string;
  colaboradorNome?: string;
}

interface ColaboradorSemUsuario {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  departamento: string;
}

const UsuariosLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Change password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Link colaborador dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [colaboradoresSemUsuario, setColaboradoresSemUsuario] = useState<ColaboradorSemUsuario[]>([]);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState('');
  const [linking, setLinking] = useState(false);

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
        .select('id, user_id, nome');

      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
        const colab = (colaboradores || []).find(c => c.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          nome: profile.nome,
          createdAt: profile.created_at,
          roles: (roles || [])
            .filter((r) => r.user_id === profile.id)
            .map((r) => r.role as AppRole),
          colaboradorId: colab?.id,
          colaboradorNome: colab?.nome,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchColaboradoresSemUsuario = async () => {
    const { data, error } = await supabase
      .from('colaboradores_elegiveis')
      .select('id, nome, matricula, email, departamento')
      .is('user_id', null)
      .eq('ativo', true)
      .order('nome');

    if (!error && data) {
      setColaboradoresSemUsuario(data);
    }
  };

  const handleOpenPasswordDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowPasswordDialog(true);
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;
    
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'update_password',
          userId: selectedUser.id,
          password: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' });
      setShowPasswordDialog(false);
    } catch (error: any) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleOpenLinkDialog = async (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedColaboradorId('');
    await fetchColaboradoresSemUsuario();
    setShowLinkDialog(true);
  };

  const handleLinkColaborador = async () => {
    if (!selectedUser || !selectedColaboradorId) return;

    setLinking(true);
    try {
      const { error } = await supabase
        .from('colaboradores_elegiveis')
        .update({ user_id: selectedUser.id })
        .eq('id', selectedColaboradorId);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Colaborador vinculado com sucesso.' });
      setShowLinkDialog(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Erro ao vincular', description: error.message, variant: 'destructive' });
    } finally {
      setLinking(false);
    }
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
            <Button variant="ghost" size="sm" onClick={() => handleOpenPasswordDialog(item)}>
              <KeyRound className="h-4 w-4 mr-2" />
              Senha
            </Button>
            {!item.colaboradorId && (
              <Button variant="ghost" size="sm" onClick={() => handleOpenLinkDialog(item)}>
                <Link className="h-4 w-4 mr-2" />
                Vincular
              </Button>
            )}
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
                <DropdownMenuItem onClick={() => handleOpenPasswordDialog(item)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Alterar Senha
                </DropdownMenuItem>
                {!item.colaboradorId && (
                  <DropdownMenuItem onClick={() => handleOpenLinkDialog(item)}>
                    <Link className="mr-2 h-4 w-4" />
                    Vincular Colaborador
                  </DropdownMenuItem>
                )}
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
          <Button onClick={() => navigate('/gerenciar-usuarios/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Novo Usuário</span>
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

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Alterar a senha do usuário: {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} disabled={changingPassword}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Colaborador Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Colaborador</DialogTitle>
            <DialogDescription>
              Vincular um colaborador ao usuário: {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {colaboradoresSemUsuario.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Todos os colaboradores já possuem usuário vinculado.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <Label>Selecione o Colaborador</Label>
                <Select value={selectedColaboradorId} onValueChange={setSelectedColaboradorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradoresSemUsuario.map((colab) => (
                      <SelectItem key={colab.id} value={colab.id}>
                        {colab.nome} - {colab.matricula} ({colab.departamento})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)} disabled={linking}>
              Cancelar
            </Button>
            <Button 
              onClick={handleLinkColaborador} 
              disabled={linking || !selectedColaboradorId || colaboradoresSemUsuario.length === 0}
            >
              {linking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsuariosLista;
