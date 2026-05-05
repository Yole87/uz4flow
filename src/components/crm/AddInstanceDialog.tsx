import { useState } from "react";
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
import { toast } from "sonner";
import { Loader2, Smartphone, Key, Eye, EyeOff, Info, Zap } from "lucide-react";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AddInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInstanceDialog({ open, onOpenChange }: AddInstanceDialogProps) {
  const [name, setName] = useState("");
  const [openbotApiKey, setOpenbotApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  const organizationId = organization?.id;

  const createInstance = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization found");

      // Simple base64 encoding - encryption happens in edge function when sending
      const apiKeyEncrypted = openbotApiKey ? btoa(openbotApiKey) : null;

      const { data, error } = await supabase
        .from("instances")
        .insert({
          name,
          provider: "baileys",
          organization_id: organizationId,
          status: "connected",
          openbot_instance_id: null,
          openbot_api_key_encrypted: apiKeyEncrypted,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Instância criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["crm-instances"] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao criar instância. Tente novamente.");
    },
  });

  const resetForm = () => {
    setName("");
    setOpenbotApiKey("");
    setShowApiKey(false);
    setTestResult(null);
    setIsTesting(false);
  };

  const testConnection = async () => {
    if (!openbotApiKey.trim()) {
      toast.error("Insira a API Key para testar");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
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
    if (!openbotApiKey.trim()) {
      toast.error("API Key do Sistema de WhatsApp AI é obrigatória");
      return;
    }
    createInstance.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Smartphone className="h-5 w-5 text-success" />
            Nova Conexão WhatsApp
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Vincule uma instância do Sistema de WhatsApp AI para receber e enviar mensagens pelo CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Nome da Instância
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: WhatsApp Principal"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Nome amigável para identificar esta conta de WhatsApp
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openbotApiKey" className="text-foreground flex items-center gap-2">
              <Key className="h-4 w-4 text-warning" />
              API Key do Sistema de WhatsApp AI
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-muted border-border">
                  <p>Encontre sua API Key no painel do Sistema de WhatsApp AI em Configurações → API. Cada instância deve ter sua própria chave.</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <div className="relative">
              <Input
                id="openbotApiKey"
                type={showApiKey ? "text" : "password"}
                value={openbotApiKey}
                onChange={(e) => setOpenbotApiKey(e.target.value)}
                placeholder="Cole sua API Key aqui"
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
            {openbotApiKey.trim() && (
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
            
            <p className="text-xs text-muted-foreground">
              Cada instância do Sistema de WhatsApp AI possui sua própria API Key
            </p>
          </div>

          {/* Auto-detection info */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <h4 className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
              💡 Detecção Automática
            </h4>
            <p className="text-xs text-muted-foreground">
              O ID da instância será detectado automaticamente quando a primeira mensagem chegar via webhook. 
              Configure a URL do webhook no Sistema de WhatsApp AI após criar esta instância.
            </p>
          </div>

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
              disabled={createInstance.isPending}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {createInstance.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Instância"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
