import { KpiCard } from "../KpiCard";
import { SectionShell, ChartCard, formatNumber } from "../SectionShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, MessageCircle, Activity } from "lucide-react";
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

export function EngagementSection({ data, loading }: Props) {
  const e = data?.engagement;
  const buckets = data?.meta?.buckets ?? [];
  const chartData = buckets.map((d) => ({
    day: d.slice(5),
    Mensagens: e?.messagesByDay?.[d] ?? 0,
    DAU: e?.dauByDay?.[d] ?? 0,
  }));

  return (
    <SectionShell
      title="Engajamento & Uso da Plataforma"
      subtitle="O quanto o produto está sendo usado pelos clientes ativos."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Mensagens trocadas"
          value={formatNumber(e?.messagesCount ?? 0)}
          formula="Total de mensagens enviadas e recebidas em todos os canais (WhatsApp, Instagram, etc.) dentro do período."
          icon={MessageSquare}
          loading={loading}
        />
        <KpiCard
          label="Conversas ativas"
          value={formatNumber(e?.activeConversations ?? 0)}
          formula="Quantas conversas tiveram pelo menos uma mensagem nova no período. Mede o uso real do CRM."
          icon={MessageCircle}
          loading={loading}
        />
        <KpiCard
          label="Contatos cadastrados"
          value={formatNumber(e?.contactsCreated ?? 0)}
          formula="Novos contatos adicionados na base dos clientes durante o período."
          icon={Users}
          loading={loading}
        />
        <KpiCard
          label="Stickiness (DAU/MAU)"
          value={`${(e?.stickiness ?? 0).toFixed(1)}%`}
          formula="% de quão grudados os clientes estão: clientes ativos por dia em média, divididos pelos clientes ativos no mês. Acima de 20% indica produto essencial no dia a dia."
          icon={Activity}
          loading={loading}
          accent="success"
          hint={e ? `Média de clientes ativos por dia: ${e.avgDau.toFixed(0)} · Ativos no mês: ${e.mau}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard
          title="Mensagens por dia"
          description="Volume diário de mensagens processadas pela plataforma."
          className="lg:col-span-2"
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
                <Bar dataKey="Mensagens" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top 5 organizações por mensagens</CardTitle>
          </CardHeader>
          <CardContent>
            {(e?.topOrgsByMessages?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ol className="space-y-2">
                {e!.topOrgsByMessages.map((o, i) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground font-mono text-xs w-4">{i + 1}.</span>
                      <span className="truncate">{o.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">
                      {formatNumber(o.count)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
