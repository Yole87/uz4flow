import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Copy, Check, Save, TestTube, Loader2, ListOrdered, ScrollText, ChevronDown, Eye, EyeOff, ShieldCheck, ExternalLink, Key, Link2, BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetaTemplatesSection } from "./MetaTemplatesSection";
import { CRMEventLogsCard } from "@/components/crm/settings/CRMEventLogsCard";
import { ConversationEvalConfigCard } from "@/components/crm/settings/ConversationEvalConfigCard";
import { EvaluationLogsCard } from "@/components/crm/settings/EvaluationLogsCard";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";

const CRM_TUTORIAL_VIDEO_ID = "HTyPIqa-vPQ";

const crmSteps = [
  "Acesse seu Sistema de WhatsApp AI.",
  'Na página inicial, confirme que a opção "Fluxo" está ativada.',
  'No menu lateral esquerdo, acesse a seção "Fluxo".',
  'Clique em "Adicionar Fluxo".',
  'Clique no fluxo recém-criado e nomeie-o, por exemplo: "OpenFlow: CRM".',
  "Atenção: não preencha nenhuma palavra-chave. Caso preencha, o CRM não funcionará corretamente.",
  'Copie a URL exibida no campo "URL do Webhook" acima e cole no campo "URL do Webhook" do Sistema de WhatsApp AI.',
  'Marque a opção "Sempre enviar todos os eventos de saída" para garantir que o CRM receba todas as mensagens.',
  'Clique em "Salvar Configurações" no Sistema de WhatsApp AI e, em seguida, em "Salvar Credenciais" no OpenFlow.',
];

const metaSteps = [
  'Acesse o Meta for Developers em developers.facebook.com e selecione seu App.',
  'No menu lateral, vá em WhatsApp > Configuração da API.',
  'Copie o "Token de Acesso Permanente" e cole no campo abaixo.',
  'Copie o "ID do Número de Telefone" (Phone Number ID) e cole no campo abaixo.',
  'Clique em "Salvar Credenciais Meta" para ativar o envio direto pela API Oficial.',
  'Teste a conexão clicando em "Testar Conexão Meta" para confirmar que tudo está funcionando.',
];

interface Props {
  instanceId: string;
  instanceName: string;
  provider: string;
  webhookUrl: string;
}

