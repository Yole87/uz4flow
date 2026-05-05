import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Save, FilePlus, X } from "lucide-react";

interface FollowUpTemplateSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasExistingTemplate: boolean;
  onSaveNew: () => void;
  onUpdate: () => void;
  onSkip: () => void;
}

export function FollowUpTemplateSaveDialog({
  open,
  onOpenChange,
  hasExistingTemplate,
  onSaveNew,
  onUpdate,
  onSkip,
}: FollowUpTemplateSaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como template?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Deseja salvar os dados desta campanha como um modelo reutilizável?
        </p>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button variant="outline" className="justify-start" onClick={onSaveNew}>
            <FilePlus className="h-4 w-4 mr-2" />
            Salvar como novo template
          </Button>
          {hasExistingTemplate && (
            <Button variant="outline" className="justify-start" onClick={onUpdate}>
              <Save className="h-4 w-4 mr-2" />
              Atualizar template existente
            </Button>
          )}
          <Button variant="ghost" className="justify-start" onClick={onSkip}>
            <X className="h-4 w-4 mr-2" />
            Não salvar template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
