import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface OrganizationFilterProps {
  value: string | null;
  onChange: (next: string | null) => void;
}

interface OrgRow {
  id: string;
  name: string;
  owner_email: string | null;
}

/**
 * Combobox para o admin filtrar dashboards por tenant (organização).
 */
export function OrganizationFilter({ value, onChange }: OrganizationFilterProps) {
  const [open, setOpen] = useState(false);

  const { data: orgs = [] } = useQuery<OrgRow[]>({
    queryKey: ["admin-dashboard-orgs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name || "Sem nome",
        owner_email: null,
      }));
    },
    staleTime: 5 * 60_000,
  });

  const selected = orgs.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-8 px-2.5 gap-1.5 text-xs justify-between min-w-[200px] max-w-[260px]"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{selected ? selected.name : "Todos os clientes"}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <X
                className="h-3 w-3 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="cursor-pointer text-xs"
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Todos os clientes
              </CommandItem>
              {orgs.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer text-xs"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
