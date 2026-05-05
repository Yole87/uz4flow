import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Download, Apple, Chrome, Share, Monitor, CheckCircle2 } from "lucide-react";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <AppLayout title="Instalar App" description="Instale o OpenFlow no seu dispositivo">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in flex-1 flex flex-col justify-start">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img src="/pwa-icon-192.png" alt="OpenFlow" className="h-16 w-16 rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Instale o OpenFlow</h1>
          <p className="text-muted-foreground">
            Acesse todas as funcionalidades direto da tela inicial do seu celular ou computador
          </p>
        </div>

        {isInstalled ? (
          <Card className="quantum-glass border-success/30">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">App já está instalado!</p>
              </div>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card className="quantum-glass neon-glow-pink">
            <CardContent className="py-6 text-center">
              <Button onClick={handleInstall} className="gradient-primary hover:opacity-90 gap-2">
                <Download className="h-5 w-5" />
                Instalar agora
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Windows / Desktop */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              Windows / Desktop (Chrome / Edge)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Abra o OpenFlow no <strong className="text-foreground">Chrome</strong> ou <strong className="text-foreground">Edge</strong></li>
              <li>Clique no ícone de <strong className="text-foreground">instalar</strong> (⊕) na barra de endereço</li>
              <li>Ou acesse o menu <strong className="text-foreground">⋮ → "Instalar OpenFlow"</strong></li>
              <li>Confirme clicando em <strong className="text-foreground">"Instalar"</strong></li>
            </ol>
            <p className="text-xs text-muted-foreground/70 mt-2">
              O app ficará disponível no Menu Iniciar e na Barra de Tarefas como um aplicativo nativo.
            </p>
          </CardContent>
        </Card>

        {/* Android */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Chrome className="h-4 w-4 text-primary" />
              Android (Chrome)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Abra o OpenFlow no Chrome</li>
              <li>Toque no menu <strong className="text-foreground">⋮</strong> (3 pontos)</li>
              <li>Selecione <strong className="text-foreground">"Adicionar à tela inicial"</strong></li>
              <li>Confirme tocando em <strong className="text-foreground">"Adicionar"</strong></li>
            </ol>
          </CardContent>
        </Card>

        {/* iOS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Apple className="h-4 w-4 text-foreground" />
              iPhone / iPad (Safari)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Abra o OpenFlow no <strong className="text-foreground">Safari</strong></li>
              <li>Toque no botão <Share className="h-3.5 w-3.5 inline" /> (compartilhar)</li>
              <li>Role para baixo e selecione <strong className="text-foreground">"Adicionar à Tela de Início"</strong></li>
              <li>Toque em <strong className="text-foreground">"Adicionar"</strong></li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
