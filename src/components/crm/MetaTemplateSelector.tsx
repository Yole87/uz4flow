import { useState } from "react";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MetaTemplateSelectorProps {
  instanceId: string | null;
  conversationId: string;
  onSent?: () => void;
}

export function MetaTemplateSelector({ instanceId, conversationId, onSent }: MetaTemplateSelectorProps) {
  const { templates, isLoading } = useMetaTemplates(instanceId || undefined);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const template = templates.find((t) => t.id === selectedTemplate);

  const handleSend = async () => {
    if (!template) {
      toast.error("Selecione um template");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-send-message", {
        body: {
          conversation_id: conversationId,
          message: `[Template: ${template.template_name}]`,
          template_name: template.template_name,
          template_language: (template as any).template_language || "pt_BR",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Template enviado!");
      onSent?.();
    } catch (err: any) {
      const msg = err.message || "Erro ao enviar template";
      if (msg.includes("Session has expired") || msg.includes("validating access token") || msg.includes("access token")) {
        toast.error("Token Meta expirado", {
          description: "Atualize o token de acesso em Configurações > Instância.",
          duration: 8000,
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-3 border-t border-border bg-destructive/5">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 border-t border-border bg-destructive/5">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Nenhum template cadastrado. Cadastre templates em Configurações &gt; Instância.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 sm:p-3 border-t border-border bg-destructive/5">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={selectedTemplate || ""} onValueChange={setSelectedTemplate}>
        <SelectTrigger className="flex-1 h-9 bg-muted border-border text-sm">
          <SelectValue placeholder="Selecione um template Meta..." />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-[200]">
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <div className="flex flex-col">
                <span className="font-mono text-xs">{t.template_name}</span>
                {t.template_message && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {t.template_message.split("\n")[0]}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleSend}
        disabled={!selectedTemplate || sending}
        className="h-9 gradient-primary text-white hover:opacity-90 shrink-0"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Send className="h-3.5 w-3.5 mr-1" />
            Enviar
          </>
        )}
      </Button>
    </div>
  );
}
