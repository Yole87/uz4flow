import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AIInsightsCard } from "./AIInsightsCard";
import { CustomFieldsList, CustomField } from "./CustomFieldsList";
import { VoiceCallDialog } from "./VoiceCallDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MigratePipelineDialog } from "./MigratePipelineDialog";
import { ConversationEvalCard } from "./ConversationEvalCard";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Phone, 
  Mail, 
  Tag, 
  Calendar, 
  MessageSquare,
  Edit,
  Ban,
  Trash2,
  User,
  Plus,
  X,
  Save,
  StickyNote,
  ChevronLeft,
  Kanban,
  Smartphone,
  Check,
  UserCheck,
  UserX
} from "lucide-react";

function DeleteContactAlert({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[100] bg-card border-border" style={{ position: 'fixed' }}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Excluir contato?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Tem certeza que deseja excluir este contato e todas as suas mensagens? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useMetaWindow } from "@/hooks/useMetaWindow";
import { MetaWindowBar } from "./MetaWindowBar";

interface InspectorPaneProps {
  contactId: string | null;
  conversationId?: string | null;
  isMobile?: boolean;
  onClose?: () => void;
}

export function InspectorPane({ contactId, conversationId: propConversationId, isMobile = false, onClose }: InspectorPaneProps) {
  const navigate = useNavigate();
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [showVoiceCallDialog, setShowVoiceCallDialog] = useState(false);
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const { data: orgData } = useUserOrganization();
  const queryClient = useQueryClient();

  // Fetch contact with conversation and instance info
  const { data: contactData, isLoading } = useQuery({
    queryKey: ["crm-contact-details", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      
      // Get contact with stage
      const { data: contact, error } = await supabase
        .from("contacts")
        .select(`
          *,
          stage:stages(
            id,
            name,
            color,
            pipeline:pipelines(id, name)
          )
        `)
        .eq("id", contactId)
        .single();
      if (error) throw error;
      
      // Get conversation with instance info - use propConversationId for isolation
      let convQuery = supabase
        .from("conversations")
        .select(`
          id,
          instance_id,
          instance:instances(id, name, phone_number, openbot_instance_id, provider)
        `);
      
      if (propConversationId) {
        convQuery = convQuery.eq("id", propConversationId);
      } else {
        convQuery = convQuery.eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(1);
      }
      
      const { data: conversation } = await convQuery.maybeSingle();
      
      // Initialize notes from metadata
      const metadata = contact.metadata as Record<string, unknown> | null;
      setNotesValue((metadata?.notes as string) || "");
      
      // Cast ai_analysis from Json to the expected type
      const aiAnalysis = contact.ai_analysis as {
        summary: string;
        sentiment: "positive" | "negative" | "neutral";
        suggested_reply: string;
        next_action: string;
        interest_level?: "high" | "medium" | "low";
        analyzed_at?: string;
      } | null;
      
      return { 
        ...contact, 
        ai_analysis: aiAnalysis,
        conversation: conversation ? {
          ...conversation,
          instance: conversation.instance as { id: string; name: string; phone_number: string | null; openbot_instance_id: string | null; provider: string | null } | null
        } : null
      };
    },
    enabled: !!contactId,
  });
  
  const contact = contactData;

  // Meta window state
  const instanceProvider = contact?.conversation?.instance?.provider || null;
  const metaWindow = useMetaWindow(
    propConversationId || contact?.conversation?.id,
    instanceProvider
  );

  // Fetch team members for assignment
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members-active", orgData?.id],
    queryFn: async () => {
      if (!orgData?.id) return [];
      const { data } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, is_active")
        .eq("organization_id", orgData.id)
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
    enabled: !!orgData?.id,
  });

  // Assign member mutation
  const assignMemberMutation = useMutation({
    mutationFn: async (memberId: string | null) => {
      const { error } = await supabase
        .from("contacts")
        .update({ assigned_to_member_id: memberId })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      toast.success("Responsável atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar responsável"),
  });

  const assignedMemberName = (() => {
    if (!contact?.assigned_to_member_id || !teamMembers) return null;
    const m = teamMembers.find(m => m.id === contact.assigned_to_member_id);
    return m ? `${m.first_name}${m.last_name ? ` ${m.last_name}` : ""}` : null;
  })();

  // Update name when contact changes
  useEffect(() => {
    if (contactData) {
      setNameValue(contactData.name || "");
    }
  }, [contactData]);

  // Update name mutation
  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ name })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-contact", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      setIsEditingName(false);
      toast.success("Nome atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar nome");
    },
  });

  // Update tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const { error } = await supabase
        .from("contacts")
        .update({ tags })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      toast.success("Tags atualizadas!");
    },
    onError: () => {
      toast.error("Erro ao atualizar tags");
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const currentMetadata = (contact?.metadata as Record<string, unknown>) || {};
      const { error } = await supabase
        .from("contacts")
        .update({ 
          metadata: { ...currentMetadata, notes } 
        })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      setIsEditingNotes(false);
      toast.success("Notas salvas!");
    },
    onError: () => {
      toast.error("Erro ao salvar notas");
    },
  });

  // Toggle block mutation
  const toggleBlockMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contacts")
        .update({ is_blocked: !contact?.is_blocked })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-contact-stage", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      toast.success(contact?.is_blocked ? "Contato desbloqueado!" : "Contato bloqueado!");
    },
  });

  const handleAddTag = () => {
    if (!newTag.trim() || !contact) return;
    const currentTags = contact.tags || [];
    if (currentTags.includes(newTag.trim())) {
      toast.error("Tag já existe");
      return;
    }
    updateTagsMutation.mutate([...currentTags, newTag.trim()]);
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!contact) return;
    const currentTags = contact.tags || [];
    updateTagsMutation.mutate(currentTags.filter(t => t !== tagToRemove));
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notesValue);
  };

  if (!contactId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground border-l border-border px-4">
        <User className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm text-center">Selecione um contato</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full bg-background border-l border-border p-4">
        {/* Mobile header with back button */}
        {isMobile && (
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-foreground font-medium">Detalhes</span>
          </div>
        )}
        <div className="flex flex-col items-center mb-6">
          <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted mb-3" />
          <Skeleton className="h-5 w-32 bg-muted mb-2" />
          <Skeleton className="h-4 w-24 bg-muted" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const displayName = contact?.name || contact?.phone || "Contato";
  const initials = displayName.slice(0, 2).toUpperCase();
  const metadata = contact?.metadata as Record<string, unknown> | null;
  const notes = (metadata?.notes as string) || "";

  return (
    <div className="h-full bg-background border-l border-border flex flex-col min-h-0 overflow-hidden">
      {/* Mobile header with back button */}
      {isMobile && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-foreground font-medium">Detalhes do Contato</span>
        </div>
      )}
      
      <ScrollArea className="flex-1 min-h-0">
        {/* Profile Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-accent/20 to-transparent overflow-hidden">
          <div className="flex flex-col items-center">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 mb-3 ring-2 ring-accent/30">
              <AvatarImage src={contact?.avatar_url || undefined} />
              <AvatarFallback className="bg-accent text-accent-foreground text-lg sm:text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            {/* Editable Name */}
            {isEditingName ? (
              <div className="flex items-center gap-2 w-full max-w-[200px]">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && updateNameMutation.mutate(nameValue)}
                  className="h-8 bg-muted border-border text-foreground text-center text-sm"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateNameMutation.mutate(nameValue)}
                  disabled={updateNameMutation.isPending}
                  className="h-8 w-8 text-accent hover:text-accent"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditingName(false);
                    setNameValue(contact?.name || "");
                  }}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h2 className="text-base sm:text-lg font-semibold text-foreground text-center">{displayName}</h2>
            )}
            
            <p className="text-sm text-muted-foreground">{contact?.phone}</p>
            
            {contact?.is_blocked && (
              <Badge variant="destructive" className="mt-2">
                <Ban className="h-3 w-3 mr-1" />
                Bloqueado
              </Badge>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setNameValue(contact?.name || "");
                setIsEditingName(true);
              }}
              className="border-border text-muted-foreground hover:bg-muted text-xs sm:text-sm"
            >
              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Editar
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate(`/kanban?contact=${contactId}`)}
              className="border-accent/50 text-accent hover:bg-accent/20 hover:text-accent text-xs sm:text-sm"
            >
              <Kanban className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Pipeline
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled
                    className="border-accent/50 text-accent opacity-50 cursor-not-allowed text-xs sm:text-sm"
                  >
                    <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Ligar IA
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Função em construção</TooltipContent>
            </Tooltip>
            
            {/* Responsible Member */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted text-xs sm:text-sm"
                >
                  {assignedMemberName ? (
                    <>
                      <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-accent" />
                      {assignedMemberName}
                    </>
                  ) : (
                    <>
                      <UserX className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      Sem Responsável
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="center">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Atribuir responsável</p>
                {contact?.assigned_to_member_id && (
                  <button
                    onClick={() => assignMemberMutation.mutate(null)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Remover responsável
                  </button>
                )}
                {teamMembers?.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => assignMemberMutation.mutate(m.id)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors flex items-center justify-between",
                      contact?.assigned_to_member_id === m.id && "bg-accent/10 text-accent"
                    )}
                  >
                    <span>{m.first_name}{m.last_name ? ` ${m.last_name}` : ""}</span>
                    {contact?.assigned_to_member_id === m.id && <Check className="h-3 w-3" />}
                  </button>
                ))}
                {(!teamMembers || teamMembers.length === 0) && (
                  <p className="text-xs text-muted-foreground px-2 py-2">Nenhum membro ativo</p>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Voice Call Dialog */}
          {contactId && (
            <VoiceCallDialog
              open={showVoiceCallDialog}
              onOpenChange={setShowVoiceCallDialog}
              contactId={contactId}
              contactName={displayName}
            />
          )}
        </div>

        <Separator className="bg-border" />

        {/* Meta Window Status */}
        {metaWindow.isMetaInstance && !metaWindow.isLoading && (
          <div className="px-3 sm:px-4 pt-3">
            <MetaWindowBar
              remainingMs={metaWindow.remainingMs}
              windowType={metaWindow.windowType}
              isFromCampaign={metaWindow.isFromCampaign}
            />
          </div>
        )}

        {/* Connected Instance - Before AI Insights */}
        {contact?.conversation?.instance && (
          <div className="p-3 sm:p-4 pb-0">
            <Card className="bg-card/50 border-border">
              <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
                  <Smartphone className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
                  Instância Conectada
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                <p className="text-sm text-foreground">{contact.conversation.instance.name}</p>
                {contact.conversation.instance.phone_number && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    +{contact.conversation.instance.phone_number.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "$1 $2 $3-$4")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Insights Card */}
        <div className="p-3 sm:p-4 pb-0">
          <AIInsightsCard 
            contactId={contactId} 
            existingAnalysis={contact?.ai_analysis}
            notes={notes}
          />
        </div>

        {/* Custom Fields */}
        <div className="px-3 sm:px-4 pt-3">
          <CustomFieldsList 
            contactId={contactId}
            fields={((metadata?.custom_fields as unknown[]) || []) as CustomField[]}
            metadata={metadata}
          />
        </div>

        {/* Contact Info */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Pipeline Stage */}
          {contact?.stage && (
            <>
              <Card className="bg-card/50 border-border">
                <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
                  <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
                      Pipeline
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-accent" onClick={() => setShowMigrateDialog(true)}>
                      Migrar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                  <p className="text-xs sm:text-sm font-medium text-foreground">
                    {contact.stage.pipeline?.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: contact.stage.color }}
                    />
                    <span className="text-xs text-muted-foreground">{contact.stage.name}</span>
                  </div>
                </CardContent>
              </Card>
              <MigratePipelineDialog
                open={showMigrateDialog}
                onOpenChange={setShowMigrateDialog}
                contactId={contactId!}
                currentStageId={contact.stage.id}
                currentPipelineId={contact.stage.pipeline?.id || null}
              />
            </>
          )}

          {/* Contact Details */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground">
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3 space-y-2 sm:space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs sm:text-sm text-foreground break-all">{contact?.phone}</span>
              </div>
              
              {contact?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs sm:text-sm text-foreground break-all">{contact.email}</span>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Criado em {contact?.created_at && format(new Date(contact.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>

              {contact?.last_interaction_at && (
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Última: {format(new Date(contact.last_interaction_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags - Editable */}
          <Card className="bg-card/50 border-border" data-guide="contact-tags">
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
               <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
                  Tags
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingTags(!isEditingTags)}
                  className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                  {isEditingTags ? <X className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {(contact?.tags || []).map((tag, index) => {
                  const isHumanTag = typeof tag === "string" && tag.toLowerCase().trim() === "human";
                  const badge = (
                    <Badge
                      key={index}
                      variant="outline"
                      className={
                        isHumanTag
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-medium flex items-center gap-1 text-xs"
                          : "bg-accent/15 text-accent border-accent/30 font-normal flex items-center gap-1 text-xs"
                      }
                    >
                      {isHumanTag && <UserCheck className="h-3 w-3" />}
                      {tag}
                      {isEditingTags && (
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => handleRemoveTag(tag)}
                        />
                      )}
                    </Badge>
                  );

                  if (isHumanTag) {
                    return (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>{badge}</TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs">
                            <strong>Atendimento humano ativo.</strong> O bot e as automações estão pausados para este contato.
                            Remova esta tag para reativar as respostas automáticas.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return badge;
                })}
                {(!contact?.tags || contact.tags.length === 0) && !isEditingTags && (
                  <span className="text-xs sm:text-sm text-muted-foreground/70">Nenhuma tag</span>
                )}
              </div>
              
              {isEditingTags && (
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Nova tag (ex: human pausa o bot)"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    className="flex-1 h-9 sm:h-8 bg-muted border-border text-foreground text-xs sm:text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddTag}
                    disabled={!newTag.trim()}
                    className="h-9 sm:h-8 gradient-primary text-white hover:opacity-90"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes - Editable */}
          <Card className="bg-card/50 border-border" data-guide="contact-notes">
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
                  Notas
                </div>
                {!isEditingNotes ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingNotes(true)}
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingNotes(false);
                        setNotesValue(notes);
                      }}
                      className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={updateNotesMutation.isPending}
                      className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-accent hover:text-accent"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
              {isEditingNotes ? (
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Adicione notas sobre este contato..."
                  className="min-h-[80px] sm:min-h-[100px] bg-muted border-border text-foreground text-xs sm:text-sm resize-none"
                />
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                  {notes || "Nenhuma nota adicionada."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI Evaluation Card */}
          {(propConversationId || contact?.conversation?.id) && (
            <ConversationEvalCard conversationId={(propConversationId || contact?.conversation?.id)!} />
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <DeleteContactAlert
        open={showDeleteAlert}
        onOpenChange={setShowDeleteAlert}
        onConfirm={() => {
          if (!contact?.conversation?.id) {
            toast.error("Nenhuma conversa encontrada para este contato");
            return;
          }
          supabase.functions.invoke("crm-bulk-delete", {
            body: { action: "delete_selected_conversations", conversation_ids: [contact.conversation.id] }
          }).then(({ data, error }) => {
            if (error || data?.error) {
              toast.error("Erro ao excluir: " + (data?.error || error?.message));
              return;
            }
            queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
            queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
            queryClient.invalidateQueries({ queryKey: ["kanban-contacts"] });
            toast.success("Contato excluído!");
          });
        }}
      />
      <div className="p-2 sm:p-3 border-t border-border pb-20">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => toggleBlockMutation.mutate()}
            className="flex-1 h-10 sm:h-9 border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs sm:text-sm"
          >
            <Ban className="h-4 w-4 mr-1" />
            {contact?.is_blocked ? "Desbloquear" : "Bloquear"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowDeleteAlert(true)}
            className="h-10 sm:h-9 w-10 sm:w-9 p-0 border-destructive/50 text-destructive hover:text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
