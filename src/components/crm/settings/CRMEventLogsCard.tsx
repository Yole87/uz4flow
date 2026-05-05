import { useState } from "react";
import { useCRMEventLogs, type CRMWebhookEvent } from "@/hooks/useCRMEventLogs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Loader2,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Eye,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig = {
  success: {
    label: "Sucesso",
    icon: CheckCircle,
    className: "bg-success/20 text-success border-success/30",
  },
  error: {
    label: "Erro",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
  ignored: {
    label: "Ignorado",
    icon: AlertTriangle,
    className: "bg-warning/20 text-warning border-warning/30",
  },
  duplicate: {
    label: "Duplicado",
    icon: Copy,
    className: "bg-muted text-muted-foreground border-muted",
  },
  pending: {
    label: "Pendente",
    icon: Loader2,
    className: "bg-primary/20 text-primary border-primary/30",
  },
};

const eventTypeConfig = {
  inbound: {
    label: "Entrada",
    icon: ArrowDownLeft,
    className: "text-accent",
  },
  outbound: {
    label: "Saída",
    icon: ArrowUpRight,
    className: "text-primary",
  },
};

function EventRow({ event, onClick }: { event: CRMWebhookEvent; onClick: () => void }) {
  const statusInfo = statusConfig[event.status];
  const typeInfo = eventTypeConfig[event.event_type];
  const StatusIcon = statusInfo.icon;
  const TypeIcon = typeInfo.icon;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center flex-wrap gap-2 sm:gap-3 px-3 py-2.5 hover:bg-muted/60 rounded-lg transition-colors text-left group"
    >
      {/* Timestamp */}
      <span className="text-xs text-muted-foreground font-mono w-16 shrink-0 hidden sm:inline">
        {format(new Date(event.created_at), "HH:mm:ss")}
      </span>

      {/* Type Badge */}
      <div className={cn("flex items-center gap-1", typeInfo.className)}>
        <TypeIcon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase">{typeInfo.label}</span>
      </div>

      {/* Status Badge */}
      <Badge variant="outline" className={cn("text-xs", statusInfo.className)}>
        <StatusIcon className={cn("h-3 w-3 mr-1", event.status === "pending" && "animate-spin")} />
        {statusInfo.label}
      </Badge>

      {/* Phone/Instance */}
      <span className="text-xs text-muted-foreground truncate flex-1">
        {event.phone || event.instance_id || "-"}
      </span>

      {/* Processing time */}
      {event.processing_time_ms && (
        <span className="text-xs text-muted-foreground">
          {event.processing_time_ms}ms
        </span>
      )}

      {/* View button */}
      <Eye className="h-4 w-4 text-muted group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

function EventDetailsDialog({ 
  event, 
  open, 
  onOpenChange 
}: { 
  event: CRMWebhookEvent | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  if (!event) return null;

  const statusInfo = statusConfig[event.status];
  const typeInfo = eventTypeConfig[event.event_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent" />
            Detalhes do Evento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Meta info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn("text-xs", typeInfo.className)}>
              {typeInfo.label}
            </Badge>
            <Badge variant="outline" className={cn("text-xs", statusInfo.className)}>
              {statusInfo.label}
            </Badge>
            {event.processing_time_ms && (
              <Badge variant="outline" className="text-xs border-border text-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {event.processing_time_ms}ms
              </Badge>
            )}
          </div>

          {/* Error message */}
          {event.error_message && (
            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <h4 className="text-sm font-medium text-destructive mb-1">Erro</h4>
              <p className="text-sm text-destructive/80">{event.error_message}</p>
            </div>
          )}

          {/* Payload */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Payload</h4>
            <pre className="p-3 bg-muted rounded-lg text-xs text-foreground overflow-auto max-h-48">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>

          {/* Response */}
          {event.response && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <pre className="p-3 bg-muted rounded-lg text-xs text-foreground overflow-auto max-h-48">
                {JSON.stringify(event.response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CRMEventLogsCard() {
  const { events, stats, isLoading, isPaused, togglePause, refetch, clearLogs } = useCRMEventLogs();
  const [selectedEvent, setSelectedEvent] = useState<CRMWebhookEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleEventClick = (event: CRMWebhookEvent) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };

  const handleClearLogs = async () => {
    try {
      setIsClearing(true);
      await clearLogs();
      toast.success("Logs limpos com sucesso!");
    } catch (error) {
      console.error("Error clearing logs:", error);
      toast.error("Erro ao limpar logs");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center flex-wrap gap-2">
              <Activity className="h-5 w-5 text-accent" />
              <CardTitle className="text-base sm:text-lg text-foreground">Logs de Webhook</CardTitle>
              
              {/* Live indicator */}
              {!isPaused && (
                <Badge variant="outline" className="border-accent/50 text-accent">
                  <span className="relative flex h-2 w-2 mr-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                  </span>
                  Escutando
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Atualizar"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePause}
                className={cn(
                  "h-8 w-8",
                  isPaused 
                    ? "text-warning hover:text-warning/80" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={isPaused ? "Retomar" : "Pausar"}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Limpar logs"
                    disabled={events.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">Limpar todos os logs?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      Esta ação não pode ser desfeita. Todos os {events.length} eventos serão removidos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border text-foreground hover:bg-muted">
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearLogs}
                      disabled={isClearing}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isClearing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <CardDescription className="text-muted-foreground">
            Monitore os webhooks de entrada e saída do CRM em tempo real
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-xl font-semibold text-foreground">{stats.total}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-success/20">
              <p className="text-xs text-success mb-1">Sucesso</p>
              <p className="text-xl font-semibold text-success">{stats.success}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-destructive/20">
              <p className="text-xs text-destructive mb-1">Erros</p>
              <p className="text-xl font-semibold text-destructive">{stats.error}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Última</p>
              <p className="text-sm font-medium text-foreground">
                {stats.lastEventAt 
                  ? formatDistanceToNow(new Date(stats.lastEventAt), { addSuffix: true, locale: ptBR })
                  : "-"
                }
              </p>
            </div>
          </div>

          {/* Events list */}
          <div className="bg-muted/50 rounded-lg border border-border">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Últimos {Math.min(events.length, 50)} eventos
              </span>
            </div>
            
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16 bg-muted" />
                    <Skeleton className="h-5 w-20 bg-muted" />
                    <Skeleton className="h-5 w-16 bg-muted" />
                    <Skeleton className="h-4 flex-1 bg-muted" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="h-10 w-10 text-muted mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Os eventos aparecerão aqui quando webhooks forem processados
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="divide-y divide-border">
                  {events.map((event) => (
                    <EventRow 
                      key={event.id} 
                      event={event} 
                      onClick={() => handleEventClick(event)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Help text */}
          <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
            <Activity className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Os eventos são atualizados automaticamente via Realtime. 
              {isPaused ? " Atualizações pausadas." : " Clique em um evento para ver detalhes."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <EventDetailsDialog 
        event={selectedEvent}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
}
