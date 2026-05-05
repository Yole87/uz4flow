import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, Key, Link as LinkIcon, Smartphone, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_API_URL = "https://api.digitalbotia.com.br/sendWebhook";

interface Props {
  /** Render a compact button (for section headers) instead of the big dashed card. */
  variant?: "card" | "button";
}

export function NewInstanceButton({ variant = "button" }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [provider, setProvider] = useState<"baileys" | "meta_official">("baileys");
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();

  const createInstance = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("Sem organização");
      if (!name.trim()) throw new Error("Nome é obrigatório");
      if (!apiKey.trim()) throw new Error("Token é obrigatório");

      const { data: newInstance, error } = await supabase.from("instances").insert({
        name: name.trim(),
        organization_id: organization.id,
        api_url: apiUrl || DEFAULT_API_URL,
        provider,
        status: "connected",
      }).select("id").single();
      if (error) throw error;

      const { error: encryptError } = await supabase.functions.invoke("manage-integration", {
        body: {
          action: "save-instance-credentials",
          instance_id: newInstance.id,
          api_key: apiKey.trim(),
          key_field: provider === "meta_official" ? "api_key_encrypted" : "openbot_api_key_encrypted",
        },
      });
      if (encryptError) throw encryptError;
    },
    onSuccess: () => {
      toast.success("Instância cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["settings-instances"] });
      setOpen(false);
      setName("");
      setApiKey("");
      setApiUrl(DEFAULT_API_URL);
      setProvider("baileys");
    },
    onError: () => toast.error("Erro ao registrar instância"),
  });

  const trigger =
    variant === "card" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex flex-col items-center justify-center gap-3 py-12 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">Cadastrar primeira instância</span>
        <span className="text-xs text-muted-foreground text-center max-w-xs">
          Adicione uma instância do Sistema de WhatsApp AI para começar
        </span>
      </button>
    ) : (
      <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
        <Plus className="h-4 w-4" />
        Nova instância
      </Button>
    );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Cadastrar Credenciais da Instância
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da sua instância do Sistema de WhatsApp AI.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); createInstance.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inst-name">Nome da Instância</Label>
              <Input id="inst-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: WhatsApp Vendas" />
            </div>

            <TooltipProvider delayDuration={150}>
              <div className="space-y-2">
                <Label htmlFor="inst-token" className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  Token para API de Entrada
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Ajuda sobre Token">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs z-[200]">
                      Pegue este token no Sistema de WhatsApp AI: ative o Fluxo, vá em "Fluxo" no menu lateral e clique em "Gerar Token" (ou "Copiar" se já tiver).
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input id="inst-token" type="password" value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole seu token aqui" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst-url" className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  URL da API
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Ajuda sobre URL da API">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs z-[200]">
                      Endereço do servidor que processa as mensagens. Por padrão: <code className="text-xs">{DEFAULT_API_URL}</code>. Só altere se você usa um servidor próprio.
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input id="inst-url" type="url" value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder={DEFAULT_API_URL} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Tipo de conexão com WhatsApp
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="QR Code vs Meta Oficial">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs z-[200]">
                      <p className="mb-1"><strong>QR Code:</strong> rápido de configurar, ideal para começar. Não é oficial.</p>
                      <p><strong>API Oficial da Meta:</strong> requer Business Manager aprovado, suporta templates e webhooks oficiais.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <RadioGroup value={provider} onValueChange={(v) => setProvider(v as any)}
                  className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="baileys" id="qr" />
                    <Label htmlFor="qr" className="font-normal cursor-pointer">QR Code</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="meta_official" id="meta" />
                    <Label htmlFor="meta" className="font-normal cursor-pointer">API Oficial da Meta</Label>
                  </div>
                </RadioGroup>
              </div>
            </TooltipProvider>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createInstance.isPending} className="gradient-primary">
                {createInstance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cadastrar Instância
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
