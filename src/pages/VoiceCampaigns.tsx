import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { LimitAlert } from "@/components/LimitAlert";
import { Phone, Plus, Play, Pause, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Play }> = {
  draft: { label: "Rascunho", color: "border-muted text-muted-foreground", icon: Clock },
  running: { label: "Em andamento", color: "border-accent/50 text-accent", icon: Play },
  paused: { label: "Pausada", color: "border-yellow-500/50 text-yellow-500", icon: Pause },
  completed: { label: "Concluída", color: "border-emerald-500/50 text-emerald-500", icon: CheckCircle },
};

export default function VoiceCampaigns() {
  const { data: organization } = useUserOrganization();
  const navigate = useNavigate();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["voice-campaigns", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("voice_campaigns")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  return (
    <AppLayout title="Ligações IA" description="Gerencie campanhas de ligações com inteligência artificial">
      <div className="space-y-6 animate-fade-in">
        <LimitAlert feature="ai_features" className="mb-4" />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">Campanhas de Voz</h2>
          </div>
          <Button className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Nova Campanha
            <Badge variant="outline" className="ml-2 text-xs border-accent/50">Em breve</Badge>
          </Button>
        </div>

        {/* Campaigns List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full bg-muted" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            variant="card"
            icon={Phone}
            title="Nenhuma campanha criada"
            description="Configure o Vapi nas Configurações e inicie ligações individuais pelo CRM. Campanhas em lote estarão disponíveis em breve."
            action={{
              label: "Configurar Vapi",
              onClick: () => navigate("/settings"),
            }}
          />
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const config = statusConfig[campaign.status] || statusConfig.draft;
              const progress = campaign.total_contacts > 0
                ? Math.round(((campaign.completed_calls + campaign.failed_calls) / campaign.total_contacts) * 100)
                : 0;

              return (
                <Card key={campaign.id} className="transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground text-base min-w-0 truncate">{campaign.name}</CardTitle>
                      <Badge variant="outline" className={`shrink-0 ${config.color}`}>
                        <config.icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {campaign.completed_calls + campaign.failed_calls} / {campaign.total_contacts} contatos
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                          {campaign.completed_calls}
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-destructive" />
                          {campaign.failed_calls}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Criada em {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
