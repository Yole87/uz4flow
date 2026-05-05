import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { ReportFilters, buildPeriod, type ReportPeriod } from "@/components/reports/ReportFilters";
import { OverviewTab } from "@/components/reports/OverviewTab";
import { FunnelTab } from "@/components/reports/FunnelTab";
import { TeamTab } from "@/components/reports/TeamTab";
import { FlowsTab } from "@/components/reports/FlowsTab";
import { VoiceTab } from "@/components/reports/VoiceTab";
import { BarChart3, Kanban, Users, GitBranch, Phone } from "lucide-react";

export default function Reports() {
  const { data: organization } = useUserOrganization();
  const { effectiveUserId } = useEffectiveUserId();
  const [period, setPeriod] = useState<ReportPeriod>(() => buildPeriod("7d"));
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: instances = [] } = useQuery({
    queryKey: ["reports-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from("instances_safe" as any)
        .select("id, name, provider")
        .eq("organization_id", organization.id)
        .order("name");
      return (data || []) as unknown as { id: string; name: string; provider: string }[];
    },
    enabled: !!organization?.id,
  });

  const tabs = useMemo(
    () => [
      { id: "overview", label: "Visão Geral", icon: BarChart3 },
      { id: "funnel", label: "Funil Kanban", icon: Kanban },
      { id: "team", label: "Equipe", icon: Users },
      { id: "flows", label: "Fluxos", icon: GitBranch },
      { id: "voice", label: "Voice AI", icon: Phone },
    ],
    []
  );

  return (
    <AppLayout
      title="Relatórios"
      description="Analytics profundos para decisões acionáveis sobre equipe, funil e automação"
    >
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <ReportFilters
            period={period}
            onPeriodChange={setPeriod}
            instanceId={instanceId}
            onInstanceChange={setInstanceId}
            instances={instances}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap quantum-scrollbar">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs sm:text-sm shrink-0">
                <t.icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {activeTab === "overview" && (
              <OverviewTab organizationId={organization?.id} period={period} instanceId={instanceId} />
            )}
          </TabsContent>
          <TabsContent value="funnel" className="mt-4">
            {activeTab === "funnel" && (
              <FunnelTab organizationId={organization?.id} period={period} instanceId={instanceId} />
            )}
          </TabsContent>
          <TabsContent value="team" className="mt-4">
            {activeTab === "team" && (
              <TeamTab organizationId={organization?.id} period={period} instanceId={instanceId} />
            )}
          </TabsContent>
          <TabsContent value="flows" className="mt-4">
            {activeTab === "flows" && (
              <FlowsTab
                organizationId={organization?.id}
                effectiveUserId={effectiveUserId}
                period={period}
                instanceId={instanceId}
              />
            )}
          </TabsContent>
          <TabsContent value="voice" className="mt-4">
            {activeTab === "voice" && (
              <VoiceTab organizationId={organization?.id} period={period} instanceId={instanceId} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
