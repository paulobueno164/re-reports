import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, UserCog, MoreVertical, Plus, Eye, EyeOff, Link, Unlink2, KeyRound, ExternalLink, Ban, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import authService, { AppRole, UserWithRoles } from '@/services/auth.service';
import colaboradoresService from '@/services/colaboradores.service';
import { useAuth } from '@/contexts/AuthContext';

interface ColaboradorSemUsuario {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  departamento: string;
}

interface UserDisplay extends UserWithRoles {
  colaboradorId?: string;
  colaboradorNome?: string;
}

const UsuariosLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser, hasRole } = useAuth();
  const [users, setUsers] = useState<UserDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Change password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDisplay | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Link colaborador dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [colaboradoresSemUsuario, setColaboradoresSemUsuario] = useState<ColaboradorSemUsuario[]>([]);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState('');
  const [linking, setLinking] = useState(false);
  
  // Unlink colaborador dialog
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersData = await authService.getAllUsers();
      const colaboradores = await colaboradoresService.getAll();
      
      const usersWithColab: UserDisplay[] = usersData.map(user => {
        const colab = colaboradores.find(c => c.user_id === user.id);
        return {
          ...user,
          roles: Array.isArray(user.roles) ? user.roles : [],
          colaboradorId: colab?.id,
          colaboradorNome: colab?.nome,
        };
      });

      setUsers(usersWithColab);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchColaboradoresSemUsuario = async () => {
    try {
      const data = await colaboradoresService.getAll({ ativo: true });
      const semUsuario = data.filter(c => !c.user_id);
      setColaboradoresSemUsuario(semUsuario.map(c => ({
        id: c.id,
        nome: c.nome,
        matricula: c.matricula,
        email: c.email,
        departamento: c.departamento,
      })));
    } catch (error) {
      console.error('Erro ao buscar colaboradores:', error);
    }
  };

  const handleOpenPasswordDialog = (user: UserDisplay) => {
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
      await authService.updateUserPassword(selectedUser.id, newPassword);
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' });
      setShowPasswordDialog(false);
    } catch (error: any) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleOpenLinkDialog = async (user: UserDisplay) => {
    // Verificar se o usuário tem role COLABORADOR
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (!roles.includes('COLABORADOR')) {
      toast({ 
        title: 'Erro', 
        description: 'Apenas usuários com role COLABORADOR podem ser vinculados a colaboradores.', 
        variant: 'destructive' 
      });
      return;
    }

    setSelectedUser(user);
    setSelectedColaboradorId('');
    await fetchColaboradoresSemUsuario();
    setShowLinkDialog(true);
  };

  const handleLinkColaborador = async () => {
    if (!selectedUser || !selectedColaboradorId) return;

    setLinking(true);
    try {
      await colaboradoresService.update(selectedColaboradorId, { user_id: selectedUser.id });
      toast({ title: 'Sucesso', description: 'Colaborador vinculado com sucesso.' });
      setShowLinkDialog(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Erro ao vincular', description: error.message, variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const handleOpenUnlinkDialog = (user: UserDisplay) => {
    setSelectedUser(user);
    setShowUnlinkDialog(true);
  };

  const handleUnlinkColaborador = async () => {
    if (!selectedUser || !selectedUser.colaboradorId) return;

    setUnlinking(true);
    try {
      await colaboradoresService.update(selectedUser.colaboradorId, { user_id: null });
      toast({ title: 'Sucesso', description: 'Colaborador desvinculado com sucesso.' });
      setShowUnlinkDialog(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Erro ao desvincular', description: error.message, variant: 'destructive' });
    } finally {
      setUnlinking(false);
    }
  };

  const handleToggleUserStatus = async (user: UserDisplay) => {
    // Validação adicional no frontend
    if (user.id === currentUser?.id) {
      toast({ 
        title: 'Erro', 
        description: 'Você não pode inativar a si mesmo.', 
        variant: 'destructive' 
      });
      return;
    }

    if (!hasRole('RH')) {
      toast({ 
        title: 'Erro', 
        description: 'Apenas usuários com role RH podem ativar/inativar usuários.', 
        variant: 'destructive' 
      });
      return;
    }

    const novoStatus = !(user.ativo !== false);
    const acao = novoStatus ? 'ativar' : 'inativar';
    
    try {
      await authService.toggleUserStatus(user.id, novoStatus);
      toast({ 
        title: 'Sucesso', 
        description: `Usuário ${acao === 'ativar' ? 'ativado' : 'inativado'} com sucesso.` 
      });
      fetchUsers();
    } catch (error: any) {
      toast({ 
        title: 'Erro', 
        description: `Erro ao ${acao} usuário: ${error.message}`, 
        variant: 'destructive' 
      });
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
      render: (item: UserDisplay) => (
        <div className="font-medium truncate max-w-[120px] sm:max-w-none">{item.nome}</div>
      )
    },
    { 
      key: 'email', 
      header: 'E-mail',
      hideOnMobile: true,
      render: (item: UserDisplay) => (
        <div className="text-muted-foreground">{item.email}</div>
      )
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (item: UserDisplay) => {
        const roles = Array.isArray(item.roles) ? item.roles : [];
        return (
          <div className="flex flex-wrap gap-1">
            {roles.length === 0 ? (
              <span className="text-muted-foreground text-sm">Sem roles</span>
            ) : (
              roles.map((role) => (
                <Badge key={role} variant={getRoleBadgeVariant(role)}>
                  {role}
                </Badge>
              ))
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (item: UserDisplay) => (
        item.ativo !== false ? (
          <Badge variant="outline" className="text-success border-success/30">
            Ativo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-destructive border-destructive/30">
            Inativo
          </Badge>
        )
      ),
    },
    {
      key: 'vinculo',
      header: 'Colaborador',
      hideOnMobile: true,
      render: (item: UserDisplay) => (
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
      render: (item: UserDisplay) => (
        <span className="text-muted-foreground text-sm">
          {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item: UserDisplay) => (
        <div className="flex justify-end gap-1">
          {/* Desktop: Icon buttons with tooltips */}
          <div className="hidden sm:flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(`/gerenciar-usuarios/${item.id}/roles`)}>
                  <UserCog className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gerenciar Roles</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenPasswordDialog(item)}>
                  <KeyRound className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alterar Senha</TooltipContent>
            </Tooltip>
            
            {hasRole('RH') && item.id !== currentUser?.id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-8 w-8 ${item.ativo !== false ? 'text-destructive hover:text-destructive' : 'text-success hover:text-success'}`}
                    onClick={() => handleToggleUserStatus(item)}
                  >
                    {item.ativo !== false ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{item.ativo !== false ? 'Inativar Usuário' : 'Ativar Usuário'}</TooltipContent>
              </Tooltip>
            )}
            
            {!item.colaboradorId && (() => {
              const roles = Array.isArray(item.roles) ? item.roles : [];
              const isColaborador = roles.includes('COLABORADOR');
              return isColaborador ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenLinkDialog(item)}>
                      <Link className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vincular Colaborador</TooltipContent>
                </Tooltip>
              ) : null;
            })()}
            
            {item.colaboradorId && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/colaboradores/${item.colaboradorId}`)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver Colaborador</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleOpenUnlinkDialog(item)}>
                      <Unlink2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Desvincular</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          
          {/* Mobile: Dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => navigate(`/gerenciar-usuarios/${item.id}/roles`)}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Gerenciar Roles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenPasswordDialog(item)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Alterar Senha
                </DropdownMenuItem>
                {hasRole('RH') && item.id !== currentUser?.id && (
                  <DropdownMenuItem 
                    onClick={() => handleToggleUserStatus(item)}
                    className={item.ativo !== false ? 'text-destructive focus:text-destructive' : 'text-success focus:text-success'}
                  >
                    {item.ativo !== false ? (
                      <>
                        <Ban className="mr-2 h-4 w-4" />
                        Inativar Usuário
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Ativar Usuário
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {!item.colaboradorId && (() => {
                  const roles = Array.isArray(item.roles) ? item.roles : [];
                  const isColaborador = roles.includes('COLABORADOR');
                  return isColaborador ? (
                    <DropdownMenuItem onClick={() => handleOpenLinkDialog(item)}>
                      <Link className="mr-2 h-4 w-4" />
                      Vincular Colaborador
                    </DropdownMenuItem>
                  ) : null;
                })()}
                {item.colaboradorId && (
                  <>
                    <DropdownMenuItem onClick={() => navigate(`/colaboradores/${item.colaboradorId}`)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Ver Colaborador
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenUnlinkDialog(item)} className="text-destructive focus:text-destructive">
                      <Unlink2 className="mr-2 h-4 w-4" />
                      Desvincular
                    </DropdownMenuItem>
                  </>
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
              {users.filter((u) => Array.isArray(u.roles) && u.roles.includes('RH')).length}
            </div>
            <div className="text-sm text-muted-foreground">Usuários RH</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">
              {users.filter((u) => Array.isArray(u.roles) && u.roles.includes('FINANCEIRO')).length}
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
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
          
          <div className="py-4">
            {colaboradoresSemUsuario.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Todos os colaboradores já possuem usuário vinculado.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={selectedColaboradorId} onValueChange={setSelectedColaboradorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradoresSemUsuario.map((colab) => (
                      <SelectItem key={colab.id} value={colab.id}>
                        {colab.nome} - {colab.matricula}
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
            <Button onClick={handleLinkColaborador} disabled={linking || !selectedColaboradorId}>
              {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Colaborador Dialog */}
      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desvincular Colaborador</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desvincular o colaborador {selectedUser?.colaboradorNome} do usuário {selectedUser?.nome}?
              O colaborador perderá o acesso ao sistema.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkDialog(false)} disabled={unlinking}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleUnlinkColaborador} disabled={unlinking}>
              {unlinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desvincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsuariosLista;
