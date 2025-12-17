import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ColaboradorSemUsuario {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  departamento: string;
}

const UsuarioForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form data
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Colaborador linking
  const [colaboradoresSemUsuario, setColaboradoresSemUsuario] = useState<ColaboradorSemUsuario[]>([]);
  const [searchColaborador, setSearchColaborador] = useState('');
  const [selectedColaborador, setSelectedColaborador] = useState<ColaboradorSemUsuario | null>(null);
  const [loadingColaboradores, setLoadingColaboradores] = useState(false);

  useEffect(() => {
    fetchColaboradoresSemUsuario();
  }, []);

  const fetchColaboradoresSemUsuario = async () => {
    setLoadingColaboradores(true);
    try {
      const { data, error } = await supabase
        .from('colaboradores_elegiveis')
        .select('id, nome, matricula, email, departamento')
        .is('user_id', null)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setColaboradoresSemUsuario(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar colaboradores:', error);
    } finally {
      setLoadingColaboradores(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!nome.trim() || !email.trim() || !password) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }
    if (!email.includes('@')) {
      toast({ title: 'Erro', description: 'Informe um e-mail válido.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // 1. Create user via edge function
      const { data: userData, error: userError } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'create',
          email: email.toLowerCase().trim(),
          password: password,
          nome: nome.trim(),
        },
      });

      if (userError) throw userError;
      if (userData?.error) throw new Error(userData.error);

      const userId = userData.userId;

      // 2. If collaborator selected, link them
      if (selectedColaborador) {
        const { error: linkError } = await supabase
          .from('colaboradores_elegiveis')
          .update({ user_id: userId })
          .eq('id', selectedColaborador.id);

        if (linkError) throw linkError;
      }

      toast({ 
        title: 'Sucesso', 
        description: selectedColaborador 
          ? 'Usuário criado e vinculado ao colaborador com sucesso.' 
          : 'Usuário criado com sucesso.'
      });
      navigate('/gerenciar-usuarios');
    } catch (error: any) {
      toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredColaboradores = colaboradoresSemUsuario.filter(c => {
    const search = searchColaborador.toLowerCase();
    return c.nome.toLowerCase().includes(search) || 
           c.matricula.toLowerCase().includes(search) ||
           c.email.toLowerCase().includes(search);
  });

  const handleSelectColaborador = (colaborador: ColaboradorSemUsuario) => {
    setSelectedColaborador(colaborador);
    // Auto-fill name and email from collaborator
    setNome(colaborador.nome);
    setEmail(colaborador.email);
    setSearchColaborador('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <BackButton to="/gerenciar-usuarios" label="Voltar para Usuários" />
      
      <PageHeader
        title="Novo Usuário"
        description="Crie um novo usuário de acesso ao sistema"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Link to Colaborador */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vincular a Colaborador (Opcional)</CardTitle>
            <CardDescription>
              Selecione um colaborador existente sem usuário vinculado para associar a este novo usuário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedColaborador ? (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{selectedColaborador.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedColaborador.matricula} • {selectedColaborador.departamento}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedColaborador(null);
                    setNome('');
                    setEmail('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar colaborador por nome, matrícula ou e-mail..."
                    value={searchColaborador}
                    onChange={(e) => setSearchColaborador(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {loadingColaboradores ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : colaboradoresSemUsuario.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Todos os colaboradores já possuem usuário vinculado.
                    </AlertDescription>
                  </Alert>
                ) : searchColaborador && filteredColaboradores.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhum colaborador encontrado.
                  </p>
                ) : searchColaborador ? (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {filteredColaboradores.slice(0, 5).map((colaborador) => (
                      <button
                        key={colaborador.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-muted transition-colors"
                        onClick={() => handleSelectColaborador(colaborador)}
                      >
                        <p className="font-medium">{colaborador.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {colaborador.matricula} • {colaborador.departamento} • {colaborador.email}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {colaboradoresSemUsuario.length} colaborador(es) disponível(is) para vinculação.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Usuário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do usuário"
                  disabled={!!selectedColaborador}
                />
              </div>
              
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com.br"
                  disabled={!!selectedColaborador}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Senha de Acesso *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/gerenciar-usuarios')}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Usuário
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UsuarioForm;
