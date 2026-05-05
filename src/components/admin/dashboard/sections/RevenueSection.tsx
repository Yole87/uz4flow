import { KpiCard } from "../KpiCard";
import { SectionShell, ChartCard, formatCurrency } from "../SectionShell";
import { DollarSign, TrendingUp, Wallet, Calculator, Receipt, Percent, AlertTriangle, PauseCircle } from "lucide-react";
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
  compareEnabled: boolean;
}

export function RevenueSection({ data, loading, compareEnabled }: Props) {
  const r = data?.revenue;
  const buckets = data?.meta?.buckets ?? [];
  const chartData = buckets.map((d) => ({
    day: d.slice(5),
    atual: r?.revenueByDay?.[d] ?? 0,
    anterior: compareEnabled
      ? Object.values(r?.revenueByDayPrev ?? {})[buckets.indexOf(d)] ?? 0
      : undefined,
  }));

  return (
    <SectionShell
      title="Receita & Saúde Financeira"
      subtitle="Recorrência, ARR projetado e indicadores de risco financeiro."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="MRR"
          value={r ? formatCurrency(r.mrr) : "—"}
          formula="Receita Mensal Recorrente: soma do valor mensal de todos os clientes pagantes ativos hoje."
          icon={DollarSign}
          loading={loading}
          accent="success"
        />
        <KpiCard
          label="ARR projetado"
          value={r ? formatCurrency(r.arr) : "—"}
          formula="Receita Anual Recorrente: o MRR multiplicado por 12. Quanto a base atual gera em um ano se nada mudar."
          icon={TrendingUp}
          loading={loading}
        />
        <KpiCard
          label="ARPU"
          value={r ? formatCurrency(r.arpu) : "—"}
          formula="Ticket médio mensal: o MRR dividido pela quantidade de clientes pagantes. Quanto cada cliente paga em média por mês."
          icon={Wallet}
          loading={loading}
        />
        <KpiCard
          label="LTV estimado"
          value={r ? formatCurrency(r.ltv) : "—"}
          formula="Quanto cada cliente vale ao longo da vida: ticket médio dividido pela taxa de cancelamento mensal. Se ninguém cancela ainda, não dá para estimar."
          icon={Calculator}
          loading={loading}
        />
        <KpiCard
          label="Receita reconhecida"
          value={r ? formatCurrency(r.revenueRecognized) : "—"}
          formula="Total de pagamentos aprovados que realmente entraram no caixa dentro do período selecionado."
          icon={Receipt}
          pctChange={r?.revenuePctChange ?? undefined}
          loading={loading}
        />
        <KpiCard
          label="Taxa de reembolso"
          value={r ? `${r.refundRate.toFixed(1)}%` : "—"}
          formula="% do faturamento que voltou em forma de reembolso ou contestação. Acima de 2% acende alerta de qualidade do produto."
          icon={Percent}
          invertColors
          accent="warning"
          loading={loading}
        />
        <KpiCard
          label="Inadimplência (D+1 a D+3)"
          value={r?.pastDue ?? 0}
          formula="Clientes com pagamento atrasado entre 1 e 3 dias. Ainda têm acesso, mas estão em cobrança."
          icon={AlertTriangle}
          accent="warning"
          loading={loading}
        />
        <KpiCard
          label="Suspensos (D+4)"
          value={r?.suspended ?? 0}
          formula="Clientes bloqueados por inadimplência prolongada (4+ dias sem pagar). Acesso à plataforma suspenso."
          icon={PauseCircle}
          accent="destructive"
          loading={loading}
        />
      </div>

      <ChartCard
        title="Receita aprovada por dia"
        description={
          compareEnabled
            ? "Linha cheia: período atual · Linha tracejada: período anterior."
            : "Receita aprovada (status approved) por dia."
        }
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
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="atual"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Atual"
              />
              {compareEnabled && (
                <Line
                  type="monotone"
                  dataKey="anterior"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Anterior"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SectionShell>
  );
}
