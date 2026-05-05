import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Pencil, Trash2, AlertCircle, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScheduledMessages, type ScheduledMessage } from "@/hooks/useScheduledMessages";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";

interface ScheduledMessagesListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactId: string;
  organizationId: string;
  instanceId?: string | null;
}

export function ScheduledMessagesList({
  open,
  onOpenChange,
  conversationId,
  contactId,
  organizationId,
  instanceId,
}: ScheduledMessagesListProps) {
  const { messages, isLoading, cancel, isCancelling } = useScheduledMessages(conversationId);
  const [editing, setEditing] = useState<ScheduledMessage | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Mensagens agendadas
            </DialogTitle>
            <DialogDescription>
              Agendamentos pendentes ou com falha desta conversa.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Clock className="h-8 w-8" />
                <p className="text-sm">Nenhuma mensagem agendada</p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {messages.map((m) => {
                  const dt = new Date(m.scheduled_for);
                  const isFailed = m.status === "failed";
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Badge
                            variant={isFailed ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {isFailed ? "Falhou" : "Pendente"}
                          </Badge>
                          <span className="text-muted-foreground">
                            {format(dt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isFailed && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditing(m)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={isCancelling}
                            onClick={() => cancel(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {m.content && (
                        <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap break-words">
                          {m.content}
                        </p>
                      )}
                      {m.media_url && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Paperclip className="h-3 w-3" />
                          {m.file_name || m.media_type}
                        </p>
                      )}
                      {isFailed && m.error_message && (
                        <p className="text-xs text-destructive flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{m.error_message}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {editing && (
        <ScheduleMessageDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          conversationId={conversationId}
          contactId={contactId}
          organizationId={organizationId}
          instanceId={instanceId}
          existing={editing}
        />
      )}
    </>
  );
}
