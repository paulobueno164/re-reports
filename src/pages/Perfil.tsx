import { useState } from 'react';
import { User, Mail, Lock, Loader2, Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Senha atual deve ter no mínimo 6 caracteres'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

const Perfil = () => {
  const { toast } = useToast();
  const { user, roles } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const validation = passwordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      setPasswordError(validation.error.errors[0].message);
      return;
    }

    setChangingPassword(true);

    try {
      // First verify the current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Senha atual incorreta');
        setChangingPassword(false);
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi atualizada com sucesso.',
      });
    } catch (error: any) {
      setPasswordError(error.message || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Meu Perfil"
        description="Visualize suas informações e gerencie sua conta"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Perfil
            </CardTitle>
            <CardDescription>
              Seus dados cadastrados no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Nome</Label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user?.user_metadata?.nome || 'Não informado'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">E-mail</Label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user?.email}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Permissões</Label>
              <div className="flex flex-wrap gap-2">
                {roles.length === 0 ? (
                  <span className="text-muted-foreground text-sm">Sem permissões atribuídas</span>
                ) : (
                  roles.map((role) => (
                    <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-sm">
                      {role}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
            <CardDescription>
              Atualize sua senha de acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              {passwordSuccess && (
                <Alert className="border-success/50 bg-success/10">
                  <Check className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    Senha alterada com sucesso!
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha Atual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={changingPassword}>
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar Senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Perfil;
