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
  BrainCircuit,
  Plus,
  Trash2,
  Loader2,
  Save,
  Send,
  Eye,
  Copy,
  Check,
  Variable,
  Clock,
  Webhook,
  Info,
  Server,
  MessageSquare,
  Phone,
  Shuffle,
  ArrowRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EvalAIMappingDialog } from "./EvalAIMappingDialog";

interface EvalVariable {
  name: string;
  description: string;
  type: string;
}

interface HeaderEntry {
  key: string;
  value: string;
}

interface EvalConfig {
  id?: string;
  is_enabled: boolean;
  silence_minutes: number;
  variables: EvalVariable[];
  custom_prompt: string;
  webhook_url: string;
  webhook_method: string;
  webhook_headers: Record<string, string>;
  webhook_payload_template: string;
  instance_id: string | null;
  whatsapp_enabled: boolean;
  whatsapp_phones: string[];
  whatsapp_distribution: "linear" | "random";
  max_tokens: number | null;
  eval_frequency: "silence_only" | "once_per_conversation" | "once_per_day" | "every_inbound";
}

const FREQUENCY_OPTIONS = [
  { value: "silence_only", label: "Apenas após silêncio", description: "Avalia 1× quando o cliente fica em silêncio (modo padrão)" },
  { value: "once_per_conversation", label: "Uma vez por conversa", description: "Apenas a primeira vez — nunca reavaliar" },
  { value: "once_per_day", label: "Uma vez por dia", description: "Limita a 1 avaliação a cada 24h por conversa" },
  { value: "every_inbound", label: "A cada nova mensagem", description: "Reavalia toda vez que o cliente enviar nova mensagem" },
] as const;

const MAX_TOKENS_PRESETS = [
  { value: null, label: "Sem limite", description: "A IA usa o necessário (pode consumir mais créditos)" },
  { value: 4096, label: "Padrão", description: "~2.500 palavras — suficiente para até 10 variáveis" },
  { value: 8192, label: "Extenso", description: "~5.000 palavras — para muitas variáveis ou resumos detalhados" },
  { value: 16384, label: "Máximo", description: "~10.000 palavras — para análises muito complexas" },
] as const;

interface InstanceOption {
  id: string;
  name: string;
}

const SYSTEM_VARIABLES = [
  { name: "resumo", label: "Resumo da conversa (gerado pela IA)" },
  { name: "sentimento", label: "Sentimento: positivo/negativo/neutro" },
  { name: "contactName", label: "Nome do contato" },
  { name: "contactPhone", label: "Telefone do contato" },
  { name: "conversationId", label: "ID da conversa" },
];

const VARIABLE_TYPES = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "booleano", label: "Sim/Não" },
  { value: "data", label: "Data" },
];

const DEFAULT_PAYLOAD = `{
  "resumo": "{{resumo}}",
  "sentimento": "{{sentimento}}",
  "contato": {
    "nome": "{{contactName}}",
    "telefone": "{{contactPhone}}"
  }
}`;

interface Props {
  organizationId: string;
  forcedInstanceId?: string;
  forcedInstanceName?: string;
}

