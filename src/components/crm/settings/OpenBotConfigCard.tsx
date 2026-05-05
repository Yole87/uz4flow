import { useQuery } from "@tanstack/react-query";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { 
  Copy, 
  Bot, 
  Check, 
  AlertCircle, 
  Info,
  Workflow,
  ArrowRight,
  Link2,
  CheckCircle2,
  Clock
} from "lucide-react";

const getInstanceWebhookUrl = (instanceId: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-openbot-inbound?instance_id=${instanceId}`;

// URL fixa de envio - constante
const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

interface InstanceStatus {
  id: string;
  name: string;
  openbot_instance_id: string | null;
  has_openbot_api_key: boolean;
}

export function OpenBotConfigCard() {
  const { data: organization } = useUserOrganization();
  const organizationId = organization?.id;
  
  // Query to check instances status
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["crm-instances-openbot-status", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from("instances_safe" as any)
        .select("id, name, openbot_instance_id, has_openbot_api_key")
        .eq("organization_id", organizationId);
      return (data || []) as unknown as InstanceStatus[];
    },
    enabled: !!organizationId,
  });

  const configuredInstances = instances.filter(i => i.openbot_instance_id && i.has_openbot_api_key);
  const pendingInstances = instances.filter(i => !i.openbot_instance_id || !i.has_openbot_api_key);
  const hasInstances = instances.length > 0;
  const allConfigured = pendingInstances.length === 0 && hasInstances;

  const copyWebhookUrl = (instanceId: string) => {
    navigator.clipboard.writeText(getInstanceWebhookUrl(instanceId));
    toast.success("URL copiada!");
  };

  const copySendUrl = () => {
    navigator.clipboard.writeText(OPENBOT_SEND_URL);
    toast.success("URL de envio copiada!");
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-48 bg-muted" />
          <Skeleton className="h-4 w-full mt-2 bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full bg-muted" />
          <Skeleton className="h-10 w-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-primary/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground text-base sm:text-lg">Integração WhatsApp AI</CardTitle>
          </div>
          <Badge 
            variant="outline" 
            className={allConfigured 
              ? "border-success/50 text-success" 
              : hasInstances
                ? "border-warning/50 text-warning"
                : "border-muted text-muted-foreground"
            }
          >
            {allConfigured ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Configurado
              </>
            ) : hasInstances ? (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Pendente
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Sem Instâncias
              </>
            )}
          </Badge>
        </div>
        <CardDescription className="text-muted-foreground">
          Configure a integração com o Sistema de WhatsApp AI para gerenciar mensagens do WhatsApp via API da Meta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Webhook URL for OpenBot */}
        <div className="space-y-2">
          <Label className="text-foreground flex items-center gap-2">
            Webhook seguro por instância
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-card border-border">
                <p>Cada instância precisa usar a sua própria URL com <span className="font-mono">instance_id</span>. Isso evita mistura de mensagens entre tenants.</p>
              </TooltipContent>
            </Tooltip>
          </Label>
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground space-y-1">
            <p className="font-medium">Importante de segurança</p>
            <p className="text-muted-foreground">
              Não use uma URL genérica nem reutilize a URL de outro cliente. Cada instância abaixo tem uma URL exclusiva e isolada.
            </p>
          </div>
        </div>

        {/* Send URL - Fixed */}
        <div className="space-y-2">
          <Label className="text-foreground flex items-center gap-2">
            URL de Envio (fixa)
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-card border-border">
                <p>Endpoint do Sistema de WhatsApp AI para envio de mensagens. Não precisa configurar.</p>
              </TooltipContent>
            </Tooltip>
          </Label>
          <Input
            value={OPENBOT_SEND_URL}
            readOnly
            className="bg-muted/50 border-border text-muted-foreground text-sm font-mono"
          />
        </div>

        {/* Instances Status */}
        {hasInstances && (
          <div className="space-y-3">
            <Label className="text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Status das Instâncias
            </Label>
            <div className="rounded-lg border border-border divide-y divide-border">
              {instances.map((instance) => {
                const isLinked = !!instance.openbot_instance_id;
                const hasApiKey = !!instance.has_openbot_api_key;
                const isComplete = isLinked && hasApiKey;

                return (
                    <div 
                    key={instance.id}
                      className="flex flex-col gap-3 p-3"
                  >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isComplete ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Clock className="h-4 w-4 text-warning" />
                          )}
                          <span className="text-sm text-foreground">{instance.name}</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1 sm:gap-2">
                          {!hasApiKey && (
                            <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">
                              Sem API Key
                            </Badge>
                          )}
                          {isLinked ? (
                            <Badge variant="outline" className="text-xs border-success/50 text-success font-mono">
                              {instance.openbot_instance_id}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-warning/50 text-warning">
                              Aguardando vínculo seguro
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={getInstanceWebhookUrl(instance.id)}
                          readOnly
                          className="bg-muted border-border text-foreground text-xs font-mono"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyWebhookUrl(instance.id)}
                          className="border-border text-muted-foreground hover:text-foreground shrink-0"
                          aria-label={`Copiar URL da instância ${instance.name}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {pendingInstances.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Instâncias pendentes só serão vinculadas quando a primeira mensagem chegar pela URL exclusiva da própria instância.
              </p>
            )}
          </div>
        )}

        {!hasInstances && (
          <div className="p-4 rounded-lg border border-dashed border-border bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma instância cadastrada. Adicione uma instância no CRM para começar.
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-2 text-primary"
              onClick={() => window.location.href = "/crm"}
            >
              Ir para o CRM
            </Button>
          </div>
        )}

        {/* Architecture Info - 3 Pillars */}
        <div className="p-4 bg-gradient-to-br from-muted/80 to-card/40 rounded-lg border border-border/50">
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Workflow className="h-4 w-4 text-accent" />
            Arquitetura de Comunicação
          </h4>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li className="flex items-start gap-2 p-2 rounded bg-muted/50">
              <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded text-xs font-medium shrink-0">1. CLIENTE</span>
              <span className="flex items-center gap-1 flex-wrap">
                Cliente <ArrowRight className="h-3 w-3" /> Meta <ArrowRight className="h-3 w-3" /> WhatsApp AI <ArrowRight className="h-3 w-3" /> CRM
              </span>
            </li>
            <li className="flex items-start gap-2 p-2 rounded bg-muted/50">
              <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-medium shrink-0">2. IA</span>
              <span>WhatsApp AI responde via Meta e transmite ao CRM automaticamente</span>
            </li>
            <li className="flex items-start gap-2 p-2 rounded bg-muted/50">
              <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs font-medium shrink-0">3. CRM</span>
              <span className="flex items-center gap-1 flex-wrap">
                CRM <ArrowRight className="h-3 w-3" /> WhatsApp AI <ArrowRight className="h-3 w-3" /> Meta <ArrowRight className="h-3 w-3" /> Cliente
              </span>
            </li>
          </ul>
          
          {/* Payload Examples - Collapsible */}
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              📋 Ver exemplos de payload
            </summary>
            <div className="mt-2 space-y-4">
              {/* API Baileys */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-accent">API Baileys (WhatsApp Web)</p>
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">📄 Texto (conversation)</summary>
                  <pre className="mt-1 p-2 bg-muted/30 rounded border border-border/30 text-[9px] text-muted-foreground overflow-x-auto">{`{
  "instanceId": "default",
  "chatId": "5581999999999",
  "fromMe": false,
  "messageType": "conversation",
  "timestamp": 1762966934,
  "pushName": "Nome do Contato",
  "message": { "conversation": "Texto da mensagem" },
  "fluxo": {
    "id": "123456789",
    "nome": "Fluxo Principal",
    "palavraChave": "oi",
    "apenasWebhookSaida": false,
    "gatilhoPorConversaIniciada": false
  },
  "key": {
    "remoteJid": "5581999999999@s.whatsapp.net",
    "id": "3EB0C2F0997EF0E2769459",
    "fromMe": false
  }
}`}</pre>
                </details>
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">🎤 Áudio (audioMessage)</summary>
                  <pre className="mt-1 p-2 bg-muted/30 rounded border border-border/30 text-[9px] text-muted-foreground overflow-x-auto">{`{
  "instanceId": "default",
  "chatId": "558185450206",
  "fromMe": false,
  "messageType": "audioMessage",
  "timestamp": 1770390810,
  "pushName": "Dantas",
  "message": {
    "audioMessage": {
      "url": "https://mmg.whatsapp.net/v/t62...",
      "mimetype": "audio/ogg; codecs=opus",
      "fileSha256": "C6NS6IcdUwx9BTBQl2gM...",
      "fileLength": "4095",
      "seconds": 1,
      "ptt": true,
      "waveform": "FxcXFxgWExEPDQwKCQgGBAIEGC1B..."
    }
  },
  "fluxo": {
    "id": "1770386790751",
    "nome": "",
    "palavraChave": "",
    "apenasWebhookSaida": true,
    "gatilhoPorConversaIniciada": false
  },
  "key": {
    "remoteJid": "558185450206@s.whatsapp.net",
    "id": "3EB0D37B3409617C496FA3"
  }
}`}</pre>
                </details>
              </div>

              {/* API Oficial */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-primary">API Oficial (WhatsApp Business)</p>
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">📄 Texto (text)</summary>
                  <pre className="mt-1 p-2 bg-muted/30 rounded border border-border/30 text-[9px] text-muted-foreground overflow-x-auto">{`{
  "instanceId": "default",
  "chatId": "5581999999999",
  "fromMe": false,
  "messageType": "text",
  "timestamp": 1762966934,
  "pushName": "Nome do Contato",
  "message": { "conversation": "Texto da mensagem" },
  "fluxo": {
    "id": "123456789",
    "nome": "Fluxo Principal",
    "palavraChave": "oi",
    "apenasWebhookSaida": false,
    "gatilhoPorConversaIniciada": false
  },
  "key": {
    "remoteJid": "5581999999999@s.whatsapp.net",
    "id": "3EB0C2F0997EF0E2769459",
    "fromMe": false
  }
}`}</pre>
                </details>
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">🖼️ Mídia com Base64 (image)</summary>
                  <pre className="mt-1 p-2 bg-muted/30 rounded border border-border/30 text-[9px] text-muted-foreground overflow-x-auto">{`{
  "instanceId": "default",
  "chatId": "5581999999999",
  "fromMe": false,
  "messageType": "image",
  "timestamp": 1770390209,
  "pushName": "5581999999999",
  "media": {
    "mimetype": "image/jpeg",
    "data": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "size": 415245
  },
  "fluxo": {
    "id": "1770386790751",
    "nome": "Fluxo de Mídia",
    "palavraChave": "",
    "apenasWebhookSaida": true,
    "gatilhoPorConversaIniciada": false
  },
  "key": {
    "remoteJid": "5581999999999@s.whatsapp.net",
    "id": "wamid.HBgMNTU4MTg1NDUwMjA2FQIAEhg...",
    "fromMe": false
  }
}`}</pre>
                </details>
              </div>

              {/* Payload de Saída */}
              <div className="p-2 bg-muted/30 rounded border border-border/30">
                <p className="text-xs font-medium text-foreground mb-1">Payload de SAÍDA (CRM → Sistema de WhatsApp AI) — único para ambas as APIs:</p>
                <pre className="text-[9px] text-muted-foreground overflow-x-auto">{`{
  "apiKey": "seu_token_aqui",
  "phone": "55XXXXXXXXXXX",
  "message": "Mensagem para enviar",
  "arquivo": "data:@file/pdf;base64,...",
  "desativarFluxo": true
}`}</pre>
              </div>
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
