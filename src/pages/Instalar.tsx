import { useState, useEffect } from 'react';
import { Download, Smartphone, Check, Share, MoreVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Instalar = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(checkStandalone);
    
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-xl">App Instalado!</CardTitle>
            <CardDescription>
              O RE-Reports já está instalado no seu dispositivo. Você pode acessá-lo diretamente da tela inicial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Ir para o Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Instalar RE-Reports</CardTitle>
          <CardDescription>
            Adicione o app à tela inicial do seu dispositivo para acesso rápido e experiência otimizada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-success" />
              </div>
              <span>Acesso rápido pela tela inicial</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-success" />
              </div>
              <span>Funciona offline com dados em cache</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-success" />
              </div>
              <span>Tela cheia sem barra de navegação</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-success" />
              </div>
              <span>Carregamento mais rápido</span>
            </div>
          </div>

          {/* Install Instructions */}
          {deferredPrompt ? (
            <Button className="w-full" size="lg" onClick={handleInstallClick}>
              <Download className="mr-2 h-5 w-5" />
              Instalar Agora
            </Button>
          ) : isIOS ? (
            <div className="space-y-4">
              <Badge variant="secondary" className="w-full justify-center py-2">
                Instruções para iPhone/iPad
              </Badge>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <div className="flex items-center gap-2">
                    <span>Toque no botão</span>
                    <Share className="h-4 w-4" />
                    <span>(Compartilhar)</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <div className="flex items-center gap-2">
                    <span>Role e toque em</span>
                    <Plus className="h-4 w-4" />
                    <span>"Adicionar à Tela de Início"</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>Toque em "Adicionar" para confirmar</span>
                </div>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <Badge variant="secondary" className="w-full justify-center py-2">
                Instruções para Android
              </Badge>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <div className="flex items-center gap-2">
                    <span>Toque no menu</span>
                    <MoreVertical className="h-4 w-4" />
                    <span>do navegador</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Selecione "Instalar aplicativo" ou "Adicionar à tela inicial"</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>Confirme a instalação</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <p>Abra esta página no seu celular para instalar o app.</p>
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={() => window.location.href = '/'}>
            <X className="mr-2 h-4 w-4" />
            Continuar no Navegador
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Instalar;
