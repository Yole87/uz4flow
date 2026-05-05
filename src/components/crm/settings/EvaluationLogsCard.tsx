import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BrainCircuit,
  CheckCircle2,
  XCircle,
  SkipForward,
  ChevronRight,
  FileJson2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EvaluationRow {
  id: string;
  conversation_id: string;
  extracted_data: Record<string, unknown> | null;
  ai_summary: string | null;
  webhook_status: string | null;
  webhook_response: Record<string, unknown> | null;
  evaluated_at: string | null;
  last_message_at_snapshot: string | null;
  contact: { name: string | null; phone: string } | null;
}

export function EvaluationLogsCard() {
  const { data: org } = useUserOrganization();
  const organizationId = org?.id;
  const [selectedEval, setSelectedEval] = useState<EvaluationRow | null>(null);
  const [pageSize, setPageSize] = useState(50);

  const { data: evaluations, isLoading, refetch } = useQuery({
    queryKey: ["evaluation-logs", organizationId, pageSize],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_evaluations")
        .select(`
          id,
          conversation_id,
          extracted_data,
          ai_summary,
          webhook_status,
          webhook_response,
          evaluated_at,
          last_message_at_snapshot,
          contact:contacts(name, phone)
        `)
        .eq("organization_id", organizationId!)
        .order("evaluated_at", { ascending: false })
        .limit(pageSize);
      if (error) throw error;
      return (data || []) as unknown as EvaluationRow[];
    },
    enabled: !!organizationId,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  // Realtime: refresh on insert/update for this org
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`eval-logs-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_evaluations",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, refetch]);

  const stats = {
    total: evaluations?.length || 0,
    sent: evaluations?.filter((e) => e.webhook_status === "sent").length || 0,
    failed: evaluations?.filter((e) => e.webhook_status === "failed").length || 0,
    skipped: evaluations?.filter((e) => e.webhook_status === "skipped" || !e.webhook_status).length || 0,
  };

  const statusBadge = (status: string | null) => {
    if (status === "sent")
      return (
        <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-500/10 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Enviado
        </Badge>
      );
    if (status === "failed")
      return (
        <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 text-xs">
          <XCircle className="h-3 w-3 mr-0.5" /> Falha
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-muted-foreground border-border text-xs">
        <SkipForward className="h-3 w-3 mr-0.5" /> Sem webhook
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <BrainCircuit className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Nenhuma avaliação registrada ainda.
      </div>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 pb-3">
        <div className="text-center p-2 rounded-lg bg-muted/50 border border-border">
          <p className="text-lg font-semibold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-lg font-semibold text-emerald-400">{stats.sent}</p>
          <p className="text-xs text-muted-foreground">Enviados</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-lg font-semibold text-destructive">{stats.failed}</p>
          <p className="text-xs text-muted-foreground">Falhas</p>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="max-h-[350px]">
        <div className="space-y-1">
          {evaluations.map((ev) => {
            const contactName = ev.contact?.name || ev.contact?.phone || "—";
            const evalDate = ev.evaluated_at
              ? format(new Date(ev.evaluated_at), "dd/MM HH:mm", { locale: ptBR })
              : "—";
            const sentiment = (ev.extracted_data as Record<string, unknown>)?.sentimento as string | undefined;

            return (
              <button
                key={ev.id}
                onClick={() => setSelectedEval(ev)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{contactName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{evalDate}</span>
                    {sentiment && (
                      <Badge variant="outline" className="text-xs capitalize border-border">
                        {sentiment}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(ev.webhook_status)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {evaluations && evaluations.length >= pageSize && (
        <div className="pt-2 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageSize((s) => s + 50)}
            className="text-xs"
          >
            Carregar mais 50
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedEval} onOpenChange={() => setSelectedEval(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              Detalhes da Avaliação
            </DialogTitle>
          </DialogHeader>

          {selectedEval && (
            <div className="space-y-4">
              {/* Contact info */}
              <div className="text-sm">
                <span className="text-muted-foreground">Contato: </span>
                <span className="text-foreground font-medium">
                  {selectedEval.contact?.name || selectedEval.contact?.phone || "—"}
                </span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {selectedEval.evaluated_at
                    ? format(new Date(selectedEval.evaluated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : ""}
                </span>
              </div>

              {/* AI Summary */}
              {selectedEval.ai_summary && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo da IA</p>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground whitespace-pre-wrap">
                    {selectedEval.ai_summary}
                  </div>
                </div>
              )}

              {/* Extracted Variables */}
              {selectedEval.extracted_data && Object.keys(selectedEval.extracted_data).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variáveis Extraídas</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(selectedEval.extracted_data).map(([key, value]) => (
                          <tr key={key} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs bg-muted/30 w-1/3">{key}</td>
                            <td className="px-3 py-2 text-foreground text-xs">{String(value ?? "—")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Webhook Status & Response */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <FileJson2 className="h-3.5 w-3.5" />
                  Webhook
                </p>
                <div className="flex items-center gap-2 mb-2">
                  {statusBadge(selectedEval.webhook_status)}
                </div>
                {selectedEval.webhook_response && (
                  <pre className="p-3 rounded-lg bg-muted/50 border border-border text-xs font-mono overflow-auto max-h-[200px] text-foreground/80">
                    {JSON.stringify(selectedEval.webhook_response, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
