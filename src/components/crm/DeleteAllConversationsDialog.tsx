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
import { toast } from "sonner";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";

interface DeleteAllConversationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId?: string | null;
  mode: "conversations" | "contacts";
  selectedIds?: string[];
  onSuccess?: () => void;
}

export function DeleteAllConversationsDialog({
  open,
  onOpenChange,
  instanceId,
  mode,
  selectedIds,
  onSuccess,
}: DeleteAllConversationsDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const isSelected = selectedIds && selectedIds.length > 0;
  const confirmWord = "EXCLUIR";

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const action = isSelected
        ? "delete_selected_conversations"
        : mode === "contacts"
        ? "delete_all_contacts"
        : "delete_all_conversations";

      const body: Record<string, unknown> = { action };
      
      if (instanceId) {
        body.instance_id = instanceId;
      }
      
      if (isSelected) {
        body.conversation_ids = selectedIds;
      }

      const { data, error } = await supabase.functions.invoke("crm-bulk-delete", {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-contacts"] });
      
      const count = data?.deleted || 0;
      toast.success(`${count} ${mode === "contacts" ? "contato(s)" : "conversa(s)"} excluído(s)!`);
      
      setConfirmText("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Erro ao excluir conversas. Tente novamente.");
    },
  });

  const handleConfirm = () => {
    if (confirmText.toUpperCase() !== confirmWord) {
      toast.error(`Digite "${confirmWord}" para confirmar`);
      return;
    }
    deleteMutation.mutate();
  };

  const getDescription = () => {
    if (isSelected) {
      return `Você está prestes a excluir ${selectedIds!.length} conversa(s) selecionada(s). Esta ação não pode ser desfeita.`;
    }
    if (mode === "contacts") {
      return instanceId
        ? "Você está prestes a excluir TODOS os contatos e conversas desta instância. Esta ação não pode ser desfeita."
        : "Você está prestes a excluir TODOS os contatos e conversas do CRM. Esta ação não pode ser desfeita.";
    }
    return instanceId
      ? "Você está prestes a excluir TODAS as conversas desta instância. Esta ação não pode ser desfeita."
      : "Você está prestes a excluir TODAS as conversas do CRM. Esta ação não pode ser desfeita.";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirmar Exclusão
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30 mb-4">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Atenção: Todas as mensagens associadas também serão permanentemente excluídas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-muted-foreground">
              Digite <span className="font-mono text-destructive">{confirmWord}</span> para confirmar
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmWord}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmText("");
              onOpenChange(false);
            }}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteMutation.isPending || confirmText.toUpperCase() !== confirmWord}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Permanentemente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
