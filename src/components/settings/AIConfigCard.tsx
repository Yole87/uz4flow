import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Brain, Eye, EyeOff, Loader2, CheckCircle2, XCircle, ExternalLink, Key, Trash2 } from "lucide-react";

type Provider = "gemini" | "openai";

interface AIConfig {
  id: string;
  organization_id: string;
  provider: Provider;
  has_key: boolean;
  has_gemini_key: boolean;
  has_openai_key: boolean;
  masked_key: string | null;
  default_model: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const MODEL_OPTIONS: Record<Provider, { value: string; label: string; description: string }[]> = {
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Equilibrado — bom para a maioria dos casos" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Mais rápido e barato, ideal para tarefas simples" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Mais preciso, ideal para análises complexas" },
  ],
  openai: [
    { value: "gpt-5-mini", label: "GPT-5 Mini", description: "Equilibrado — bom para a maioria dos casos" },
    { value: "gpt-5-nano", label: "GPT-5 Nano", description: "Mais rápido e barato, ideal para tarefas simples" },
    { value: "gpt-5", label: "GPT-5", description: "Mais preciso, ideal para análises complexas" },
    { value: "gpt-4.1", label: "GPT-4.1", description: "Versão mais recente do GPT-4 — alta precisão" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", description: "GPT-4.1 reduzido — bom custo-benefício" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano", description: "GPT-4.1 ultra-rápido para tarefas simples" },
    { value: "gpt-4o", label: "GPT-4o", description: "GPT-4 multimodal — ótimo equilíbrio entre custo e qualidade" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "GPT-4 econômico — rápido e versátil" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "Geração anterior, ainda robusta para tarefas gerais" },
  ],
};

const PROVIDER_INFO: Record<Provider, { name: string; placeholder: string; helpUrl: string; helpText: string }> = {
  gemini: {
    name: "Google Gemini",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpText: "Como obter uma chave API no Google AI Studio",
  },
  openai: {
    name: "OpenAI (GPT)",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Como obter uma chave API na plataforma OpenAI",
  },
};

