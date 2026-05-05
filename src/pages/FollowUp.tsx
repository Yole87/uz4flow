import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FollowUpCampaignForm } from "@/components/followup/FollowUpCampaignForm";
import { FollowUpDashboard } from "@/components/followup/FollowUpDashboard";
import { FollowUpTemplates } from "@/components/followup/FollowUpTemplates";
import { LimitAlert } from "@/components/LimitAlert";
import { PhoneForwarded, Plus, LayoutDashboard, FileText } from "lucide-react";

export default function FollowUp() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editCampaign, setEditCampaign] = useState<any>(null);

  // When editing from dashboard, switch to form tab
  const handleEditCampaign = (campaign: any) => {
    setEditCampaign(campaign);
    setActiveTab("new");
  };

  const handleBackFromForm = () => {
    setEditCampaign(null);
    setActiveTab("dashboard");
  };

  // When loading template from templates tab, switch to form
  const handleLoadTemplate = (template: any) => {
    setEditCampaign(null);
    setActiveTab("new");
    // Template loading is handled inside the form via the template selector
  };

  return (
    <AppLayout title="Follow-up" description="Programe ligações de follow-up para seus contatos">
      <div className="space-y-6 animate-fade-in">
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
    </AppLayout>
  );
}
