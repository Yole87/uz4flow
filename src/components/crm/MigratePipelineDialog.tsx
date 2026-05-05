import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface MigratePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  currentStageId: string | null;
  currentPipelineId: string | null;
}

export function MigratePipelineDialog({ open, onOpenChange, contactId, currentStageId, currentPipelineId }: MigratePipelineDialogProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");

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

  useEffect(() => {
    if (open) {
      setSelectedPipelineId("");
      setSelectedStageId("");
    }
  }, [open]);

  const migrateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStageId) throw new Error("Selecione um estágio");
      const { error } = await supabase
        .from("contacts")
        .update({ pipeline_stage_id: selectedStageId })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
      toast.success("Contato migrado com sucesso!");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao migrar contato"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
           <DialogTitle>Migrar Funil</DialogTitle>
           <DialogDescription>Selecione o funil e o estágio de destino.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Funil</Label>
            <Select value={selectedPipelineId} onValueChange={(v) => { setSelectedPipelineId(v); setSelectedStageId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.filter((p) => p.id !== currentPipelineId).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {stages.length > 0 && (
            <div>
              <Label className="text-sm">Estágio</Label>
              <RadioGroup value={selectedStageId} onValueChange={setSelectedStageId} className="mt-2 space-y-2">
                {stages.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 border border-border rounded-md">
                    <RadioGroupItem value={s.id} id={`stage-${s.id}`} />
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <Label htmlFor={`stage-${s.id}`} className="text-sm cursor-pointer">{s.name}</Label>
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
            disabled={!selectedStageId || migrateMutation.isPending}
          >
            {migrateMutation.isPending ? "Migrando..." : "Migrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
