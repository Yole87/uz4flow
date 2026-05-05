import { KpiCard } from "../KpiCard";
import { SectionShell, ChartCard, formatNumber } from "../SectionShell";
import { UserPlus, CreditCard, Percent, Users } from "lucide-react";
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

export function AcquisitionSection({ data, loading }: Props) {
  const a = data?.acquisition;
  const buckets = data?.meta?.buckets ?? [];
  const total = (a?.organicSignups ?? 0) + (a?.affiliateSignups ?? 0) + (a?.couponSignups ?? 0);
  const orgPct = total > 0 ? ((a!.organicSignups / total) * (a!.newSignups || 1)) : 0;

  // Distribute origin proportionally per day (approximation since we don't have per-day origin breakdown)
  const orgRatio = a && a.newSignups > 0 ? a.organicSignups / a.newSignups : 0;
  const affRatio = a && a.newSignups > 0 ? a.affiliateSignups / a.newSignups : 0;
  const coupRatio = a && a.newSignups > 0 ? a.couponSignups / a.newSignups : 0;
  const chartData = buckets.map((d) => {
    const t = a?.signupsByDay?.[d] ?? 0;
    return {
      day: d.slice(5),
      Orgânico: Math.round(t * orgRatio),
      Afiliado: Math.round(t * affRatio),
      Cupom: Math.round(t * coupRatio),
    };
  });

  return (
    <SectionShell
      title="Aquisição & Crescimento"
      subtitle="Funil de entrada: cadastros, conversão e canais de aquisição."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Novos cadastros"
          value={formatNumber(a?.newSignups ?? 0)}
          formula="Quantas empresas se cadastraram na plataforma dentro do período selecionado."
          icon={UserPlus}
          pctChange={a?.signupsPctChange ?? undefined}
          loading={loading}
        />
        <KpiCard
          label="Novos pagantes"
          value={formatNumber(a?.newPaying ?? 0)}
          formula="Quantos clientes assinaram um plano pago no período. Trials e planos gratuitos não contam aqui."
          icon={CreditCard}
          loading={loading}
          accent="success"
        />
        <KpiCard
          label="Conversão Free → Pago"
          value={`${(a?.conversionFreeToPaid ?? 0).toFixed(1)}%`}
          formula="% dos novos cadastros que viraram clientes pagantes no mesmo período. Mede a eficiência do funil de venda."
          icon={Percent}
          loading={loading}
        />
        <KpiCard
          label="Cadastros pendentes"
          value={formatNumber(a?.pendingLeads ?? 0)}
          formula="Empresas cadastradas que ainda não escolheram nenhum plano ativo. Leads quentes para o time de vendas."
          icon={Users}
          accent="warning"
          loading={loading}
        />
        <KpiCard
          label="Origem: Orgânico"
          value={formatNumber(a?.organicSignups ?? 0)}
          formula="Cadastros que chegaram por conta própria — sem afiliado e sem cupom. Reflete o alcance da marca."
          loading={loading}
        />
        <KpiCard
          label="Origem: Afiliado"
          value={formatNumber(a?.affiliateSignups ?? 0)}
          formula="Cadastros indicados por algum parceiro do programa de afiliados."
          loading={loading}
        />
        <KpiCard
          label="Origem: Cupom"
          value={formatNumber(a?.couponSignups ?? 0)}
          formula="Cadastros que aplicaram algum cupom promocional no checkout."
          loading={loading}
        />
      </div>

      <ChartCard
        title="Novos cadastros por dia × origem"
        description="Distribuição diária dos cadastros segmentada pela origem (proporcional ao período)."
      >
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Orgânico" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="Afiliado" stackId="a" fill="hsl(var(--secondary))" />
              <Bar dataKey="Cupom" stackId="a" fill="hsl(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SectionShell>
  );
}
