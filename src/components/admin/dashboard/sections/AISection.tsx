import { KpiCard } from "../KpiCard";
import { SectionShell, ChartCard, formatNumber } from "../SectionShell";
import { Workflow, Bot, Sparkles, Repeat, CheckCircle2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
} from "recharts";
import type { AdminDashboardData } from "@/hooks/admin/useAdminDashboardData";

interface Props {
  data?: AdminDashboardData;
  loading: boolean;
}

export function AISection({ data, loading }: Props) {
  const a = data?.ai;
  const buckets = data?.meta?.buckets ?? [];
  const chartData = buckets.map((d) => ({
    day: d.slice(5),
    Sessões: a?.flowSessionsByDay?.[d] ?? 0,
  }));

  return (
    <SectionShell
      title="Automação & IA"
      subtitle="Execução de fluxos, avaliações automáticas e disparos de re-engajamento."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Sessões de fluxo"
          value={formatNumber(a?.flowSessionsCount ?? 0)}
          formula="Quantas vezes os fluxos automatizados dos clientes foram disparados (cada conversa que entrou em uma automação) no período."
          icon={Workflow}
          loading={loading}
        />
        <KpiCard
          label="Fluxos ativos"
          value={formatNumber(a?.activeFlows ?? 0)}
          formula="Quantos fluxos de automação estão ligados agora em toda a plataforma. Foto do momento, não depende do período."
          icon={Bot}
          loading={loading}
        />
        <KpiCard
          label="Avaliações de IA"
          value={formatNumber(a?.evalsCount ?? 0)}
          formula="Quantas conversas foram analisadas automaticamente pela IA no período (resumo, sentimento, dados extraídos)."
          icon={Sparkles}
          loading={loading}
        />
        <KpiCard
          label="Taxa positiva"
          value={`${(a?.evalsPositiveRate ?? 0).toFixed(1)}%`}
          formula="% das avaliações de IA que receberam nota 7 ou mais. Indica qualidade geral das conversas dos clientes."
          icon={CheckCircle2}
          accent="success"
          loading={loading}
        />
        <KpiCard
          label="Re-engajamentos enviados"
          value={formatNumber(a?.reengagements ?? 0)}
          formula="Mensagens automáticas que a plataforma disparou para reanimar conversas paradas no período."
          icon={Repeat}
          loading={loading}
        />
      </div>

      <ChartCard title="Execuções de fluxo por dia" description="Volume diário de sessões de automação iniciadas.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <ReTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="Sessões" fill="hsl(var(--secondary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SectionShell>
  );
}
