import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Zap, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FieldSelector } from "@/components/connectors/FieldSelector";
import { PayloadPreview } from "@/components/connectors/PayloadPreview";
import { InteractionEditor, ConnectorInteraction, FieldMapping } from "@/components/connectors/InteractionEditor";
import { useWebhookUrls } from "@/hooks/useWebhookUrls";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

// Legacy interface for backward compatibility
interface MessageConfig {
  type: "fixed" | "ai";
  template?: string;
  ai_prompt?: string;
}

interface ConnectorFormData {
  name: string;
  description: string;
  source_type: string;
  webhook_token: string;
  sample_payload: Record<string, unknown> | null;
  field_mappings: FieldMapping[];
  message_config: MessageConfig; // Legacy, kept for compatibility
  interactions: ConnectorInteraction[]; // New: array of interactions
  target_phone_field: string;
}

const SOURCE_OPTIONS = [
  { value: "kiwify", label: "Kiwify", description: "Plataforma de vendas de produtos digitais" },
  { value: "hotmart", label: "Hotmart", description: "Maior plataforma de produtos digitais do Brasil" },
  { value: "eduzz", label: "Eduzz", description: "Plataforma de infoprodutos" },
  { value: "monetizze", label: "Monetizze", description: "Plataforma de afiliados" },
  { value: "custom", label: "Personalizado", description: "Qualquer outro serviço que envie webhooks" },
];

function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

