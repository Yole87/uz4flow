import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Webhook,
  Plus,
  Trash2,
  Loader2,
  Send,
  Eye,
  Copy,
  Check,
  Variable,
} from "lucide-react";

interface FlowWebhookConfigProps {
  flowId: string;
  userId: string;
  availableVariables: string[];
}

interface WebhookConfig {
  id?: string;
  is_enabled: boolean;
  webhook_url: string;
  http_method: string;
  headers: Record<string, string>;
  payload_template: string;
  description: string;
}

interface HeaderEntry {
  key: string;
  value: string;
}

const SYSTEM_VARIABLES = [
  { name: "pushName", label: "Nome do contato" },
  { name: "chatId", label: "Número WhatsApp" },
  { name: "instanceId", label: "ID da instância" },
];

const SAMPLE_DATA: Record<string, string> = {
  pushName: "João Silva",
  chatId: "5511999998888@s.whatsapp.net",
  instanceId: "inst-abc123",
};

const DEFAULT_TEMPLATE = `{
  "nome": "{{pushName}}",
  "telefone": "{{chatId}}",
  "origem": "whatsapp-bot"
}`;

export function FlowWebhookConfig({ flowId, userId, availableVariables }: FlowWebhookConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [config, setConfig] = useState<WebhookConfig>({
    is_enabled: false,
    webhook_url: "",
    http_method: "POST",
    headers: {},
    payload_template: DEFAULT_TEMPLATE,
    description: "",
  });

  const [headers, setHeaders] = useState<HeaderEntry[]>([
    { key: "Content-Type", value: "application/json" },
  ]);

  // Load existing config
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("flow_webhooks")
        .select("*")
        .eq("flow_id", flowId)
        .maybeSingle();

      if (data) {
        const h = (data.headers as Record<string, string>) || {};
        setConfig({
          id: data.id,
          is_enabled: data.is_enabled ?? false,
          webhook_url: data.webhook_url,
          http_method: data.http_method ?? "POST",
          headers: h,
          payload_template: data.payload_template,
          description: data.description ?? "",
        });
        const headerEntries = Object.entries(h).map(([key, value]) => ({ key, value }));
        if (headerEntries.length > 0) setHeaders(headerEntries);
      }
      setLoading(false);
    }
    load();
  }, [flowId]);

  // Build preview
  const previewPayload = useMemo(() => {
    let template = config.payload_template;
    for (const [key, val] of Object.entries(SAMPLE_DATA)) {
      template = template.split(`{{${key}}}`).join(val);
    }
    for (const varName of availableVariables) {
      template = template.split(`{{${varName}}}`).join(`[valor de ${varName}]`);
    }
    try {
      return JSON.stringify(JSON.parse(template), null, 2);
    } catch {
      return template;
    }
  }, [config.payload_template, availableVariables]);

  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.payload_template;
    const insertion = `{{${varName}}}`;
    const newText = text.substring(0, start) + insertion + text.substring(end);
    setConfig({ ...config, payload_template: newText });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!config.webhook_url.trim()) {
      toast.error("Informe a URL do webhook");
      return;
    }

    setSaving(true);
    const headersObj = Object.fromEntries(
      headers.filter(h => h.key.trim()).map(h => [h.key, h.value])
    );

    const payload = {
      flow_id: flowId,
      user_id: userId,
      is_enabled: config.is_enabled,
      webhook_url: config.webhook_url.trim(),
      http_method: config.http_method,
      headers: headersObj,
      payload_template: config.payload_template,
      description: config.description || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (config.id) {
      ({ error } = await supabase.from("flow_webhooks").update(payload).eq("id", config.id));
    } else {
      const { data, error: insertError } = await supabase.from("flow_webhooks").insert(payload).select().single();
      error = insertError;
      if (data) setConfig(prev => ({ ...prev, id: data.id }));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar webhook: " + error.message);
    } else {
      toast.success("Webhook salvo com sucesso");
    }
  };

  const handleTest = async () => {
    if (!config.webhook_url.trim()) {
      toast.error("Informe a URL do webhook");
      return;
    }

    setTesting(true);
    try {
      const headersObj = Object.fromEntries(
        headers.filter(h => h.key.trim()).map(h => [h.key, h.value])
      );

      const { data, error } = await supabase.functions.invoke("test-flow-webhook", {
        body: {
          webhook_url: config.webhook_url,
          http_method: config.http_method,
          headers: headersObj,
          payload_template: config.payload_template,
          sample_data: {
            ...SAMPLE_DATA,
            ...Object.fromEntries(availableVariables.map(v => [v, `[teste: ${v}]`])),
          },
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Teste enviado com sucesso! Status: ${data.status}`);
      } else {
        toast.error(`Falha no teste: ${data?.error || "Erro desconhecido"}`);
      }
    } catch (err: any) {
      toast.error("Erro ao testar: " + (err.message || "Falha na requisição"));
    }
    setTesting(false);
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addHeader = () => setHeaders([...headers, { key: "", value: "" }]);
  const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index));
  const updateHeader = (index: number, field: "key" | "value", val: string) => {
    const updated = [...headers];
    updated[index][field] = val;
    setHeaders(updated);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Webhook className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base truncate">Webhook de Conclusão</CardTitle>
          </div>
          <Switch
            checked={config.is_enabled}
            onCheckedChange={(checked) => setConfig({ ...config, is_enabled: checked })}
            className="shrink-0"
          />
        </div>
        <p className="text-sm text-muted-foreground break-words">
          Envie os dados coletados para um sistema externo ao final do fluxo
        </p>
      </CardHeader>

      {config.is_enabled && (
        <CardContent className="space-y-4 min-w-0">
          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="wh-desc">Descrição (opcional)</Label>
            <Input
              id="wh-desc"
              placeholder="Ex: Enviar lead para HubSpot"
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
            />
          </div>

          {/* URL + Method */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="w-full sm:w-28 shrink-0">
              <Label>Método</Label>
              <Select value={config.http_method} onValueChange={(v) => setConfig({ ...config, http_method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <Label htmlFor="wh-url">URL do Webhook</Label>
              <Input
                id="wh-url"
                placeholder="https://api.exemplo.com/webhook"
                value={config.webhook_url}
                onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
              />
            </div>
          </div>

          {/* Headers */}
          <Accordion type="single" collapsible>
            <AccordionItem value="headers" className="border-none">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                Headers ({headers.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {headers.map((h, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Input
                        placeholder="Header"
                        value={h.key}
                        onChange={(e) => updateHeader(i, "key", e.target.value)}
                        className="flex-1 min-w-0"
                      />
                      <Input
                        placeholder="Valor"
                        value={h.value}
                        onChange={(e) => updateHeader(i, "value", e.target.value)}
                        className="flex-1 min-w-0"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="shrink-0 self-end sm:self-auto">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addHeader} className="gap-1">
                    <Plus className="h-3 w-3" /> Adicionar header
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Variables bar */}
          <div className="space-y-1.5 min-w-0">
            <Label className="flex items-center gap-1">
              <Variable className="h-4 w-4" />
              Variáveis disponíveis
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SYSTEM_VARIABLES.map((v) => (
                <Badge
                  key={v.name}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors max-w-full"
                  onClick={() => insertVariable(v.name)}
                  title={v.label}
                >
                  <span className="truncate">{`{{${v.name}}}`}</span>
                </Badge>
              ))}
              {availableVariables.map((v) => (
                <Badge
                  key={v}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20 transition-colors max-w-full"
                  onClick={() => insertVariable(v)}
                >
                  <span className="truncate">{`{{${v}}}`}</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* JSON Template */}
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="wh-template">Template do Payload (JSON)</Label>
            <Textarea
              ref={textareaRef}
              id="wh-template"
              rows={10}
              className="font-mono text-xs"
              placeholder='{"campo": "{{variavel}}"}'
              value={config.payload_template}
              onChange={(e) => setConfig({ ...config, payload_template: e.target.value })}
            />
            <p className="text-xs text-muted-foreground break-words">
              Use <code className="bg-muted px-1 rounded break-all">{`{{variavel}}`}</code> para inserir dados coletados no fluxo
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? "Ocultar preview" : "Ver preview"}
              </Button>
              {showPreview && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleCopyPreview}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </div>
            {showPreview && (
              <pre className="p-3 rounded-md bg-muted/50 border text-xs font-mono overflow-auto max-h-60 max-w-full">
                <code className="text-foreground/80">{previewPayload}</code>
              </pre>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-1 w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar webhook
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !config.webhook_url} className="gap-1 w-full sm:w-auto">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Testar envio
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
