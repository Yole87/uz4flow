import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createSource } from "@/services/prospectSourceService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onCreated: (newId: string) => void;
}

export function CreateSourceDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: CreateSourceDialogProps) {
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createSource(organizationId, name.trim()),
    onSuccess: (source) => {
      setName("");
      onOpenChange(false);
      onCreated(source.id);
    },
    onError: () => toast.error("Erro ao criar fonte"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nova Fonte de Formulário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="source-name" className="text-foreground">
              Nome da fonte <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Ex: Formulário de Contato — Site Principal"
              maxLength={60}
              className="bg-background border-border"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">
              {name.length}/60
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="gradient-primary hover:opacity-90 text-primary-foreground"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Criar fonte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
