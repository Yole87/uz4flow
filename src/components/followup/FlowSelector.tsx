import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

interface FlowSelectorProps {
  value: string;
  onChange: (flowId: string) => void;
}

export function FlowSelector({ value, onChange }: FlowSelectorProps) {
  const { data: organization } = useUserOrganization();

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["followup-flows", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      // Get org owner's user_id to query flows
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organization.id)
        .eq("role", "owner")
        .limit(1);

      const ownerId = members?.[0]?.user_id;
      if (!ownerId) return [];

      const { data, error } = await supabase
        .from("flows")
        .select("id, name, is_active")
        .eq("user_id", ownerId)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  if (isLoading) return <Skeleton className="h-10 w-full bg-muted" />;

  if (flows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border rounded-md p-3">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          Nenhum fluxo encontrado.{" "}
          <Link to="/flows" className="text-accent hover:underline">
            Criar fluxo em Automação → Fluxos
          </Link>
        </span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione um fluxo..." />
      </SelectTrigger>
      <SelectContent>
        {flows.map((flow) => (
          <SelectItem key={flow.id} value={flow.id}>
            <div className="flex items-center gap-2">
              <Workflow className="h-3 w-3" />
              <span>{flow.name}</span>
              <Badge
                variant="outline"
                className={flow.is_active ? "text-emerald-500 border-emerald-500/50" : "text-muted-foreground border-muted"}
              >
                {flow.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
