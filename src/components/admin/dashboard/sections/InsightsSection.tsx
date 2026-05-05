import { SectionShell, formatNumber } from "../SectionShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Info, TrendingUp, Trophy } from "lucide-react";
import type { AdminDashboardData } from "@/hooks/admin/useAdminDashboardData";

interface Props {
  data?: AdminDashboardData;
  loading: boolean;
  compareEnabled: boolean;
}

function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="O que é isto?"
          className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="max-w-[300px] z-[200] bg-popover text-popover-foreground border"
      >
        <p className="text-xs leading-relaxed">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function InsightsSection({ data, compareEnabled }: Props) {
  const k = data?.insights;
  return (
    <SectionShell
      title="Insights Críticos"
      subtitle={
        compareEnabled
          ? "Quem precisa de atenção agora, quem está crescendo e quem pode virar case de sucesso."
          : "Ative a comparação de período para detectar clientes em risco e campeões."
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="border-destructive/40 relative">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
              <span className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="truncate">Clientes em risco</span>
              </span>
              <HelpTip text="Clientes pagantes ativos cujo volume de mensagens caiu 50% ou mais comparado ao período anterior. Sinal forte de desengajamento — abordar antes que cancelem. Mostra os 5 com maior queda." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!compareEnabled ? (
              <p className="text-xs text-muted-foreground">Ative comparação para ver.</p>
            ) : (k?.atRiskClients?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum cliente com queda crítica.</p>
            ) : (
              <ul className="space-y-2">
                {k!.atRiskClients.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">{c.name}</span>
                    <Badge variant="destructive">−{c.dropPct.toFixed(0)}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-success/40 relative">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
              <span className="flex items-center gap-2 min-w-0">
                <TrendingUp className="h-4 w-4 text-success shrink-0" />
                <span className="truncate">Clientes campeões</span>
              </span>
              <HelpTip text="Clientes cujo volume de mensagens cresceu 50% ou mais comparado ao período anterior. Mostra os 5 maiores crescimentos — bons candidatos a expansão de plano e indicações." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!compareEnabled ? (
              <p className="text-xs text-muted-foreground">Ative comparação para ver.</p>
            ) : (k?.championClients?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum crescimento expressivo.</p>
            ) : (
              <ul className="space-y-2">
                {k!.championClients.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">{c.name}</span>
                    <Badge variant="default">+{c.growthPct.toFixed(0)}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="relative">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
              <span className="flex items-center gap-2 min-w-0">
                <Trophy className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Candidatos a cases</span>
              </span>
              <HelpTip text="Clientes pagantes há 3 meses ou mais com alto volume de uso (>100 mensagens no período). Bons candidatos para depoimento, estudo de caso ou material de marketing." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(k?.successCases?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum candidato (≥3 meses pagantes + alto uso).</p>
            ) : (
              <ul className="space-y-2">
                {k!.successCases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">
                      {c.name}
                      <span className="block text-xs text-muted-foreground">{c.plan}</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs">{formatNumber(c.messages)} msgs</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