export function CRMCredentialsTab({ instanceId, instanceName, provider, webhookUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const orgQuery = useUserOrganization();
  const organizationId = orgQuery.data?.id;

  // Meta credentials state
  const [metaToken, setMetaToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [testingMeta, setTestingMeta] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasPhoneNumberId, setHasPhoneNumberId] = useState(false);

  // Instance token management state
  const [instanceToken, setInstanceToken] = useState("");
  const [instanceApiUrl, setInstanceApiUrl] = useState("");
  const [showInstanceToken, setShowInstanceToken] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [hasInstanceToken, setHasInstanceToken] = useState(false);
  const [savingInstanceCreds, setSavingInstanceCreds] = useState(false);
  const [instanceTokenChanged, setInstanceTokenChanged] = useState(false);
  const [instanceApiUrlChanged, setInstanceApiUrlChanged] = useState(false);

  const isMetaOfficial = provider === "meta_official";

  // Load existing config status
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("instances_safe")
        .select("has_api_key, has_openbot_api_key, meta_phone_number_id, api_url")
        .eq("id", instanceId)
        .maybeSingle();
      if (data) {
        setHasApiKey(!!data.has_api_key);
        setHasPhoneNumberId(!!data.meta_phone_number_id);
        setHasInstanceToken(isMetaOfficial ? !!data.has_api_key : !!data.has_openbot_api_key);
        if (data.meta_phone_number_id) setPhoneNumberId(data.meta_phone_number_id);
        if (data.api_url) setInstanceApiUrl(data.api_url);
      }
    })();
  }, [instanceId, isMetaOfficial]);

  const loadInstanceToken = async () => {
    if (tokenLoaded) {
      setShowInstanceToken(!showInstanceToken);
      return;
    }
    setLoadingToken(true);
    try {
      const response = await supabase.functions.invoke("get-instance-token", {
        body: { instance_id: instanceId },
      });
      if (response.error) {
        toast.error("Erro ao carregar token. Tente novamente.");
        return;
      }
      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }
      setInstanceToken(response.data.token || "");
      if (response.data.api_url) setInstanceApiUrl(response.data.api_url);
      setTokenLoaded(true);
      setShowInstanceToken(true);
    } catch {
      toast.error("Erro ao carregar token");
    } finally {
      setLoadingToken(false);
    }
  };

  const handleSaveInstanceCreds = async () => {
    setSavingInstanceCreds(true);
    try {
      // Update api_url directly (non-sensitive)
      if (instanceApiUrlChanged) {
        const { error } = await supabase
          .from("instances")
          .update({ api_url: instanceApiUrl.trim() || null })
          .eq("id", instanceId);
        if (error) throw error;
      }

      // Encrypt token server-side via edge function
      if (instanceTokenChanged && instanceToken.trim()) {
        const { error } = await supabase.functions.invoke("manage-integration", {
          body: {
            action: "save-instance-credentials",
            instance_id: instanceId,
            api_key: instanceToken.trim(),
            key_field: isMetaOfficial ? "api_key_encrypted" : "openbot_api_key_encrypted",
          },
        });
        if (error) throw error;
      }

      if (!instanceApiUrlChanged && !(instanceTokenChanged && instanceToken.trim())) {
        toast.info("Nenhuma alteração para salvar");
        setSavingInstanceCreds(false);
        return;
      }

      setInstanceTokenChanged(false);
      setInstanceApiUrlChanged(false);
      setHasInstanceToken(true);
      toast.success("Credenciais da instância atualizadas!");
    } catch {
      toast.error("Erro ao salvar credenciais da instância");
    } finally {
      setSavingInstanceCreds(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Trigger test to validate the existing credentials work
      await handleTest();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await supabase.functions.invoke("crm-test-openbot", {
        body: { instance_id: instanceId },
      });

      if (response.error) {
        toast.error(response.error.message || "Erro no teste de conexão. Tente novamente.");
      } else if (response.data?.success) {
        toast.success(response.data.message || "Conexão testada com sucesso!");
      } else {
        toast.error(
          response.data?.error ||
          response.data?.message ||
          "Falha no teste de conexão. Verifique suas credenciais."
        );
      }
    } catch {
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!metaToken && !hasApiKey) {
      toast.error("Informe o Token de Acesso Meta");
      return;
    }
    if (!phoneNumberId) {
      toast.error("Informe o Phone Number ID");
      return;
    }
    setSavingMeta(true);
    try {
      // Save phone_number_id directly (non-sensitive)
      const { error: updateError } = await supabase
        .from("instances")
        .update({ meta_phone_number_id: phoneNumberId })
        .eq("id", instanceId);
      if (updateError) throw updateError;

      // Encrypt token server-side if provided
      if (metaToken) {
        const { error } = await supabase.functions.invoke("manage-integration", {
          body: {
            action: "save-instance-credentials",
            instance_id: instanceId,
            api_key: metaToken,
            key_field: "api_key_encrypted",
          },
        });
        if (error) throw error;
      }

      setHasApiKey(true);
      setHasPhoneNumberId(true);
      setMetaToken("");
      toast.success("Credenciais Meta salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar credenciais Meta");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleTestMeta = async () => {
    setTestingMeta(true);
    try {
      const response = await supabase.functions.invoke("crm-send-message", {
        body: {
          instance_id: instanceId,
          test_connection: true,
        },
      });
      if (response.error) {
        toast.error("Erro no teste Meta. Tente novamente.");
      } else if (response.data?.success) {
        const name = response.data.verified_name;
        const quality = response.data.quality_rating;
        toast.success(`Conexão Meta OK! Nome: ${name}${quality ? ` • Qualidade: ${quality}` : ""}`);
      } else {
        toast.error("Falha: " + (response.data?.error || "Token ou Phone Number ID inválido"));
      }
    } catch {
      toast.error("Erro ao testar conexão Meta");
    } finally {
      setTestingMeta(false);
    }
  };

  const metaConfigured = hasApiKey && hasPhoneNumberId;
  const hasCredChanges = instanceTokenChanged || instanceApiUrlChanged;

  return (
    <div className="space-y-6">
      {/* Instance Token & API URL */}
      <div className="space-y-4 p-4 rounded-lg border border-border bg-card/50">
        <div className="flex items-center justify-between">
          <Label className="text-foreground font-medium text-sm flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Token e URL da API
          </Label>
          {hasInstanceToken && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-500/10 text-xs">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isMetaOfficial
            ? "Token de acesso e URL da API configurados para esta instância Meta Official."
            : "API Key e URL do Sistema de WhatsApp AI configurados para esta instância."
          }
        </p>

        <div className="space-y-3">
          {/* Token field */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {isMetaOfficial ? "Token de Acesso" : "API Key"}
            </Label>
            <div className="flex gap-2">
              <Input
                type={showInstanceToken ? "text" : "password"}
                placeholder={hasInstanceToken ? "••••••••••••••••••••" : "Nenhum token configurado"}
                value={instanceToken}
                onChange={e => {
                  setInstanceToken(e.target.value);
                  setInstanceTokenChanged(true);
                }}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={loadInstanceToken}
                disabled={loadingToken}
                className="shrink-0"
                title={showInstanceToken ? "Ocultar token" : "Mostrar token"}
              >
                {loadingToken ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : showInstanceToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* API URL field */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Link2 className="h-3 w-3" />
              URL da API
            </Label>
            <Input
              placeholder="https://api.example.com"
              value={instanceApiUrl}
              onChange={e => {
                setInstanceApiUrl(e.target.value);
                setInstanceApiUrlChanged(true);
              }}
              className="font-mono text-sm"
            />
          </div>
        </div>

        {hasCredChanges && (
          <Button
            onClick={handleSaveInstanceCreds}
            disabled={savingInstanceCreds}
            className="gradient-primary hover:opacity-90"
            size="sm"
          >
            {savingInstanceCreds ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        )}
      </div>

      {/* Meta API Credentials (only for meta_official) */}
      {isMetaOfficial && (
        <div className="space-y-4 p-4 rounded-lg border border-border bg-card/50">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium text-sm">Credenciais da API Oficial Meta</Label>
            {metaConfigured && (
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-500/10 text-xs">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Configurada
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Esses dados são os mesmos que você já configurou no seu Sistema de WhatsApp AI. São necessários aqui para enviar mensagens diretamente pela API da Meta.
            Encontre-os em{" "}
            <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              developers.facebook.com <ExternalLink className="h-3 w-3" />
            </a>
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token de Acesso Meta</Label>
              <div className="flex gap-2">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder={hasApiKey ? "••••••••••••••••••••" : "Cole o token de acesso aqui"}
                  value={metaToken}
                  onChange={e => setMetaToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)} className="shrink-0">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
              <Input
                placeholder="Ex: 123456789012345"
                value={phoneNumberId}
                onChange={e => setPhoneNumberId(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button onClick={handleSaveMeta} disabled={savingMeta} className="gradient-primary hover:opacity-90" size="sm">
              {savingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Credenciais Meta
            </Button>
            <Button variant="outline" onClick={handleTestMeta} disabled={testingMeta || !metaConfigured} size="sm">
              {testingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
              Testar Conexão Meta
            </Button>
          </div>

          {/* Meta step-by-step */}
          <Accordion type="single" collapsible>
            <AccordionItem value="meta-steps" className="border rounded-lg px-4 border-border">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-accent" />
                  Passo a Passo — API Oficial Meta
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  {metaSteps.map((step, i) => (
                    <li key={i} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Webhook URL */}
      <div className="space-y-2">
        <Label className="text-foreground">URL de Webhook (CRM)</Label>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="font-mono text-sm bg-muted" />
          <Button variant="outline" size="icon" onClick={copyUrl} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          URL única desta instância. Configure no Sistema de WhatsApp AI para receber eventos do CRM.
        </p>
        <div className="p-2.5 rounded-md border border-primary/20 bg-primary/5 mt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Importante:</strong> Ao configurar esta URL no seu Sistema de WhatsApp AI e enviar a primeira mensagem, o sistema vinculará automaticamente a instância. Não é necessário preencher o ID manualmente.
          </p>
        </div>
      </div>

      {/* Step-by-step */}
      <Accordion type="single" collapsible>
        <AccordionItem value="crm-steps" className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-accent" />
              Passo a Passo — CRM
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              {crmSteps.map((step, i) => (
                <li key={i} className="leading-relaxed">{step}</li>
              ))}
            </ol>
            <div className="mt-4">
              <p className="text-xs font-medium text-foreground mb-2">Vídeo Tutorial</p>
              <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${CRM_TUTORIAL_VIDEO_ID}`}
                  title="Tutorial CRM"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Meta Templates (only for meta_official) */}
      {isMetaOfficial && (
        <MetaTemplatesSection instanceId={instanceId} />
      )}

      {/* AI Conversation Evaluation */}
      {organizationId && (
        <ConversationEvalConfigCard
          organizationId={organizationId}
          forcedInstanceId={instanceId}
          forcedInstanceName={instanceName}
        />
      )}

      {/* AI Evaluation Logs (collapsible) */}
      {organizationId && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sm font-medium px-0 hover:bg-transparent">
              <span className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
                Logs de Avaliação IA
              </span>
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <EvaluationLogsCard />
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-sm font-medium px-0 hover:bg-transparent">
            <span className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-secondary" />
              Logs de Eventos
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${logsOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CRMEventLogsCard />
        </CollapsibleContent>
      </Collapsible>

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
