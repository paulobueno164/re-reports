import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import authService, { AppRole } from '@/services/auth.service';

interface UserProfile {
  id: string;
  nome: string;
  email: string;
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
  {
    value: 'ADMINISTRADOR',
    label: 'Administrador',
    description: 'Acesso total às configurações do sistema e auditoria',
    icon: ShieldCheck
  },
];

const UsuarioRoles = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentRoles, setCurrentRoles] = useState<AppRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    if (id) fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const userData = await authService.getUserById(id!);

      if (!userData) {
        toast({ title: 'Erro', description: 'Usuário não encontrado', variant: 'destructive' });
        navigate('/gerenciar-usuarios');
        return;
      }

      // Garantir que roles seja sempre um array
      const roles = Array.isArray(userData.roles) ? userData.roles : [];

      setUser({
        id: userData.id,
        nome: userData.nome,
        email: userData.email,
      });
      setCurrentRoles(roles);
      setSelectedRoles([...roles]);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      navigate('/gerenciar-usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: AppRole) => {
    // Permite múltiplas roles
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (!user) return;

    // Validar que pelo menos uma role foi selecionada
    if (selectedRoles.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos uma role para o usuário.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      // Sincronizar roles: remover as que foram desmarcadas e adicionar as novas
      const rolesToRemove = currentRoles.filter(r => !selectedRoles.includes(r));
      const rolesToAdd = selectedRoles.filter(r => !currentRoles.includes(r));

      // Remover roles desmarcadas
      for (const role of rolesToRemove) {
        await authService.removeUserRole(user.id, role);
      }

      // Adicionar novas roles
      for (const role of rolesToAdd) {
        await authService.addUserRole(user.id, role);
      }

      toast({
        title: 'Roles atualizadas',
        description: `As permissões de ${user.nome} foram atualizadas com sucesso.`,
      });

      navigate('/gerenciar-usuarios');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <PageFormLayout
      title="Gerenciar Roles"
      description={`Defina as permissões para ${user.nome}`}
      backTo="/gerenciar-usuarios"
      backLabel="Voltar"
      onSave={handleSave}
      onCancel={() => navigate('/gerenciar-usuarios')}
      saving={saving}
    >
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Usuário</p>
          <p className="font-medium">{user.nome}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-2">
            Selecione uma ou mais roles para o usuário. As permissões são cumulativas.
          </p>
          {AVAILABLE_ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRoles.includes(role.value);

            return (
              <div
                key={role.value}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                onClick={() => handleRoleToggle(role.value)}
              >
                <div className="mt-0.5">
                  <Checkbox
                    id={role.value}
                    checked={isSelected}
                    onCheckedChange={() => handleRoleToggle(role.value)}
                  />
                </div>
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
      </div>
    </PageFormLayout>
  );
};

export default UsuarioRoles;
