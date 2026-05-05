import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface KanbanMigrateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected contact (from card context menu) */
  preSelectedContactId?: string | null;
  currentPipelineId?: string | null;
}

export function KanbanMigrateDialog({ open, onOpenChange, preSelectedContactId, currentPipelineId }: KanbanMigrateDialogProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  const [contactPipelineId, setContactPipelineId] = useState<string | null>(null);

  // Pre-fill from props
  useEffect(() => {
    if (open) {
      if (preSelectedContactId) setSelectedContactId(preSelectedContactId);
      else setSelectedContactId("");
      setSelectedStageId("");
      setSelectedPipelineId("");
      setContactPipelineId(null);
      setSearchTerm("");
    }
  }, [open, preSelectedContactId]);

  // Fetch all contacts for search
  const { data: contacts = [] } = useQuery({
    queryKey: ["kanban-migrate-contacts", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone, avatar_url, pipeline_stage_id")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id && open,
  });

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines-list", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id && open,
  });

  // Fetch stages for selected pipeline
  const { data: stages = [] } = useQuery({
    queryKey: ["pipeline-stages", selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return [];
      const { data, error } = await supabase
        .from("stages")
        .select("id, name, color, order_index")
        .eq("pipeline_id", selectedPipelineId)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedPipelineId,
  });

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return contacts.filter(c => 
      (c.name?.toLowerCase().includes(term)) || c.phone.includes(term)
    ).slice(0, 20);
  }, [contacts, searchTerm]);

  // Get selected contact info
  const selectedContact = contacts.find(c => c.id === selectedContactId);

  // Fetch the contact's current pipeline via their stage
  useEffect(() => {
    if (!selectedContactId || !selectedContact?.pipeline_stage_id) {
      setContactPipelineId(null);
      return;
    }
    supabase
      .from("stages")
      .select("pipeline_id")
      .eq("id", selectedContact.pipeline_stage_id)
      .maybeSingle()
      .then(({ data }) => {
        setContactPipelineId(data?.pipeline_id || null);
      });
  }, [selectedContactId, selectedContact?.pipeline_stage_id]);

  // Filter pipelines: exclude the contact's current pipeline
  const availablePipelines = pipelines.filter(p => p.id !== contactPipelineId);

  const migrateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContactId || !selectedStageId) throw new Error("Selecione contato e estágio");
      const { error } = await supabase
        .from("contacts")
        .update({ pipeline_stage_id: selectedStageId })
        .eq("id", selectedContactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      toast.success("Contato migrado com sucesso!");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao migrar contato"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Migrar Contato de Pipeline</DialogTitle>
          <DialogDescription>Selecione o contato e o pipeline/estágio de destino.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Contact Search */}
          {!preSelectedContactId && (
            <div>
              <Label className="text-sm">Contato</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchTerm && (
                <ScrollArea className="mt-2 max-h-40 border border-border rounded-md">
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedContactId(c.id); setSearchTerm(""); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                        selectedContactId === c.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {(c.name || c.phone).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{c.name || c.phone}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{c.phone}</span>
                    </button>
                  ))}
                  {filteredContacts.length === 0 && (
                    <p className="text-xs text-muted-foreground p-3">Nenhum contato encontrado</p>
                  )}
                </ScrollArea>
              )}
              {selectedContact && !searchTerm && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={selectedContact.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {(selectedContact.name || selectedContact.phone).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{selectedContact.name || selectedContact.phone}</span>
                </div>
              )}
            </div>
          )}

          {preSelectedContactId && selectedContact && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedContact.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {(selectedContact.name || selectedContact.phone).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{selectedContact.name || selectedContact.phone}</span>
            </div>
          )}

          {/* Pipeline Select */}
          <div>
            <Label className="text-sm">Funil de destino</Label>
            <Select value={selectedPipelineId} onValueChange={(v) => { setSelectedPipelineId(v); setSelectedStageId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {availablePipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stage RadioGroup */}
          {stages.length > 0 && (
            <div>
              <Label className="text-sm">Estágio</Label>
              <RadioGroup value={selectedStageId} onValueChange={setSelectedStageId} className="mt-2 space-y-2">
                {stages.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 border border-border rounded-md">
                    <RadioGroupItem value={s.id} id={`migrate-stage-${s.id}`} />
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <Label htmlFor={`migrate-stage-${s.id}`} className="text-sm cursor-pointer">{s.name}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => migrateMutation.mutate()}
            disabled={!selectedContactId || !selectedStageId || migrateMutation.isPending}
          >
            {migrateMutation.isPending ? "Migrando..." : "Migrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
