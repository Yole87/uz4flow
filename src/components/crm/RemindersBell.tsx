import { useState } from "react";
import { useAgentReminders, type AgentReminder } from "@/hooks/useAgentReminders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Check, X, Pencil } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReminderDialog } from "./ReminderDialog";

export function RemindersBell() {
  const { reminders, setStatus, remove } = useAgentReminders();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgentReminder | null>(null);

  const overdueCount = reminders.filter((r) => isPast(new Date(r.remind_at))).length;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative overflow-visible [clip-path:none] h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Meus lembretes"
          >
            <Bell className="h-5 w-5" />
            {reminders.length > 0 && (
              <Badge
                className={`absolute -top-1.5 -right-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background px-1.5 text-xs leading-none shadow-sm ${
                  overdueCount > 0 ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground"
                }`}
              >
                {reminders.length > 99 ? "99+" : reminders.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 bg-popover border-border">
          <div className="p-3 border-b border-border">
            <h4 className="text-sm font-semibold text-foreground">Meus lembretes</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reminders.length === 0
                ? "Nenhum lembrete pendente"
                : `${reminders.length} pendente(s)${overdueCount > 0 ? ` · ${overdueCount} vencido(s)` : ""}`}
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {reminders.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Use o botão 🔔 no chat para criar lembretes pessoais.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {reminders.map((r) => {
                  const due = new Date(r.remind_at);
                  const overdue = isPast(due);
                  return (
                    <li key={r.id} className="p-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground line-clamp-2">{r.description}</p>
                          {r.contact && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              👤 {r.contact.name || r.contact.phone}
                            </p>
                          )}
                          <p className={`text-xs mt-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            {overdue ? "Venceu " : "Em "}
                            {formatDistanceToNow(due, { locale: ptBR, addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Editar"
                            onClick={() => {
                              setEditing(r);
                              setOpen(false);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Marcar como concluído"
                            onClick={() => setStatus({ id: r.id, status: "done" })}
                          >
                            <Check className="h-3.5 w-3.5 text-accent" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Remover"
                            onClick={() => remove(r.id)}
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ReminderDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        existingReminder={editing}
      />
    </>
  );
}