export function ConversationEvalConfigCard({ organizationId, forcedInstanceId, forcedInstanceName }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInstanceLocked = !!forcedInstanceId;

  // Instance selector state
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(forcedInstanceId || "__global__");

  const [config, setConfig] = useState<EvalConfig>({
    is_enabled: false,
    silence_minutes: 60,
    variables: [],
    custom_prompt: "",
    webhook_url: "",
    webhook_method: "POST",
    webhook_headers: {},
    webhook_payload_template: DEFAULT_PAYLOAD,
    instance_id: null,
    whatsapp_enabled: false,
    whatsapp_phones: ["", "", ""],
    whatsapp_distribution: "linear",
    max_tokens: null,
    eval_frequency: "silence_only",
  });

  const [headers, setHeaders] = useState<HeaderEntry[]>([
    { key: "Content-Type", value: "application/json" },
  ]);

  const [silenceUnit, setSilenceUnit] = useState<"minutes" | "hours">("minutes");
  const [silenceValue, setSilenceValue] = useState(60);

  // Track which instances have saved configs
  const [configuredInstanceIds, setConfiguredInstanceIds] = useState<Set<string>>(new Set());

  // Load instances + detect which have saved configs
  useEffect(() => {
    async function loadInstances() {
      const [instancesRes, configsRes] = await Promise.all([
        supabase
          .from("instances")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name"),
        (supabase as any)
          .from("conversation_evaluation_configs")
          .select("instance_id")
          .eq("organization_id", organizationId),
      ]);

      if (instancesRes.data) setInstances(instancesRes.data);

      const configs = (configsRes.data || []) as { instance_id: string | null }[];
      const configuredIds = new Set<string>();
      let hasGlobal = false;
      for (const c of configs) {
        if (!c.instance_id) {
          hasGlobal = true;
          configuredIds.add("__global__");
        } else {
          configuredIds.add(c.instance_id);
        }
      }
      setConfiguredInstanceIds(configuredIds);

      // Auto-select first configured instance if no global config exists
      if (!forcedInstanceId && !hasGlobal && configs.length > 0) {
        const firstConfigured = configs.find(c => c.instance_id)?.instance_id;
        if (firstConfigured) setSelectedInstanceId(firstConfigured);
      }
    }
    loadInstances();
  }, [organizationId, forcedInstanceId]);

  useEffect(() => {
    if (forcedInstanceId) {
      setSelectedInstanceId(forcedInstanceId);
    }
  }, [forcedInstanceId]);

  // Load config based on selected instance
  useEffect(() => {
    async function load() {
      setLoading(true);
      const instanceId = selectedInstanceId === "__global__" ? null : selectedInstanceId;

      let query = (supabase as any)
        .from("conversation_evaluation_configs")
        .select("*")
        .eq("organization_id", organizationId);

      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      } else {
        query = query.is("instance_id", null);
      }

      const { data } = await query.maybeSingle();

      if (data) {
        const vars = (data.variables as EvalVariable[]) || [];
        const h = (data.webhook_headers as Record<string, string>) || {};
        const phones = (data.whatsapp_phones as string[]) || [];
        // Ensure always 3 slots
        const phonesArr = [phones[0] || "", phones[1] || "", phones[2] || ""];
        setConfig({
          id: data.id,
          is_enabled: data.is_enabled ?? false,
          silence_minutes: data.silence_minutes ?? 60,
          variables: vars,
          custom_prompt: data.custom_prompt || "",
          webhook_url: data.webhook_url || "",
          webhook_method: data.webhook_method || "POST",
          webhook_headers: h,
          webhook_payload_template: data.webhook_payload_template || DEFAULT_PAYLOAD,
          instance_id: data.instance_id || null,
          whatsapp_enabled: data.whatsapp_enabled ?? false,
          whatsapp_phones: phonesArr,
          whatsapp_distribution: data.whatsapp_distribution || "linear",
          max_tokens: data.max_tokens ?? null,
          eval_frequency: (data.eval_frequency as EvalConfig["eval_frequency"]) || "silence_only",
        });

        const mins = data.silence_minutes ?? 60;
        if (mins >= 60 && mins % 60 === 0) {
          setSilenceUnit("hours");
          setSilenceValue(mins / 60);
        } else {
          setSilenceUnit("minutes");
          setSilenceValue(mins);
        }

        const headerEntries = Object.entries(h).map(([key, value]) => ({ key, value: value as string }));
        if (headerEntries.length > 0) setHeaders(headerEntries);
        else setHeaders([{ key: "Content-Type", value: "application/json" }]);
      } else {
        // Reset to defaults for this instance
        setConfig({
          is_enabled: false,
          silence_minutes: 60,
          variables: [],
          custom_prompt: "",
          webhook_url: "",
          webhook_method: "POST",
          webhook_headers: {},
          webhook_payload_template: DEFAULT_PAYLOAD,
          instance_id: selectedInstanceId === "__global__" ? null : selectedInstanceId,
          whatsapp_enabled: false,
          whatsapp_phones: ["", "", ""],
          whatsapp_distribution: "linear",
          max_tokens: null,
          eval_frequency: "silence_only",
        });
        setHeaders([{ key: "Content-Type", value: "application/json" }]);
        setSilenceUnit("minutes");
        setSilenceValue(60);
      }
      setLoading(false);
    }
    load();
  }, [organizationId, selectedInstanceId, forcedInstanceId]);

  // Sync silence minutes
  useEffect(() => {
    const mins = silenceUnit === "hours" ? silenceValue * 60 : silenceValue;
    setConfig((prev) => ({ ...prev, silence_minutes: mins }));
  }, [silenceValue, silenceUnit]);

  // All available variable names for the template
  const allVariableNames = useMemo(() => {
    return [
      ...SYSTEM_VARIABLES.map((v) => v.name),
      ...config.variables.map((v) => v.name),
    ];
  }, [config.variables]);

  // Preview payload
  const previewPayload = useMemo(() => {
    let template = config.webhook_payload_template;
    const sampleData: Record<string, string> = {
      resumo: "Cliente interessado em alugar apartamento de 2 quartos na zona sul.",
      sentimento: "positivo",
      contactName: "Maria Silva",
      contactPhone: "5511999998888",
      conversationId: "conv-abc123",
    };
    for (const v of config.variables) {
      sampleData[v.name] = `[valor de ${v.name}]`;
    }
    for (const [key, val] of Object.entries(sampleData)) {
      template = template.split(`{{${key}}}`).join(val);
    }
    try {
      return JSON.stringify(JSON.parse(template), null, 2);
    } catch {
      return template;
    }
  }, [config.webhook_payload_template, config.variables]);

  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.webhook_payload_template;
    const insertion = `{{${varName}}}`;
    const newText = text.substring(0, start) + insertion + text.substring(end);
    setConfig({ ...config, webhook_payload_template: newText });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  // Variable management
  const addVariable = () => {
    setConfig({
      ...config,
      variables: [...config.variables, { name: "", description: "", type: "texto" }],
    });
  };

  const removeVariable = (index: number) => {
    setConfig({
      ...config,
      variables: config.variables.filter((_, i) => i !== index),
    });
  };

  const updateVariable = (index: number, field: keyof EvalVariable, value: string) => {
    const updated = [...config.variables];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "name") {
      updated[index].name = value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    }
    setConfig({ ...config, variables: updated });
  };

  // Headers
  const addHeader = () => setHeaders([...headers, { key: "", value: "" }]);
  const removeHeader = (i: number) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const updated = [...headers];
    updated[i][field] = val;
    setHeaders(updated);
  };

  const handleSave = async () => {
    const invalidVars = config.variables.filter((v) => !v.name.trim() || !v.description.trim());
    if (invalidVars.length > 0) {
      toast.error("Preencha nome e descrição de todas as variáveis");
      return;
    }

    setSaving(true);
    const headersObj = Object.fromEntries(headers.filter((h) => h.key.trim()).map((h) => [h.key, h.value]));
    const instanceId = selectedInstanceId === "__global__" ? null : selectedInstanceId;

    const whatsappPhones = config.whatsapp_phones.filter(Boolean);

    if (config.whatsapp_enabled && whatsappPhones.length > 0) {
      const phoneRegex = /^\+?\d{10,15}$/;
      const invalid = whatsappPhones.filter((p) => !phoneRegex.test(p.replace(/\D/g, "").replace(/^/, "+")) && !phoneRegex.test(p));
      if (invalid.length > 0) {
        toast.error(`Telefone inválido: ${invalid.join(", ")}. Use o formato +55 11 91234-5678.`);
        setSaving(false);
        return;
      }
    }

    if (config.silence_minutes < 1) {
      toast.error("Tempo de silêncio deve ser de pelo menos 1 minuto.");
      setSaving(false);
      return;
    }

    const payload: any = {
      organization_id: organizationId,
      instance_id: instanceId,
      is_enabled: config.is_enabled,
      silence_minutes: config.silence_minutes,
      variables: config.variables,
      custom_prompt: config.custom_prompt || null,
      webhook_url: config.webhook_url || null,
      webhook_method: config.webhook_method,
      webhook_headers: headersObj,
      webhook_payload_template: config.webhook_payload_template || null,
      whatsapp_enabled: config.whatsapp_enabled,
      whatsapp_phones: whatsappPhones,
      whatsapp_distribution: config.whatsapp_distribution,
      max_tokens: config.max_tokens,
      eval_frequency: config.eval_frequency,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (config.id) {
      ({ error } = await (supabase as any)
        .from("conversation_evaluation_configs")
        .update(payload)
        .eq("id", config.id));
    } else {
      const { data, error: insertError } = await (supabase as any)
        .from("conversation_evaluation_configs")
        .insert(payload)
        .select()
        .single();
      error = insertError;
      if (data) setConfig((prev) => ({ ...prev, id: data.id }));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configuração de avaliação salva!");
      // Update configured indicators
      setConfiguredInstanceIds(prev => {
        const next = new Set(prev);
        next.add(selectedInstanceId);
        return next;
      });
    }
  };

  const handleTestWebhook = async () => {
    if (!config.webhook_url.trim()) {
      toast.error("Informe a URL do webhook");
      return;
    }
    setTesting(true);
    try {
      const headersObj = Object.fromEntries(headers.filter((h) => h.key.trim()).map((h) => [h.key, h.value]));
      if (!headersObj["Content-Type"]) headersObj["Content-Type"] = "application/json";

      let payload = config.webhook_payload_template || "{}";
      const testData: Record<string, string> = {
        resumo: "[TESTE] Resumo gerado pela IA sobre a conversa.",
        sentimento: "positivo",
        contactName: "Contato Teste",
        contactPhone: "5511999990000",
        conversationId: "test-conv-id",
      };
      for (const v of config.variables) {
        testData[v.name] = `[teste: ${v.name}]`;
      }
      for (const [key, val] of Object.entries(testData)) {
        payload = payload.split(`{{${key}}}`).join(val);
      }

      const { data: proxyResult, error: proxyError } = await supabase.functions.invoke("test-eval-webhook", {
        body: {
          webhook_url: config.webhook_url,
          method: config.webhook_method || "POST",
          headers: headersObj,
          body: payload,
        },
      });

      if (proxyError) throw proxyError;

      if (proxyResult?.ok) {
        toast.success(`Teste enviado com sucesso! Status: ${proxyResult.status}`);
      } else {
        toast.error(`Falha no teste: ${proxyResult?.status} ${proxyResult?.statusText}`);
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
            <BrainCircuit className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base truncate">Avaliação Automática por IA</CardTitle>
          </div>
          <Switch
            checked={config.is_enabled}
            onCheckedChange={async (checked) => {
              setConfig((prev) => ({ ...prev, is_enabled: checked }));
              // Auto-persist toggle so disabling actually turns the feature off without needing Save
              if (config.id) {
                const { error } = await (supabase as any)
                  .from("conversation_evaluation_configs")
                  .update({ is_enabled: checked, updated_at: new Date().toISOString() })
                  .eq("id", config.id);
                if (error) {
                  toast.error("Erro ao alterar status: " + error.message);
                  setConfig((prev) => ({ ...prev, is_enabled: !checked }));
                } else {
                  toast.success(checked ? "Avaliação ativada" : "Avaliação desativada");
                }
              }
            }}
            className="shrink-0"
          />
        </div>
        <p className="text-sm text-muted-foreground break-words">
          Analisa conversas em silêncio e extrai dados automaticamente para enviar via webhook
        </p>
      </CardHeader>

      {/* Instance Selector */}
      <CardContent className="pb-3 pt-0">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-sm">
            <Server className="h-4 w-4" />
            Instância
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                  Configure uma avaliação por instância para extrair informações específicas de cada número.
                  "Todas" funciona como fallback global.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          {isInstanceLocked ? (
            <>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {forcedInstanceName || instances.find((inst) => inst.id === selectedInstanceId)?.name || "Instância atual"}
                </span>
                {configuredInstanceIds.has(selectedInstanceId) && <span className="text-xs">✅</span>}
              </div>
              <p className="text-xs text-muted-foreground italic">
                Esta configuração está isolada para a instância atual.
              </p>
            </>
          ) : (
            <>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">
                    📌 Todas as instâncias (global) {configuredInstanceIds.has("__global__") ? "✅" : ""}
                  </SelectItem>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name} {configuredInstanceIds.has(inst.id) ? "✅" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInstanceId !== "__global__" && !config.id && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma configuração para esta instância. Configure e salve para criar uma dedicada.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>

      {config.is_enabled && (
        <CardContent className="space-y-6 min-w-0 pt-0">
          {/* Timer de Silêncio */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Timer de Silêncio
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">
                    Tempo sem interação para considerar a conversa finalizada e disparar a análise
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="number"
                min={1}
                value={silenceValue}
                onChange={(e) => setSilenceValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full sm:w-24"
              />
              <Select value={silenceUnit} onValueChange={(v: "minutes" | "hours") => setSilenceUnit(v)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              A IA será acionada após{" "}
              <strong>
                {config.silence_minutes >= 60
                  ? `${config.silence_minutes / 60}h`
                  : `${config.silence_minutes}min`}
              </strong>{" "}
              sem novas mensagens
            </p>
          </div>

          {/* Frequência de Avaliação */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Shuffle className="h-4 w-4" />
              Frequência de Avaliação
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    Define quando a IA deve reavaliar uma conversa após a primeira análise
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.eval_frequency}
              onValueChange={(v: EvalConfig["eval_frequency"]) =>
                setConfig({ ...config, eval_frequency: v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {config.id && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className="text-xs border-primary/40 text-primary bg-primary/5">
                  Frequência ativa no servidor:{" "}
                  {FREQUENCY_OPTIONS.find((o) => o.value === config.eval_frequency)?.label || config.eval_frequency}
                </Badge>
                {selectedInstanceId !== "__global__" && configuredInstanceIds.has("__global__") && (
                  <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-500 bg-amber-500/5">
                    Esta organização também tem config global ativa — a config por instância prevalece.
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Parametrizador de Variáveis */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5">
              <Variable className="h-4 w-4" />
              Variáveis para Extração
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    Defina quais informações a IA deve buscar na conversa. Ex: "interesse", "orçamento", "disponibilidade"
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>

            <div className="space-y-2">
              {config.variables.map((v, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Input
                      placeholder="nome_variavel"
                      value={v.name}
                      onChange={(e) => updateVariable(i, "name", e.target.value)}
                      className="font-mono text-sm"
                    />
                    <Input
                      placeholder="Descrição: o que a IA deve buscar"
                      value={v.description}
                      onChange={(e) => updateVariable(i, "description", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-start gap-2 sm:flex-col">
                    <Select
                      value={v.type}
                      onValueChange={(val) => updateVariable(i, "type", val)}
                    >
                      <SelectTrigger className="w-full sm:w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VARIABLE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariable(i)}
                      className="shrink-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addVariable} className="gap-1">
              <Plus className="h-3 w-3" /> Adicionar variável
            </Button>

            {config.variables.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Nenhuma variável configurada. A IA retornará apenas resumo e sentimento.
              </p>
            )}
          </div>

          {/* Prompt Personalizado */}
          <div className="space-y-1.5">
            <Label htmlFor="eval-prompt">Instruções extras para a IA (opcional)</Label>
            <Textarea
              id="eval-prompt"
              rows={3}
              placeholder="Ex: Foque em identificar se o cliente tem urgência na compra..."
              value={config.custom_prompt}
              onChange={(e) => setConfig({ ...config, custom_prompt: e.target.value })}
              className="text-sm"
            />
          </div>

          {/* Limite de Tokens da IA */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <BrainCircuit className="h-4 w-4" />
              Limite de resposta da IA
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    Controla o tamanho máximo da resposta da IA. Valores maiores permitem extrair mais variáveis mas consomem mais créditos.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MAX_TOKENS_PRESETS.map((preset) => {
                const isSelected = config.max_tokens === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setConfig({ ...config, max_tokens: preset.value })}
                    className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm font-medium">{preset.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{preset.description}</span>
                    {preset.value && (
                      <Badge variant="secondary" className="mt-1 text-xs px-1.5 py-0">
                        {preset.value.toLocaleString()} tokens
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {config.max_tokens
                ? `Limite atual: ${config.max_tokens.toLocaleString()} tokens (~${Math.round(config.max_tokens * 0.6).toLocaleString()} palavras)`
                : "Sem limite definido — a IA usará o necessário (padrão: 8192 tokens)"}
            </p>
          </div>

          {/* Delivery Section Header */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-base font-medium">Canais de Entrega</Label>
            <p className="text-xs text-muted-foreground">
              Escolha como receber os dados extraídos: via webhook, WhatsApp ou ambos.
            </p>
          </div>

          {/* WhatsApp Delivery Section */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                Enviar via WhatsApp
              </Label>
              <Switch
                checked={config.whatsapp_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, whatsapp_enabled: checked })}
              />
            </div>

            {config.whatsapp_enabled && (
              <div className="space-y-4">
                {/* Distribution Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Shuffle className="h-3.5 w-3.5" />
                    Modo de Distribuição
                  </Label>
                  <Select
                    value={config.whatsapp_distribution}
                    onValueChange={(v: "linear" | "random") =>
                      setConfig({ ...config, whatsapp_distribution: v })
                    }
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">
                        <span className="flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5" /> Linear (1→2→3→1...)
                        </span>
                      </SelectItem>
                      <SelectItem value="random">
                        <span className="flex items-center gap-1.5">
                          <Shuffle className="h-3.5 w-3.5" /> Aleatório
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {config.whatsapp_distribution === "linear"
                      ? "Envia em ordem sequencial: 1º, 2º, 3º e repete"
                      : "Envia para um número aleatório a cada avaliação"}
                  </p>
                </div>

                {/* Phone Numbers */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Telefones de Destino (até 3)
                  </Label>
                  {config.whatsapp_phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}.</span>
                      <Input
                        placeholder="5511999998888"
                        value={phone}
                        onChange={(e) => {
                          const updated = [...config.whatsapp_phones];
                          updated[idx] = e.target.value.replace(/\D/g, "");
                          setConfig({ ...config, whatsapp_phones: updated });
                        }}
                        className="font-mono text-sm"
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (ex: 5511999998888)
                  </p>
                </div>

                {/* Preview */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Prévia da mensagem</Label>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs whitespace-pre-wrap text-foreground/80">
                    {`📊 *AVALIAÇÃO AUTOMÁTICA - IA*\n\n👤 *Contato:* Maria Silva\n📱 *Telefone:* 5511999998888\n\n📝 *RESUMO*\nCliente interessado em alugar apartamento.\n\n🟢 *Sentimento:* positivo\n\n📋 *DADOS EXTRAÍDOS*\n${config.variables.length > 0
                      ? config.variables.map(v => `• *${v.name}:* [valor extraído]`).join("\n")
                      : "• (nenhuma variável configurada)"}`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Webhook Section */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Webhook className="h-4 w-4" />
              Webhook de Saída
            </Label>

            {/* URL + Method */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-full sm:w-28 shrink-0">
                <Label>Método</Label>
                <Select
                  value={config.webhook_method}
                  onValueChange={(v) => setConfig({ ...config, webhook_method: v })}
                >
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
                <Label>URL do Webhook</Label>
                <Input
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
                {config.variables
                  .filter((v) => v.name)
                  .map((v) => (
                    <Badge
                      key={v.name}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary/20 transition-colors max-w-full"
                      onClick={() => insertVariable(v.name)}
                      title={v.description}
                    >
                      <span className="truncate">{`{{${v.name}}}`}</span>
                    </Badge>
                  ))}
              </div>
            </div>

            {/* Payload Template */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <Label>Template do Payload (JSON)</Label>
                <EvalAIMappingDialog
                  variables={config.variables}
                  onApplyTemplate={(template) =>
                    setConfig({ ...config, webhook_payload_template: template })
                  }
                />
              </div>
              <Textarea
                ref={textareaRef}
                rows={10}
                className="font-mono text-xs"
                placeholder='{"campo": "{{variavel}}"}'
                value={config.webhook_payload_template}
                onChange={(e) =>
                  setConfig({ ...config, webhook_payload_template: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground break-words">
                Use <code className="bg-muted px-1 rounded break-all">{`{{variavel}}`}</code> para
                inserir dados extraídos pela IA. Ou clique em{" "}
                <strong>"Gerar com IA"</strong> para criar o template automaticamente.
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

            {/* Test */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestWebhook}
              disabled={testing || !config.webhook_url}
              className="gap-1"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Testar envio
            </Button>
          </div>

          {/* Save */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="gap-1 w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
