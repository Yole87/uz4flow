import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { GitBranch, Phone, ExternalLink, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const OUTCOME_CONFIG: Record<string, { label: string; className: string }> = {
  answered: { label: "Atendida", className: "border-emerald-500/50 text-emerald-500" },
  voicemail: { label: "Caixa postal", className: "border-amber-500/50 text-amber-500" },
  no_answer: { label: "Não atendeu", className: "border-red-500/50 text-red-500" },
  failed: { label: "Falhou", className: "border-red-500/50 text-red-500" },
  pending: { label: "Em andamento", className: "border-muted text-muted-foreground" },
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FlowVoiceCallsTab() {
  const { data: organization } = useUserOrganization();
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<any | null>(null);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["flow-voice-calls", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("voice_calls")
        .select(`
          id, status, transcript, summary, duration_seconds, ended_reason,
          flow_session_id, flow_step_id, flow_attempt_number, flow_outcome,
          created_at, contact_id,
          contact:contacts(id, name, phone),
          flow_session:flow_sessions(id, flow_id, flow:flows(id, name))
        `)
        .eq("organization_id", organization.id)
        .not("flow_session_id", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const filtered = useMemo(() => {
    if (outcomeFilter === "all") return calls;
    return calls.filter((c: any) => (c.flow_outcome || "pending") === outcomeFilter);
  }, [calls, outcomeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-fuchsia-500" />
          <h2 className="text-lg font-semibold text-foreground">Ligações disparadas por fluxos</h2>
        </div>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filtrar por resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os resultados</SelectItem>
            <SelectItem value="answered">Atendidas</SelectItem>
            <SelectItem value="voicemail">Caixa postal</SelectItem>
            <SelectItem value="no_answer">Não atendeu</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="pending">Em andamento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma ligação por fluxo ainda</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Adicione um nó <strong>"Chamada Voice AI"</strong> em um fluxo para ver as ligações aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((call: any) => {
            const outcomeKey = call.flow_outcome || (call.status === "completed" ? "answered" : "pending");
            const outcomeCfg = OUTCOME_CONFIG[outcomeKey] || OUTCOME_CONFIG.pending;
            const flowId = call.flow_session?.flow_id;
            const flowName = call.flow_session?.flow?.name || "Fluxo";
            return (
              <Card key={call.id} className="hover:border-fuchsia-500/40 transition-colors">
                <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {call.contact?.name || call.contact?.phone || "Contato sem nome"}
                      </span>
                      <Badge variant="outline" className={outcomeCfg.className}>
                        {outcomeCfg.label}
                      </Badge>
                      {call.flow_attempt_number > 1 && (
                        <Badge variant="outline" className="text-xs">Tentativa {call.flow_attempt_number}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      {flowId && (
                        <Link to={`/flows/${flowId}`} className="flex items-center gap-1 hover:text-fuchsia-400 transition-colors">
                          <GitBranch className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{flowName}</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      <span>⏱ {formatDuration(call.duration_seconds)}</span>
                      <span>{format(new Date(call.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedCall(call)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Detalhes
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!selectedCall} onOpenChange={(o) => !o && setSelectedCall(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da ligação</SheetTitle>
            <SheetDescription>
              {selectedCall?.contact?.name || selectedCall?.contact?.phone}
            </SheetDescription>
          </SheetHeader>
          {selectedCall && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <p className="font-medium">{OUTCOME_CONFIG[selectedCall.flow_outcome || "pending"]?.label || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p className="font-medium">{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tentativa</p>
                  <p className="font-medium">{selectedCall.flow_attempt_number || 1}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Encerramento</p>
                  <p className="font-medium text-xs">{selectedCall.ended_reason || "—"}</p>
                </div>
              </div>

              {selectedCall.summary && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Resumo</h4>
                  <p className="text-sm bg-muted/40 rounded p-2">{selectedCall.summary}</p>
                </div>
              )}

              {selectedCall.transcript && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Transcrição</h4>
                  <pre className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                    {(() => {
                      try {
                        const parsed = JSON.parse(selectedCall.transcript);
                        if (Array.isArray(parsed)) {
                          return parsed.map((m: any) => `${m.role === "ai" ? "🤖" : "👤"} ${m.content}`).join("\n\n");
                        }
                      } catch { /* not json */ }
                      return selectedCall.transcript;
                    })()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
