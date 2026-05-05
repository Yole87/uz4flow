import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Settings } from "lucide-react";

interface PipelineSelectorProps {
  selectedPipelineId: string | null;
  onPipelineChange: (pipelineId: string) => void;
  onEditPipeline?: () => void;
  onCreatePipeline?: () => void;
}

export function PipelineSelector({
  selectedPipelineId,
  onPipelineChange,
  onEditPipeline,
  onCreatePipeline,
}: PipelineSelectorProps) {
  const { data: organization } = useUserOrganization();

  const { data: pipelines, isLoading } = useQuery({
    queryKey: ["pipelines", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, is_default, description")
        .eq("organization_id", organization.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-9 w-48 bg-muted" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedPipelineId || ""}
        onValueChange={onPipelineChange}
      >
        <SelectTrigger className="w-full min-w-0 bg-muted border-border text-foreground" data-guide="pipeline-selector">
          <span className="truncate block min-w-0 flex-1 text-left">
            <SelectValue placeholder="Selecione o Funil" />
          </span>
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-[200]">
          {pipelines?.map((pipeline) => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              <div className="flex items-center gap-2">
                <span>{pipeline.name}</span>
                {pipeline.is_default && (
                  <span className="text-xs text-muted-foreground">(Padrão)</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {onEditPipeline && selectedPipelineId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onEditPipeline}
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}

      {onCreatePipeline && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreatePipeline}
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
