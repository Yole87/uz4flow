import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BrainCircuit,
  CheckCircle2,
  XCircle,
  SkipForward,
  FileJson2,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationEvalCardProps {
  conversationId: string;
}

export function ConversationEvalCard({ conversationId }: ConversationEvalCardProps) {
  const queryClient = useQueryClient();

  const { data: evaluation, isLoading } = useQuery({
    queryKey: ["conversation-eval", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_evaluations")
        .select("id, extracted_data, ai_summary, webhook_status, webhook_response, evaluated_at")
        .eq("conversation_id", conversationId)
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
    refetchInterval: 60_000,
  });

  // Realtime: refresh when a new evaluation arrives for this conversation
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`eval-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_evaluations",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-eval", conversationId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!evaluation) {
    return (
      <Card className="border-border bg-card/50 border-dashed">
        <CardContent className="px-3 sm:px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 opacity-60" />
          <span>Aguardando próxima avaliação automática desta conversa.</span>
        </CardContent>
      </Card>
    );
  }


  const extracted = (evaluation.extracted_data || {}) as Record<string, unknown>;
  const entries = Object.entries(extracted).filter(([k]) => k !== "resumo" && k !== "sentimento");
  const sentiment = extracted.sentimento as string | undefined;

  const statusBadge = (status: string | null) => {
    if (status === "sent")
      return (
        <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-500/10 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Enviado
        </Badge>
      );
    if (status === "partial")
      return (
        <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-500/10 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Parcial
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

  return (
    <Card className="border-border bg-card">
      <CardHeader className="px-3 sm:px-4 py-2 sm:py-3">
        <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Avaliação IA
          </span>
          <div className="flex items-center gap-1.5">
            {sentiment && (
              <Badge variant="outline" className="text-xs capitalize border-border">
                {sentiment}
              </Badge>
            )}
            {statusBadge(evaluation.webhook_status)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3 space-y-2">
        {/* Summary */}
        {evaluation.ai_summary && (
          <p className="text-xs text-muted-foreground line-clamp-3">{evaluation.ai_summary}</p>
        )}

        {/* Compact variables */}
        {entries.length > 0 && (
          <div className="space-y-1">
            {entries.slice(0, 4).map(([key, value]) => (
              <div key={key} className="flex items-baseline gap-1.5 text-xs">
                <span className="text-muted-foreground font-mono shrink-0">{key}:</span>
                <span className="text-foreground truncate">{String(value ?? "—")}</span>
              </div>
            ))}
            {entries.length > 4 && (
              <p className="text-xs text-muted-foreground">+{entries.length - 4} variáveis</p>
            )}
          </div>
        )}

        {/* Date + Detail button */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {evaluation.evaluated_at
              ? format(new Date(evaluation.evaluated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
              : ""}
          </span>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-2">
                <FileJson2 className="h-3 w-3 mr-1" />
                Ver Detalhes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  Detalhes da Avaliação
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {evaluation.ai_summary && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo</p>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground whitespace-pre-wrap">
                      {evaluation.ai_summary}
                    </div>
                  </div>
                )}

                {Object.keys(extracted).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variáveis</p>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {Object.entries(extracted).map(([key, value]) => (
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

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Webhook</p>
                  <div className="flex items-center gap-2 mb-2">
                    {statusBadge(evaluation.webhook_status)}
                  </div>
                  {evaluation.webhook_response && (
                    <pre className="p-3 rounded-lg bg-muted/50 border border-border text-xs font-mono overflow-auto max-h-[200px] text-foreground/80">
                      {JSON.stringify(evaluation.webhook_response, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
