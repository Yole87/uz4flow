import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreVertical, User, Tag, Trash2, Ban, Archive, CheckSquare } from "lucide-react";
import { toast } from "sonner";

interface ChatHeaderMenuProps {
  contactId: string;
  onToggleInspector: () => void;
  showInspector: boolean;
  onStartSelection?: () => void;
}

export function ChatHeaderMenu({ contactId, onToggleInspector, showInspector, onStartSelection }: ChatHeaderMenuProps) {
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: pipelines } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["crm-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stages")
        .select(`id, name, color, order_index, pipeline_id, pipeline:pipelines(id, name)`)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: contact } = useQuery({
    queryKey: ["crm-contact-stage", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("pipeline_stage_id, is_blocked")
        .eq("id", contactId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const updateStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ pipeline_stage_id: stageId })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-contact-stage", contactId] });
      toast.success("Etapa do funil atualizada!");
      setStageDialogOpen(false);
    },
    onError: () => toast.error("Erro ao atualizar etapa"),
  });

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
    onError: () => toast.error("Erro ao atualizar contato"),
  });

  const clearConversationMutation = useMutation({
    mutationFn: async () => {
      const { data: conv, error: convError } = await supabase
        .from("conversations").select("id").eq("contact_id", contactId).single();
      if (convError) throw convError;
      if (!conv) return;
      const { error } = await supabase.from("messages").delete().eq("conversation_id", conv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-messages", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast.success("Mensagens removidas!");
    },
    onError: () => toast.error("Erro ao limpar conversa"),
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async () => {
      const { data: conv, error: convError } = await supabase
        .from("conversations").select("id").eq("contact_id", contactId).single();
      if (convError) throw convError;
      if (!conv) return;
      await supabase.from("messages").delete().eq("conversation_id", conv.id);
      const { error } = await supabase.from("conversations").delete().eq("id", conv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-messages", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations-ids"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details"] });
      toast.success("Conversa excluída!");
      setDeleteConfirmOpen(false);
    },
    onError: () => { toast.error("Erro ao excluir conversa"); setDeleteConfirmOpen(false); },
  });

  const handleViewContact = () => { if (!showInspector) onToggleInspector(); };

  const handleChangeStage = () => {
    setSelectedStageId(contact?.pipeline_stage_id || null);
    if (contact?.pipeline_stage_id && stages) {
      const currentStage = stages.find(s => s.id === contact.pipeline_stage_id);
      setSelectedPipelineId(currentStage?.pipeline_id || pipelines?.[0]?.id || null);
    } else {
      setSelectedPipelineId(pipelines?.[0]?.id || null);
    }
    setStageDialogOpen(true);
  };

  const filteredStages = stages?.filter(s => s.pipeline_id === selectedPipelineId) || [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover border-border text-popover-foreground">
          <DropdownMenuItem onClick={handleViewContact} className="focus:bg-muted focus:text-foreground cursor-pointer">
            <User className="h-4 w-4 mr-2" />
            Ver Dados do Contato
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleChangeStage} className="focus:bg-muted focus:text-foreground cursor-pointer">
            <Tag className="h-4 w-4 mr-2" />
            Mudar Etapa do Funil
          </DropdownMenuItem>
          {onStartSelection && (
            <DropdownMenuItem onClick={onStartSelection} className="focus:bg-muted focus:text-foreground cursor-pointer">
              <CheckSquare className="h-4 w-4 mr-2" />
              Selecionar Mensagens
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem onClick={() => setClearConfirmOpen(true)} className="focus:bg-muted focus:text-foreground cursor-pointer">
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Mensagens
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Conversa
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleBlockMutation.mutate()} className="focus:bg-muted focus:text-foreground cursor-pointer">
            {contact?.is_blocked ? (
              <><Archive className="h-4 w-4 mr-2" />Desbloquear Contato</>
            ) : (
              <><Ban className="h-4 w-4 mr-2" />Bloquear Contato</>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Stage Change Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mudar Etapa do Funil</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {pipelines && pipelines.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Funil Kanban</Label>
                <Select value={selectedPipelineId || ""} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder="Selecione o funil" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-[200]">
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-foreground focus:bg-muted">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {filteredStages.length > 0 ? (
              <RadioGroup value={selectedStageId || ""} onValueChange={setSelectedStageId} className="space-y-3">
                {filteredStages.map((stage) => (
                  <div key={stage.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={stage.id} id={stage.id} className="border-border text-accent" />
                    <Label htmlFor={stage.id} className="flex items-center gap-2 cursor-pointer">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-foreground">{stage.name}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-muted-foreground text-sm">
                {selectedPipelineId ? "Nenhuma etapa neste funil." : "Selecione um funil."}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => selectedStageId && updateStageMutation.mutate(selectedStageId)}
              disabled={!selectedStageId || updateStageMutation.isPending}
            >
              {updateStageMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-card border-border text-card-foreground z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conversa? Todas as mensagens serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConversationMutation.mutate()}
              disabled={deleteConversationMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConversationMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Messages Confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent className="bg-card border-border text-card-foreground z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Mensagens</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover todas as mensagens desta conversa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearConversationMutation.mutate(); setClearConfirmOpen(false); }}
              disabled={clearConversationMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearConversationMutation.isPending ? "Limpando..." : "Limpar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
