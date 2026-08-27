import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useActiveConversations } from "@/hooks/useActiveConversations";
import { Input } from "@/components/ui/input";
import { VirtualContactList } from "./VirtualContactList";
import { ConversationSelectionBar } from "./ConversationSelectionBar";
import { DeleteAllConversationsDialog } from "./DeleteAllConversationsDialog";
import { NewConversationDialog } from "./NewConversationDialog";
import { ContactsFilterPopover, ContactFilters } from "./ContactsFilterPopover";
import { AllRemindersDialog } from "./AllRemindersDialog";
import { QuickReplyManager } from "./QuickReplyManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Plus, Trash2, CheckSquare, Bell, Zap, MessageSquare, Filter, BookOpen, Clock, X } from "lucide-react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon } from "@/components/icons/ChannelIcon";

interface ContactsPaneProps {
  selectedContactId: string | null;
  onSelectContact: (contactId: string, conversationId?: string) => void;
  instanceId: string | null;
  /** Telefone (somente dígitos) para abrir o diálogo de nova conversa pré-preenchido */
  newConversationPhone?: string | null;
  onNewConversationHandled?: () => void;
}

export function ContactsPane({ selectedContactId, onSelectContact, instanceId, newConversationPhone, onNewConversationHandled }: ContactsPaneProps) {
  const { data: organization } = useUserOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const unansweredFilter = searchParams.get("filter") === "unanswered_1h";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [prefilledPhone, setPrefilledPhone] = useState<string | undefined>(undefined);

  // Abre o diálogo de nova conversa quando o CRMLayout sinaliza um telefone
  // vindo de /crm?new_conversation_phone=... (Via Cadastros / Via Uz4Forms)
  useEffect(() => {
    if (!newConversationPhone) return;
    setPrefilledPhone(newConversationPhone);
    setShowNewConversationDialog(true);
    onNewConversationHandled?.();
  }, [newConversationPhone, onNewConversationHandled]);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [showQuickReplyManager, setShowQuickReplyManager] = useState(false);
  const [channelFilter, setChannelFilter] = useState<"all" | "whatsapp" | "instagram">("all");
  const [filters, setFilters] = useState<ContactFilters>({
    stageId: null,
    unreadOnly: false,
    blockedOnly: false,
    instanceId: null,
    assignedMemberIds: [],
    unassignedOnly: false,
  });

  const clearUnansweredFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("filter");
    setSearchParams(next, { replace: true });
  };

  // Fetch instances separately to avoid RLS join issues
  const { data: instancesData } = useQuery({
    queryKey: ["crm-instances-map", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { nameMap: {}, providerMap: {}, channelMap: {} };
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name, provider, channel")
        .eq("organization_id", organization.id);
      if (error) throw error;
      const nameMap: Record<string, string> = {};
      const providerMap: Record<string, string> = {};
      const channelMap: Record<string, string> = {};
      for (const inst of (data || [])) {
        nameMap[(inst as any).id] = (inst as any).name;
        providerMap[(inst as any).id] = (inst as any).provider || "baileys";
        channelMap[(inst as any).id] = (inst as any).channel || "whatsapp";
      }
      return { nameMap, providerMap, channelMap };
    },
    enabled: !!organization?.id,
  });

  const instancesMap = instancesData?.nameMap || {};
  const instancesProviderMap = instancesData?.providerMap || {};
  const instancesChannelMap = instancesData?.channelMap || {};

  // Determine effective instance filter: selector > filter popover
  const effectiveInstanceId = instanceId || filters.instanceId;

  const orgInstanceIds = Object.keys(instancesMap);

  // Active conversations — critério canônico unificado (mesmo número do Dashboard)
  const {
    conversations: activeConversations,
    count: activeCount,
    isLoading: activeLoading,
  } = useActiveConversations({
    organizationId: organization?.id,
    instanceId: effectiveInstanceId,
  });

  // Enriquecimento via 2ª query (decoupled de RLS): contact + stage + assigned_member
  const conversationIds = useMemo(
    () => activeConversations.map((c) => c.id),
    [activeConversations]
  );
  const contactIds = useMemo(
    () => Array.from(new Set(activeConversations.map((c) => c.contact_id))),
    [activeConversations]
  );

  const { data: contactsEnriched, isLoading: contactsLoading } = useQuery({
    queryKey: ["crm-conversations-contacts", contactIds.join(",")],
    queryFn: async () => {
      if (contactIds.length === 0) return {} as Record<string, any>;
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          stage:stages(id, name, color),
          assigned_member:team_members!contacts_assigned_to_member_id_fkey(id, first_name)
        `)
        .in("id", contactIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const c of data || []) map[c.id] = c;
      return map;
    },
    enabled: contactIds.length > 0,
    staleTime: 5000,
  });

  const isLoading = activeLoading || contactsLoading;

  // Compose conversations with their enriched contact (formato esperado pelos consumidores)
  const conversations = useMemo(() => {
    if (!activeConversations.length) return [];
    return activeConversations.map((conv) => ({
      ...conv,
      contact: contactsEnriched?.[conv.contact_id] || null,
    }));
  }, [activeConversations, contactsEnriched]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    
    let result = conversations;
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter((conv) => {
        const contact = conv.contact;
        if (!contact) return false;
        return (
          contact.name?.toLowerCase().includes(searchLower) ||
          contact.phone?.includes(searchQuery)
        );
      });
    }
    
    if (filters.stageId) {
      if (filters.stageId === "unassigned") {
        result = result.filter((conv) => !conv.contact?.pipeline_stage_id);
      } else {
        result = result.filter((conv) => conv.contact?.pipeline_stage_id === filters.stageId);
      }
    }
    
    if (filters.unreadOnly) {
      result = result.filter((conv) => conv.unread_count > 0);
    }
    
    if (filters.blockedOnly) {
      result = result.filter((conv) => conv.contact?.is_blocked);
    }

    if (filters.unassignedOnly) {
      result = result.filter((conv) => !conv.contact?.assigned_to_member_id);
    } else if (filters.assignedMemberIds.length > 0) {
      result = result.filter((conv) =>
        filters.assignedMemberIds.includes(conv.contact?.assigned_to_member_id || "")
      );
    }

    if (channelFilter !== "all") {
      result = result.filter((conv) => {
        const ch = (conv as any).channel || instancesChannelMap[conv.instance_id || ""] || "whatsapp";
        return ch === channelFilter;
      });
    }

    if (unansweredFilter) {
      const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
      result = result.filter((conv: any) => {
        if (conv.last_sender_type !== "customer") return false;
        const lastMs = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
        return lastMs > 0 && lastMs < oneHourAgoMs;
      });
    }

    return result;
  }, [conversations, searchQuery, filters, channelFilter, instancesChannelMap, unansweredFilter]);

  // Unread counts per channel — uses raw conversations (ignores channel filter so badges always reflect inbox)
  const channelUnreadCounts = useMemo(() => {
    const counts = { all: 0, whatsapp: 0, instagram: 0 };
    if (!conversations) return counts;
    for (const conv of conversations) {
      const unread = conv.unread_count || 0;
      if (unread <= 0) continue;
      counts.all += unread;
      const ch = (conv as any).channel || instancesChannelMap[conv.instance_id || ""] || "whatsapp";
      if (ch === "whatsapp") counts.whatsapp += unread;
      else if (ch === "instagram") counts.instagram += unread;
    }
    return counts;
  }, [conversations, instancesChannelMap]);

  const handleToggleSelection = (conversationId: string) => {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const handleSelectAll = () => {
    setSelectedConversationIds(filteredConversations.map((c) => c.id));
  };

  const handleClearSelection = () => {
    setSelectedConversationIds([]);
    setSelectionMode(false);
  };

  const handleDeleteSelected = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteSuccess = () => {
    setSelectedConversationIds([]);
    setSelectionMode(false);
  };

  const handleNewConversationCreated = (contactId: string) => {
    onSelectContact(contactId);
  };

  // Show instance filter in popover only when "Todas" is selected in the header selector
  const showInstanceFilter = !instanceId;

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      <div className="p-2 sm:p-3 border-b border-border">
        <div className="flex items-center justify-between gap-1 xl:gap-2 mb-2 sm:mb-3 min-w-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col min-w-0 flex-1 cursor-help">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Conversas
                    </h2>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs tabular-nums">
                      {activeCount}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground/70 truncate">
                    Canal: {channelFilter === "all" ? "Todos" : channelFilter === "whatsapp" ? "WhatsApp" : "Instagram"}
                    {" · "}
                    Instância: {effectiveInstanceId ? (instancesMap[effectiveInstanceId] || "—") : "Todas"}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">
                  Conversas ativas da organização — mesmo número exibido no Dashboard.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex gap-0.5 sm:gap-1 shrink-0">
            <ContactsFilterPopover 
              filters={filters} 
              onFiltersChange={setFilters}
              showInstanceFilter={showInstanceFilter}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAllReminders(true)}
              className="h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Gerenciar todos os lembretes"
            >
              <Bell className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQuickReplyManager(true)}
              className="h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Gerenciar respostas rápidas"
            >
              <Zap className="h-4 w-4" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) setSelectedConversationIds([]);
              }}
              className={`h-9 w-9 sm:h-8 sm:w-8 ${
                selectionMode 
                  ? "text-accent bg-accent/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
            
            {selectionMode && selectedConversationIds.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDeleteSelected}
                className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowNewConversationDialog(true)}
              className="h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 sm:h-9 text-base sm:text-sm bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
            data-guide="search-contacts"
          />
        </div>

        {unansweredFilter && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-warning/10 border border-warning/30">
            <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
            <span className="text-xs text-foreground flex-1 truncate">Sem resposta &gt; 1h</span>
            <button
              onClick={clearUnansweredFilter}
              className="h-5 w-5 rounded hover:bg-warning/20 flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Remover filtro"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Channel filter tabs */}
        <Tabs
          value={channelFilter}
          onValueChange={(v) => setChannelFilter(v as typeof channelFilter)}
          className="mt-2"
        >
          <TabsList className="grid grid-cols-3 h-8 w-full bg-muted">
            <TabsTrigger value="all" className="text-xs h-6 gap-1.5">
              <span className="hidden sm:inline">Todos os canais</span>
              <span className="sm:hidden">Todos</span>
              {channelUnreadCounts.all > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-xs bg-accent text-accent-foreground flex items-center justify-center">
                  {channelUnreadCounts.all > 99 ? "99+" : channelUnreadCounts.all}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs h-6 gap-1">
              <ChannelIcon channel="whatsapp" size={12} />
              <span className="hidden sm:inline">WhatsApp</span>
              {channelUnreadCounts.whatsapp > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-xs bg-accent text-accent-foreground flex items-center justify-center ml-0.5">
                  {channelUnreadCounts.whatsapp > 99 ? "99+" : channelUnreadCounts.whatsapp}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="instagram" className="text-xs h-6 gap-1">
              <ChannelIcon channel="instagram" size={12} />
              <span className="hidden sm:inline">Instagram</span>
              {channelUnreadCounts.instagram > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-xs bg-accent text-accent-foreground flex items-center justify-center ml-0.5">
                  {channelUnreadCounts.instagram > 99 ? "99+" : channelUnreadCounts.instagram}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {selectionMode && (
        <ConversationSelectionBar
          selectedCount={selectedConversationIds.length}
          totalCount={filteredConversations.length}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onDelete={handleDeleteSelected}
        />
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28 sm:w-32 bg-muted" />
                  <Skeleton className="h-3 w-40 sm:w-48 bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : activeCount === 0 ? (
          <EmptyState
            size="sm"
            icon={MessageSquare}
            title="Nenhuma conversa ainda"
            description={
              effectiveInstanceId
                ? "Esta instância ainda não recebeu mensagens. Conecte um número ou aguarde a primeira interação."
                : "Conecte um canal (WhatsApp ou Instagram) para começar a receber mensagens dos seus leads."
            }
            action={{
              label: "Ir para Conectores",
              onClick: () => navigate("/connectors"),
              icon: Plus,
            }}
            secondaryAction={{
              label: "Ver tutoriais",
              onClick: () => navigate("/tutorials"),
              icon: BookOpen,
            }}
          />
        ) : filteredConversations.length === 0 ? (
          <EmptyState
            size="sm"
            icon={Filter}
            title="Nenhuma conversa com esses filtros"
            description={`${activeCount} conversa${activeCount === 1 ? "" : "s"} disponíve${activeCount === 1 ? "l" : "is"}. Tente remover um filtro ou ampliar o período.`}
            action={{
              label: "Limpar filtros",
              variant: "outline",
              onClick: () => {
                setSearchQuery("");
                setChannelFilter("all");
                setFilters({
                  stageId: null,
                  unreadOnly: false,
                  blockedOnly: false,
                  instanceId: null,
                  assignedMemberIds: [],
                  unassignedOnly: false,
                });
              },
            }}
          />
        ) : (
          <VirtualContactList
            conversations={filteredConversations}
            selectedContactId={selectedContactId}
            onSelectContact={onSelectContact}
            selectionMode={selectionMode}
            selectedConversationIds={selectedConversationIds}
            onToggleSelection={handleToggleSelection}
            instancesMap={instancesMap}
            instancesProviderMap={instancesProviderMap}
            instancesChannelMap={instancesChannelMap}
          />
        )}
      </div>

      <DeleteAllConversationsDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        instanceId={effectiveInstanceId}
        mode="conversations"
        selectedIds={selectedConversationIds}
        onSuccess={handleDeleteSuccess}
      />

      <NewConversationDialog
        open={showNewConversationDialog}
        onOpenChange={(open) => {
          setShowNewConversationDialog(open);
          if (!open) {
            setPrefilledPhone(undefined);
          }
        }}
        initialPhone={prefilledPhone}
        onConversationCreated={handleNewConversationCreated}
      />

      <AllRemindersDialog
        open={showAllReminders}
        onOpenChange={setShowAllReminders}
      />

      <Dialog open={showQuickReplyManager} onOpenChange={setShowQuickReplyManager}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto quantum-scrollbar">
          <DialogHeader>
            <DialogTitle>Respostas rápidas</DialogTitle>
            <DialogDescription>
              Cadastre, edite e organize suas respostas rápidas para usar dentro de qualquer conversa.
            </DialogDescription>
          </DialogHeader>
          <QuickReplyManager />
        </DialogContent>
      </Dialog>
    </div>
  );
}
