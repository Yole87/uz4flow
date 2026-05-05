import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "./ExportButton";
import { useReportTeam } from "@/hooks/reports/useReportData";
import type { ReportPeriod } from "./ReportFilters";
import { buildReportFileName } from "@/lib/reports/exporters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Clock } from "lucide-react";

interface TeamTabProps {
  organizationId?: string;
  period: ReportPeriod;
  instanceId: string | null;
}

const DAYS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatMs(ms: number) {
  if (!ms || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function TeamTab({ organizationId, period, instanceId }: TeamTabProps) {
  const { data, isLoading } = useReportTeam({ organizationId, period, instanceId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data || data.members.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={Users}
        title="Sem dados de equipe"
        description="Cadastre membros da equipe e atribua conversas para começar a medir performance."
      />
    );
  }

  const teamFile = buildReportFileName("equipe-performance", period.start, period.end);
  const heatmapFile = buildReportFileName("equipe-heatmap", period.start, period.end);

  // Heatmap data
  const heatRows = data.heatmap
    .map((row, dayIdx) =>
      row.map((count, hourIdx) => ({
        day: DAYS_LABEL[dayIdx],
        hour: `${hourIdx.toString().padStart(2, "0")}:00`,
        count,
      }))
    )
    .flat();
  const maxHeat = Math.max(...heatRows.map((r) => r.count), 1);

  const top5 = data.members.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {data.slaPercents.map((sla) => {
          const minutes = sla.threshold / (60 * 1000);
          return (
            <Card key={sla.threshold}>
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">SLA &lt; {minutes}min</span>
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold tracking-tight">{sla.pct.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1.5">conversas atendidas no prazo</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {top5.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" /> Top 5 Atendentes (por conversões)
            </h3>
            <div className="space-y-2">
              {top5.map((m, idx) => {
                const max = Math.max(...top5.map((x) => x.conversions), 1);
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="w-32 text-xs font-medium truncate">{m.name}</div>
                    <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent flex items-center px-2"
                        style={{ width: `${(m.conversions / max) * 100}%`, minWidth: m.conversions > 0 ? "2rem" : 0 }}
                      >
                        <span className="text-xs font-bold text-primary-foreground">{m.conversions}</span>
                      </div>
                    </div>
                    <div className="w-20 text-right text-xs text-muted-foreground">{m.conversionPct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Performance por atendente</h3>
            <ExportButton
              fileName={teamFile}
              rows={data.members}
              columns={[
                { key: "name", label: "Atendente" },
                { key: "conversations", label: "Conversas" },
                { key: "avgRespMs", label: "Tempo médio resposta", format: (v) => formatMs(v as number) },
                { key: "conversions", label: "Conversões" },
                { key: "conversionPct", label: "Taxa conversão", format: (v) => `${(v as number).toFixed(1)}%` },
                { key: "slaUnder5min", label: "SLA <5min", format: (v) => `${(v as number).toFixed(1)}%` },
              ]}
            />
          </div>
          <div className="border border-border/50 rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atendente</TableHead>
                  <TableHead className="text-right">Conversas</TableHead>
                  <TableHead className="text-right">Tempo médio</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{m.conversations}</TableCell>
                    <TableCell className="text-right">{formatMs(m.avgRespMs)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{m.conversions}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{m.conversionPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Heatmap de horário de pico</h3>
            <ExportButton
              fileName={heatmapFile}
              rows={heatRows}
              columns={[
                { key: "day", label: "Dia" },
                { key: "hour", label: "Hora" },
                { key: "count", label: "Mensagens recebidas" },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid" style={{ gridTemplateColumns: "60px repeat(24, 1fr)", gap: "2px" }}>
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-[9px] text-muted-foreground text-center">
                    {h}
                  </div>
                ))}
                {DAYS_LABEL.map((day, dayIdx) => (
                  <>
                    <div key={day} className="text-xs text-muted-foreground flex items-center pr-1">
                      {day}
                    </div>
                    {data.heatmap[dayIdx].map((count, hourIdx) => {
                      const intensity = count / maxHeat;
                      return (
                        <div
                          key={`${dayIdx}-${hourIdx}`}
                          className="aspect-square rounded-sm transition-colors"
                          style={{
                            background: `hsl(var(--primary) / ${0.05 + intensity * 0.85})`,
                          }}
                          title={`${day} ${hourIdx}h: ${count} mensagens`}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground justify-end">
                <span>Menos</span>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
                  <div
                    key={i}
                    className="h-3 w-3 rounded-sm"
                    style={{ background: `hsl(var(--primary) / ${i})` }}
                  />
                ))}
                <span>Mais</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
