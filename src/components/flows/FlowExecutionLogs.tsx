import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  User,
  Zap,
  AlertTriangle,
  Timer,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FlowExecutionLogsProps {
  flowId: string;
  userId: string;
}

interface EventRow {
  id: string;
  chat_id: string;
  instance_id: string;
  push_name: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  message_text: string | null;
}

interface EventActionRow {
  id: string;
  step_order: number;
  status: string;
  error_message: string | null;
  latency_ms: number | null;
  sent_at: string | null;
  sent_payload_json: any;
  step_id: string | null;
  flow_step?: {
    step_type: string;
    text_content: string | null;
    variable_name: string | null;
  } | null;
}

const PAGE_SIZE = 20;

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pending: {
    label: "Pendente",
    icon: Loader2,
    className: "bg-primary/20 text-primary border-primary/30",
  },
  processing: {
    label: "Processando",
    icon: Loader2,
    className: "bg-accent/20 text-accent border-accent/30",
  },
  completed: {
    label: "Concluído",
    icon: CheckCircle,
    className: "bg-success/20 text-success border-success/30",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
  timeout: {
    label: "Timeout",
    icon: Timer,
    className: "bg-warning/20 text-warning border-warning/30",
  },
  error: {
    label: "Erro",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
};

const actionStatusConfig: Record<string, { label: string; className: string }> = {
  sent: { label: "Enviado", className: "bg-success/20 text-success border-success/30" },
  failed: { label: "Falhou", className: "bg-destructive/20 text-destructive border-destructive/30" },
  error: { label: "Erro", className: "bg-destructive/20 text-destructive border-destructive/30" },
  waiting_reply: { label: "Aguardando", className: "bg-primary/20 text-primary border-primary/30" },
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
};

function maskPhone(chatId: string): string {
  const digits = chatId.replace(/\D/g, "");
  if (digits.length < 6) return chatId;
  return digits.slice(0, 4) + "****" + digits.slice(-2);
}

function getDuration(created: string, completed: string | null): string {
  if (!completed) return "-";
  const ms = new Date(completed).getTime() - new Date(created).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function stepTypeLabel(type: string): string {
  const map: Record<string, string> = {
    text: "Texto",
    file: "Arquivo",
    start: "Início",
    condition: "Condição",
    end: "Fim",
    block: "Bloco",
    tag: "Tag",
    lane: "Estágio",
    active_message: "Msg Ativa",
    random: "Aleatório",
    delay: "Delay",
    menu: "Menu",
  };
  return map[type] || type;
}

function EventActions({ eventId }: { eventId: string }) {
  const [actions, setActions] = useState<EventActionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from("event_actions")
        .select("id, step_order, status, error_message, latency_ms, sent_at, sent_payload_json, step_id")
        .eq("event_id", eventId)
        .order("step_order", { ascending: true });

      if (!error && data) {
        // Fetch step details for each action that has step_id
        const stepIds = data.filter(a => a.step_id).map(a => a.step_id!);
        let stepMap = new Map<string, any>();
        if (stepIds.length > 0) {
          const { data: steps } = await supabase
            .from("flow_steps")
            .select("id, step_type, text_content, variable_name")
            .in("id", stepIds);
          if (steps) {
            steps.forEach(s => stepMap.set(s.id, s));
          }
        }

        setActions(data.map(a => ({
          ...a,
          flow_step: a.step_id ? stepMap.get(a.step_id) || null : null,
        })));
      }
      setLoading(false);
    }
    fetch();
  }, [eventId]);

  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full bg-muted" />
        ))}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-xs text-muted-foreground">Nenhuma ação registrada</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1.5">
      {actions.map((action) => (
        <ActionItem key={action.id} action={action} />
      ))}
    </div>
  );
}

