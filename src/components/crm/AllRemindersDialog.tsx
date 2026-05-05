import { useState, useMemo } from "react";
import { useAgentReminders, type AgentReminder } from "@/hooks/useAgentReminders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ReminderDialog } from "./ReminderDialog";
import { Bell, Search, Check, X, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AllRemindersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StatusFilter = "pending" | "done" | "dismissed" | "all";

export function AllRemindersDialog({ open, onOpenChange }: AllRemindersDialogProps) {
  const { reminders, setStatus, remove } = useAgentReminders(undefined, { includeAllStatuses: true });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [editing, setEditing] = useState<AgentReminder | null>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, done: 0, dismissed: 0, all: reminders.length };
    for (const r of reminders) {
      if (r.status === "pending") c.pending++;
      else if (r.status === "done") c.done++;
      else if (r.status === "dismissed") c.dismissed++;
    }
    return c;
  }, [reminders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reminders
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => {
        if (!q) return true;
        return (
          r.description.toLowerCase().includes(q) ||
          r.contact?.name?.toLowerCase().includes(q) ||
          r.contact?.phone?.includes(q)
        );
      });
  }, [reminders, search, statusFilter]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-accent" />
              Gerenciar todos os lembretes
            </DialogTitle>
            <DialogDescription>
              Visualize, edite e organize seus lembretes pessoais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 min-h-0 flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-muted border-border"
              />
            </div>

            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList className="grid grid-cols-4 w-full bg-muted">
                <TabsTrigger value="pending" className="text-xs gap-1.5">
                  Pendentes
                  {counts.pending > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-xs bg-accent text-accent-foreground">
                      {counts.pending}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="done" className="text-xs gap-1.5">
                  Concluídos
                  {counts.done > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-xs bg-success text-success-foreground">
                      {counts.done}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="dismissed" className="text-xs gap-1.5">
                  Dispensados
                  {counts.dismissed > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-xs bg-muted-foreground/30 text-muted-foreground">
                      {counts.dismissed}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-3 flex-1 min-h-0">
                <div className="overflow-y-auto max-h-[50vh] -mx-1 px-1">
                  {filtered.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhum lembrete nesta categoria.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {filtered.map((r) => {
                        const due = new Date(r.remind_at);
                        const overdue = r.status === "pending" && isPast(due);
                        return (
                          <li key={r.id} className="p-3 hover:bg-muted/40 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm text-foreground line-clamp-2">{r.description}</p>
                                  {overdue && (
                                    <Badge variant="destructive" className="h-4 px-1 text-xs gap-0.5">
                                      <AlertTriangle className="h-2.5 w-2.5" /> vencido
                                    </Badge>
                                  )}
                                  {r.status === "done" && (
                                    <Badge className="h-4 px-1 text-xs bg-success text-success-foreground">concluído</Badge>
                                  )}
                                  {r.status === "dismissed" && (
                                    <Badge variant="secondary" className="h-4 px-1 text-xs">dispensado</Badge>
                                  )}
                                </div>
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
                              <div className="flex items-center gap-1 shrink-0">
                                {r.status === "pending" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Editar"
                                      onClick={() => setEditing(r)}
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Marcar como concluído"
                                      onClick={() => setStatus({ id: r.id, status: "done" })}
                                    >
                                      <Check className="h-3.5 w-3.5 text-accent" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Dispensar"
                                      onClick={() => setStatus({ id: r.id, status: "dismissed" })}
                                    >
                                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Remover"
                                  onClick={() => remove(r.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <ReminderDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        existingReminder={editing}
      />
    </>
  );
}
