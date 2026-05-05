import { KpiCard } from "../KpiCard";
import { SectionShell, ChartCard, formatNumber } from "../SectionShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Target, ArrowRight, Percent, MessageCircle } from "lucide-react";
import type { AdminDashboardData } from "@/hooks/admin/useAdminDashboardData";

interface Props {
  data?: AdminDashboardData;
  loading: boolean;
}

export function ProspectionSection({ data, loading }: Props) {
  const p = data?.prospection;
  const stages = [
    { label: "Buscas realizadas", value: p?.searchesCount ?? 0 },
    { label: "Leads encontrados", value: p?.resultsCount ?? 0 },
    { label: "Importados ao CRM", value: p?.importedCount ?? 0 },
    { label: "Iniciaram conversa", value: p?.conversedCount ?? 0 },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <SectionShell title="Prospecção" subtitle="Funil de aquisição que a plataforma entrega para os clientes.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Buscas realizadas" value={formatNumber(p?.searchesCount ?? 0)} formula="Quantas buscas de prospecção os clientes rodaram no período (Google Places, scraping, etc.)." icon={Search} loading={loading} />
        <KpiCard label="Leads encontrados" value={formatNumber(p?.resultsCount ?? 0)} formula="Total de empresas e contatos descobertos pelas buscas no período." icon={Target} loading={loading} />
        <KpiCard label="Importados ao CRM" value={formatNumber(p?.importedCount ?? 0)} formula="Quantos leads encontrados foram salvos como contatos no CRM dos clientes." icon={ArrowRight} loading={loading} />
        <KpiCard label="Conversão Lead→Contato" value={`${(p?.importRate ?? 0).toFixed(1)}%`} formula="% dos leads encontrados que viraram contato salvo. Mede a qualidade dos resultados de busca." icon={Percent} accent="success" loading={loading} />
        <KpiCard label="Conversão Importado→Conversa" value={`${(p?.conversionToConv ?? 0).toFixed(1)}%`} formula="% dos contatos importados que efetivamente iniciaram uma conversa. Mede o ROI real da prospecção." icon={MessageCircle} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard title="Funil de prospecção" description="Buscado → Encontrado → Importado → Conversaram." className="lg:col-span-2">
          <div className="space-y-3 py-2">
            {stages.map((s, i) => {
              const pct = (s.value / max) * 100;
              return (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums">{formatNumber(s.value)}</span>
                  </div>
                  <div className="h-6 bg-muted rounded">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${pct}%`,
                        background: `hsl(var(--primary) / ${1 - i * 0.18})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top 3 organizações por leads</CardTitle>
          </CardHeader>
          <CardContent>
            {(p?.topOrgsByLeads?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ol className="space-y-2">
                {p!.topOrgsByLeads.map((o, i) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground font-mono text-xs w-4">{i + 1}.</span>
                      <span className="truncate">{o.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">{formatNumber(o.count)}</span>
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
