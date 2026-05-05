import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { PipelineFunnelChart } from "./PipelineFunnelChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users } from "lucide-react";

interface PipelineDashboardProps {
  pipelineId: string | null;
  instanceId?: string | null;
}

interface StageMetric {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
}

export function PipelineDashboard({ pipelineId, instanceId }: PipelineDashboardProps) {
  const { data: organization } = useUserOrganization();
  // Fetch pipeline info
  const { data: pipeline } = useQuery({
    queryKey: ["pipeline-info", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null;
      const { data } = await supabase
        .from("pipelines")
        .select("id, name, description")
        .eq("id", pipelineId)
        .single();
      return data;
    },
    enabled: !!pipelineId,
  });

  // Fetch stages for the pipeline
  const { data: stages, isLoading: stagesLoading } = useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data } = await supabase
        .from("stages")
        .select("id, name, color, order_index")
        .eq("pipeline_id", pipelineId)
        .order("order_index");
      return data || [];
    },
    enabled: !!pipelineId,
  });

  // Fetch all contacts for the organization (filtered by instance if selected)
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["pipeline-contacts-count", organization?.id, instanceId],
    queryFn: async () => {
      if (!organization?.id) return [];
      let query = supabase
        .from("contacts")
        .select("id, pipeline_stage_id")
        .eq("organization_id", organization.id);
      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!stages || !contacts) {
      return { stages: [], total: 0 };
    }

    // Initialize counts
    const grouped: Record<string, number> = { unassigned: 0 };
    stages.forEach(s => {
      grouped[s.id] = 0;
    });

    // Count contacts per stage
    contacts.forEach(c => {
      if (c.pipeline_stage_id && grouped[c.pipeline_stage_id] !== undefined) {
        grouped[c.pipeline_stage_id]++;
      } else {
        grouped.unassigned++;
      }
    });

    const total = contacts.length;

    // Build metrics array
    const stageMetrics: StageMetric[] = [
      {
        id: "unassigned",
        name: "Não Atribuído",
        color: "#71717a",
        count: grouped.unassigned,
        percentage: total > 0 ? (grouped.unassigned / total) * 100 : 0,
      },
      ...stages.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color || "#71717a",
        count: grouped[s.id],
        percentage: total > 0 ? (grouped[s.id] / total) * 100 : 0,
      })),
    ];

    return { stages: stageMetrics, total };
  }, [stages, contacts]);

  const isLoading = stagesLoading || contactsLoading;

  if (!pipelineId) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione um funil para ver o dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Contatos</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : metrics.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estágios com Contatos</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    `${metrics.stages.filter(s => s.id !== "unassigned" && s.count > 0).length}/${stages?.length || 0}`
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <Users className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    (() => {
                      const closedStage = metrics.stages.find(s => 
                        s.name.toLowerCase().includes("fechado") || 
                        s.name.toLowerCase().includes("ganho") ||
                        s.name.toLowerCase().includes("won")
                      );
                      return closedStage ? `${closedStage.percentage.toFixed(1)}%` : "0%";
                    })()
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 min-w-0">
            <BarChart3 className="h-5 w-5 text-accent shrink-0" />
            <span className="truncate">Funil de Vendas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <PipelineFunnelChart stages={metrics.stages} total={metrics.total} />
          )}
        </CardContent>
      </Card>

    </div>
  );
}
