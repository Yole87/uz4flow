import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "./ExportButton";
import { useReportOverview } from "@/hooks/reports/useReportData";
import type { ReportPeriod } from "./ReportFilters";
import { buildReportFileName } from "@/lib/reports/exporters";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  MessageSquare,
  Clock,
  Activity,
  Trophy,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface OverviewTabProps {
  organizationId?: string;
  period: ReportPeriod;
  instanceId: string | null;
}

function ComparisonBadge({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  const diff = current - previous;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((diff / previous) * 100);
  if (Math.abs(diff) < 0.01) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
        <Minus className="h-3 w-3" /> Sem variação
      </span>
    );
  }
  const isUp = diff > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isUp ? "text-green-500" : "text-red-500"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}
      {Math.round(diff)}
      {suffix} ({isUp ? "+" : ""}
      {pct}%)
    </span>
  );
}

function formatMs(ms: number) {
  if (!ms || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function OverviewTab({ organizationId, period, instanceId }: OverviewTabProps) {
  const { data, isLoading } = useReportOverview({ organizationId, period, instanceId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data || (data.kpis.newContacts === 0 && data.kpis.conversations === 0)) {
    return (
      <EmptyState
        variant="card"
        icon={BarChart3}
        title="Sem dados no período"
        description="Não há contatos novos ou conversas no período selecionado. Tente um intervalo maior."
      />
    );
  }

  const { kpis, dailySeries } = data;

  const cards = [
    {
      label: "Novos contatos",
      value: kpis.newContacts,
      prev: kpis.newContactsPrev,
      icon: Users,
      color: "text-primary",
      suffix: "",
      formatter: (v: number) => v.toString(),
    },
    {
      label: "Conversas iniciadas",
      value: kpis.conversations,
      prev: kpis.conversationsPrev,
      icon: MessageSquare,
      color: "text-accent",
      suffix: "",
      formatter: (v: number) => v.toString(),
    },
    {
      label: "Taxa de resposta",
      value: kpis.responseRate,
      prev: kpis.responseRatePrev,
      icon: Activity,
      color: "text-primary",
      suffix: "%",
      formatter: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      label: "Tempo médio 1ª resposta",
      value: kpis.avgFirstResponseMs,
      prev: kpis.avgFirstResponseMsPrev,
      icon: Clock,
      color: "text-warning",
      suffix: "",
      formatter: formatMs,
      hideBadge: true,
    },
    {
      label: "Conversões",
      value: kpis.conversions,
      prev: kpis.conversionsPrev,
      icon: Trophy,
      color: "text-success",
      suffix: "",
      formatter: (v: number) => v.toString(),
    },
  ];

  const chartConfig = {
    newSeriesFile: buildReportFileName("visao-geral-serie", period.start, period.end),
    channelFile: buildReportFileName("visao-geral-canais", period.start, period.end),
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className={`text-2xl font-bold tracking-tight ${c.color}`}>{c.formatter(c.value)}</div>
              {!c.hideBadge && (
                <div className="mt-1.5">
                  <ComparisonBadge current={c.value} previous={c.prev} suffix={c.suffix} />
                </div>
              )}
              {c.hideBadge && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Anterior: {c.formatter(c.prev)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Novos contatos por dia</h3>
            <ExportButton
              fileName={chartConfig.newSeriesFile}
              rows={dailySeries}
              columns={[
                { key: "date", label: "Data" },
                { key: "contacts", label: "Novos contatos" },
              ]}
            />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="contacts"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Novos contatos"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Conversas por canal</h3>
            <ExportButton
              fileName={chartConfig.channelFile}
              rows={dailySeries}
              columns={[
                { key: "date", label: "Data" },
                { key: "whatsapp", label: "WhatsApp" },
                { key: "instagram", label: "Instagram" },
              ]}
            />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="whatsapp" fill="hsl(var(--primary))" name="WhatsApp" radius={[4, 4, 0, 0]} />
                <Bar dataKey="instagram" fill="hsl(var(--accent))" name="Instagram" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
