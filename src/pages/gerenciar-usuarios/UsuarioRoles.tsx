import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'FINANCEIRO' | 'COLABORADOR' | 'RH';

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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('id', id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        toast({ title: 'Erro', description: 'Usuário não encontrado', variant: 'destructive' });
        navigate('/gerenciar-usuarios');
        return;
      }

      setUser(profile);

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', id);

      if (rolesError) throw rolesError;

      const userRoles = (roles || []).map((r) => r.role as AppRole);
      setCurrentRoles(userRoles);
      setSelectedRoles([...userRoles]);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const rolesToAdd = selectedRoles.filter((role) => !currentRoles.includes(role));
      const rolesToRemove = currentRoles.filter((role) => !selectedRoles.includes(role));

      if (rolesToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map((role) => ({ user_id: user.id, role })));

        if (insertError) throw insertError;
      }

      if (rolesToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.id)
          .in('role', rolesToRemove);

        if (deleteError) throw deleteError;
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
      </div>
    </PageFormLayout>
  );
};

export default UsuarioRoles;