export function AIConfigCard() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("gemini");
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const { data: config, isLoading } = useQuery<AIConfig | null>({
    queryKey: ["ai-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-ai-config", {
        method: "GET",
      });
      if (error) throw error;
      return data?.config || null;
    },
  });

  // Sync provider state with backend config
  useEffect(() => {
    if (config?.provider) {
      setSelectedProvider(config.provider);
    }
  }, [config?.provider]);

  const saveMutation = useMutation({
    mutationFn: async (params: { api_key?: string; default_model?: string; is_active?: boolean; provider?: Provider }) => {
      const { data, error } = await supabase.functions.invoke("manage-ai-config", {
        body: { action: "save", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("Configuração salva com sucesso!");
      setApiKey("");
      setEditing(false);
      setTestResult(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao salvar configuração");
    },
  });

  const testMutation = useMutation({
    mutationFn: async (params: { api_key?: string; provider?: Provider }) => {
      const { data, error } = await supabase.functions.invoke("manage-ai-config", {
        body: { action: "test", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao testar conexão");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-ai-config", {
        body: { action: "delete" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("Configuração removida");
      setApiKey("");
      setEditing(false);
      setTestResult(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao remover configuração");
    },
  });

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      toast.error("Insira uma chave API válida");
      return;
    }
    saveMutation.mutate({
      api_key: apiKey.trim(),
      provider: selectedProvider,
      is_active: true,
    });
  };

  const handleToggleActive = (active: boolean) => {
    saveMutation.mutate({ is_active: active });
  };

  const handleModelChange = (model: string) => {
    saveMutation.mutate({ default_model: model });
  };

  const handleProviderChange = (provider: Provider) => {
    setSelectedProvider(provider);
    setTestResult(null);
    // If a provider switch happens after a key already exists, persist the change immediately
    if (config && provider !== config.provider) {
      saveMutation.mutate({ provider });
    }
  };

  const startEditing = () => {
    setEditing(true);
    setApiKey("");
    setTestResult(null);
  };

  const cancelEditing = () => {
    setEditing(false);
    setApiKey("");
    setTestResult(null);
  };

  if (isLoading) {
    return (
      <Card className="quantum-glass border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const providerInfo = PROVIDER_INFO[selectedProvider];
  const isInputMode = !config?.has_key || editing;

  return (
    <Card className="quantum-glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Inteligência Artificial</CardTitle>
              <CardDescription>
                Escolha o provedor e conecte sua chave API para usar IA em todos os recursos do sistema
              </CardDescription>
            </div>
          </div>
          {config?.has_key && (
            <Badge variant={config.is_active ? "default" : "secondary"} className="gap-1">
              {config.is_active ? (
                <><CheckCircle2 className="h-3 w-3" /> Conectado</>
              ) : (
                <><XCircle className="h-3 w-3" /> Desativado</>
              )}
            </Badge>
          )}
          {!config?.has_key && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Key className="h-3 w-3" /> Não configurado
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-3">
          <Label>Provedor de IA</Label>
          <Select
            value={selectedProvider}
            onValueChange={(v) => handleProviderChange(v as Provider)}
            disabled={saveMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">
                <div className="flex flex-col">
                  <span>Google Gemini</span>
                  <span className="text-xs text-muted-foreground">Modelos Gemini 2.5 (Flash, Lite, Pro)</span>
                </div>
              </SelectItem>
              <SelectItem value="openai">
                <div className="flex flex-col">
                  <span>OpenAI (GPT)</span>
                  <span className="text-xs text-muted-foreground">Modelos GPT-5 e GPT-4 (o, o-mini, Turbo)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* API Key Section */}
        <div className="space-y-3">
          <Label htmlFor="ai-key">Chave API do {providerInfo.name}</Label>

          {!isInputMode && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm text-foreground">{config!.masked_key}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8"
                onClick={startEditing}
              >
                Alterar
              </Button>
            </div>
          )}

          {isInputMode && (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="ai-key"
                  type={showKey ? "text" : "password"}
                  placeholder={providerInfo.placeholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono"
                  autoComplete="off"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim() || saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar chave
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testMutation.mutate({
                    api_key: apiKey.trim() || undefined,
                    provider: selectedProvider,
                  })}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Testar conexão
                </Button>
                {config?.has_key && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEditing}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className={`p-3 rounded-lg text-sm ${testResult.success ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30"}`}>
              {testResult.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  {testResult.message}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  {testResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Model Selection */}
        {config?.has_key && (
          <>
            <div className="space-y-3">
              <Label>Modelo padrão</Label>
              <Select
                value={config.default_model}
                onValueChange={handleModelChange}
                disabled={saveMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS[selectedProvider].map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Activation Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div>
                <p className="font-medium text-sm">Ativar integração</p>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, todos os recursos de IA usarão sua chave {providerInfo.name}
                </p>
              </div>
              <Switch
                checked={config.is_active}
                onCheckedChange={handleToggleActive}
                disabled={saveMutation.isPending}
              />
            </div>

            {/* Test existing key & remove */}
            {!isInputMode && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testMutation.mutate({ provider: selectedProvider })}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Testar conexão
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Deseja realmente remover a chave API? Isso afetará todos os recursos de IA.")) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remover
                </Button>
              </div>
            )}
          </>
        )}

        {/* Help Link */}
        <div className="pt-2 border-t border-border/50">
          <a
            href={providerInfo.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            {providerInfo.helpText}
          </a>
          <p className="text-xs text-muted-foreground mt-1">
            A chave é armazenada com criptografia AES-256 e usada em: Assistente LIA, Análise de conversas,
            Avaliação por IA, Transcrição de áudio, Sugestões de texto e Conectores.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
