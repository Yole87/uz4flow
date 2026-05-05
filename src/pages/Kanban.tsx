import { useState, useEffect } from "react";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { PipelineDashboard } from "@/components/crm/PipelineDashboard";
import { PipelineSelector } from "@/components/crm/PipelineSelector";
import { PipelineEditorDialog } from "@/components/crm/PipelineEditorDialog";
import { InstanceSelector } from "@/components/crm/InstanceSelector";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Kanban, BarChart3, Menu, Smartphone, Zap } from "lucide-react";
import { PipelineAutomationDialog } from "@/components/crm/PipelineAutomationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useIsMobile } from "@/hooks/use-mobile";
import { LimitAlert } from "@/components/LimitAlert";

export default function KanbanPage() {
  const { data: organization } = useUserOrganization();
  const isMobile = useIsMobile();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [showEditorDialog, setShowEditorDialog] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("edit");
  const [viewMode, setViewMode] = useState<"kanban" | "dashboard">("kanban");
  const [showAutomationDialog, setShowAutomationDialog] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // Detect landscape on mobile
  useEffect(() => {
    if (!isMobile) return;
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, [isMobile]);

  // Get default pipeline on load
  const { data: defaultPipeline } = useQuery({
    queryKey: ["default-pipeline", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { data } = await supabase
        .from("pipelines")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("is_default", true)
        .maybeSingle();
      return data;
    },
    enabled: !!organization?.id,
  });

  // Get the currently selected pipeline name (for header)
  const { data: selectedPipeline } = useQuery({
    queryKey: ["pipeline-name", selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return null;
      const { data } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("id", selectedPipelineId)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedPipelineId,
  });

  const pipelineName = selectedPipeline?.name || "Funil Kanban";

  // Set default pipeline when loaded
  useEffect(() => {
    if (defaultPipeline && !selectedPipelineId) {
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [defaultPipeline, selectedPipelineId]);

  const handleEditPipeline = () => {
    setEditorMode("edit");
    setShowEditorDialog(true);
  };

  const handleCreatePipeline = () => {
    setEditorMode("create");
    setShowEditorDialog(true);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          {/* Desktop Header */}
          {!isMobile && (
            <header className="flex shrink-0 items-center gap-2 lg:gap-3 header-quantum px-3 lg:px-4 min-w-0 flex-wrap gap-y-2 min-h-14 h-auto py-2 lg:py-0 lg:h-14 lg:flex-nowrap">
              <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground shrink-0" />
              <div className="flex items-center gap-2 shrink-0 min-w-0">
                <Kanban className="h-5 w-5 text-accent shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-base lg:text-lg font-semibold text-foreground truncate leading-tight" title={pipelineName}>{pipelineName}</h1>
                  <p className="text-xs text-muted-foreground leading-tight hidden lg:block">Funil Kanban</p>
                </div>
              </div>

              <div className="ml-2 lg:ml-4 shrink-0">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "kanban" | "dashboard")}>
                  <TabsList className="h-8">
                    <TabsTrigger value="kanban" className="text-xs px-3 gap-1.5">
                      <Kanban className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Kanban</span>
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="text-xs px-3 gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Dashboard</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAutomationDialog(true)}
                className="gap-1.5 border-border text-muted-foreground hover:text-foreground shrink-0"
                title="Automações"
              >
                <Zap className="h-3.5 w-3.5 text-accent" />
                <span className="hidden xl:inline whitespace-nowrap">Automações</span>
              </Button>

              <div className="ml-auto flex items-center gap-2 flex-wrap min-w-0">
                <div className="min-w-[150px] max-w-[220px] flex-1">
                  <InstanceSelector
                    selectedInstanceId={selectedInstanceId}
                    onInstanceChange={setSelectedInstanceId}
                  />
                </div>
                <div className="min-w-[160px] max-w-[220px] flex-1">
                  <PipelineSelector
                    selectedPipelineId={selectedPipelineId}
                    onPipelineChange={setSelectedPipelineId}
                    onEditPipeline={handleEditPipeline}
                    onCreatePipeline={handleCreatePipeline}
                  />
                </div>
              </div>
            </header>
          )}

          {/* Mobile Header */}
          {isMobile && (
            <header className="flex h-14 shrink-0 items-center gap-2 header-quantum px-3">
              <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
              <Kanban className="h-4 w-4 text-accent shrink-0" />
              <h1 className="text-sm font-semibold text-foreground truncate" title={pipelineName}>{pipelineName}</h1>
              <div className="ml-auto flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem onClick={() => setViewMode(viewMode === "kanban" ? "dashboard" : "kanban")}>
                      {viewMode === "kanban" ? <BarChart3 className="h-4 w-4 mr-2" /> : <Kanban className="h-4 w-4 mr-2" />}
                      {viewMode === "kanban" ? "Dashboard" : "Kanban"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowAutomationDialog(true)}>
                      <Zap className="h-4 w-4 mr-2" />
                      Automações
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleEditPipeline}>
                     <Kanban className="h-4 w-4 mr-2" />
                       Editar Funil
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={handleCreatePipeline}>
                       <Kanban className="h-4 w-4 mr-2" />
                       Novo Funil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
          )}

          {/* Mobile: Landscape orientation banner */}
          {isMobile && !isLandscape && viewMode === "kanban" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border-b border-accent/20 text-xs text-foreground/80">
              <Smartphone className="h-4 w-4 text-accent shrink-0" />
              <span>Para melhor visualização do Kanban, gire o celular na horizontal</span>
            </div>
          )}

          {/* Mobile Pipeline + Instance Selector */}
          {isMobile && (
            <div className="flex flex-col gap-2 px-3 py-2 border-b border-border">
              <PipelineSelector
                selectedPipelineId={selectedPipelineId}
                onPipelineChange={setSelectedPipelineId}
                onEditPipeline={handleEditPipeline}
                onCreatePipeline={handleCreatePipeline}
              />
              <InstanceSelector
                selectedInstanceId={selectedInstanceId}
                onInstanceChange={setSelectedInstanceId}
              />
            </div>
          )}

          <LimitAlert feature="pipeline" className="mx-3 mt-2" />
          <main className="flex-1 bg-background overflow-hidden">
            {viewMode === "kanban" ? (
              <KanbanBoard pipelineId={selectedPipelineId} instanceId={selectedInstanceId} />
            ) : (
              <PipelineDashboard pipelineId={selectedPipelineId} instanceId={selectedInstanceId} />
            )}
          </main>
        </SidebarInset>
      </div>

      <PipelineEditorDialog
        open={showEditorDialog}
        onOpenChange={setShowEditorDialog}
        pipelineId={selectedPipelineId}
        mode={editorMode}
      />

      <PipelineAutomationDialog
        open={showAutomationDialog}
        onOpenChange={setShowAutomationDialog}
      />
    </SidebarProvider>
  );
}
