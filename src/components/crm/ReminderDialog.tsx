import { useState, useEffect } from "react";
import { useAgentReminders, type AgentReminder } from "@/hooks/useAgentReminders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Pencil } from "lucide-react";

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string | null;
  conversationId?: string | null;
  contactName?: string;
  existingReminder?: AgentReminder | null;
}

const QUICK_OFFSETS = [
  { label: "Em 15 min", minutes: 15 },
  { label: "Em 1 h", minutes: 60 },
  { label: "Em 3 h", minutes: 180 },
  { label: "Amanhã 9h", minutes: -1 }, // special
];

function nextDay9am(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderDialog({
  open,
  onOpenChange,
  contactId,
  conversationId,
  contactName,
  existingReminder,
}: ReminderDialogProps) {
  const { create, update, isCreating, isUpdating } = useAgentReminders();
  const isEdit = !!existingReminder;
  const [description, setDescription] = useState("");
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalInputValue(d);
  });

  // Sync state when opening in edit mode
  useEffect(() => {
    if (open && existingReminder) {
      setDescription(existingReminder.description);
      setRemindAt(toLocalInputValue(new Date(existingReminder.remind_at)));
    } else if (open && !existingReminder) {
      setDescription("");
      setRemindAt(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    }
  }, [open, existingReminder]);

  const handleQuick = (minutes: number) => {
    const d = minutes === -1 ? nextDay9am() : new Date(Date.now() + minutes * 60 * 1000);
    setRemindAt(toLocalInputValue(d));
  };

  const handleSave = async () => {
    if (!description.trim() || !remindAt) return;
    const iso = new Date(remindAt).toISOString();
    if (isEdit && existingReminder) {
      await update({
        id: existingReminder.id,
        description: description.trim(),
        remind_at: iso,
      });
    } else {
      await create({
        contact_id: contactId,
        conversation_id: conversationId || null,
        description: description.trim(),
        remind_at: iso,
      });
    }
    setDescription("");
    onOpenChange(false);
  };

  const busy = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-5 w-5 text-accent" /> : <Bell className="h-5 w-5 text-accent" />}
            {isEdit ? "Editar Lembrete" : "Novo Lembrete"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize a descrição ou data do lembrete"
              : contactName
                ? `Sobre ${contactName}`
                : "Lembrete pessoal — só você verá"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rem-desc">Descrição</Label>
            <Textarea
              id="rem-desc"
              placeholder="Ex: Retornar ligação, enviar proposta..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rem-time">Quando lembrar</Label>
            <Input
              id="rem-time"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_OFFSETS.map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleQuick(q.minutes)}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!description.trim() || !remindAt || busy}>
            {busy ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar lembrete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
