import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Copy, Check, Save, TestTube, Loader2, ListOrdered, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const FLOWS_TUTORIAL_VIDEO_ID = "HTyPIqa-vPQ";

const flowsSteps = [
  "Acesse seu Sistema de WhatsApp AI.",
  'Na página inicial, confirme que a opção "Fluxo" está ativada.',
  'No menu lateral esquerdo, acesse a seção "Fluxo".',
  'Clique em "Adicionar Fluxo".',
  'Clique no fluxo recém-criado e nomeie-o, por exemplo: "Uz4Flow: Fluxos".',
  "Se necessário, preencha uma palavra-chave. Caso não saiba para que serve, consulte o tutorial de Fluxos e Conectores.",
  'Copie a URL exibida no campo "URL do Webhook" acima e cole no campo "URL do Webhook" do Sistema de WhatsApp AI.',
  'Marque a opção "Sempre enviar todos os eventos de saída" para garantir que os fluxos recebam todas as mensagens.',
  'Clique em "Salvar Configurações" no Sistema de WhatsApp AI e, em seguida, em "Salvar Credenciais" no Uz4Flow.',
];

interface Props {
  instanceId: string;
  webhookUrl: string;
}

export function FlowsCredentialsTab({ instanceId, webhookUrl }: Props) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error("Sessão expirada"); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            action: "save",
            webhookSecret: webhookSecret || undefined,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed");
      toast.success("Credenciais salvas!");
      setWebhookSecret("");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!user) return;
    setTesting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error("Sessão expirada"); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ action: "test", instance_id: instanceId }),
        }
      );
      const result = await response.json();
      if (result.success) {
        toast.success("Conexão testada com sucesso!");
      } else {
        toast.error("Erro: " + (result.error || "Falha"));
      }
    } catch {
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <div className="space-y-2">
        <Label className="text-foreground">URL de Webhook (Conectores e Fluxos)</Label>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="font-mono text-sm bg-muted" />
          <Button variant="outline" size="icon" onClick={copyUrl} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure esta URL no Sistema de WhatsApp AI para receber eventos de Fluxos e Conectores.
        </p>
      </div>

      {/* Step-by-step */}
      <Accordion type="single" collapsible>
        <AccordionItem value="flows-steps" className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-accent" />
              Passo a Passo — Conectores e Fluxos
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              {flowsSteps.map((step, i) => (
                <li key={i} className="leading-relaxed">{step}</li>
              ))}
            </ol>
            <div className="mt-4">
              <p className="text-xs font-medium text-foreground mb-2">Vídeo Tutorial</p>
              <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${FLOWS_TUTORIAL_VIDEO_ID}`}
                  title="Tutorial Conectores e Fluxos"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Webhook Secret */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Webhook Secret (opcional)
        </Label>
        <Input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="Secret para validação HMAC" />
        <p className="text-xs text-muted-foreground">
          Se configurado, validamos a assinatura dos webhooks recebidos.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} className="gradient-primary hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Credenciais
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
          Testar Conexão
        </Button>
      </div>
    </div>
  );
}
