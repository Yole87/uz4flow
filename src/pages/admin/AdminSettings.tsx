import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  Globe, 
  CreditCard, 
  Palette, 
  Copy, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Loader2,
  ExternalLink,
  Zap,
  Bot,
  Image,
  Eye,
  EyeOff
} from "lucide-react";
import { BrandingTab } from "@/components/admin/BrandingTab";
import { PaymentWebhookLogs } from "@/components/admin/PaymentWebhookLogs";
import { useToast } from "@/hooks/use-toast";

interface GeneralSettings {
  app_name: string;
  support_email: string;
  terms_url: string;
  privacy_url: string;
  webhook_base_url?: string;
  new_member_tutorials_enabled?: boolean;
}

interface LandingSettings {
  hero: {
    title: string;
    subtitle: string;
    cta_text: string;
    cta_secondary_text: string;
  };
}

interface MpSettings {
  public_key: string;
  access_token_configured: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  is_free: boolean | null;
  mp_plan_id: string | null;
  is_active: boolean | null;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accessToken, setAccessToken] = useState("");
  const [savingAccessToken, setSavingAccessToken] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [liaPrompt, setLiaPrompt] = useState("");
  const [savingLia, setSavingLia] = useState(false);
  const [brandingSettings, setBrandingSettings] = useState<Record<string, any>>({});
  const { toast } = useToast();

  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    app_name: "",
    support_email: "",
    terms_url: "",
    privacy_url: "",
    webhook_base_url: "",
    new_member_tutorials_enabled: true,
  });

  const [landingSettings, setLandingSettings] = useState<LandingSettings>({
    hero: {
      title: "",
      subtitle: "",
      cta_text: "",
      cta_secondary_text: "",
    },
  });

  const [mpSettings, setMpSettings] = useState<MpSettings>({
    public_key: "",
    access_token_configured: false,
  });

  // Generate webhook URL using centralized helper
  const getWebhookUrl = () => {
    const baseUrl = generalSettings.webhook_base_url?.trim() 
      ? generalSettings.webhook_base_url.replace(/\/$/, '')
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    return `${baseUrl}/mercadopago-webhook`;
  };
  
  const webhookUrl = getWebhookUrl();

  const fetchAccessToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "get-access-token" },
      });
      if (!error && data?.success) {
        const realToken = (data.token || "").toString();
        setAccessToken(realToken);
        // Reconcile UI flag with reality
        setMpSettings((prev) => ({ ...prev, access_token_configured: realToken.length > 0 }));
      }
    } catch (e) {
      console.warn("Could not load access token:", e);
    }
  };

  useEffect(() => {
    fetchSettings().then(() => fetchAccessToken());
    fetchPlans();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("saas_settings")
        .select("key, value");

      if (error) throw error;

      data?.forEach((setting) => {
        if (setting.key === "general") {
          setGeneralSettings(setting.value as unknown as GeneralSettings);
        } else if (setting.key === "landing_page") {
          setLandingSettings(setting.value as unknown as LandingSettings);
        } else if (setting.key === "mercadopago") {
          setMpSettings(setting.value as unknown as MpSettings);
        } else if (setting.key === "branding") {
          setBrandingSettings(setting.value as unknown as Record<string, any>);
        } else if (setting.key === "lia_system_prompt") {
          const val = setting.value;
          if (typeof val === "string") setLiaPrompt(val);
          else if (typeof val === "object" && val !== null && (val as any).prompt) setLiaPrompt((val as any).prompt);
        }
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("subscription_plans")
      .select("id, name, price, is_free, mp_plan_id, is_active")
      .eq("is_active", true)
      .order("sort_order");
    
    if (data) setPlans(data);
  };

  const saveSettings = async (key: string, value: unknown) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("saas_settings")
        .upsert(
          { key, value: JSON.parse(JSON.stringify(value)) },
          { onConflict: "key" }
        );

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As alterações foram aplicadas com sucesso",
      });

      // Refresh settings to get latest state
      fetchSettings();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "test-connection" },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus("connected");
        
        // Update access_token_configured to true since connection works
        const updatedMpSettings = { ...mpSettings, access_token_configured: true };
        setMpSettings(updatedMpSettings);
        
        // Save to database
        await supabase
          .from("saas_settings")
          .upsert(
            { key: "mercadopago", value: JSON.parse(JSON.stringify(updatedMpSettings)) },
            { onConflict: "key" }
          );
        
        toast({
          title: "Conexão estabelecida!",
          description: `Conta: ${data.account?.email || data.account?.nickname}`,
        });
      } else {
        setConnectionStatus("error");
        
        // Update access_token_configured to false since connection failed
        const updatedMpSettings = { ...mpSettings, access_token_configured: false };
        setMpSettings(updatedMpSettings);
        
        toast({
          title: "Falha na conexão",
          description: data.error || "Verifique suas credenciais",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Test connection error:", error);
      setConnectionStatus("error");
      const isNetwork = /Failed to (send|fetch)/i.test(error?.message || "");
      toast({
        title: "Erro ao testar conexão",
        description: isNetwork
          ? "Não foi possível contatar o serviço (CORS/rede). Recarregue a página e tente novamente."
          : error?.message || "Não foi possível contatar o serviço. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const syncPlans = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "sync-plans" },
      });

      if (error) throw error;

      if (data.success) {
        const successCount = data.results?.filter((r: { success: boolean }) => r.success).length || 0;
        const failCount = data.results?.filter((r: { success: boolean }) => !r.success).length || 0;

        toast({
          title: "Sincronização concluída",
          description: `${successCount} plano(s) sincronizado(s)${failCount > 0 ? `, ${failCount} falha(s)` : ""}`,
        });

        // Refresh plans
        fetchPlans();
      }
    } catch (error) {
      console.error("Sync plans error:", error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível sincronizar os planos",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "URL copiada para a área de transferência",
    });
  };


  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Configure seu SaaS</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="landing" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Landing Page
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="lia" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              LIA
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>
                  Informações básicas do seu SaaS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="app_name">Nome do App</Label>
                    <Input
                      id="app_name"
                      value={generalSettings.app_name}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, app_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support_email">Email de Suporte</Label>
                    <Input
                      id="support_email"
                      type="email"
                      value={generalSettings.support_email}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, support_email: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="terms_url">URL Termos de Uso</Label>
                    <Input
                      id="terms_url"
                      value={generalSettings.terms_url}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, terms_url: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="privacy_url">URL Política de Privacidade</Label>
                    <Input
                      id="privacy_url"
                      value={generalSettings.privacy_url}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, privacy_url: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="webhook_base_url">URL Base de Webhooks (opcional)</Label>
                    <Input
                      id="webhook_base_url"
                      value={generalSettings.webhook_base_url || ""}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, webhook_base_url: e.target.value })
                      }
                      placeholder={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se você configurou um proxy customizado (ex: Cloudflare), coloque a URL base aqui.
                      Deixe em branco para usar a URL padrão.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="new_member_tutorials" className="text-sm font-medium cursor-pointer">
                      Ativar tutoriais para novos membros
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Controla o modal de boas-vindas, o checklist inicial e o tour guiado da LIA
                      que aparecem para novos usuários ao acessarem o sistema pela primeira vez.
                    </p>
                  </div>
                  <Switch
                    id="new_member_tutorials"
                    checked={generalSettings.new_member_tutorials_enabled !== false}
                    onCheckedChange={(v) =>
                      setGeneralSettings({ ...generalSettings, new_member_tutorials_enabled: v })
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => saveSettings("general", generalSettings)}
                    disabled={saving}
                    className="gradient-primary border-0"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Landing Page Settings */}
          <TabsContent value="landing">
            <Card>
              <CardHeader>
                <CardTitle>Configurações da Landing Page</CardTitle>
                <CardDescription>
                  Personalize a página de vendas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hero_title">Título Principal</Label>
                  <Input
                    id="hero_title"
                    value={landingSettings.hero?.title || ""}
                    onChange={(e) =>
                      setLandingSettings({
                        ...landingSettings,
                        hero: { ...landingSettings.hero, title: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero_subtitle">Subtítulo</Label>
                  <Textarea
                    id="hero_subtitle"
                    value={landingSettings.hero?.subtitle || ""}
                    onChange={(e) =>
                      setLandingSettings({
                        ...landingSettings,
                        hero: { ...landingSettings.hero, subtitle: e.target.value },
                      })
                    }
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cta_text">Texto do Botão Principal</Label>
                    <Input
                      id="cta_text"
                      value={landingSettings.hero?.cta_text || ""}
                      onChange={(e) =>
                        setLandingSettings({
                          ...landingSettings,
                          hero: { ...landingSettings.hero, cta_text: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cta_secondary_text">Texto do Botão Secundário</Label>
                    <Input
                      id="cta_secondary_text"
                      value={landingSettings.hero?.cta_secondary_text || ""}
                      onChange={(e) =>
                        setLandingSettings({
                          ...landingSettings,
                          hero: { ...landingSettings.hero, cta_secondary_text: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => saveSettings("landing_page", landingSettings)}
                    disabled={saving}
                    className="gradient-primary border-0"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Settings */}
          <TabsContent value="payments" className="space-y-6">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Status da Conexão
                </CardTitle>
                <CardDescription>
                  Verifique se a integração com o Mercado Pago está funcionando
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {connectionStatus === "unknown" && (
                      <Badge variant="secondary">Não testado</Badge>
                    )}
                    {connectionStatus === "connected" && (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Conectado
                      </Badge>
                    )}
                    {connectionStatus === "error" && (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        Erro
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testConnection}
                    disabled={testing}
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Testar Conexão
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Credentials */}
            <Card>
              <CardHeader>
                <CardTitle>Credenciais</CardTitle>
                <CardDescription>
                  Configure as credenciais do Mercado Pago
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mp_public_key">Public Key</Label>
                  <div className="relative">
                    <Input
                      id="mp_public_key"
                      type={showPublicKey ? "text" : "password"}
                      value={mpSettings.public_key}
                      onChange={(e) =>
                        setMpSettings({ ...mpSettings, public_key: e.target.value })
                      }
                      placeholder="TEST-... ou APP_USR-..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPublicKey(!showPublicKey)}
                      className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
                    >
                      {showPublicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Chave pública para integração frontend (se necessário)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mp_access_token">Access Token</Label>
                  <div className="relative">
                    <Input
                      id="mp_access_token"
                      type={showAccessToken ? "text" : "password"}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="APP_USR-... ou TEST-..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
                    >
                      {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Token de acesso para integração backend. Será armazenado de forma segura como secret do projeto.
                  </p>
                  {mpSettings.access_token_configured ? (
                    <div className="flex items-center gap-2 p-2 border border-green-500/30 rounded-lg bg-green-500/5">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <p className="text-sm text-green-600">Access Token configurado</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
                      <XCircle className="w-4 h-4 text-yellow-500" />
                      <p className="text-sm text-yellow-600">Access Token não configurado</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  {mpSettings.access_token_configured && connectionStatus !== "connected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testConnection}
                      disabled={testing}
                    >
                      {testing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Testar Conexão
                    </Button>
                  )}
                  <Button
                    onClick={async () => {
                      // If accessToken field has a value, persist it via edge function first
                      if (accessToken.trim()) {
                        setSavingAccessToken(true);
                        try {
                          const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
                            body: { action: "save-access-token", accessToken: accessToken.trim() },
                          });
                          if (error) throw error;
                          if (!data?.success) throw new Error(data?.error || "Erro ao salvar token");

                          // Update local state — keep token visible
                          const updated = { ...mpSettings, access_token_configured: true };
                          setMpSettings(updated);
                          setConnectionStatus("unknown");

                          toast({
                            title: "Access Token salvo com sucesso",
                            description: "O token foi criptografado e armazenado de forma segura. Teste a conexão para verificar.",
                          });
                        } catch (err: any) {
                          console.error("Error saving access token:", err);
                          toast({
                            title: "Erro ao salvar Access Token",
                            description: err.message || "Tente novamente",
                            variant: "destructive",
                          });
                        } finally {
                          setSavingAccessToken(false);
                        }
                      }
                      // Also save public_key settings — use local variable to avoid stale state
                      const nextMp = {
                        public_key: mpSettings.public_key,
                        access_token_configured: accessToken.trim() ? true : mpSettings.access_token_configured,
                      };
                      setMpSettings(nextMp);
                      await saveSettings("mercadopago", nextMp);
                    }}
                    disabled={saving || savingAccessToken}
                    className="gradient-primary border-0"
                  >
                    {savingAccessToken ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Webhook Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Webhook (IPN)</CardTitle>
                <CardDescription>
                  Configure esta URL no painel do Mercado Pago para receber notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <div className="flex gap-2">
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <p className="text-sm font-medium">Como configurar:</p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
                    <li>
                      Acesse o{" "}
                      <a
                        href="https://www.mercadopago.com.br/developers/panel/app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Painel de Desenvolvedores
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Selecione sua aplicação</li>
                    <li>Vá em "Webhooks" → "Notificações IPN"</li>
                    <li>Cole a URL acima no campo "URL de produção"</li>
                    <li>
                      Selecione os eventos:
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li><code className="text-xs bg-background px-1 rounded">subscription_preapproval</code></li>
                        <li><code className="text-xs bg-background px-1 rounded">payment</code></li>
                      </ul>
                    </li>
                    <li>Salve as configurações</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* Plans Sync */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Sincronização de Planos</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncPlans}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sincronizar com MP
                  </Button>
                </CardTitle>
                <CardDescription>
                  Sincronize seus planos com o Mercado Pago para habilitar assinaturas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Plano</th>
                        <th className="text-left p-3 text-sm font-medium">Preço</th>
                        <th className="text-left p-3 text-sm font-medium">Status MP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan.id} className="border-t">
                          <td className="p-3">{plan.name}</td>
                          <td className="p-3">
                            {plan.is_free ? "Grátis" : `R$ ${plan.price.toFixed(2)}`}
                          </td>
                          <td className="p-3">
                            {plan.is_free ? (
                              <Badge variant="secondary">N/A</Badge>
                            ) : plan.mp_plan_id ? (
                              <Badge className="bg-green-500 hover:bg-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Sincronizado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                                Pendente
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                      {plans.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-muted-foreground">
                            Nenhum plano cadastrado. Crie planos na seção de Planos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Payment Webhook Logs */}
            <PaymentWebhookLogs />
          </TabsContent>

          {/* Branding */}
          <TabsContent value="branding">
            <BrandingTab initialData={brandingSettings} onSave={saveSettings} saving={saving} />
          </TabsContent>

          {/* LIA Settings */}
          <TabsContent value="lia">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  System Prompt da LIA
                </CardTitle>
                <CardDescription>
                  Edite o prompt de sistema que define o comportamento e conhecimento da LIA. 
                  Se vazio, será usado o prompt padrão com toda a documentação do OpenFlow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={liaPrompt}
                  onChange={(e) => setLiaPrompt(e.target.value)}
                  rows={20}
                  className="min-h-[400px] text-xs"
                  placeholder="Deixe vazio para usar o prompt padrão..."
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {liaPrompt.length > 0 ? `${liaPrompt.length} caracteres` : "Usando prompt padrão"}
                  </p>
                  <div className="flex gap-2">
                    {liaPrompt.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLiaPrompt("")}
                      >
                        Restaurar Padrão
                      </Button>
                    )}
                    <Button
                      onClick={async () => {
                        setSavingLia(true);
                        try {
                          await saveSettings("lia_system_prompt", liaPrompt || "");
                        } finally {
                          setSavingLia(false);
                        }
                      }}
                      disabled={savingLia}
                      className="gradient-primary border-0"
                    >
                      {savingLia ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Salvar Prompt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
