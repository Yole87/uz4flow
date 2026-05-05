import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Phone, Save, Loader2, Check, AlertCircle, Info, Key, Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function VapiConfigCard() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [defaultVoice, setDefaultVoice] = useState("");
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [voiceEdited, setVoiceEdited] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["vapi-config"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ action: "get-config" }),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch config");
      const result = await response.json();
      return result;
    },
  });

  // Populate fields from config when loaded
  useEffect(() => {
    if (config && !configLoaded) {
      if (config.phone_number_id) setPhoneNumberId(config.phone_number_id);
      if (config.default_voice && config.default_voice !== "pt-BR-female") setDefaultVoice(config.default_voice);
      setConfigLoaded(true);
    }
  }, [config, configLoaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            action: "save-config",
            vapi_api_key: apiKey || undefined,
            vapi_phone_number_id: phoneNumberId || undefined,
            vapi_default_voice: defaultVoice || undefined,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vapi-config"] });
      setApiKey("");
      setPhoneEdited(false);
      setVoiceEdited(false);
      setConfigLoaded(false);
      toast.success("Configuração do Vapi salva!");
    },
    onError: () => {
      toast.error("Erro ao salvar configuração");
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-accent/20">
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
    <Card className="bg-card/50 border-accent/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-accent" />
            <CardTitle className="text-foreground text-base sm:text-lg">Voice AI (Vapi)</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={
              config?.configured
                ? "border-emerald-500/50 text-emerald-500"
                : "border-muted text-muted-foreground"
            }
          >
            {config?.configured ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Configurado
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Não configurado
              </>
            )}
          </Badge>
        </div>
        <CardDescription className="text-muted-foreground">
          Configure o Vapi para fazer ligações com IA diretamente do CRM.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* API Key */}
        <div className="space-y-2">
          <Label className="text-foreground flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            Private API Key do Vapi
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-card border-border">
                <p>Encontre sua API Key em dashboard.vapi.ai → Account → API Keys</p>
              </TooltipContent>
            </Tooltip>
          </Label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              placeholder={config?.configured ? "••••••• (salva)" : "Cole sua API Key aqui"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-muted border-border text-foreground pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Phone Number ID */}
        <div className="space-y-2">
          <Label className="text-foreground flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            Phone Number ID
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-card border-border">
                <p>Copie o ID do número importado do Twilio no dashboard do Vapi (dashboard.vapi.ai → Phone Numbers → clique no número → copie o ID).</p>
              </TooltipContent>
            </Tooltip>
          </Label>
          <Input
            type="text"
            placeholder="Ex: abc123-def456..."
            value={phoneNumberId}
            onChange={(e) => {
              setPhoneEdited(true);
              setPhoneNumberId(e.target.value);
            }}
            className="bg-muted border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Este é o ID do número no Vapi, não o número de telefone em si.
          </p>
        </div>

        {/* Default Voice */}
        <div className="space-y-2">
          <Label className="text-foreground flex items-center gap-2">
            Voice ID (Biblioteca Vapi)
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-card border-border">
                <p>Encontre o Voice ID no dashboard do Vapi em Voices. O Vapi inclui vozes de diversos provedores (ElevenLabs, PlayHT, etc) sem precisar de conta separada.</p>
              </TooltipContent>
            </Tooltip>
          </Label>
          <Input
            type="text"
            placeholder="Ex: pFZP5JQG7iQjIQuC4Bku"
            value={defaultVoice}
            onChange={(e) => {
              setVoiceEdited(true);
              setDefaultVoice(e.target.value);
            }}
            className="bg-muted border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Deixe vazio para usar a voz padrão. Encontre vozes em dashboard.vapi.ai → Voices.
          </p>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}
