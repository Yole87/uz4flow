import { useState } from "react";
import { useInstagramConfig } from "@/hooks/useInstagramConfig";
import { ServiceConfigSection } from "@/components/settings/ServiceConfigSection";
import { type TutorialStep } from "@/components/settings/ServiceTutorialSteps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Instagram,
  Key,
  Check,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  Link,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const instagramTutorialSteps: TutorialStep[] = [
  {
    title: "Crie um App na Meta for Developers",
    description:
      'Acesse developers.facebook.com, clique em "Meus Apps" → "Criar App". Selecione o tipo "Business". Dê um nome ao app e clique em criar.',
  },
  {
    title: 'Adicione o produto "Instagram Login for Business"',
    description:
      'No painel do app, vá em "Adicionar Produtos" e localize "Instagram Login for Business". Clique em "Configurar" para adicioná-lo ao seu app.',
  },
  {
    title: "Copie o Instagram App ID e App Secret",
    description:
      'Dentro de "Configurações do login da empresa" do produto Instagram Login, copie o "Instagram App ID" (diferente do ID principal do app). O App Secret está em "Configurações" → "Básico" no painel do app.',
  },
  {
    title: "Cole as credenciais no sistema",
    description:
      'Cole o "Instagram App ID" e o "App Secret" nos campos acima e clique em "Salvar Credenciais".',
  },
  {
    title: "Configure as URLs na Meta",
    description:
      'Copie as URLs exibidas na seção "URLs para Configurações do Login da Empresa" e cole nos campos correspondentes no painel da Meta: URI de redirecionamento, URL de desautorização e URL de exclusão de dados.',
  },
  {
    title: "Configure o Webhook",
    description:
      'No painel do app Meta, vá em "Webhooks" → "Instagram". Cole a "URL do Webhook" e o "Token de Verificação" exibidos acima. Inscreva-se nos campos: messages, messaging_postbacks e feed.',
  },
  {
    title: "Copie a URL de Login Incorporado",
    description:
      'No painel da Meta, em "Configurações do login da empresa", copie a URL de "Incorporação" e cole no campo "URL de Login Incorporado" no sistema. Essa URL será usada para conectar contas.',
  },
  {
    title: "Envie para App Review",
    description:
      'Para usar em produção, envie o app para revisão da Meta. Solicite as permissões: instagram_business_basic, instagram_business_manage_messages e instagram_business_manage_comments.',
  },
];

