import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Loader2, UserCog, MoreVertical, Users, Info, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
}

const UsuariosLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gerenciar Usuários"
        description="Visualize e gerencie as permissões dos usuários do sistema"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Para criar novos usuários ou alterar e-mail/senha, acesse o cadastro do colaborador em{' '}
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/colaboradores')}>
            Colaboradores
          </Button>
          . Aqui você pode gerenciar apenas as <strong>roles</strong> (permissões) dos usuários existentes.
        </AlertDescription>
      </Alert>

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
  );
};

export default UsuariosLista;
