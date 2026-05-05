import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DeleteInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: { id: string; name: string } | null;
}

export function DeleteInstanceDialog({ open, onOpenChange, instance }: DeleteInstanceDialogProps) {
  const queryClient = useQueryClient();

  const deleteInstance = useMutation({
    mutationFn: async () => {
      if (!instance) throw new Error("No instance selected");

      const { error } = await supabase
        .from("instances")
        .delete()
        .eq("id", instance.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instância excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["crm-instances"] });
      queryClient.invalidateQueries({ queryKey: ["crm-instances-openbot-status"] });
      queryClient.invalidateQueries({ queryKey: ["openbot-instances-config"] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao excluir instância. Tente novamente.");
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-zinc-900 border-zinc-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-zinc-100">
            Excluir instância "{instance?.name}"?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Esta ação não pode ser desfeita. Todos os dados de configuração desta instância serão removidos.
            Os contatos e conversas vinculados a esta instância permanecerão no sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteInstance.mutate()}
            disabled={deleteInstance.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleteInstance.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
