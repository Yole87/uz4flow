import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneForwarded, Phone, Settings, GitBranch } from "lucide-react";
import { FlowVoiceCallsTab } from "@/components/voice/FlowVoiceCallsTab";

// Follow-up sub-content (reuses existing components)
import { FollowUpCampaignForm } from "@/components/followup/FollowUpCampaignForm";
import { FollowUpDashboard } from "@/components/followup/FollowUpDashboard";
import { FollowUpTemplates } from "@/components/followup/FollowUpTemplates";
import { LimitAlert } from "@/components/LimitAlert";
import { Plus, LayoutDashboard, FileText } from "lucide-react";

// Voice Campaigns sub-content
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pause, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Config tab
import { VoiceConfigTab } from "@/components/voice/VoiceConfigTab";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Play }> = {
  draft: { label: "Rascunho", color: "border-muted text-muted-foreground", icon: Clock },
  running: { label: "Em andamento", color: "border-accent/50 text-accent", icon: Play },
  paused: { label: "Pausada", color: "border-warning/50 text-warning", icon: Pause },
  completed: { label: "Concluída", color: "border-success/50 text-success", icon: CheckCircle },
};

function FollowUpContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editCampaign, setEditCampaign] = useState<any>(null);

  const handleEditCampaign = (campaign: any) => {
    setEditCampaign(campaign);
    setActiveTab("new");
  };

  const handleBackFromForm = () => {
    setEditCampaign(null);
    setActiveTab("dashboard");
  };

  return (
    <div className="space-y-4">
      <LimitAlert feature="followup" className="mb-4" />
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <PhoneForwarded className="h-5 w-5 text-accent shrink-0" />
        <h2 className="text-lg font-semibold text-foreground truncate whitespace-nowrap">Campanhas de Follow-up</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="new" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nova Campanha</span>
            <span className="sm:hidden">Nova</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <FollowUpCampaignForm onBack={handleBackFromForm} editCampaign={editCampaign} />
        </TabsContent>
        <TabsContent value="dashboard">
          <FollowUpDashboard onEditCampaign={handleEditCampaign} />
        </TabsContent>
        <TabsContent value="templates">
          <FollowUpTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VoiceCampaignsContent() {
  const { data: organization } = useUserOrganization();

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
    <div className="space-y-6">
      <LimitAlert feature="ai_features" className="mb-4" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Campanhas de Voz</h2>
        </div>
        <Button className="w-full sm:w-auto gradient-primary text-white hover:opacity-90" disabled>
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
          <Badge variant="outline" className="ml-2 text-xs border-accent/50">Em breve</Badge>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full bg-muted" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma campanha criada</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Configure o Vapi na aba Configurações e inicie ligações individuais pelo CRM.
              Campanhas em lote estarão disponíveis em breve.
            </p>
          </CardContent>
        </Card>
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
                    <span>{campaign.completed_calls + campaign.failed_calls} / {campaign.total_contacts} contatos</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-success" />
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
  );
}

export default function VoiceAI() {
  return (
    <AppLayout title="Voice AI" description="Gerencie ligações de voz com inteligência artificial">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="followup" className="space-y-6">
          <TabsList className="quantum-glass border border-border/50 flex w-full sm:grid sm:grid-cols-4 h-auto">
            <TabsTrigger value="followup" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm">
              <PhoneForwarded className="h-4 w-4" />
              <span className="hidden sm:inline">Follow-up</span>
              <span className="sm:hidden">Follow</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Ligações IA</span>
              <span className="sm:hidden">Ligações</span>
            </TabsTrigger>
            <TabsTrigger value="flow-calls" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Via Fluxos</span>
              <span className="sm:hidden">Fluxos</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="followup">
            <FollowUpContent />
          </TabsContent>

          <TabsContent value="campaigns">
            <VoiceCampaignsContent />
          </TabsContent>

          <TabsContent value="flow-calls">
            <FlowVoiceCallsTab />
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="text-base font-medium text-foreground mb-1">Configurações foram movidas</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  As credenciais do Vapi agora ficam em <strong>Configurações → Voice AI</strong>, junto com todas as outras integrações.
                </p>
                <Button variant="default" onClick={() => (window.location.href = "/settings#voice")} className="gap-2">
                  <Settings className="h-4 w-4" />
                  Abrir em Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
