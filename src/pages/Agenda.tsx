import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarPlus, CalendarIcon, ChevronLeft, ChevronRight,
  Trash2, Pencil, Loader2, Video, Settings2, Copy } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleEventDialog } from "@/components/crm/ScheduleEventDialog";
import { GoogleCalendarSettings } from "@/components/agenda/GoogleCalendarSettings";

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
}

export default function Agenda() {
  const {
    isConnected, checkingConnection, connect, connecting, accountEmail,
    listEvents, listingEvents, deleteEvent, deletingEvent,
  } = useGoogleCalendar();

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const queryClient = useQueryClient();

  // Refresh connection status right after the Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("oauth_status");
    if (!status) return;
    if (status === "success") {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-connection"] });
      toast.success("Google Calendar conectado com sucesso!");
    } else {
      toast.error("Não foi possível conectar o Google Calendar. Tente novamente.");
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [queryClient]);

  const weekStart = startOfWeek(currentWeek, { locale: ptBR });
  const weekEnd = endOfWeek(currentWeek, { locale: ptBR });

  const loadEvents = useCallback(async () => {
    if (!isConnected) return;
    try {
      const items = await listEvents({
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      });
      setEvents(items);
    } catch { /* errors handled by hook */ }
  }, [isConnected, weekStart.toISOString(), weekEnd.toISOString()]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteEvent(deleteTarget.id);
    setDeleteTarget(null);
    loadEvents();
  };

  const formatEventTime = (dt?: string) => {
    if (!dt) return "";
    return format(new Date(dt), "HH:mm", { locale: ptBR });
  };

  if (checkingConnection) {
    return (
      <AppLayout title="Agenda" description="Gerencie seus compromissos do Google Calendar">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Agenda" description="Gerencie seus compromissos do Google Calendar">
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {format(weekStart, "d MMM", { locale: ptBR })} – {format(weekEnd, "d MMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isConnected && (
              <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[220px]">
                {accountEmail ? (
                  <>
                    Conectado como: <span className="font-medium text-foreground">{accountEmail}</span>
                  </>
                ) : (
                  "Conta conectada"
                )}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
            {isConnected && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gradient-primary text-primary-foreground gap-2">
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Evento</span>
              </Button>
            )}
          </div>
        </div>

        {/* Not connected state */}
        {!isConnected ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
              <CalendarIcon className="h-16 w-16 text-muted-foreground" />
              <div className="text-center">
                <p className="font-semibold text-foreground">Google Calendar não conectado</p>
                <p className="text-sm text-muted-foreground mt-1">Conecte sua conta para visualizar e gerenciar eventos</p>
              </div>
              <Button onClick={() => connect()} disabled={connecting} className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {connecting ? "Redirecionando..." : "Conectar Google Calendar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                Configurar credenciais
              </Button>
            </CardContent>
          </Card>
        ) : listingEvents ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-48 gap-3">
              <CalendarIcon className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum evento nesta semana</p>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
                <CalendarPlus className="h-4 w-4" /> Criar evento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Card key={event.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="flex items-center justify-between p-4 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{event.summary ?? "Sem título"}</p>
                      {event.hangoutLink && (
                        <Badge variant="outline" className="gap-1 text-xs shrink-0">
                          <Video className="h-3 w-3" /> Meet
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.start.dateTime
                        ? `${format(new Date(event.start.dateTime), "EEE, d MMM", { locale: ptBR })} · ${formatEventTime(event.start.dateTime)} – ${formatEventTime(event.end.dateTime)}`
                        : format(new Date(event.start.date!), "EEE, d MMM", { locale: ptBR })}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{event.description}</p>
                    )}
                    {event.hangoutLink && (
                      <div className="flex items-center gap-1 mt-1 min-w-0">
                        <a
                          href={event.hangoutLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate"
                        >
                          {event.hangoutLink}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          title="Copiar link do Meet"
                          onClick={() => {
                            navigator.clipboard.writeText(event.hangoutLink!);
                            toast.success("Link do Meet copiado!");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditEvent(event)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(event)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create event dialog — reuse existing */}
      <ScheduleEventDialog
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) loadEvents(); }}
        contactName=""
      />

      {/* Edit event dialog */}
      {editEvent && (
        <ScheduleEventDialog
          open={!!editEvent}
          onOpenChange={(open) => { if (!open) { setEditEvent(null); loadEvents(); } }}
          contactName={editEvent.summary ?? ""}
          existingEventId={editEvent.id}
          existingStart={editEvent.start.dateTime}
          existingDescription={editEvent.description}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.summary}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
              disabled={deletingEvent}
            >
              {deletingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings panel */}
      <GoogleCalendarSettings open={showSettings} onOpenChange={setShowSettings} />
    </AppLayout>
  );
}
