import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "./ExportButton";
import { useReportFunnel } from "@/hooks/reports/useReportData";
import type { ReportPeriod } from "./ReportFilters";
import { buildReportFileName } from "@/lib/reports/exporters";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Kanban, Info, AlertTriangle, Clock } from "lucide-react";

interface FunnelTabProps {
  organizationId?: string;
  period: ReportPeriod;
  instanceId: string | null;
}

export function FunnelTab({ organizationId, period, instanceId }: FunnelTabProps) {
  const { data, isLoading } = useReportFunnel({ organizationId, period, instanceId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data || data.pipelines.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={Kanban}
        title="Nenhum funil configurado"
        description="Crie um pipeline no Kanban para visualizar conversões entre estágios."
      />
    );
  }

  const funnelFile = buildReportFileName("funil-estagios", period.start, period.end);
  const stagnantFile = buildReportFileName("funil-leads-estagnados", period.start, period.end);

  const allStages = data.pipelines.flatMap((p) =>
    p.stages.map((s) => ({
      pipeline: p.name,
      stage: s.name,
      count: s.count,
      conversion: s.conversionPct === null ? "—" : `${s.conversionPct.toFixed(1)}%`,
      bottleneck: s.isBottleneck ? "Sim" : "Não",
    }))
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4 px-3 sm:px-4">
            <span className="text-xs font-medium text-muted-foreground">Total no funil</span>
            <div className="text-2xl font-bold tracking-tight">{data.totalContacts}</div>
            <p className="text-xs text-muted-foreground mt-1.5">contatos cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <span className="text-xs font-medium text-muted-foreground">Fechados</span>
            <div className="text-2xl font-bold tracking-tight text-success">{data.closedCount}</div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {data.totalContacts > 0
                ? `${((data.closedCount / data.totalContacts) * 100).toFixed(1)}% do total`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Tempo médio de ciclo
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      Aproximação calculada a partir da última atualização do contato. Para precisão exata,
                      necessitamos de histórico de movimentação entre estágios (futura evolução).
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </span>
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {data.avgCycleDays > 0 ? `${data.avgCycleDays.toFixed(1)}d` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">criação → fechamento</p>
          </CardContent>
        </Card>
      </div>

      {data.pipelines.map((pipeline) => (
        <Card key={pipeline.id}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 min-w-0">
                <Kanban className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{pipeline.name}</span>
              </h3>
              <div className="shrink-0">
                <ExportButton
                  fileName={funnelFile}
                  rows={allStages}
                  columns={[
                    { key: "pipeline", label: "Funil" },
                    { key: "stage", label: "Estágio" },
                    { key: "count", label: "Quantidade" },
                    { key: "conversion", label: "Conversão" },
                    { key: "bottleneck", label: "Gargalo" },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              {pipeline.stages.map((stage, idx) => {
                const max = Math.max(...pipeline.stages.map((s) => s.count), 1);
                const widthPct = (stage.count / max) * 100;
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-24 sm:w-32 text-xs font-medium truncate flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: stage.color || "hsl(var(--primary))" }}
                      />
                      <span className="truncate">{stage.name}</span>
                    </div>
                    <div className="flex-1 h-8 bg-muted/30 rounded relative overflow-hidden">
                      <div
                        className={`h-full rounded transition-all flex items-center px-2 ${
                          stage.isBottleneck ? "bg-destructive/70" : "bg-primary/60"
                        }`}
                        style={{ width: `${widthPct}%`, minWidth: stage.count > 0 ? "2.5rem" : "0" }}
                      >
                        <span className="text-xs font-bold text-foreground">{stage.count}</span>
                      </div>
                    </div>
                    <div className="w-16 sm:w-24 flex items-center gap-1 justify-end text-xs">
                      {stage.conversionPct !== null ? (
                        <>
                          <span className={stage.isBottleneck ? "text-destructive font-semibold" : "text-muted-foreground"}>
                            {stage.conversionPct.toFixed(1)}%
                          </span>
                          {stage.isBottleneck && (
                            <Badge variant="destructive" className="h-4 text-[9px] px-1 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> Gargalo
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <span className="truncate">Leads estagnados (mais de 7 dias sem movimento)</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {data.stagnant.length}
              </Badge>
            </h3>
            <div className="shrink-0">
              <ExportButton
                fileName={stagnantFile}
                rows={data.stagnant}
                columns={[
                  { key: "name", label: "Contato" },
                  { key: "stage", label: "Estágio" },
                  { key: "assignedTo", label: "Responsável" },
                  { key: "daysStagnant", label: "Dias parado" },
                  { key: "updatedAt", label: "Última atualização" },
                ]}
              />
            </div>
          </div>

          {data.stagnant.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum lead estagnado. Equipe está em dia! 🎉
            </p>
          ) : (
            <div className="overflow-x-auto">
          <div className="border border-border/50 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Dias parado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stagnant.slice(0, 50).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={{ borderColor: row.stageColor, color: row.stageColor }}>
                          {row.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.assignedTo}</TableCell>
                      <TableCell className="text-right">
                        <span className={row.daysStagnant > 30 ? "text-destructive font-semibold" : ""}>
                          {row.daysStagnant}d
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.stagnant.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30">
                  Exibindo 50 de {data.stagnant.length}. Exporte para ver todos.
                </p>
              )}
            </div>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
