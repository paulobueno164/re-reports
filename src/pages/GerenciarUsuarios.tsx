import { useState, useEffect } from 'react';
import { Search, Shield, ShieldCheck, ShieldAlert, Loader2, UserCog } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
}

const AVAILABLE_ROLES: { value: AppRole; label: string; description: string; icon: typeof Shield }[] = [
  { 
    value: 'COLABORADOR', 
    label: 'Colaborador', 
    description: 'Pode submeter despesas e ver próprios dados',
    icon: Shield 
  },
  { 
    value: 'RH', 
    label: 'RH', 
    description: 'Pode validar despesas, gerenciar colaboradores e processar fechamentos',
    icon: ShieldCheck 
  },
  { 
    value: 'FINANCEIRO', 
    label: 'Financeiro', 
    description: 'Pode exportar dados e gerar relatórios de pagamento',
    icon: ShieldAlert 
  },
];

const GerenciarUsuarios = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, nome, created_at')
        .order('nome');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Map profiles with their roles
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        nome: profile.nome,
        createdAt: profile.created_at,
        roles: (roles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole),
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

  const handleEditRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles([...user.roles]);
    setIsDialogOpen(true);
  };

  const handleRoleToggle = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      // Remove existing roles
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id);

      if (deleteError) throw deleteError;

      // Add new roles
      if (selectedRoles.length > 0) {
        const rolesToInsert = selectedRoles.map((role) => ({
          user_id: selectedUser.id,
          role,
        }));

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(rolesToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Roles atualizadas',
        description: `As permissões de ${selectedUser.nome} foram atualizadas com sucesso.`,
      });

      setIsDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
        <div className="font-medium">{item.nome}</div>
      )
    },
    { 
      key: 'email', 
      header: 'E-mail',
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
      header: 'Ações',
      className: 'text-right',
      render: (item: UserWithRoles) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => handleEditRoles(item)}>
            <UserCog className="h-4 w-4 mr-2" />
            Gerenciar Roles
          </Button>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            {users.filter((u) => u.roles.includes('COLABORADOR')).length}
          </div>
          <div className="text-sm text-muted-foreground">Colaboradores</div>
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

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Roles</DialogTitle>
            <DialogDescription>
              Defina as permissões para {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {AVAILABLE_ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRoles.includes(role.value);
              
              return (
                <div
                  key={role.value}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleRoleToggle(role.value)}
                >
                  <Checkbox
                    id={role.value}
                    checked={isSelected}
                    onCheckedChange={() => handleRoleToggle(role.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <Label htmlFor={role.value} className="cursor-pointer font-medium">
                        {role.label}
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {role.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GerenciarUsuarios;
