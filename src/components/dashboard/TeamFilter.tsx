import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";

interface TeamFilterProps {
  value: string[]; // selected member IDs (empty = all)
  onChange: (next: string[]) => void;
  className?: string;
}

interface TeamMemberLite {
  id: string;
  name: string;
}

/**
 * Multi-select filter para atendentes (team_members) da organização.
 * Vazio = todos os atendentes.
 */
export function TeamFilter({ value, onChange, className }: TeamFilterProps) {
  const { data: organization } = useUserOrganization();
  const [open, setOpen] = useState(false);

  const { data: members = [] } = useQuery<TeamMemberLite[]>({
    queryKey: ["dashboard-team-members", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("first_name");
      return (data || []).map((m: any) => ({
        id: m.id,
        name: [m.first_name, m.last_name].filter(Boolean).join(" ") || "Sem nome",
      }));
    },
    enabled: !!organization?.id,
    staleTime: 60_000,
  });

  // Drop stale ids when team changes
  useEffect(() => {
    if (!members.length || !value.length) return;
    const valid = value.filter((id) => members.some((m) => m.id === id));
    if (valid.length !== value.length) onChange(valid);
  }, [members, value, onChange]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const selectedNames = members.filter((m) => value.includes(m.id)).map((m) => m.name);
  const label =
    selectedNames.length === 0
      ? "Todos os atendentes"
      : selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames.length} atendentes`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 px-2.5 gap-1.5 text-xs justify-between min-w-[160px]", className)}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </div>
          {value.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">{value.length}</Badge>
          )}
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar atendente..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum atendente encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => onChange([])}
                className="cursor-pointer text-xs"
              >
                <Check className={cn("mr-2 h-4 w-4", value.length === 0 ? "opacity-100" : "opacity-0")} />
                Todos os atendentes
              </CommandItem>
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  onSelect={() => toggle(m.id)}
                  className="cursor-pointer text-xs"
                >
                  <Check className={cn("mr-2 h-4 w-4", value.includes(m.id) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{m.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
