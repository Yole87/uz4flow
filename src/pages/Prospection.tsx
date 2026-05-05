import { useState, useEffect, useRef } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, Settings, History, UserSearch, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProviderConfigCard } from "@/components/crm/prospection/ProviderConfigCard";
import { ProspectionSearchForm } from "@/components/crm/prospection/ProspectionSearchForm";
import { ProspectionResults } from "@/components/crm/prospection/ProspectionResults";
import { ProspectionHistory } from "@/components/crm/prospection/ProspectionHistory";
import { useProspectionPolling } from "@/hooks/useProspectionPolling";
import { useProspectionPersistence } from "@/hooks/useProspectionPersistence";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { LimitAlert } from "@/components/LimitAlert";

export default function Prospection() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("search");
  const [isSearching, setIsSearching] = useState(false);
  
  const {
    searchId,
    status: searchStatus,
    isPolling,
    elapsedTime,
    startPolling,
    stopSearch,
    reset,
  } = useProspectionPolling();

  const persistence = useProspectionPersistence();
  // Estado local para resultados re-hidratados quando não há polling ativo
  const [hydratedResults, setHydratedResults] = useState<{
    searchId: string | null;
    status: any;
    elapsedTime: number;
  } | null>(null);
  const hydrationDoneRef = useRef(false);

  // Re-hidrata da localStorage na primeira montagem (após persistência carregar)
  useEffect(() => {
    if (
      !hydrationDoneRef.current &&
      persistence.hydrated &&
      persistence.persisted &&
      !searchId &&
      !isPolling
    ) {
      hydrationDoneRef.current = true;
      setHydratedResults({
        searchId: persistence.persisted.searchId,
        status: persistence.persisted.status,
        elapsedTime: persistence.persisted.elapsedTime,
      });
    }
  }, [persistence.hydrated, persistence.persisted, searchId, isPolling]);

  // Persiste a cada update do polling
  useEffect(() => {
    if (searchId && searchStatus) {
      persistence.persist({
        searchId,
        status: searchStatus,
        elapsedTime,
        searchMeta: lastSearchMetaRef.current || undefined,
      });
    }
  }, [searchId, searchStatus, elapsedTime, persistence]);

  // Handle search completion
  useEffect(() => {
    if (searchStatus?.status === "completed") {
      setIsSearching(false);
      toast({
        title: "Busca concluída!",
        description: `${searchStatus.total_found} leads encontrados`,
      });
    } else if (searchStatus?.status === "stopped") {
      setIsSearching(false);
      toast({
        title: "Busca interrompida",
        description: `${searchStatus.total_found} leads foram encontrados`,
      });
    } else if (searchStatus?.status === "failed") {
      setIsSearching(false);
      toast({
        title: "Erro na busca",
        description: searchStatus.error_message || "Ocorreu um erro durante a busca",
        variant: "destructive",
      });
    }
  }, [searchStatus?.status, searchStatus?.total_found, searchStatus?.error_message, toast]);

  const lastSearchMetaRef = useRef<{ keyword?: string; location?: string; provider?: string } | null>(null);

  const handleSearchStarted = (
    newSearchId: string, 
    options?: { functionName?: string; autoStep?: boolean; meta?: { keyword?: string; location?: string; provider?: string } }
  ) => {
    // Limpa hidratação ao iniciar nova busca
    setHydratedResults(null);
    persistence.clear();
    reset();
    if (options?.meta) lastSearchMetaRef.current = options.meta;
    startPolling(newSearchId, {
      functionName: options?.functionName as "gmaps-visual-scraper" | "google-places-search" || "gmaps-visual-scraper",
      autoStep: options?.autoStep || false,
    });
  };

  const handleStopSearch = () => {
    stopSearch();
    setIsSearching(false);
  };

  const handleNewSearch = () => {
    reset();
    setHydratedResults(null);
    persistence.clear();
    lastSearchMetaRef.current = null;
    setIsSearching(false);
  };

  // Resolve a fonte de verdade dos dados (polling ativo > hidratado)
  const effectiveSearchId = searchId || hydratedResults?.searchId || null;
  const effectiveStatus = searchStatus || hydratedResults?.status || null;
  const effectiveElapsed = isPolling || searchId ? elapsedTime : (hydratedResults?.elapsedTime || 0);
  const currentLeads = effectiveStatus?.leads || [];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 sm:gap-3 header-quantum px-3 sm:px-4">
            <SidebarTrigger className="-ml-1 sm:-ml-2 text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2 min-w-0">
              <UserSearch className="h-5 w-5 text-accent shrink-0" />
              <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate">
                {isMobile ? "Prospecção" : "Prospecção com IA"}
              </h1>
            </div>

            {/* Mobile: secondary actions in dropdown */}
            {isMobile && (
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem onClick={() => setActiveTab("search")}>
                      <Search className="h-4 w-4 mr-2" /> Buscar Leads
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("config")}>
                      <Settings className="h-4 w-4 mr-2" /> Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("history")}>
                      <History className="h-4 w-4 mr-2" /> Histórico
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </header>

          <main className="flex-1 bg-background p-3 sm:p-6 overflow-auto">
            <LimitAlert feature="prospection" className="mb-4" />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              {/* Desktop tabs - hidden on mobile since we have dropdown */}
              {!isMobile && (
                <TabsList className="quantum-glass border border-border/50">
                  <TabsTrigger value="search">
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Leads
                  </TabsTrigger>
                  <TabsTrigger value="config">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History className="h-4 w-4 mr-2" />
                    Histórico
                  </TabsTrigger>
                </TabsList>
              )}

              <TabsContent value="search" className="space-y-4 sm:space-y-6">
                <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 min-h-0">
                  <div className="lg:col-span-1 min-w-0">
                    <ProspectionSearchForm 
                      onSearchStarted={handleSearchStarted}
                      isSearching={isSearching || isPolling}
                      setIsSearching={setIsSearching}
                      onGoToConfig={() => setActiveTab("config")}
                      hasUnsavedLeads={persistence.hasUnsavedLeads}
                      unsavedCount={persistence.unsavedCount}
                    />
                  </div>
                  <div className="lg:col-span-2 min-w-0">
                    <ProspectionResults 
                      results={currentLeads}
                      isLoading={isSearching && !searchStatus}
                      searchId={effectiveSearchId}
                      metrics={effectiveStatus?.metrics}
                      searchStatus={effectiveStatus}
                      elapsedTime={effectiveElapsed}
                      onStopSearch={handleStopSearch}
                      onNewSearch={handleNewSearch}
                      onGoToConfig={() => setActiveTab("config")}
                      onLeadsSaved={persistence.markAsSaved}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="config">
                <ProviderConfigCard />
              </TabsContent>

              <TabsContent value="history">
                <ProspectionHistory />
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
