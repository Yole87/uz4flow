import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Workflow } from "lucide-react";
import { toast } from "sonner";

interface TriggerFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  contactName: string;
}

export function TriggerFlowDialog({
  open,
  onOpenChange,
  conversationId,
  contactName,
}: TriggerFlowDialogProps) {
  const [flowId, setFlowId] = useState<string>("");

  const { data: flows, isLoading } = useQuery({
    queryKey: ["active-flows-for-trigger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flows")
        .select("id, name, description")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      if (!flowId || !conversationId) throw new Error("Selecione um fluxo");
      const { data, error } = await supabase.functions.invoke("trigger-flow-manual", {
        body: { flow_id: flowId, conversation_id: conversationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Fluxo iniciado", {
        description: `O fluxo foi disparado para ${contactName}.`,
      });
      onOpenChange(false);
      setFlowId("");
    },
    onError: (err: any) => {
      toast.error("Erro ao disparar fluxo", {
        description: err?.message || "Tente novamente.",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-accent" />
            Disparar Fluxo
          </DialogTitle>
          <DialogDescription>
            Inicia manualmente um fluxo de automação para <strong>{contactName}</strong>.
            Caso o contato esteja em outro fluxo, o atual será encerrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Selecione o fluxo</Label>
          <Select value={flowId} onValueChange={setFlowId} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Carregando..." : "Escolha um fluxo ativo"} />
            </SelectTrigger>
            <SelectContent>
              {flows?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
              {!isLoading && (flows || []).length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  Nenhum fluxo ativo encontrado.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => triggerMutation.mutate()}
            disabled={!flowId || triggerMutation.isPending}
          >
            {triggerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Disparando...
              </>
            ) : (
              "Disparar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
