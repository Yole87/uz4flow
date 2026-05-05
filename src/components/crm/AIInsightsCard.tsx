import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, TrendingUp, MessageSquare, ArrowRight, RefreshCw, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAnalysis {
  summary: string;
  sentiment: "positive" | "negative" | "neutral";
  suggested_reply: string;
  next_action: string;
  interest_level?: "high" | "medium" | "low";
  analyzed_at?: string;
}

interface AIInsightsCardProps {
  contactId: string;
  existingAnalysis?: AIAnalysis | null;
  notes?: string;
}

export function AIInsightsCard({ contactId, existingAnalysis, notes }: AIInsightsCardProps) {
  const queryClient = useQueryClient();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(existingAnalysis || null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset analysis when contact changes
  useEffect(() => {
    setAnalysis(existingAnalysis || null);
  }, [existingAnalysis, contactId]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("analyze-conversation", {
        body: { contact_id: contactId, notes },
      });
      
      if (error) throw error;
      return data as AIAnalysis;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      queryClient.invalidateQueries({ queryKey: ["crm-contact", contactId] });
      toast.success("Análise concluída!");
    },
    onError: (error: Error) => {
      console.error("Analysis error:", error);
      if (error.message?.includes("429")) {
        toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
      } else if (error.message?.includes("402")) {
        toast.error("Créditos insuficientes. Adicione fundos ao workspace.");
      } else {
        toast.error("Erro ao analisar conversa");
      }
    },
  });

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado para a área de transferência!");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const sentimentConfig = {
    positive: {
      label: "Positivo",
      color: "bg-accent/20 text-accent border-accent/30",
      icon: "😊",
    },
    negative: {
      label: "Negativo",
      color: "bg-destructive/20 text-destructive border-destructive/30",
      icon: "😟",
    },
    neutral: {
      label: "Neutro",
      color: "bg-muted text-muted-foreground border-border",
      icon: "😐",
    },
  };

  const interestConfig = {
    high: { label: "Alto", color: "text-accent" },
    medium: { label: "Médio", color: "text-yellow-400" },
    low: { label: "Baixo", color: "text-muted-foreground" },
  };

  const shouldShowExpanded = analysis && (
    analysis.summary.length > 100 || 
    analysis.suggested_reply.length > 80 ||
    analysis.next_action.length > 50
  );

  return (
    <Card className="bg-gradient-to-br from-purple-900/30 via-card to-accent/20 border-purple-500/30 shadow-lg shadow-purple-500/10 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
          <Sparkles className="h-4 w-4 text-purple-400" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analyzeMutation.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-3/4 bg-muted" />
            <Skeleton className="h-8 w-24 bg-muted" />
          </div>
        ) : analysis ? (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            {/* Sentiment Badge */}
            <div className="flex items-center gap-2">
              <span className="text-lg">{sentimentConfig[analysis.sentiment]?.icon}</span>
              <Badge
                variant="outline"
                className={cn("text-xs", sentimentConfig[analysis.sentiment]?.color)}
              >
                {sentimentConfig[analysis.sentiment]?.label}
              </Badge>
              {analysis.interest_level && (
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  Interesse: <span className={cn("ml-1", interestConfig[analysis.interest_level]?.color)}>
                    {interestConfig[analysis.interest_level]?.label}
                  </span>
                </Badge>
              )}
            </div>

            {/* Summary - Always visible but truncated */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Resumo
              </div>
              <p className={cn("text-sm text-foreground", !isExpanded && "line-clamp-2")}>
                {analysis.summary}
              </p>
            </div>

            <CollapsibleContent className="space-y-3">
              {/* Suggested Reply with Copy Button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    Sugestão de Resposta
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(analysis.suggested_reply)}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground italic bg-card/50 rounded p-2 border-l-2 border-purple-500">
                  "{analysis.suggested_reply}"
                </p>
              </div>

              {/* Next Action */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3" />
                  Próxima Ação
                </div>
                <p className="text-sm text-accent">{analysis.next_action}</p>
              </div>
            </CollapsibleContent>

            {/* Expand/Collapse Toggle */}
            {shouldShowExpanded && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/50 mt-1"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-2" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-2" />
                      Ver mais
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => analyzeMutation.mutate()}
              className="w-full text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Reanalisar
            </Button>
          </Collapsible>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Use IA para analisar esta conversa
            </p>
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-accent hover:from-purple-500 hover:to-accent text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analisar Conversa
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
