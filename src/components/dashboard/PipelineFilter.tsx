import { useQuery } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";

interface PipelineFilterProps {
  value: string | null; // null = all
  onChange: (next: string | null) => void;
  className?: string;
}

export function PipelineFilter({ value, onChange, className }: PipelineFilterProps) {
  const { data: organization } = useUserOrganization();

  const { data: pipelines = [] } = useQuery({
    queryKey: ["dashboard-pipelines", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from("pipelines")
        .select("id, name, is_default")
        .eq("organization_id", organization.id)
        .order("name");
      return data || [];
    },
    enabled: !!organization?.id,
    staleTime: 60_000,
  });

  if (pipelines.length === 0) return null;

  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger className={className || "h-8 w-[180px] text-xs"}>
        <SelectValue>
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {value
                ? pipelines.find((p) => p.id === value)?.name || "Funil"
                : "Todos os funis"}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            Todos os funis
          </div>
        </SelectItem>
        {pipelines.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              {p.name}
              {p.is_default && (
                <span className="text-[9px] text-muted-foreground ml-1">(padrão)</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
