import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import onsetLogo from '@/assets/onset-logo.png';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const Auth = () => {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'forgot-password'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Forgot password form state
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Redirect if already logged in
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const validation = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });
    
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      if (error.message.includes('Invalid login credentials') || error.message.includes('Credenciais')) {
        setError('E-mail ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu e-mail antes de fazer login');
      } else {
        setError(error.message);
      }
    } else {
      navigate('/');
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    
    if (!recoveryEmail || !z.string().email().safeParse(recoveryEmail).success) {
      setError('Por favor, informe um e-mail válido');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await authService.requestPasswordReset(recoveryEmail);
      setSuccessMessage('Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');
    } catch (error: any) {
      // Não mostramos erro específico por segurança
      setSuccessMessage('Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');
    }
    
    setIsLoading(false);
  };

  const switchToLogin = () => {
    setView('login');
    setError(null);
    setSuccessMessage(null);
    setRecoveryEmail('');
  };

  const switchToForgotPassword = () => {
    setView('forgot-password');
    setError(null);
    setSuccessMessage(null);
    setRecoveryEmail(loginEmail);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo Onset */}
        <div className="text-center mb-6">
          <img 
            src={onsetLogo} 
            alt="Onset" 
            className="h-12 mx-auto mb-4"
          />
        </div>

        {/* Logo RE-Reports */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">RE-Reports</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            {view === 'login' ? (
              <>
                <CardTitle>Bem-vindo</CardTitle>
                <CardDescription>
                  Faça login para acessar o sistema
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle>Recuperar Senha</CardTitle>
                <CardDescription>
                  Informe seu e-mail para receber as instruções de recuperação
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={switchToForgotPassword}
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                {successMessage && (
                  <Alert className="border-green-500 bg-green-50 text-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">E-mail</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Instruções
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={switchToLogin}
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Voltar ao login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-4">
          Sistema interno de gestão de benefícios
        </p>
      </div>
    </div>
  );
};

export default Auth;