export default function ConnectorWizard() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waitingForPayload, setWaitingForPayload] = useState(false);
  
  const [formData, setFormData] = useState<ConnectorFormData>({
    name: "",
    description: "",
    source_type: "custom",
    webhook_token: generateToken(),
    sample_payload: null,
    field_mappings: [],
    message_config: { type: "fixed", template: "" },
    interactions: [],
    target_phone_field: "",
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { getConnectorUrl } = useWebhookUrls();
  const { effectiveUserId } = useEffectiveUserId();
  const webhookUrl = getConnectorUrl(formData.webhook_token);

  // Load existing connector if editing
  useEffect(() => {
    if (isEditing && user) {
      loadConnector();
    }
  }, [isEditing, user]);

  // Subscribe to realtime updates for payload discovery via connector_events table
  // (connector_events has Realtime enabled, webhook_connectors does not)
  useEffect(() => {
    if (!waitingForPayload || !id) return;

    const channel = supabase
      .channel(`connector-discovery-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "connector_events",
          filter: `connector_id=eq.${id}`,
        },
        async (payload) => {
          const newEvent = payload.new as { status?: string };
          
          // If it's a discovery event, fetch the updated sample_payload
          if (newEvent.status === 'discovery') {
            const { data } = await supabase
              .from("webhook_connectors")
              .select("sample_payload")
              .eq("id", id)
              .single();
            
            if (data?.sample_payload) {
              setFormData(prev => ({ 
                ...prev, 
                sample_payload: data.sample_payload as Record<string, unknown> 
              }));
              setWaitingForPayload(false);
              toast({
                title: "Payload recebido!",
                description: "Agora você pode selecionar os campos que deseja utilizar.",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [waitingForPayload, id, toast]);

  async function loadConnector() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_connectors")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        // Parse interactions or migrate from legacy message_config
        let interactions: ConnectorInteraction[] = [];
        const rawInteractions = data.interactions as unknown;
        const rawMessageConfig = data.message_config as unknown as MessageConfig | null;
        
        if (Array.isArray(rawInteractions) && rawInteractions.length > 0) {
          interactions = rawInteractions as ConnectorInteraction[];
        } else if (rawMessageConfig && (rawMessageConfig.template || rawMessageConfig.ai_prompt)) {
          // Migrate legacy message_config to interactions
          interactions = [{
            id: crypto.randomUUID(),
            order_index: 0,
            type: "text",
            text_mode: rawMessageConfig.type,
            template: rawMessageConfig.template,
            ai_prompt: rawMessageConfig.ai_prompt,
            delay_ms: 0,
          }];
        }

        setFormData({
          name: data.name || "",
          description: data.description || "",
          source_type: data.source_type || "custom",
          webhook_token: data.webhook_token || generateToken(),
          sample_payload: data.sample_payload as unknown as Record<string, unknown> | null,
          field_mappings: (data.field_mappings as unknown as FieldMapping[]) || [],
          message_config: rawMessageConfig || { type: "fixed", template: "" },
          interactions,
          target_phone_field: data.target_phone_field || "",
        });
        
        // If already has sample payload, skip to step 3
        if (data.sample_payload) {
          setStep(3);
        } else if (data.name) {
          setStep(2);
        }
      }
    } catch (error) {
      console.error("Error loading connector:", error);
      toast({
        title: "Erro ao carregar conector",
        variant: "destructive",
      });
      navigate("/connectors");
    } finally {
      setLoading(false);
    }
  }

  async function saveConnector(finalSave = false) {
    if (!user) return;
    
    setSaving(true);
    try {
      const payload = {
        user_id: effectiveUserId || user.id,
        name: formData.name,
        description: formData.description || null,
        source_type: formData.source_type,
        webhook_token: formData.webhook_token,
        sample_payload: formData.sample_payload as unknown,
        field_mappings: formData.field_mappings.length > 0 ? formData.field_mappings as unknown : null,
        // Keep message_config for backward compatibility (first text interaction)
        message_config: formData.interactions.length > 0 && formData.interactions[0].type === "text"
          ? {
              type: formData.interactions[0].text_mode,
              template: formData.interactions[0].template,
              ai_prompt: formData.interactions[0].ai_prompt,
            } as unknown
          : null,
        // New interactions array
        interactions: formData.interactions.length > 0 ? formData.interactions as unknown : null,
        target_phone_field: formData.target_phone_field || null,
        is_active: finalSave,
      };

      if (isEditing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase
          .from("webhook_connectors")
          .update(payload as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await supabase
          .from("webhook_connectors")
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        
        // Navigate to edit mode with new ID
        if (data && !finalSave) {
          navigate(`/connectors/${data.id}`, { replace: true });
        }
      }

      if (finalSave) {
        toast({ title: "Conector salvo com sucesso!" });
        navigate("/connectors");
      }
    } catch (error) {
      console.error("Error saving connector:", error);
      toast({
        title: "Erro ao salvar conector",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL copiada!" });
  }

  async function startDiscovery() {
    await saveConnector(false);
    setWaitingForPayload(true);
    toast({
      title: "Aguardando webhook...",
      description: "Envie um webhook de teste da sua plataforma.",
    });
  }

  function handleFieldSelect(path: string, label: string, selected: boolean) {
    setFormData(prev => {
      if (selected) {
        return {
          ...prev,
          field_mappings: [...prev.field_mappings, { path, label }],
        };
      } else {
        return {
          ...prev,
          field_mappings: prev.field_mappings.filter(m => m.path !== path),
        };
      }
    });
  }

  function handleInteractionsChange(interactions: ConnectorInteraction[]) {
    setFormData(prev => ({ ...prev, interactions }));
  }

  const canProceedStep1 = formData.name.trim().length > 0;
  const canProceedStep2 = formData.sample_payload !== null;
  const canProceedStep3 = formData.field_mappings.length > 0 && formData.target_phone_field;
  const canProceedStep4 = formData.interactions.length > 0;

  if (loading) {
    return (
      <AppLayout title={isEditing ? "Editar Conector" : "Novo Conector"} description={`Passo ${step} de 5`}>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-24" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Skeleton key={s} className="h-2 flex-1 rounded-full" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={isEditing ? "Editar Conector" : "Novo Conector"} description={`Passo ${step} de 5`}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/connectors")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {/* Progress */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(s => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Dê um nome ao seu conector e selecione a plataforma de origem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Conector *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Vendas Kiwify"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o propósito deste conector..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <Label>Plataforma de Origem</Label>
                <RadioGroup
                  value={formData.source_type}
                  onValueChange={v => setFormData(prev => ({ ...prev, source_type: v }))}
                  className="grid gap-3"
                >
                  {SOURCE_OPTIONS.map(option => (
                    <Label
                      key={option.value}
                      htmlFor={option.value}
                      className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        formData.source_type === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={option.value} id={option.value} />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Webhook URL & Discovery */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Capturar Webhook</CardTitle>
              <CardDescription>
                Configure a URL do webhook na sua plataforma e envie um teste
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" onClick={copyWebhookUrl} className="w-full sm:w-auto shrink-0">
                    <Copy className="h-4 w-4 mr-2 sm:mr-0" />
                    <span className="sm:hidden">Copiar URL</span>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Copie esta URL e configure na sua plataforma ({SOURCE_OPTIONS.find(s => s.value === formData.source_type)?.label})
                </p>
              </div>

              <div className="border rounded-lg p-6 space-y-4">
                {waitingForPayload ? (
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <div>
                      <h4 className="font-medium">Aguardando webhook...</h4>
                      <p className="text-sm text-muted-foreground">
                        Envie um webhook de teste da sua plataforma
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setWaitingForPayload(false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : formData.sample_payload ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Payload recebido com sucesso!</span>
                    </div>
                    <PayloadPreview payload={formData.sample_payload} />
                    <Button variant="outline" onClick={() => {
                      setFormData(prev => ({ ...prev, sample_payload: null }));
                      startDiscovery();
                    }}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Receber novo payload
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="rounded-full bg-muted p-4 w-fit mx-auto">
                      <Zap className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">Pronto para receber</h4>
                      <p className="text-sm text-muted-foreground">
                        Clique no botão abaixo e depois envie um webhook da sua plataforma
                      </p>
                    </div>
                    <Button onClick={startDiscovery} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                      Iniciar Captura
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Field Selection */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Campos</CardTitle>
              <CardDescription>
                Clique nos campos que você deseja utilizar na mensagem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.sample_payload && (
                <>
                  <FieldSelector
                    payload={formData.sample_payload}
                    selectedFields={formData.field_mappings}
                    onFieldSelect={handleFieldSelect}
                  />

                  <div className="space-y-2">
                    <Label>Campo do Telefone *</Label>
                    <Select
                      value={formData.target_phone_field}
                      onValueChange={v => setFormData(prev => ({ ...prev, target_phone_field: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o campo com o número de telefone" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.field_mappings.map(field => (
                          <SelectItem key={field.path} value={field.path}>
                            {field.label} ({field.path})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Este campo será usado como número de destino da mensagem
                    </p>
                  </div>

                  {formData.field_mappings.length > 0 && (
                    <div className="space-y-2">
                      <Label>Campos Selecionados</Label>
                      <div className="flex flex-wrap gap-2">
                        {formData.field_mappings.map(field => (
                          <Badge key={field.path} variant="secondary">
                            {field.label}
                            {field.path === formData.target_phone_field && (
                              <span className="ml-1 text-primary">📱</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Interactions Configuration */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Configurar Interações</CardTitle>
              <CardDescription>
                Configure as mensagens e arquivos que serão enviados quando o webhook for recebido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InteractionEditor
                interactions={formData.interactions}
                fieldMappings={formData.field_mappings}
                samplePayload={formData.sample_payload}
                onInteractionsChange={handleInteractionsChange}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review & Test */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Revisão Final</CardTitle>
              <CardDescription>
                Revise as configurações e ative o conector
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Nome</span>
                    <span className="font-medium min-w-0 truncate">{formData.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Plataforma</span>
                    <span className="font-medium min-w-0 truncate">
                      {SOURCE_OPTIONS.find(s => s.value === formData.source_type)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Campos</span>
                    <span className="font-medium">{formData.field_mappings.length} selecionados</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Interações</span>
                    <span className="font-medium">{formData.interactions.length} configuradas</span>
                  </div>
                </div>

                {/* Preview of interactions */}
                {formData.interactions.length > 0 && (
                  <div className="p-4 border rounded-lg space-y-3">
                    <Label className="text-xs text-muted-foreground">Sequência de Interações</Label>
                    {formData.interactions.map((interaction, index) => (
                      <div key={interaction.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">
                          {interaction.type === "file" ? "📎 Arquivo" : "💬 Texto"}
                          {interaction.type === "text" && interaction.text_mode === "ai" && " (IA)"}
                        </span>
                        {interaction.delay_ms > 0 && (
                          <span className="text-muted-foreground">
                            ⏱ {interaction.delay_ms / 1000}s
                          </span>
                        )}
                        {index === formData.interactions.length - 1 && (
                          <Badge className="bg-success text-success-foreground text-xs">Última</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          {step < 5 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !canProceedStep3) ||
                (step === 4 && !canProceedStep4)
              }
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => saveConnector(true)} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Salvar e Ativar
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// Helper function to get nested value
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}
