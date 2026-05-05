import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
  AlertTriangle,
  Copy,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EvalVariable {
  name: string;
  description: string;
  type: string;
}

interface Mapping {
  target_field: string;
  source_variable: string;
  confidence: "alta" | "media" | "baixa";
  reason: string;
}

interface MappingResult {
  mappings: Mapping[];
  converted_payload: string;
  observations: string;
}

interface Props {
  variables: EvalVariable[];
  onApplyTemplate: (template: string) => void;
}

const SYSTEM_VARIABLES = [
  { name: "resumo", description: "Resumo da conversa gerado pela IA" },
  { name: "sentimento", description: "Sentimento: positivo/negativo/neutro" },
  { name: "contactName", description: "Nome do contato" },
  { name: "contactPhone", description: "Telefone do contato" },
  { name: "conversationId", description: "ID da conversa" },
];

const confidenceColors: Record<string, string> = {
  alta: "text-emerald-400 border-emerald-400/30 bg-emerald-500/10",
  media: "text-yellow-400 border-yellow-400/30 bg-yellow-500/10",
  baixa: "text-destructive border-destructive/30 bg-destructive/10",
};

export function EvalAIMappingDialog({ variables, onApplyTemplate }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [targetPayload, setTargetPayload] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MappingResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!targetPayload.trim()) {
      toast.error("Cole o payload de exemplo do sistema de destino");
      return;
    }

    try {
      JSON.parse(targetPayload);
    } catch {
      toast.error("O payload deve ser um JSON válido");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("webhook-eval-ai-mapping", {
        body: {
          target_payload_example: targetPayload,
          variables: variables.map((v) => ({
            name: v.name,
            description: v.description,
          })),
          system_variables: SYSTEM_VARIABLES,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResult(data as MappingResult);
      setStep(2);
    } catch (err: any) {
      toast.error("Erro ao gerar mapeamento: " + (err.message || "Falha"));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result?.converted_payload) return;

    let template = result.converted_payload;
    try {
      template = JSON.stringify(JSON.parse(template), null, 2);
    } catch {
    }

    onApplyTemplate(template);
    toast.success("Template aplicado com sucesso!");
    setOpen(false);
  };

  const handleCopy = () => {
    if (!result?.converted_payload) return;
    let template = result.converted_payload;
    try {
      template = JSON.stringify(JSON.parse(template), null, 2);
    } catch {}
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setStep(1);
      setResult(null);
      setTargetPayload("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Gerar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Mapeamento DE/PARA com IA
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Cole abaixo um exemplo do payload JSON que o sistema de destino espera receber.
                A IA vai analisar e mapear automaticamente as variáveis do OpenFlow para os campos do destino.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Variáveis de origem disponíveis:
              </Label>
              <div className="flex flex-wrap gap-1">
                {SYSTEM_VARIABLES.map((v) => (
                  <TooltipProvider key={v.name}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs">
                          {v.name}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{v.description}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
                {variables
                  .filter((v) => v.name)
                  .map((v) => (
                    <TooltipProvider key={v.name}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs">
                            {v.name}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{v.description}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Payload de exemplo do sistema de destino</Label>
              <Textarea
                rows={12}
                className="font-mono text-xs"
                placeholder={`{\n  "lead": {\n    "name": "João Silva",\n    "phone": "+5511999999999",\n    "source": "whatsapp"\n  },\n  "notes": "Interessado em plano premium",\n  "status": "new"\n}`}
                value={targetPayload}
                onChange={(e) => setTargetPayload(e.target.value)}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !targetPayload.trim()}
              className="w-full gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Analisando com IA..." : "Gerar Mapeamento"}
            </Button>
          </div>
        )}

        {step === 2 && result && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Mapeamento DE/PARA</Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">
                        Origem (OpenFlow)
                      </th>
                      <th className="px-1 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">
                        Destino (Sistema)
                      </th>
                      <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium">
                        Confiança
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.mappings.map((m, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={m.source_variable === "não_mapeado" ? "destructive" : "secondary"}
                                  className="text-xs font-mono"
                                >
                                  {m.source_variable === "não_mapeado"
                                    ? "⚠ não mapeado"
                                    : `{{${m.source_variable}}}`}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[200px]">{m.reason}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-1 py-2 text-center">
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground inline" />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-foreground">
                          {m.target_field}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge
                            variant="outline"
                            className={`text-xs ${confidenceColors[m.confidence] || ""}`}
                          >
                            {m.confidence}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {result.observations && (
              <div className="flex gap-2 p-3 rounded-lg border border-border bg-muted/30">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{result.observations}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Payload Convertido</Label>
              <pre className="p-3 rounded-lg bg-muted/50 border border-border text-xs font-mono overflow-auto max-h-[200px] text-foreground/80">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(result.converted_payload), null, 2);
                  } catch {
                    return result.converted_payload;
                  }
                })()}
              </pre>
            </div>

            {result.mappings.some((m) => m.source_variable === "não_mapeado") && (
              <div className="flex gap-2 p-3 rounded-lg border border-yellow-400/30 bg-yellow-500/5">
                <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Alguns campos não foram mapeados. Você pode adicionar variáveis customizadas
                  na seção de "Variáveis para Extração" e gerar novamente.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button onClick={handleApply} className="gap-1.5 flex-1">
                <Check className="h-4 w-4" />
                Aplicar Template
              </Button>
              <Button variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button variant="ghost" onClick={handleReset} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Refazer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
