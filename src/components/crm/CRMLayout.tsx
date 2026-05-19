import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useActiveConversations } from "@/hooks/useActiveConversations";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ContactsPane } from "./ContactsPane";
import { ChatPane } from "./ChatPane";
import { InspectorPane } from "./InspectorPane";
import { InstanceSelector } from "./InstanceSelector";
import { CRMEmptyState } from "./CRMEmptyState";
import { ContactsListPane } from "./ContactsListPane";
import { StorageHeaderBar } from "./StorageHeaderBar";
import { DataRetentionNotice } from "./DataRetentionNotice";
import { LiaFab } from "@/components/lia/LiaFab";
import { MessageSquare, Menu, Users, Bell, BellOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useCRMRealtime } from "@/hooks/useCRMRealtime";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MobilePane = "contacts" | "chat" | "inspector";
type CRMTab = "conversations" | "contacts";

export function CRMLayout() {
  const { data: organization } = useUserOrganization();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { enabled: soundEnabled, setEnabled: setSoundEnabled, testSound } = useNotificationSound();

  // Global realtime subscription at CRM level so notification sound fires
  // even when no conversation is open (e.g. Contacts tab, no selection)
  useCRMRealtime(null);

  const SoundToggle = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            aria-label={soundEnabled ? "Desativar som de notificação" : "Ativar som de notificação"}
          >
            {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 opacity-60" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {soundEnabled ? "Som de notificação ligado" : "Som de notificação desligado"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => testSound()}
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Testar som de notificação"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Testar som de notificação</TooltipContent>
      </Tooltip>
    </>
  );

  // Handle OAuth callback status (Google Calendar)
  useEffect(() => {
    const oauthStatus = searchParams.get("oauth_status");
    if (!oauthStatus) return;

    const REASON_MESSAGES: Record<string, string> = {
      access_denied: "Acesso negado. Verifique se seu e-mail está adicionado como 'Usuário de teste' no Google Cloud Console, ou se o app OAuth está publicado.",
      invalid_client: "Client ID inválido. Verifique se o GOOGLE_CLIENT_ID está correto no backend.",
      redirect_uri_mismatch: "URI de redirecionamento não confere. Adicione a URI exata nas 'Authorized redirect URIs' do Google Cloud.",
      invalid_scope: "Escopo inválido. Verifique se a Google Calendar API está habilitada no projeto.",
      token_exchange_failed: "Falha na troca do código por token. Verifique o GOOGLE_CLIENT_SECRET.",
      missing_params: "Parâmetros ausentes na resposta do Google.",
      internal_error: "Erro interno no servidor ao processar o callback.",
    };

    if (oauthStatus === "success") {
      toast.success("Google Calendar conectado com sucesso!");
    } else if (oauthStatus === "error") {
      const reason = searchParams.get("reason") || "unknown";
      const message = REASON_MESSAGES[reason] || `Erro ao conectar: ${reason}`;
      toast.error("Falha ao conectar Google Calendar", { description: message, duration: 10000 });
    }

    const newParams = new URLSearchParams(searchParams);
    newParams.delete("oauth_status");
    newParams.delete("reason");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  const [selectedInstanceId, setSelectedInstanceIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem("crm-selected-instance");
    return stored || null;
  });

  const setSelectedInstanceId = useCallback((id: string | null) => {
    setSelectedInstanceIdState(id);
    if (id) {
      localStorage.setItem("crm-selected-instance", id);
    } else {
      localStorage.removeItem("crm-selected-instance");
    }
  }, []);


  const [showInspector, setShowInspector] = useState(true);
  const [mobilePane, setMobilePane] = useState<MobilePane>("contacts");
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CRMTab>("conversations");

  // Handle query param for deep linking from Kanban / Fila
  useEffect(() => {
    const contactParam = searchParams.get("contact");
    const conversationParam = searchParams.get("conversation");
    if (contactParam || conversationParam) {
      if (contactParam) setSelectedContactId(contactParam);
      if (conversationParam) setSelectedConversationId(conversationParam);
      setActiveTab("conversations");
      if (isMobile) {
        setMobilePane("chat");
      }
    }
  }, [searchParams, isMobile]);

  // Fetch instances to check if any exist
  const { data: instances, isLoading: instancesLoading } = useQuery({
    queryKey: ["crm-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("*")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Validate stored instance still exists once instances load
  useEffect(() => {
    if (!instances || instances.length === 0) return;
    if (selectedInstanceId) {
      const exists = instances.some((i: any) => i.id === selectedInstanceId);
      if (!exists) {
        setSelectedInstanceId(null);
      }
    }
  }, [instances, selectedInstanceId, setSelectedInstanceId]);

  const orgInstanceIds = (instances || []).map((i: any) => i.id) as string[];

  // Fetch conversations for auto-select logic — usa critério canônico unificado
  const { conversations } = useActiveConversations({
    organizationId: organization?.id,
    instanceId: selectedInstanceId,
  });

  // Track manual selection to prevent auto-select from overriding user clicks
  const manualSelectionRef = useRef(false);

  // Auto-select next contact only if truly deleted (skip right after manual selection)
  useEffect(() => {
    if (!conversations || !selectedContactId) return;
    if (manualSelectionRef.current) {
      manualSelectionRef.current = false;
      return;
    }
    const stillExists = conversations.some(c => c.contact_id === selectedContactId);
    if (!stillExists && conversations.length > 0) {
      setSelectedContactId(conversations[0].contact_id);
      setSelectedConversationId(conversations[0].id);
    } else if (!stillExists) {
      setSelectedContactId(null);
      setSelectedConversationId(null);
    }
  }, [conversations]);

  const hasInstances = instances && instances.length > 0;

  // Handle contact selection with conversationId
  const handleSelectContact = useCallback((contactId: string, conversationId?: string) => {
    manualSelectionRef.current = true;
    setSelectedContactId(contactId);
    setSelectedConversationId(conversationId || null);
  }, []);

  // Mobile: Handle contact selection - navigate to chat
  const handleMobileContactSelect = useCallback((contactId: string, conversationId?: string) => {
    handleSelectContact(contactId, conversationId);
    setMobilePane("chat");
  }, [handleSelectContact]);

  // Mobile: Go back to contacts
  const handleMobileBack = () => {
    setMobilePane("contacts");
  };

  // Mobile: Toggle inspector as sheet
  const handleMobileInspectorToggle = () => {
    setMobileInspectorOpen(!mobileInspectorOpen);
  };

  // Navigate from Contacts tab to Conversations tab with a specific contact
  const handleNavigateToConversation = useCallback((contactId: string) => {
    manualSelectionRef.current = true;
    setSelectedContactId(contactId);
    setActiveTab("conversations");
    if (isMobile) {
      setMobilePane("chat");
    }
  }, [isMobile]);

  // Mobile Header Component
  const MobileHeader = () => (
    <header className="flex h-14 shrink-0 items-center gap-1.5 header-quantum px-2">
      <SidebarTrigger className="-ml-0.5 text-muted-foreground hover:text-foreground shrink-0" />
      
      <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
        <button
          onClick={() => setActiveTab("conversations")}
          className={`px-2 py-1 text-xs font-medium rounded-sm transition-all whitespace-nowrap ${
            activeTab === "conversations"
              ? "bg-primary/20 text-primary border-b-2 border-primary shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Conversas
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`px-2 py-1 text-xs font-medium rounded-sm transition-all whitespace-nowrap ${
            activeTab === "contacts"
              ? "bg-primary/20 text-primary border-b-2 border-primary shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Contatos
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 shrink-0">
        {SoundToggle}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
           <DropdownMenuContent align="end" className="bg-card border-border">
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );

  // Desktop Header Component
  const DesktopHeader = () => (
    <header className="flex h-14 shrink-0 items-center gap-2 lg:gap-3 header-quantum px-3 lg:px-4 min-w-0">
      <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground shrink-0" />
      <div className="flex items-center gap-2 shrink-0">
        <MessageSquare className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">CRM</h1>
      </div>

      <div className="flex items-center gap-1 ml-2 lg:ml-4 bg-muted rounded-md p-1 shrink-0">
        <button
          onClick={() => setActiveTab("conversations")}
          className={`px-2.5 lg:px-3 py-1.5 text-sm font-medium rounded-sm transition-all whitespace-nowrap ${
            activeTab === "conversations"
              ? "bg-primary/20 text-primary border-b-2 border-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Conversas
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`px-2.5 lg:px-3 py-1.5 text-sm font-medium rounded-sm transition-all whitespace-nowrap ${
            activeTab === "contacts"
              ? "bg-primary/20 text-primary border-b-2 border-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 inline mr-1" />
          Contatos
        </button>
      </div>

      <div className="hidden xl:flex items-center gap-2 min-w-0">
        <StorageHeaderBar />
        <DataRetentionNotice />
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0 min-w-0">
        {SoundToggle}
        {hasInstances && (
          <InstanceSelector 
            selectedInstanceId={selectedInstanceId}
            onInstanceChange={setSelectedInstanceId}
          />
        )}
      </div>
    </header>
  );

  // Mobile Layout
  const MobileLayout = () => (
    <div className="flex flex-col h-full">
      {mobilePane === "contacts" && (
        <ContactsPane 
          selectedContactId={selectedContactId}
          onSelectContact={handleMobileContactSelect}
          instanceId={selectedInstanceId}
        />
      )}
      
      {mobilePane === "chat" && (
        <ChatPane 
          contactId={selectedContactId}
          conversationId={selectedConversationId}
          onToggleInspector={handleMobileInspectorToggle}
          showInspector={mobileInspectorOpen}
          isMobile={true}
          onBack={handleMobileBack}
        />
      )}

      <Sheet open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:w-[400px] p-0 bg-background border-border"
        >
          <InspectorPane 
            contactId={selectedContactId}
            conversationId={selectedConversationId}
            isMobile={true}
            onClose={() => setMobileInspectorOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );

  // Desktop Layout
  const DesktopLayout = () => {
    const showInspectorPanel = showInspector && !!selectedContactId;
    return (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={30} minSize={22} maxSize={40}>
          <div className="h-full overflow-hidden">
            <ContactsPane
              selectedContactId={selectedContactId}
              onSelectContact={handleSelectContact}
              instanceId={selectedInstanceId}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />

        <ResizablePanel defaultSize={showInspectorPanel ? 45 : 70} minSize={40}>
          <div className="h-full overflow-hidden">
            <ChatPane
              contactId={selectedContactId}
              conversationId={selectedConversationId}
              onToggleInspector={() => setShowInspector(!showInspector)}
              showInspector={showInspector}
              isMobile={false}
            />
          </div>
        </ResizablePanel>

        {showInspectorPanel && (
          <>
            <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
            <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
              <div className="h-full overflow-hidden">
                <InspectorPane
                  contactId={selectedContactId}
                  conversationId={selectedConversationId}
                  isMobile={false}
                />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex h-[100svh] w-full bg-background overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col h-full overflow-hidden">
          {isMobile ? <MobileHeader /> : <DesktopHeader />}

          {isMobile && activeTab === "conversations" && (
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border shrink-0">
              {hasInstances && (
                <InstanceSelector
                  selectedInstanceId={selectedInstanceId}
                  onInstanceChange={setSelectedInstanceId}
                />
              )}
              <div className="ml-auto">
                <StorageHeaderBar />
              </div>
            </div>
          )}

          <main className="flex-1 bg-background overflow-hidden min-h-0">
            {activeTab === "contacts" ? (
              <ContactsListPane onNavigateToConversation={handleNavigateToConversation} globalInstanceId={selectedInstanceId} />
            ) : instancesLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando...
              </div>
            ) : !hasInstances ? (
              <CRMEmptyState />
            ) : isMobile ? (
              <MobileLayout />
            ) : (
              <DesktopLayout />
            )}
          </main>
        </SidebarInset>
      </div>

      <LiaFab />
    </SidebarProvider>
  );
}
