import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw, Loader2, ListX, User, ChevronDown, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  success: { label: "Sucesso", variant: "default" },
  retried_success: { label: "Sucesso", variant: "default" },
  error: { label: "Erro", variant: "destructive" },
  pending: { label: "Pendente", variant: "secondary" },
  skipped: { label: "Pulado", variant: "secondary" },
  validation_failed: { label: "Validação", variant: "destructive" },
};

// Extract sender scoped ID from event payload
function extractSenderFromPayload(payload: any): string | null {
  if (!payload) return null;
  // DM: payload.sender.id
  const senderId = payload?.sender?.id;
  if (senderId) return String(senderId);
  // Comment: payload.value.from.id
  const fromId = payload?.value?.from?.id;
  if (fromId) return String(fromId);
  return null;
}

export function InstagramLogsTab() {
  const { data: org } = useUserOrganization();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: logs, isLoading } = useQuery({
    queryKey: ["instagram-logs", org?.id, statusFilter],
    queryFn: async () => {
      if (!org?.id) return [];
      let query = supabase
        .from("instagram_action_logs")
        .select("id, action_type, status, human_summary, latency_ms, created_at, automation_id, error_message, event_id, session_id, instagram_sessions(ig_user_scoped_id)")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;

      // Collect scoped IDs from sessions
      const scopedIds = new Set<string>();
      const eventIdsWithoutSession = new Set<string>();
      (data ?? []).forEach((log: any) => {
        const sid = log.instagram_sessions?.ig_user_scoped_id;
        if (sid) {
          scopedIds.add(sid);
        } else if (log.event_id) {
          eventIdsWithoutSession.add(log.event_id);
        }
      });

      // Fallback: fetch event payloads for logs without session
      let eventPayloadMap: Record<string, string> = {};
      if (eventIdsWithoutSession.size > 0) {
        const { data: events } = await supabase
          .from("instagram_events")
          .select("id, payload_json")
          .in("id", Array.from(eventIdsWithoutSession));
        if (events) {
          events.forEach((ev: any) => {
            const senderId = extractSenderFromPayload(ev.payload_json);
            if (senderId) {
              eventPayloadMap[ev.id] = senderId;
              scopedIds.add(senderId);
            }
          });
        }
      }

      // Resolve leads
      let leadsMap: Record<string, { ig_name: string | null; ig_handle: string | null }> = {};
      if (scopedIds.size > 0) {
        const { data: leads } = await supabase
          .from("instagram_leads")
          .select("ig_user_scoped_id, ig_name, ig_handle")
          .eq("organization_id", org.id)
          .in("ig_user_scoped_id", Array.from(scopedIds));
        if (leads) {
          leads.forEach((l: any) => {
            leadsMap[l.ig_user_scoped_id] = { ig_name: l.ig_name, ig_handle: l.ig_handle };
          });
        }
      }

      return (data ?? []).map((log: any) => {
        const sid = log.instagram_sessions?.ig_user_scoped_id;
        const fallbackSid = !sid && log.event_id ? eventPayloadMap[log.event_id] : null;
        const finalSid = sid || fallbackSid || null;
        const lead = finalSid ? leadsMap[finalSid] : null;
        return { ...log, _ig_scoped_id: finalSid, _ig_name: lead?.ig_name, _ig_handle: lead?.ig_handle };
      });
    },
    enabled: !!org?.id,
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRetry = async (logEntry: any) => {
    try {
      setRetrying(logEntry.id);
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Não autenticado");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-jobs-retry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ action_log_id: logEntry.id }),
        }
      );
      if (!res.ok) throw new Error("Falha ao retentar");
      toast.success("Retentativa agendada!");
    } catch {
      toast.error("Erro ao agendar retentativa");
    } finally {
      setRetrying(null);
    }
  };

  const getClientLabel = (log: any) => {
    if (log._ig_handle) return `@${log._ig_handle}`;
    if (log._ig_name) return log._ig_name;
    if (log._ig_scoped_id) return log._ig_scoped_id.substring(0, 10) + "…";
    return "—";
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-muted border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(!logs || logs.length === 0) ? (
        <div className="quantum-glass rounded-xl p-8 text-center space-y-3">
          <ListX className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-foreground font-medium">Nenhum log encontrado</h3>
          <p className="text-sm text-muted-foreground">Os logs aparecerão aqui quando as automações forem executadas.</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {logs.map((log: any) => {
              const sb = statusBadge[log.status] ?? statusBadge.pending;
              const isExpanded = expandedRows.has(log.id);
              const clientLabel = getClientLabel(log);

              return (
                <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleRow(log.id)}>
                  <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        
                        <span className="text-xs text-muted-foreground whitespace-nowrap w-[72px] shrink-0">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>

                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-xs text-foreground truncate min-w-[90px] max-w-[160px]">
                                <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate">{clientLabel}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>{log._ig_name && `${log._ig_name} `}{log._ig_handle && `(@${log._ig_handle}) `}{log._ig_scoped_id && `ID: ${log._ig_scoped_id}`}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <span className="text-xs font-mono text-muted-foreground truncate min-w-[80px] max-w-[140px]">{log.action_type}</span>

                        <Badge variant={sb.variant} className="text-xs shrink-0">{sb.label}</Badge>

                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground truncate flex-1 hidden sm:block">
                                {log.human_summary ?? log.error_message ?? ""}
                              </span>
                            </TooltipTrigger>
                            {(log.human_summary || log.error_message) && (
                              <TooltipContent side="top" className="max-w-sm">
                                <p className="text-sm whitespace-pre-wrap">{log.human_summary || log.error_message}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>

                        {log.status === "error" && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-7 px-2 text-xs shrink-0"
                                  onClick={(e) => { e.stopPropagation(); handleRetry(log); }}
                                  disabled={retrying === log.id}
                                >
                                  {retrying === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Tentar novamente</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-3 pt-1 border-t border-border/30 space-y-2 text-sm">
                        {log._ig_scoped_id && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-foreground">Usuário:</span>
                            <span className="text-foreground">
                              {log._ig_name && `${log._ig_name} `}
                              {log._ig_handle && `(@${log._ig_handle}) `}
                              {!log._ig_name && !log._ig_handle && log._ig_scoped_id}
                            </span>
                          </div>
                        )}
                        {log.human_summary && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Resumo:</span>
                            <p className="text-foreground mt-0.5">{log.human_summary}</p>
                          </div>
                        )}
                        {log.error_message && (
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                            <div>
                              <span className="text-xs font-medium text-destructive">Erro:</span>
                              <p className="text-destructive/90 mt-0.5">{log.error_message}</p>
                            </div>
                          </div>
                        )}
                        {log.latency_ms != null && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Latência: {log.latency_ms}ms
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
