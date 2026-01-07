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
    // Usuário só pode ter uma role, então selecionar apenas a role clicada
    setSelectedRoles([role]);
  };

  const handleSave = async () => {
    if (!user) return;

    // Validar que exatamente uma role foi selecionada
    if (selectedRoles.length === 0) {
      toast({ 
        title: 'Erro', 
        description: 'Selecione pelo menos uma role para o usuário.', 
        variant: 'destructive' 
      });
      return;
    }

    if (selectedRoles.length > 1) {
      toast({ 
        title: 'Erro', 
        description: 'Um usuário só pode ter uma role. Selecione apenas uma.', 
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);
    try {
      const newRole = selectedRoles[0];
      const currentRole = currentRoles[0];

      // Se a role mudou, atualizar (addUserRole já remove todas as outras)
      if (newRole !== currentRole) {
        await authService.addUserRole(user.id, newRole);
      }

      toast({
        title: 'Role atualizada',
        description: `A permissão de ${user.nome} foi atualizada com sucesso.`,
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
            Selecione uma role para o usuário. Cada usuário pode ter apenas uma role.
          </p>
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
                <div className="mt-0.5">
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-primary bg-primary' : 'border-border'
                  }`}>
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
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
