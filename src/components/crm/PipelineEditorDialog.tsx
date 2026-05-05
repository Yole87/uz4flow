import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";

interface Stage {
  id?: string;
  name: string;
  color: string;
  description: string;
  order_index: number;
}

interface PipelineEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId?: string | null;
  mode: "create" | "edit";
}

const DEFAULT_COLORS = [
  "#71717a", // zinc
  "#3b82f6", // blue
  "#f97316", // orange
  "#22c55e", // green
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#eab308", // yellow
];

export function PipelineEditorDialog({
  open,
  onOpenChange,
  pipelineId,
  mode,
}: PipelineEditorDialogProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);

  // Fetch existing pipeline data
  const { data: existingPipeline, isLoading: pipelineLoading } = useQuery({
    queryKey: ["pipeline-detail", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null;
      
      const { data: pipeline, error: pipelineError } = await supabase
        .from("pipelines")
        .select("*")
        .eq("id", pipelineId)
        .single();
      
      if (pipelineError) throw pipelineError;
      
      const { data: stagesData, error: stagesError } = await supabase
        .from("stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("order_index");
      
      if (stagesError) throw stagesError;
      
      return { ...pipeline, stages: stagesData };
    },
    enabled: !!pipelineId && open && mode === "edit",
  });

  // Initialize form with existing data
  useEffect(() => {
    if (mode === "edit" && existingPipeline) {
      setName(existingPipeline.name);
      setDescription(existingPipeline.description || "");
      setIsDefault(existingPipeline.is_default);
      setStages(
        existingPipeline.stages.map((s: any) => ({
          id: s.id,
          name: s.name,
          color: s.color || "#71717a",
          description: s.description || "",
          order_index: s.order_index,
        }))
      );
    } else if (mode === "create") {
      // Default stages for new pipeline
      setName("");
      setDescription("");
      setIsDefault(false);
      setStages([
        { name: "Novo Lead", color: "#71717a", description: "", order_index: 0 },
        { name: "Em Progresso", color: "#3b82f6", description: "", order_index: 1 },
        { name: "Negociação", color: "#f97316", description: "", order_index: 2 },
        { name: "Fechado", color: "#22c55e", description: "", order_index: 3 },
        { name: "Perdido", color: "#ef4444", description: "", order_index: 4 },
      ]);
    }
  }, [existingPipeline, mode, open]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("No organization");

      if (mode === "create") {
        // Create new pipeline
        const { data: newPipeline, error: pipelineError } = await supabase
          .from("pipelines")
          .insert({
            organization_id: organization.id,
            name,
            description: description || null,
            is_default: isDefault,
          })
          .select()
          .single();

        if (pipelineError) throw pipelineError;

        // Create stages
        const stagesToInsert = stages.map((stage, index) => ({
          pipeline_id: newPipeline.id,
          name: stage.name,
          color: stage.color,
          description: stage.description || null,
          order_index: index,
        }));

        const { error: stagesError } = await supabase
          .from("stages")
          .insert(stagesToInsert);

        if (stagesError) throw stagesError;

        return newPipeline;
      } else {
        // Update existing pipeline
        const { error: pipelineError } = await supabase
          .from("pipelines")
          .update({
            name,
            description: description || null,
            is_default: isDefault,
          })
          .eq("id", pipelineId);

        if (pipelineError) throw pipelineError;

        // Get existing stage IDs
        const existingStageIds = stages.filter(s => s.id).map(s => s.id!);
        
        // Delete removed stages
        if (existingStageIds.length > 0) {
          await supabase
            .from("stages")
            .delete()
            .eq("pipeline_id", pipelineId)
            .not("id", "in", `(${existingStageIds.join(",")})`);
        }

        // Upsert stages
        for (let i = 0; i < stages.length; i++) {
          const stage = stages[i];
          if (stage.id) {
            await supabase
              .from("stages")
              .update({
                name: stage.name,
                color: stage.color,
                description: stage.description || null,
                order_index: i,
              })
              .eq("id", stage.id);
          } else {
            await supabase
              .from("stages")
              .insert({
                pipeline_id: pipelineId,
                name: stage.name,
                color: stage.color,
                description: stage.description || null,
                order_index: i,
              });
          }
        }

        return { id: pipelineId };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages"] });
      queryClient.invalidateQueries({ queryKey: ["default-pipeline"] });
      toast.success(mode === "create" ? "Funil criado!" : "Funil atualizado!");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar funil");
    },
  });

  const handleAddStage = () => {
    const newIndex = stages.length;
    const colorIndex = newIndex % DEFAULT_COLORS.length;
    setStages([
      ...stages,
      {
        name: `Etapa ${newIndex + 1}`,
        color: DEFAULT_COLORS[colorIndex],
        description: "",
        order_index: newIndex,
      },
    ]);
  };

  const handleRemoveStage = (index: number) => {
    if (stages.length <= 2) {
      toast.error("O funil deve ter pelo menos 2 etapas");
      return;
    }
    setStages(stages.filter((_, i) => i !== index));
  };

  const handleStageChange = (index: number, field: keyof Stage, value: string) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    setStages(updated);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const isLoading = mode === "edit" && pipelineLoading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {mode === "create" ? "Novo Funil Kanban" : "Editar Funil Kanban"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure as etapas do funil de vendas
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pipeline Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pipeline-name" className="text-foreground">
                  Nome do Funil
                </Label>
                <Input
                  id="pipeline-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                   placeholder="Ex: Funil de Vendas"
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pipeline-desc" className="text-foreground">
                  Descrição (opcional)
                </Label>
                <Textarea
                  id="pipeline-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o objetivo deste funil"
                  className="bg-muted border-border text-foreground resize-none"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is-default" className="text-foreground">
                  Funil padrão
                </Label>
                <Switch
                  id="is-default"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Stages */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">Etapas do Funil</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStage}
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div
                    key={stage.id || `new-${index}`}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move" />
                    
                    {/* Color picker */}
                    <div className="space-y-1">
                      <input
                        type="color"
                        value={stage.color}
                        onChange={(e) => handleStageChange(index, "color", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-border"
                      />
                    </div>

                    <div className="flex-1 space-y-2">
                      <Input
                        value={stage.name}
                        onChange={(e) => handleStageChange(index, "name", e.target.value)}
                        placeholder="Nome da etapa"
                        className="h-8 bg-background border-border text-foreground text-sm"
                      />
                      <Input
                        value={stage.description}
                        onChange={(e) => handleStageChange(index, "description", e.target.value)}
                        placeholder="Descrição/nota da etapa (opcional)"
                        className="h-8 bg-background border-border text-muted-foreground text-xs"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStage(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || stages.length < 2 || saveMutation.isPending}
            className="gradient-primary text-white hover:opacity-90"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : mode === "create" ? (
              "Criar Funil"
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
