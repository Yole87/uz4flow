import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  MessageSquare, Heart, MousePointerClick, Eye, Users, TrendingUp, Activity, Megaphone,
} from "lucide-react";
import { format, subDays, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const EVENT_COLORS: Record<string, string> = {
  dm: "hsl(var(--primary))",
  comment: "hsl(var(--accent))",
  live_comment: "#f97316",
  reaction: "#ef4444",
  postback: "#8b5cf6",
  referral: "#06b6d4",
  seen: "#a3a3a3",
  optin: "#22c55e",
  message_edit: "#eab308",
  handover: "#6366f1",
};

const EVENT_LABELS: Record<string, string> = {
  dm: "DMs",
  comment: "Comentários",
  live_comment: "Live Comments",
  reaction: "Reações",
  postback: "Postbacks",
  referral: "Referrals",
  seen: "Visualizações",
  optin: "Opt-ins",
  message_edit: "Edições",
  handover: "Handovers",
};

type Period = "7" | "30" | "90";

export function InstagramInsightsTab() {
  const { data: org } = useUserOrganization();
  const [period, setPeriod] = useState<Period>("30");
  const daysAgo = Number(period);

  const startDate = useMemo(() => subDays(new Date(), daysAgo).toISOString(), [daysAgo]);

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["ig-insights-events", org?.id, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_events")
        .select("event_type, received_at, status")
        .eq("organization_id", org!.id)
        .gte("received_at", startDate)
        .order("received_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!org?.id,
  });

  // Fetch leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["ig-insights-leads", org?.id, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_leads")
        .select("id, created_at, origin")
        .eq("organization_id", org!.id)
        .gte("created_at", startDate);
      return data ?? [];
    },
    enabled: !!org?.id,
  });

  // Fetch top automations
  const { data: topAutomations, isLoading: automationsLoading } = useQuery({
    queryKey: ["ig-insights-automations", org?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_automations")
        .select("id, name, execution_count, last_executed_at, is_enabled, trigger_type")
        .eq("organization_id", org!.id)
        .order("execution_count", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!org?.id,
  });

  // Fetch action logs for referral origins
  const { data: actionLogs } = useQuery({
    queryKey: ["ig-insights-actions", org?.id, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_action_logs")
        .select("action_type, status, created_at")
        .eq("organization_id", org!.id)
        .gte("created_at", startDate);
      return data ?? [];
    },
    enabled: !!org?.id,
  });

  // KPIs
  const totalEvents = events?.length ?? 0;
  const dmEvents = events?.filter(e => e.event_type === "dm").length ?? 0;
  const commentEvents = events?.filter(e => e.event_type === "comment" || e.event_type === "live_comment").length ?? 0;
  const reactionEvents = events?.filter(e => e.event_type === "reaction").length ?? 0;
  const totalLeads = leads?.length ?? 0;
  const conversionRate = totalEvents > 0 ? ((totalLeads / totalEvents) * 100).toFixed(1) : "0";

  // Chart data: events per day grouped by type
  const chartData = useMemo(() => {
    if (!events) return [];
    const dayMap: Record<string, Record<string, number>> = {};
    for (let i = 0; i < daysAgo; i++) {
      const day = format(subDays(new Date(), daysAgo - 1 - i), "yyyy-MM-dd");
      dayMap[day] = {};
    }
    for (const ev of events) {
      const day = format(parseISO(ev.received_at), "yyyy-MM-dd");
      if (!dayMap[day]) dayMap[day] = {};
      dayMap[day][ev.event_type] = (dayMap[day][ev.event_type] || 0) + 1;
    }
    return Object.entries(dayMap).map(([date, types]) => ({
      date: format(parseISO(date), "dd/MM", { locale: ptBR }),
      ...types,
    }));
  }, [events, daysAgo]);

  // Unique event types in the data
  const activeEventTypes = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.event_type))].sort();
  }, [events]);

  // Status breakdown
  const statusCounts = useMemo(() => {
    if (!events) return { processed: 0, error: 0, skipped: 0, no_match: 0 };
    return {
      processed: events.filter(e => e.status === "processed").length,
      error: events.filter(e => e.status === "error").length,
      skipped: events.filter(e => e.status === "skipped").length,
      no_match: events.filter(e => e.status === "no_match").length,
    };
  }, [events]);

  // Funnel data
  const funnelData = useMemo(() => {
    const successActions = actionLogs?.filter(a => a.status === "success").length ?? 0;
    return [
      { name: "Eventos Recebidos", value: totalEvents },
      { name: "Automações Disparadas", value: statusCounts.processed },
      { name: "Ações Executadas", value: successActions },
      { name: "Leads Gerados", value: totalLeads },
    ];
  }, [totalEvents, statusCounts.processed, actionLogs, totalLeads]);

  const isLoading = eventsLoading || leadsLoading || automationsLoading;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Insights do Instagram
        </h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] bg-muted border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Activity} label="Eventos" value={totalEvents} loading={isLoading} />
        <KpiCard icon={MessageSquare} label="DMs" value={dmEvents} loading={isLoading} />
        <KpiCard icon={MessageSquare} label="Comentários" value={commentEvents} loading={isLoading} />
        <KpiCard icon={Heart} label="Reações" value={reactionEvents} loading={isLoading} />
        <KpiCard icon={Users} label="Leads" value={totalLeads} loading={isLoading} />
        <KpiCard icon={TrendingUp} label="Conversão" value={`${conversionRate}%`} loading={isLoading} />
      </div>

      {/* Event Chart */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Eventos por Dia</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                {activeEventTypes.map((type) => (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={type}
                    name={EVENT_LABELS[type] || type}
                    stroke={EVENT_COLORS[type] || "#888"}
                    fill={EVENT_COLORS[type] || "#888"}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum evento no período selecionado.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={130} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((_, index) => (
                      <Cell key={index} fill={["hsl(var(--primary))", "hsl(var(--accent))", "#f97316", "#22c55e"][index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Status dos Eventos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {isLoading ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <div className="space-y-2">
                <StatusBar label="Processados" count={statusCounts.processed} total={totalEvents} color="bg-green-500" />
                <StatusBar label="Sem Match" count={statusCounts.no_match} total={totalEvents} color="bg-yellow-500" />
                <StatusBar label="Ignorados" count={statusCounts.skipped} total={totalEvents} color="bg-muted-foreground" />
                <StatusBar label="Erros" count={statusCounts.error} total={totalEvents} color="bg-destructive" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Automations */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Top Automações</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {automationsLoading ? (
            <Skeleton className="h-[120px]" />
          ) : topAutomations && topAutomations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b border-border/50">
                    <th className="text-left py-2 pr-4">Nome</th>
                    <th className="text-left py-2 pr-4">Gatilho</th>
                    <th className="text-right py-2 pr-4">Execuções</th>
                    <th className="text-right py-2">Último disparo</th>
                  </tr>
                </thead>
                <tbody>
                  {topAutomations.map((a) => (
                    <tr key={a.id} className="border-b border-border/20">
                      <td className="py-2 pr-4 flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{a.name}</span>
                        {!a.is_enabled && <Badge variant="secondary" className="text-xs">Pausada</Badge>}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">{a.trigger_type}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{a.execution_count}</td>
                      <td className="py-2 text-right text-muted-foreground text-xs">
                        {a.last_executed_at ? format(parseISO(a.last_executed_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma automação criada ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, loading }: { icon: React.ElementType; label: string; value: string | number; loading: boolean }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-3 flex flex-col items-center gap-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {loading ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <span className="text-lg font-bold text-foreground">{value}</span>
        )}
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      </CardContent>
    </Card>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{count} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
