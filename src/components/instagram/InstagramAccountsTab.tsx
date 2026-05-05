import { useState } from "react";
import { useInstagramAccounts } from "@/hooks/useInstagramAccounts";
import { useInstagramConfig } from "@/hooks/useInstagramConfig";
import { InstagramAccountCard } from "./InstagramAccountCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Instagram, Plus, AlertTriangle, Settings } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";

export function InstagramAccountsTab() {
  const { accounts, isLoading, startOAuth, refreshToken, disconnectAccount } = useInstagramAccounts();
  const { isConfigured, isLoading: isConfigLoading } = useInstagramConfig();
  const [showOAuthWarning, setShowOAuthWarning] = useState(false);
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [, setSearchParams] = useSearchParams();

  const handleConnectClick = () => {
    if (!isConfigured) {
      setShowConfigWarning(true);
      return;
    }
    if (accounts.length > 0) {
      setShowOAuthWarning(true);
    } else {
      startOAuth();
    }
  };

  const confirmConnect = () => {
    setShowOAuthWarning(false);
    startOAuth();
  };

  const goToConfig = () => {
    setShowConfigWarning(false);
    setSearchParams({ tab: "config" }, { replace: true });
    // Also trigger tab change via DOM since parent manages state
    const configTab = document.querySelector('[data-value="config"]') as HTMLButtonElement;
    if (configTab) configTab.click();
  };

  if (isLoading || isConfigLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Conecte contas do Instagram para usar nas automações.
        </p>
        <Button onClick={handleConnectClick} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Conectar Instagram
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Instagram}
          title="Nenhuma conta Instagram conectada"
          description="Conecte uma conta para receber DMs e criar automações de respostas para comentários e mensagens diretas."
          action={{
            label: "Conectar Instagram",
            onClick: handleConnectClick,
            icon: Plus,
          }}
        />
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <InstagramAccountCard
              key={account.id}
              account={account}
              onRefresh={(id) => refreshToken.mutate(id)}
              onDisconnect={(id) => disconnectAccount.mutate(id)}
              isRefreshing={refreshToken.isPending}
              isDisconnecting={disconnectAccount.isPending}
            />
          ))}
        </div>
      )}

      {/* Modal: Credenciais não configuradas */}
      <Dialog open={showConfigWarning} onOpenChange={setShowConfigWarning}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Configuração necessária
            </DialogTitle>
            <DialogDescription className="text-muted-foreground space-y-2">
              <p>
                Para conectar uma conta do Instagram, você precisa primeiro configurar as credenciais do seu App Meta (App ID e App Secret).
              </p>
              <p className="text-xs text-muted-foreground/70">
                Acesse a aba <strong>Configurações</strong> nesta mesma página e preencha as credenciais antes de tentar conectar uma conta.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigWarning(false)} className="border-border text-muted-foreground">
              Fechar
            </Button>
            <Button onClick={goToConfig} className="gradient-primary text-white hover:opacity-90 gap-1.5">
              <Settings className="h-4 w-4" />
              Ir para Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Aviso de troca de conta */}
      <Dialog open={showOAuthWarning} onOpenChange={setShowOAuthWarning}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Conectar outra conta
            </DialogTitle>
            <DialogDescription className="text-muted-foreground space-y-2">
              <p>Para conectar uma <strong>conta diferente</strong> do Instagram, você precisa:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Sair da conta atual do Instagram no navegador</li>
                <li>Fazer login com a conta que deseja conectar</li>
                <li>Ou abrir uma <strong>janela anônima</strong> e fazer login lá</li>
              </ol>
              <p className="text-xs text-muted-foreground/70 mt-2">
                Além disso, se o app ainda estiver em modo de desenvolvimento ou com acesso padrão, essa conta também precisa estar liberada no app da Meta. Para conectar contas de terceiros sem cadastro prévio, o app precisa estar publicado e com acesso avançado aprovado.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOAuthWarning(false)} className="border-border text-muted-foreground">
              Cancelar
            </Button>
            <Button onClick={confirmConnect} className="gradient-primary text-white hover:opacity-90">
              Entendi, continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
