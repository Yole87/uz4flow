import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWebhookUrls } from "@/hooks/useWebhookUrls";
import { toast } from "sonner";
import {
  Key,
  Link as LinkIcon,
  Shield,
  Save,
  TestTube,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Info,
} from "lucide-react";

export function FlowsConfigCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [inboundUrl, setInboundUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [hasExisting, setHasExisting] = useState(false);

  const { getUrl } = useWebhookUrls();
  const webhookUrl = getUrl("openbot");

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) { setLoading(false); return; }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-integration`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ action: "get" }),
          }
        );

        if (!response.ok) throw new Error("Failed to fetch integration");
        const result = await response.json();

        if (result.integration) {
          setHasExisting(true);
          setApiKeyMasked(result.integration.apiKeyMasked || "");
          setInboundUrl(result.integration.inboundUrl || "");
        }
      } catch (error) {
        console.error("Error fetching integration:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error("Sessão expirada. Faça login novamente."); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            action: "save",
            apiKey: apiKey || undefined,
            inboundUrl: inboundUrl || undefined,
            webhookSecret: webhookSecret || undefined,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429 || result.retryAfter) {
          toast.error(`Muitas tentativas. Aguarde ${result.retryAfter || 60} segundos.`);
          return;
        }
        throw new Error(result.error || "Failed to save");
      }

      if (result.apiKeyMasked) { setApiKeyMasked(result.apiKeyMasked); setApiKey(""); }
      setHasExisting(true);
      toast.success("Configurações salvas com sucesso! ✅");
    } catch (error) {
      console.error("Error saving integration:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!inboundUrl) { toast.error("Informe a URL de entrada do Sistema de WhatsApp AI"); return; }
    if (!user) return;
    try {
      setTesting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error("Sessão expirada. Faça login novamente."); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ action: "test", apiKey: apiKey || undefined, inboundUrl }),
        }
      );

      const result = await response.json();
      if (result.success) {
        toast.success("Conexão testada com sucesso! O Sistema de WhatsApp AI recebeu a mensagem.");
      } else if (response.status === 429 || result.retryAfter) {
        toast.error(`Muitas tentativas de teste. Aguarde ${result.retryAfter || 60} segundos.`);
      } else {
        toast.error(`Erro na conexão: ${result.error}`);
      }
    } catch (error) {
      console.error("Test connection error:", error);
      toast.error("Erro ao testar conexão. Verifique a URL.");
    } finally {
      setTesting(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Webhook URL Card */}
      <Card className="quantum-glass border-primary/30 shadow-[0_0_15px_hsl(338_100%_53%/0.1)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            Seu Webhook URL
          </CardTitle>
          <CardDescription>
            Configure esta URL no Sistema de WhatsApp AI para receber eventos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-sm bg-muted" />
            <Button variant="outline" onClick={copyWebhookUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <Info className="h-4 w-4" />
            <AlertTitle>⚠️ IMPORTANTE: Copie a URL completa!</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-sm font-medium">
                A URL acima contém o parâmetro <code className="bg-background px-1.5 py-0.5 rounded font-mono">?user_id=...</code> que é <strong>OBRIGATÓRIO</strong>.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Sem esse parâmetro, o webhook retornará erro 400 Bad Request.
              </p>
            </AlertDescription>
          </Alert>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como configurar no Sistema de WhatsApp AI</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Clique no botão <strong>"Copiar"</strong> acima para copiar a URL completa</li>
                <li>Acesse as configurações do seu fluxo no Sistema de WhatsApp AI</li>
                <li>Vá em <strong>"Webhooks"</strong> → <strong>"Saída"</strong></li>
                <li>Cole a URL completa (com o <code className="bg-muted px-1 rounded">?user_id=</code>)</li>
                <li>Salve as configurações</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>Credenciais do Sistema de WhatsApp AI</CardTitle>
          <CardDescription>Configure as credenciais para enviar mensagens ao Sistema de WhatsApp AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              API Key do Sistema de WhatsApp AI
            </Label>
            {apiKeyMasked && (
              <p className="text-sm text-muted-foreground">
                Atual: <code className="bg-muted px-2 py-0.5 rounded">{apiKeyMasked}</code>
              </p>
            )}
            <Input
              id="api-key"
              type="password"
              placeholder={apiKeyMasked ? "Digite para alterar" : "Cole sua API Key aqui"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">A API Key é armazenada de forma segura e nunca exibida após salva.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inbound-url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              URL de entrada do Sistema de WhatsApp AI
            </Label>
            <Input
              id="inbound-url"
              type="url"
              placeholder="https://api.openbot.com/webhook"
              value={inboundUrl}
              onChange={(e) => setInboundUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">URL para onde enviaremos as mensagens de volta ao Sistema de WhatsApp AI.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Webhook Secret (opcional)
            </Label>
            <Input
              id="webhook-secret"
              type="password"
              placeholder="Secret para validação HMAC"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Se configurado, validamos a assinatura dos webhooks recebidos.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} className="gradient-primary hover:opacity-90 w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configurações
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !inboundUrl} className="w-full sm:w-auto">
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
              Testar conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