export function InstagramConfigTab() {
  const {
    isConfigured,
    appId,
    appSecretMasked,
    webhookVerifyToken,
    redirectUri,
    webhookUrl,
    embeddedLoginUrl,
    deauthorizationCallbackUrl,
    dataDeletionUrl,
    isLoading,
    isError,
    saveConfig,
    isSaving,
    testConfig,
    isTesting,
    removeConfig,
    isRemoving,
    refetch,
  } = useInstagramConfig();

  const { toast } = useToast();
  const [appIdInput, setAppIdInput] = useState("");
  const [appSecretInput, setAppSecretInput] = useState("");
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [embeddedUrlInput, setEmbeddedUrlInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showAppId, setShowAppId] = useState(true);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [showEmbeddedUrl, setShowEmbeddedUrl] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiada para a área de transferência.` });
  };

  const isEditMode = showEditForm && isConfigured;
  const hasAppIdValid = appIdInput.trim().length >= 5;
  const hasSecretValid = appSecretInput.trim().length >= 10;
  // In edit mode, secret is optional (keeps existing); in new mode, it's required
  const canSave = hasAppIdValid && (isEditMode ? true : hasSecretValid);

  const hasChanges = isEditMode
    ? (appIdInput.trim() !== (appId || "") ||
       appSecretInput.trim().length > 0 ||
       verifyTokenInput.trim() !== (webhookVerifyToken || "") ||
       embeddedUrlInput.trim() !== (embeddedLoginUrl || ""))
    : true;

  const handleSave = () => {
    if (!canSave || !hasChanges) return;
    saveConfig({
      appId: appIdInput.trim(),
      appSecret: appSecretInput.trim() || "__keep__",
      webhookVerifyToken: verifyTokenInput.trim() || undefined,
      embeddedLoginUrl: embeddedUrlInput.trim() || undefined,
    });
    setAppSecretInput("");
    setShowEditForm(false);
  };

  const handleRemove = () => {
    if (confirm("Tem certeza? Remover as credenciais desconectará todas as contas Instagram vinculadas.")) {
      removeConfig();
    }
  };

  if (isError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-destructive font-medium">Erro ao carregar configurações</p>
          <Button onClick={() => refetch()} variant="outline" className="border-destructive/30 text-destructive">
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ServiceConfigSection
      title="Instagram"
      icon={Instagram}
      tutorialVideoId="uJGrlIMufYU"
      tutorialVideoTitle="Como configurar a integração com o Instagram"
      tutorialSteps={instagramTutorialSteps}
    >
      {/* Credenciais Card */}
      <Card className={`border-border ${!isConfigured ? "border-warning/50" : ""}`}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Key className="h-5 w-5 text-accent" />
                Credenciais do App Meta
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                App ID e App Secret do seu aplicativo na Meta for Developers
              </CardDescription>
            </div>
            {isConfigured ? (
              <Badge className="bg-success/20 text-success border-success/30 self-start sm:self-auto">
                <Check className="h-3 w-3 mr-1" /> Configurado
              </Badge>
            ) : (
              <Badge className="bg-warning/20 text-warning border-warning/30 self-start sm:self-auto">
                <AlertTriangle className="h-3 w-3 mr-1" /> Pendente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured || showEditForm ? (
            <>
              {!isConfigured && (
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Configuração necessária</p>
                      <p className="text-xs opacity-80 mt-1">
                        Configure as credenciais do seu App Meta para usar as automações do Instagram.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Instagram App ID</Label>
                  <div className="relative">
                    <Input
                      type={showAppId ? "text" : "password"}
                      placeholder="Ex: 1234567890123456"
                      value={appIdInput}
                      onChange={(e) => setAppIdInput(e.target.value)}
                      className="bg-muted border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAppId(!showAppId)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showAppId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">App Secret</Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder={showEditForm && isConfigured ? "Digite o novo App Secret (obrigatório)" : "Cole o App Secret aqui"}
                      value={appSecretInput}
                      onChange={(e) => setAppSecretInput(e.target.value)}
                      className="bg-muted border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {showEditForm && isConfigured && (
                    <p className="text-xs text-muted-foreground/70">
                      O App Secret atual está criptografado ({appSecretMasked}). Insira o valor completo para salvar.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    Webhook Verify Token <span className="text-xs opacity-60">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showVerifyToken ? "text" : "password"}
                      placeholder="Token personalizado para verificação do webhook"
                      value={verifyTokenInput}
                      onChange={(e) => setVerifyTokenInput(e.target.value)}
                      className="bg-muted border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowVerifyToken(!showVerifyToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showVerifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

              <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    URL de Login Incorporado <span className="text-xs opacity-60">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showEmbeddedUrl ? "text" : "password"}
                      placeholder="https://www.instagram.com/oauth/authorize?..."
                      value={embeddedUrlInput}
                      onChange={(e) => setEmbeddedUrlInput(e.target.value)}
                      className="bg-muted border-border text-foreground pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmbeddedUrl(!showEmbeddedUrl)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showEmbeddedUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    Cole a URL de incorporação do "Configurações do login da empresa" na Meta. Essa URL será usada no botão "Conectar Instagram".
                  </p>
                </div>

                {/* Validation alerts */}
                <div className="space-y-2">
                  <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg text-xs text-muted-foreground space-y-1.5">
                    <p className="font-medium text-foreground/80 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                      Dicas importantes para evitar erros de conexão
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-1">
                      <li>O <strong>App ID</strong> e o <strong>App Secret</strong> devem pertencer ao <strong>mesmo aplicativo</strong> na Meta.</li>
                      <li>A <strong>URI de redirecionamento</strong> cadastrada na Meta precisa ser <strong>idêntica</strong> à exibida abaixo na seção "URLs para Configurações".</li>
                      <li>Se usar a <strong>URL de Login Incorporado</strong>, ela deve vir do <strong>mesmo app</strong> configurado acima.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !canSave || !hasChanges}
                    className="gradient-primary hover:opacity-90 text-primary-foreground"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar Credenciais
                  </Button>
                  {showEditForm && (
                    <Button variant="outline" onClick={() => setShowEditForm(false)} className="border-border">
                      Cancelar
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <a
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-accent hover:text-accent/80"
                  >
                    Acessar Meta for Developers
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                      <Key className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">App ID: {appId}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        Secret: {appSecretMasked || "••••••••"}
                      </p>
                      {embeddedLoginUrl && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Login URL: configurado ✓
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConfig()}
                      disabled={isTesting}
                      className="border-border text-foreground hover:bg-muted gap-1.5"
                    >
                      {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Testar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAppIdInput(appId || "");
                        setAppSecretInput(""); // Secret can't be pre-filled (encrypted)
                        setVerifyTokenInput(webhookVerifyToken || "");
                        setEmbeddedUrlInput(embeddedLoginUrl || "");
                        setShowEditForm(true);
                      }}
                      className="border-border text-foreground hover:bg-muted"
                    >
                      Alterar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemove}
                      disabled={isRemoving}
                      className="border-border text-foreground hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive"
                    >
                      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* URLs para Configurações do Login da Empresa */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-secondary" />
            URLs para Configurações do Login da Empresa
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Cole essas URLs nos campos correspondentes em "Configurações do login da empresa" no painel da Meta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning mb-2">
            <p className="font-medium">⚠️ A URI abaixo precisa estar cadastrada <strong>exatamente igual</strong> no painel do seu app na Meta (Configurações do login da empresa → URIs de redirecionamento do OAuth).</p>
          </div>

          {/* URI de redirecionamento do OAuth */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold">URIs de redirecionamento do OAuth (obrigatória)</Label>
            <div className="flex items-center gap-2">
              <Input value={redirectUri} readOnly className="bg-muted border-border text-foreground font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(redirectUri, "URI de redirecionamento")}
                className="border-border shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* URL de retorno de chamada de desautorização */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">URL de retorno de chamada de desautorização</Label>
            <div className="flex items-center gap-2">
              <Input value={deauthorizationCallbackUrl} readOnly className="bg-muted border-border text-foreground font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(deauthorizationCallbackUrl, "URL de desautorização")}
                className="border-border shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* URL de solicitação de exclusão de dados */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">URL de solicitação de exclusão de dados</Label>
            <div className="flex items-center gap-2">
              <Input value={dataDeletionUrl} readOnly className="bg-muted border-border text-foreground font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(dataDeletionUrl, "URL de exclusão de dados")}
                className="border-border shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* URLs de Integração (Webhook) */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Link className="h-5 w-5 text-secondary" />
            URLs do Webhook
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Use essas URLs ao configurar os Webhooks do seu app na Meta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">URL do Webhook</Label>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="bg-muted border-border text-foreground font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(webhookUrl, "URL do Webhook")}
                className="border-border shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Webhook Verify Token */}
          {webhookVerifyToken && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Token de Verificação do Webhook</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={webhookVerifyToken}
                  readOnly
                  className="bg-muted border-border text-foreground font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(webhookVerifyToken, "Token de Verificação")}
                  className="border-border shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ServiceConfigSection>
  );
}
