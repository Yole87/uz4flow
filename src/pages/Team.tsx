import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamProfilesTab } from "@/components/settings/TeamProfilesTab";
import { TeamMembersTab } from "@/components/settings/TeamMembersTab";
import { LeadRotationConfig } from "@/components/crm/LeadRotationConfig";
import { Users, Shield, ListChecks } from "lucide-react";

export default function Team() {
  const [params, setParams] = useSearchParams();
  // Regra de negócio: criar perfis primeiro, depois membros.
  const initial = params.get("tab") || "profiles";
  const [tab, setTab] = useState(initial);

  const handleChange = (value: string) => {
    setTab(value);
    setParams({ tab: value }, { replace: true });
  };

  return (
    <AppLayout
      title="Equipe"
      description="Crie perfis e permissões, cadastre membros e configure a distribuição de leads"
    >
      <div className="max-w-5xl animate-fade-in">
        <Tabs value={tab} onValueChange={handleChange} className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto whitespace-nowrap quantum-scrollbar md:grid md:grid-cols-3 md:w-auto md:overflow-visible">
            <TabsTrigger value="profiles" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Perfis &amp; Permissões</span>
              <span className="sm:hidden">Perfis</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              <span>Membros</span>
            </TabsTrigger>
            <TabsTrigger value="rotation" className="gap-2">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Distribuição</span>
              <span className="sm:hidden">Rodízio</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="space-y-6 mt-0">
            <TeamProfilesTab />
          </TabsContent>

          <TabsContent value="members" className="space-y-6 mt-0">
            <TeamMembersTab />
          </TabsContent>

          <TabsContent value="rotation" className="space-y-6 mt-0">
            <LeadRotationConfig />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
