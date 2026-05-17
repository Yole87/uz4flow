import { Suspense, lazy, useMemo, useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardFilters, buildRange, buildCompareRange } from "@/components/admin/dashboard/DashboardFilters";
import { useAdminDashboardData, type DashboardFiltersState } from "@/hooks/admin/useAdminDashboardData";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const RevenueSection = lazy(() => import("@/components/admin/dashboard/sections/RevenueSection").then((m) => ({ default: m.RevenueSection })));
const AcquisitionSection = lazy(() => import("@/components/admin/dashboard/sections/AcquisitionSection").then((m) => ({ default: m.AcquisitionSection })));
const RetentionSection = lazy(() => import("@/components/admin/dashboard/sections/RetentionSection").then((m) => ({ default: m.RetentionSection })));
const EngagementSection = lazy(() => import("@/components/admin/dashboard/sections/EngagementSection").then((m) => ({ default: m.EngagementSection })));
const AISection = lazy(() => import("@/components/admin/dashboard/sections/AISection").then((m) => ({ default: m.AISection })));
const VoiceSection = lazy(() => import("@/components/admin/dashboard/sections/VoiceSection").then((m) => ({ default: m.VoiceSection })));
const ProspectionSection = lazy(() => import("@/components/admin/dashboard/sections/ProspectionSection").then((m) => ({ default: m.ProspectionSection })));
const InstagramSection = lazy(() => import("@/components/admin/dashboard/sections/InstagramSection").then((m) => ({ default: m.InstagramSection })));
const AffiliatesSection = lazy(() => import("@/components/admin/dashboard/sections/AffiliatesSection").then((m) => ({ default: m.AffiliatesSection })));
const InfraSection = lazy(() => import("@/components/admin/dashboard/sections/InfraSection").then((m) => ({ default: m.InfraSection })));
const InsightsSection = lazy(() => import("@/components/admin/dashboard/sections/InsightsSection").then((m) => ({ default: m.InsightsSection })));

const STORAGE_KEY = "admin-dashboard-filters-v1";

function DashboardSectionsFallback() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-border bg-card/60 animate-pulse" />
        ))}
      </div>
      <div className="h-80 rounded-lg border border-border bg-card/60 animate-pulse" />
    </div>
  );
}

function buildInitial(): DashboardFiltersState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {/* ignore */}
  const { start, end } = buildRange("30d");
  const { compareStart, compareEnd } = buildCompareRange(start, end);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    compareStart: compareStart.toISOString(),
    compareEnd: compareEnd.toISOString(),
    organizationId: null,
    compareEnabled: true,
  };
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<DashboardFiltersState>(buildInitial);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch {/* ignore */}
  }, [filters]);

  const { data, isLoading, isFetching, refetch } = useAdminDashboardData(filters);

  const exportCsv = () => {
    if (!data) {
      toast({ title: "Aguarde", description: "Dados ainda carregando." });
      return;
    }
    const rows: string[] = [
      "Categoria,Métrica,Valor",
      `Receita,MRR,${data.revenue.mrr}`,
      `Receita,ARR,${data.revenue.arr}`,
      `Receita,ARPU,${data.revenue.arpu.toFixed(2)}`,
      `Receita,LTV,${data.revenue.ltv.toFixed(2)}`,
      `Receita,Receita reconhecida,${data.revenue.revenueRecognized}`,
      `Receita,Taxa de reembolso (%),${data.revenue.refundRate.toFixed(2)}`,
      `Receita,Inadimplência,${data.revenue.pastDue}`,
      `Receita,Suspensos,${data.revenue.suspended}`,
      `Aquisição,Novos cadastros,${data.acquisition.newSignups}`,
      `Aquisição,Novos pagantes,${data.acquisition.newPaying}`,
      `Aquisição,Conversão Free→Pago (%),${data.acquisition.conversionFreeToPaid.toFixed(2)}`,
      `Aquisição,Cadastros pendentes,${data.acquisition.pendingLeads}`,
      `Retenção,Churn (%),${data.retention.churnRate.toFixed(2)}`,
      `Retenção,MRR perdido,${data.retention.mrrLost}`,
      `Retenção,NRR (%),${data.retention.nrr.toFixed(2)}`,
      `Retenção,Trials expirando,${data.retention.trialsExpiring}`,
      `Engajamento,Mensagens,${data.engagement.messagesCount}`,
      `Engajamento,Conversas ativas,${data.engagement.activeConversations}`,
      `Engajamento,Contatos criados,${data.engagement.contactsCreated}`,
      `Engajamento,Stickiness DAU/MAU (%),${data.engagement.stickiness.toFixed(2)}`,
      `IA,Sessões de fluxo,${data.ai.flowSessionsCount}`,
      `IA,Avaliações,${data.ai.evalsCount}`,
      `IA,Re-engajamentos,${data.ai.reengagements}`,
      `Voice,Ligações,${data.voice.total}`,
      `Voice,Atendimento (%),${data.voice.answerRate.toFixed(2)}`,
      `Voice,Custo,${data.voice.cost.toFixed(2)}`,
      `Prospecção,Buscas,${data.prospection.searchesCount}`,
      `Prospecção,Leads,${data.prospection.resultsCount}`,
      `Prospecção,Importados,${data.prospection.importedCount}`,
      `Instagram,Eventos,${data.instagram.events}`,
      `Instagram,Leads,${data.instagram.leads}`,
      `Afiliados,Cliques,${data.affiliates.clicks}`,
      `Afiliados,Cadastros,${data.affiliates.signups}`,
      `Afiliados,Comissões,${data.affiliates.totalCommissions.toFixed(2)}`,
      `Infra,Storage (bytes),${data.infra.totalStorageBytes}`,
      `Infra,Webhook erros 24h,${data.infra.webhookErrors24h}`,
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-admin-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loading = isLoading || isFetching;

  const sectionProps = useMemo(
    () => ({ data, loading, compareEnabled: filters.compareEnabled }),
    [data, loading, filters.compareEnabled],
  );

  return (
    <AdminLayout>
      <TooltipProvider delayDuration={150}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão de dono — KPIs de saúde, uso, receita e crescimento da plataforma.
            </p>
          </div>

          <DashboardFilters
            filters={filters}
            onChange={setFilters}
            onRefresh={() => refetch()}
            onExport={exportCsv}
            loading={loading}
          />

          <Suspense fallback={<DashboardSectionsFallback />}>
            <RevenueSection {...sectionProps} />
            <AcquisitionSection data={data} loading={loading} />
            <RetentionSection data={data} loading={loading} />
            <EngagementSection data={data} loading={loading} />
            <AISection data={data} loading={loading} />
            <VoiceSection data={data} loading={loading} />
            <ProspectionSection data={data} loading={loading} />
            <InstagramSection data={data} loading={loading} />
            <AffiliatesSection data={data} loading={loading} />
            <InfraSection data={data} loading={loading} />
            <InsightsSection {...sectionProps} />
          </Suspense>
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
}
