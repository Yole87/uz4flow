import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Smartphone, Key, Eye, EyeOff, AlertTriangle, CheckCircle2, Zap, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface Instance {
  id: string;
  name: string;
  openbot_instance_id: string | null;
  has_openbot_api_key?: boolean;
  provider?: string;
  meta_phone_number_id?: string | null;
}

interface EditInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
}

export function EditInstanceDialog({ open, onOpenChange, instance }: EditInstanceDialogProps) {
  const [name, setName] = useState("");
  const [openbotApiKey, setOpenbotApiKey] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChangedApiKey, setHasChangedApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const queryClient = useQueryClient();

  const isMetaOfficial = instance?.provider === "meta_official";

  useEffect(() => {
    if (instance) {
      setName(instance.name);
      setOpenbotApiKey("");
      setMetaPhoneNumberId(instance.meta_phone_number_id || "");
      setHasChangedApiKey(false);
      setTestResult(null);
    }
  }, [instance]);

  const updateInstance = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error("No instance selected");

      const updateData: Record<string, unknown> = { name };

      // Only update API key if changed
      if (hasChangedApiKey && openbotApiKey.trim()) {
        updateData.openbot_api_key_encrypted = btoa(openbotApiKey);
      }

      // For meta_official, also save meta_phone_number_id
      if (isMetaOfficial) {
        updateData.meta_phone_number_id = metaPhoneNumberId.trim() || null;
        // Save Meta token in api_key_encrypted field
        if (hasChangedApiKey && openbotApiKey.trim()) {
          updateData.api_key_encrypted = btoa(openbotApiKey);
        }
      }

      const { error } = await supabase
        .from("instances")
        .update(updateData)
        .eq("id", instance.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instância atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["crm-instances"] });
      queryClient.invalidateQueries({ queryKey: ["crm-instances-openbot-status"] });
      queryClient.invalidateQueries({ queryKey: ["openbot-instances-config"] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar instância. Tente novamente.");
    },
  });

  const testConnection = async () => {
    if (!openbotApiKey.trim()) {
      toast.error("Insira a API Key para testar");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("crm-test-openbot", {
        body: { 
          api_key: openbotApiKey,
          send_url: "https://api.digitalbotia.com.br/sendWebhook"
        },
      });

      if (response.error) {
        setTestResult({ success: false, message: response.error.message });
      } else {
        setTestResult(response.data);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      setTestResult({ success: false, message: errorMessage });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateInstance.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Smartphone className="h-5 w-5 text-success" />
            Editar Instância
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Atualize as configurações desta instância do WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider delayDuration={150}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-foreground flex items-center gap-2">
              Nome da Instância
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Ajuda sobre Nome da Instância" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-muted border-border">
                  <p>Identificador interno para você reconhecer esta conexão. Aparece em listas e logs do CRM.</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: WhatsApp Principal"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* OpenBot Instance ID - Readonly */}
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-2">
              ID da Instância
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Ajuda sobre ID da Instância" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-muted border-border">
                  <p>Detectado automaticamente pelo webhook. Não pode ser editado manualmente.</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            {instance?.openbot_instance_id ? (
              <Badge variant="outline" className="text-xs border-success/50 text-success font-mono py-1.5 px-3">
                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                {instance.openbot_instance_id}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-warning/50 text-warning py-1.5 px-3">
                <AlertTriangle className="h-3 w-3 mr-1.5" />
                Aguardando primeira mensagem do webhook
              </Badge>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="edit-openbotApiKey" className="text-foreground flex items-center gap-2">
              <Key className="h-4 w-4 text-warning" />
              {isMetaOfficial ? "Token de Acesso Meta (WhatsApp Business)" : "API Key do Sistema de WhatsApp AI"}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Ajuda sobre API Key" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-muted border-border">
                  <p>Token fornecido pelo Sistema de WhatsApp AI: ative o Fluxo, vá em "Fluxo" no menu lateral e clique em "Gerar Token" (ou "Copiar" se já tiver).</p>
                </TooltipContent>
              </Tooltip>
              {instance?.has_openbot_api_key && !hasChangedApiKey && (
                <Badge variant="outline" className="text-xs border-success/30 text-success">
                  Configurada
                </Badge>
              )}
            </Label>
            <div className="relative">
              <Input
                id="edit-openbotApiKey"
                type={showApiKey ? "text" : "password"}
                value={openbotApiKey}
                onChange={(e) => {
                  setOpenbotApiKey(e.target.value);
                  setHasChangedApiKey(true);
                  setTestResult(null);
                }}
                placeholder={instance?.has_openbot_api_key ? "••••••••••••• (alterar)" : "Cole sua API Key aqui"}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* Test connection button */}
            {hasChangedApiKey && openbotApiKey.trim() && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  disabled={isTesting}
                  className="border-border text-foreground hover:bg-muted"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1.5" />
                      Testar Conexão
                    </>
                  )}
                </Button>
                {testResult && (
                  <Badge 
                    variant="outline" 
                    className={testResult.success 
                      ? "border-success/50 text-success" 
                      : "border-destructive/50 text-destructive"
                    }
                  >
                    {testResult.success ? "✓ Conectado" : "✗ Falhou"}
                  </Badge>
                )}
              </div>
            )}
            
            {testResult && !testResult.success && (
              <p className="text-xs text-destructive">{testResult.message}</p>
            )}
          </div>

          {/* Warning about changing API Key */}
          {hasChangedApiKey && openbotApiKey.trim() && (
            <Alert className="bg-warning/10 border-warning/30">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning-foreground text-xs">
                Ao alterar a API Key, todos os eventos passarão a usar a nova instância no Sistema de WhatsApp AI. 
                Os chats existentes mantêm o histórico vinculado à instância original.
              </AlertDescription>
            </Alert>
          )}

          {/* Meta Phone Number ID - Only for meta_official */}
          {isMetaOfficial && (
            <div className="space-y-2">
              <Label htmlFor="edit-metaPhoneNumberId" className="text-foreground flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-accent" />
                Phone Number ID (Meta Business)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Ajuda sobre Phone Number ID" className="text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-muted border-border">
                    <p>ID numérico do número de telefone no Meta Business Manager. Encontre em: WhatsApp Manager → Configurações do número.</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="edit-metaPhoneNumberId"
                value={metaPhoneNumberId}
                onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                placeholder="Ex: 123456789012345"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground font-mono"
              />
              {!metaPhoneNumberId.trim() && (
                <p className="text-xs text-warning">
                  ⚠️ Sem o Phone Number ID, as mensagens do CRM não serão entregues para esta instância Meta Official.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateInstance.isPending}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {updateInstance.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
