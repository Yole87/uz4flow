import { KpiCard } from "../KpiCard";
import { SectionShell, ChartCard, formatNumber, formatDuration, formatCurrency } from "../SectionShell";
import { Phone, PhoneCall, PhoneOff, Clock, DollarSign, Radio } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
} from "recharts";
import type { AdminDashboardData } from "@/hooks/admin/useAdminDashboardData";

interface Props {
  data?: AdminDashboardData;
  loading: boolean;
}

export function VoiceSection({ data, loading }: Props) {
  const v = data?.voice;
  const buckets = data?.meta?.buckets ?? [];
  const chartData = buckets.map((d) => ({
    day: d.slice(5),
    Atendidas: v?.byDay?.[d]?.completed ?? 0,
    Falhas: v?.byDay?.[d]?.failed ?? 0,
    Outros: v?.byDay?.[d]?.other ?? 0,
  }));

  return (
    <SectionShell title="Voice AI" subtitle="Ligações automatizadas, taxa de atendimento e custo operacional.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Ligações realizadas" value={formatNumber(v?.total ?? 0)} formula="Total de ligações que a IA de voz disparou no período." icon={Phone} loading={loading} />
        <KpiCard label="Taxa de atendimento" value={`${(v?.answerRate ?? 0).toFixed(1)}%`} formula="% das ligações que foram efetivamente atendidas pelo destinatário." icon={PhoneCall} accent="success" loading={loading} />
        <KpiCard label="Duração média" value={formatDuration(v?.avgDuration ?? 0)} formula="Tempo médio das ligações que foram atendidas. Conversas curtas demais podem indicar script fraco." icon={Clock} loading={loading} />
        <KpiCard label="Falhas" value={formatNumber(v?.failed ?? 0)} formula="Ligações que não completaram: número inválido, caixa postal, sem atendimento ou erro técnico." icon={PhoneOff} accent="warning" loading={loading} />
        <KpiCard label="Campanhas em execução" value={formatNumber(v?.campaignsActive ?? 0)} formula="Quantas campanhas de voz estão rodando agora em toda a plataforma. Foto do momento." icon={Radio} loading={loading} />
        <KpiCard label="Custo estimado" value={formatCurrency(v?.cost ?? 0)} formula="Custo total das ligações no período (operadora + IA). Calculado a partir do tempo e tipo de chamada." icon={DollarSign} loading={loading} />
      </div>

      <ChartCard title="Ligações por dia × status" description="Distribuição diária segmentada por resultado da ligação.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <ReTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Atendidas" stackId="a" fill="hsl(var(--success))" />
              <Bar dataKey="Falhas" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="Outros" stackId="a" fill="hsl(var(--muted-foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SectionShell>
  );
}
