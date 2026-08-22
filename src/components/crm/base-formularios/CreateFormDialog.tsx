import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createForm } from "@/services/uzFormService";
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

interface CreateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function CreateFormDialog({
  open,
  onOpenChange,
  organizationId,
}: CreateFormDialogProps) {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: () => createForm(organizationId, name.trim()),
    onSuccess: (newForm) => {
      setName("");
      onOpenChange(false);
      toast.success("Formulário criado com sucesso!");
      navigate(`/base-formularios/form/${newForm.id}`);
    },
    onError: () => toast.error("Erro ao criar formulário"),
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
          <DialogTitle className="text-foreground">Novo Formulário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="form-name" className="text-foreground">
              Nome do formulário <span className="text-destructive">*</span>
            </Label>
            <Input
              id="form-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Ex: Formulário de Captação — Leads"
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
              Criar formulário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
