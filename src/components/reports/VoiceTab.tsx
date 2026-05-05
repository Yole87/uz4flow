import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "./ExportButton";
import { useReportVoice } from "@/hooks/reports/useReportData";
import type { ReportPeriod } from "./ReportFilters";
import { buildReportFileName } from "@/lib/reports/exporters";
import { Phone, PhoneCall, PhoneOff, Activity, Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface VoiceTabProps {
  organizationId?: string;
  period: ReportPeriod;
  instanceId: string | null;
}

export function VoiceTab({ organizationId, period, instanceId }: VoiceTabProps) {
  const { data, isLoading } = useReportVoice({ organizationId, period, instanceId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data || data.kpis.campaignCount === 0) {
    return (
      <EmptyState
        variant="card"
        icon={Phone}
        title="Sem campanhas de voz no período"
        description="Crie campanhas em /voice para acompanhar volume e taxa de atendimento."
      />
    );
  }

  const fileName = buildReportFileName("voice-ai", period.start, period.end);
  const hourFile = buildReportFileName("voice-ai-horarios", period.start, period.end);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Disparadas</span>
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold tracking-tight">{data.kpis.totalDispatched}</div>
            <p className="text-xs text-muted-foreground mt-1.5">{data.kpis.campaignCount} campanha(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Atendidas</span>
              <PhoneCall className="h-4 w-4 text-success" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-success">{data.kpis.totalCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1.5">ligações completadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Falhas</span>
              <PhoneOff className="h-4 w-4 text-destructive" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-destructive">{data.kpis.totalFailed}</div>
            <p className="text-xs text-muted-foreground mt-1.5">não atendidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Taxa atendimento</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold tracking-tight">{data.kpis.answerRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1.5">atendidas/disparadas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Top horários de atendimento</h3>
            <ExportButton
              fileName={hourFile}
              rows={data.hourSeries}
              columns={[
                { key: "hour", label: "Hora" },
                { key: "calls", label: "Atendimentos" },
              ]}
            />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="calls" fill="hsl(var(--accent))" name="Atendidas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Campanhas do período</h3>
            <ExportButton
              fileName={fileName}
              rows={data.campaigns}
              columns={[
                { key: "name", label: "Campanha" },
                { key: "status", label: "Status" },
                { key: "total_contacts", label: "Total contatos" },
                { key: "completed_calls", label: "Atendidas" },
                { key: "failed_calls", label: "Falhas" },
                { key: "scheduled_at", label: "Agendada para" },
              ]}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {data.campaigns.length} campanha(s) no período. Use o botão acima para exportar.
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-accent mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Análise de sentimento e transcrições</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Em desenvolvimento — em breve será possível analisar o sentimento das ligações e revisar transcrições
                completas com classificação automática.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
