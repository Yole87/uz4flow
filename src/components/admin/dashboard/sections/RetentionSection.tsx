import { KpiCard } from "../KpiCard";
import { SectionShell, ChartCard, formatCurrency } from "../SectionShell";
import { TrendingDown, DollarSign, RefreshCcw, Clock, Hourglass } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

export function RetentionSection({ data, loading }: Props) {
  const r = data?.retention;
  const buckets = data?.meta?.buckets ?? [];
  const chartData = buckets.map((d) => ({
    day: d.slice(5),
    Cancelamentos: r?.cancelByDay?.[d] ?? 0,
    Novas: r?.newSubsByDay?.[d] ?? 0,
  }));

  return (
    <SectionShell
      title="Retenção & Churn"
      subtitle="Quantos clientes a plataforma perde, quanto isso custa e quanto tempo eles ficam."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Churn de clientes"
          value={`${(r?.churnRate ?? 0).toFixed(1)}%`}
          formula="% de clientes pagantes que cancelaram no período em relação aos que estavam ativos no início. Quanto menor, melhor."
          icon={TrendingDown}
          invertColors
          accent="warning"
          loading={loading}
        />
        <KpiCard
          label="MRR perdido"
          value={r ? formatCurrency(r.mrrLost) : "—"}
          formula="Quanto deixou de entrar por mês por conta dos cancelamentos do período. Soma do valor dos planos perdidos."
          icon={DollarSign}
          accent="destructive"
          loading={loading}
        />
        <KpiCard
          label="NRR (Net Revenue Retention)"
          value={`${(r?.nrr ?? 0).toFixed(0)}%`}
          formula="Quanto a base atual de clientes do início do período rende hoje vs. o que rendia antes. Acima de 100% significa que a base cresce sozinha (upgrades superam cancelamentos)."
          icon={RefreshCcw}
          loading={loading}
        />
        <KpiCard
          label="Trials expirando (7d)"
          value={r?.trialsExpiring ?? 0}
          formula="Clientes em teste gratuito que vão expirar nos próximos 7 dias. Janela ideal para abordagem comercial."
          icon={Hourglass}
          accent="warning"
          loading={loading}
        />
        <KpiCard
          label="Tempo médio de vida"
          value={`${Math.round(r?.avgLifetimeDays ?? 0)} dias`}
          formula="Em média, quantos dias um cliente fica ativo até cancelar (considera apenas quem cancelou no período)."
          icon={Clock}
          loading={loading}
        />
        <KpiCard
          label="Cancelamentos no período"
          value={r?.cancelledCount ?? 0}
          formula="Quantos clientes pediram cancelamento dentro do intervalo selecionado."
          loading={loading}
        />
      </div>

      <ChartCard
        title="Cancelamentos vs Novas assinaturas"
        description="Comparação diária de saídas e entradas. Saldo positivo significa crescimento líquido."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Novas" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Cancelamentos" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SectionShell>
  );
}