function ActionItem({ action }: { action: EventActionRow }) {
  const [payloadOpen, setPayloadOpen] = useState(false);
  const cfg = actionStatusConfig[action.status] || actionStatusConfig.pending;

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1.5">
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
          #{action.step_order}
        </span>
        <Badge variant="outline" className={cn("text-xs", cfg.className)}>
          {cfg.label}
        </Badge>
        {action.flow_step && (
          <span className="text-xs text-foreground font-medium">
            {stepTypeLabel(action.flow_step.step_type)}
            {action.flow_step.variable_name && (
              <span className="text-muted-foreground ml-1">→ {action.flow_step.variable_name}</span>
            )}
          </span>
        )}
        {action.latency_ms != null && (
          <span className="text-xs text-muted-foreground ml-auto">
            {action.latency_ms}ms
          </span>
        )}
      </div>

      {action.error_message && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
          {action.error_message}
        </p>
      )}

      {action.sent_payload_json && (
        <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {payloadOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Payload
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-1 p-2 bg-muted rounded text-xs text-foreground overflow-auto max-h-32">
              {JSON.stringify(action.sent_payload_json, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function EventItem({ event }: { event: EventRow }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[event.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  const isAnimated = event.status === "pending" || event.status === "processing";

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="w-full flex items-center flex-wrap gap-2 sm:gap-3 px-3 py-2.5 hover:bg-muted/60 rounded-lg transition-colors text-left group">
        <span className="text-xs text-muted-foreground font-mono w-14 shrink-0 hidden sm:inline">
          {format(new Date(event.created_at), "HH:mm:ss")}
        </span>

        <Badge variant="outline" className={cn("text-xs", cfg.className)}>
          <StatusIcon className={cn("h-3 w-3 mr-1", isAnimated && "animate-spin")} />
          {cfg.label}
        </Badge>

        <span className="flex items-center gap-1 text-xs text-foreground">
          <User className="h-3 w-3 text-muted-foreground" />
          {event.push_name || maskPhone(event.chat_id)}
        </span>

        <span className="text-xs text-muted-foreground truncate flex-1">
          {event.message_text ? (event.message_text.length > 40 ? event.message_text.slice(0, 40) + "…" : event.message_text) : ""}
        </span>

        <span className="text-xs text-muted-foreground hidden sm:inline">
          {getDuration(event.created_at, event.completed_at)}
        </span>

        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted group-hover:text-muted-foreground transition-colors" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-0 sm:ml-[72px] border-l-2 border-border pl-3 mb-2">
          {/* Error message */}
          {event.error_message && (
            <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-lg mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{event.error_message}</p>
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-muted-foreground">
              Chat: {maskPhone(event.chat_id)}
            </span>
            <span className="text-xs text-muted-foreground">
              Instância: {event.instance_id.slice(0, 8)}…
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss")}
            </span>
          </div>

          {/* Actions */}
          <EventActions eventId={event.id} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FlowExecutionLogs({ flowId, userId }: FlowExecutionLogsProps) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchEvents = useCallback(async (append = false) => {
    if (!append) setIsLoading(true);
    else setLoadingMore(true);

    try {
      let query = supabase
        .from("events")
        .select("id, chat_id, instance_id, push_name, status, error_message, created_at, completed_at, message_text")
        .eq("chosen_flow_id", flowId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        query = query.or(`push_name.ilike.%${search.trim()}%,chat_id.ilike.%${search.trim()}%`);
      }

      if (append && events.length > 0) {
        const last = events[events.length - 1];
        query = query.lt("created_at", last.created_at);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      const hasNext = rows.length > PAGE_SIZE;
      const pageRows = hasNext ? rows.slice(0, PAGE_SIZE) : rows;

      if (append) {
        setEvents(prev => [...prev, ...pageRows]);
      } else {
        setEvents(pageRows);
      }
      setHasMore(hasNext);
    } catch (err) {
      console.error("Error fetching execution logs:", err);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, [flowId, userId, statusFilter, search, events]);

  useEffect(() => {
    fetchEvents(false);
  }, [flowId, userId, statusFilter]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchEvents(false), 400);
    return () => clearTimeout(t);
  }, [search]);

  const stats = {
    total: events.length,
    completed: events.filter(e => e.status === "completed").length,
    failed: events.filter(e => e.status === "failed" || e.status === "error").length,
    timeout: events.filter(e => e.status === "timeout").length,
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent" />
            <CardTitle className="text-base sm:text-lg text-foreground">Logs de Execução</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchEvents(false)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground self-end sm:self-auto"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-muted-foreground">
          Histórico detalhado de cada execução deste fluxo
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por contato ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-border text-foreground"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9 bg-muted/50 border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="timeout">Timeout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 bg-muted/50 rounded-lg border border-border text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg border border-success/20 text-center">
            <p className="text-xs text-success">Sucesso</p>
            <p className="text-lg font-semibold text-success">{stats.completed}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg border border-destructive/20 text-center">
            <p className="text-xs text-destructive">Erros</p>
            <p className="text-lg font-semibold text-destructive">{stats.failed}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg border border-warning/20 text-center">
            <p className="text-xs text-warning">Timeout</p>
            <p className="text-lg font-semibold text-warning">{stats.timeout}</p>
          </div>
        </div>

        {/* Events list */}
        <div className="bg-muted/50 rounded-lg border border-border">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Execuções
            </span>
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-14 bg-muted" />
                  <Skeleton className="h-5 w-20 bg-muted" />
                  <Skeleton className="h-4 w-24 bg-muted" />
                  <Skeleton className="h-4 flex-1 bg-muted" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="h-10 w-10 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma execução registrada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                As execuções aparecerão aqui quando o fluxo for acionado
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y divide-border">
                {events.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>

              {hasMore && (
                <div className="p-3 text-center border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchEvents(true)}
                    disabled={loadingMore}
                    className="text-xs text-muted-foreground"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Carregar mais
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
