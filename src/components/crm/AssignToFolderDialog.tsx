import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, Loader2 } from "lucide-react";
import { useContactFolders, useAssignContactsToFolder } from "@/hooks/useContactFolders";

interface AssignToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  onAssigned?: () => void;
}

export function AssignToFolderDialog({
  open,
  onOpenChange,
  contactIds,
  onAssigned,
}: AssignToFolderDialogProps) {
  const { data: folders, isLoading } = useContactFolders();
  const assignMutation = useAssignContactsToFolder();

  const handleAssign = async (folderId: string) => {
    await assignMutation.mutateAsync({ folderId, contactIds });
    onAssigned?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-accent" />
            Mover para pasta
          </DialogTitle>
          <DialogDescription>
            Selecione a pasta de destino para os {contactIds.length} contato(s) selecionado(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">Carregando...</div>
          ) : !folders || folders.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhuma pasta criada. Use "Gerenciar pastas" para criar uma.
            </div>
          ) : (
            folders.map((f) => (
              <Button
                key={f.id}
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => handleAssign(f.id)}
                disabled={assignMutation.isPending}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                <span className="truncate">{f.name}</span>
                {assignMutation.isPending && <Loader2 className="h-3.5 w-3.5 ml-auto animate-spin" />}
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
