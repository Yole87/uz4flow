import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "./ExportButton";
import { useReportFlows } from "@/hooks/reports/useReportData";
import type { ReportPeriod } from "./ReportFilters";
import { buildReportFileName } from "@/lib/reports/exporters";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GitBranch, Crown, AlertTriangle } from "lucide-react";

interface FlowsTabProps {
  organizationId?: string;
  effectiveUserId?: string | null;
  period: ReportPeriod;
  instanceId: string | null;
}

export function FlowsTab({ organizationId, effectiveUserId, period, instanceId }: FlowsTabProps) {
  const { data, isLoading } = useReportFlows({ organizationId, effectiveUserId, period, instanceId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data || data.flows.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={GitBranch}
        title="Nenhum fluxo cadastrado"
        description="Crie fluxos no editor para acompanhar execuções e taxas de conversão."
      />
    );
  }

  const fileName = buildReportFileName("fluxos", period.start, period.end);
  const highAbandon = data.flows.filter((f) => f.abandonPct > 40 && f.executions >= 5);

  return (
    <div className="space-y-4">
      {data.topFlow && data.topFlow.completed > 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success/15 flex items-center justify-center">
                <Crown className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Top fluxo do período</p>
                <h3 className="text-base font-semibold">{data.topFlow.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {data.topFlow.completed} conclusão(ões) · {data.topFlow.executions} execução(ões) ·{" "}
                  {data.topFlow.completionPct.toFixed(1)}% taxa
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {highAbandon.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">Fluxos com alta taxa de abandono (&gt;40%)</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {highAbandon.map((f) => (
                <Badge key={f.id} variant="outline" className="border-warning/40 text-warning">
                  {f.name} · {f.abandonPct.toFixed(0)}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" /> Performance por fluxo
            </h3>
            <ExportButton
              fileName={fileName}
              rows={data.flows}
              columns={[
                { key: "name", label: "Fluxo" },
                { key: "executions", label: "Execuções" },
                { key: "completed", label: "Concluídos" },
                { key: "failed", label: "Abandonados/Falhos" },
                { key: "completionPct", label: "Taxa conclusão", format: (v) => `${(v as number).toFixed(1)}%` },
                { key: "abandonPct", label: "Taxa abandono", format: (v) => `${(v as number).toFixed(1)}%` },
              ]}
            />
          </div>
          <div className="border border-border/50 rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fluxo</TableHead>
                  <TableHead className="text-right">Execuções</TableHead>
                  <TableHead className="text-right">Concluídos</TableHead>
                  <TableHead className="text-right">Conclusão</TableHead>
                  <TableHead className="text-right">Abandono</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.flows.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {f.name}
                        {!f.isActive && (
                          <Badge variant="outline" className="text-[9px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{f.executions}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="border-success/40 text-success">
                        {f.completed}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{f.completionPct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      <span className={f.abandonPct > 40 ? "text-warning font-semibold" : "text-muted-foreground"}>
                        {f.abandonPct.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
