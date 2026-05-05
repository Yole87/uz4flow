import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X, Smartphone, Users } from "lucide-react";

export interface ContactFilters {
  stageId: string | null;
  unreadOnly: boolean;
  blockedOnly: boolean;
  instanceId: string | null;
  assignedMemberIds: string[];
  unassignedOnly: boolean;
}

interface ContactsFilterPopoverProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
  showInstanceFilter?: boolean;
}

export function ContactsFilterPopover({
  filters,
  onFiltersChange,
  showInstanceFilter = false,
}: ContactsFilterPopoverProps) {
  const { data: organization } = useUserOrganization();
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<ContactFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Fetch all pipelines and their stages
  const { data: pipelineGroups } = useQuery({
    queryKey: ["all-pipeline-stages-filter", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("organization_id", organization.id)
        .order("created_at");
      
      if (!pipelines || pipelines.length === 0) return [];
      
      const groups = [];
      for (const pipeline of pipelines) {
        const { data: stages } = await supabase
          .from("stages")
          .select("id, name, color")
          .eq("pipeline_id", pipeline.id)
          .order("order_index");
        
        if (stages && stages.length > 0) {
          groups.push({ pipeline, stages });
        }
      }
      return groups;
    },
    enabled: !!organization?.id,
  });

  // Fetch instances for instance filter
  const { data: instances } = useQuery({
    queryKey: ["crm-instances-filter", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name, status, phone_number")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as { id: string; name: string; status: string; phone_number: string | null }[];
    },
    enabled: showInstanceFilter && !!organization?.id,
  });

  // Fetch team members of the org
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members-filter", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("organization_id", organization.id)
        .order("first_name");
      if (error) throw error;
      return (data || []) as Array<{ id: string; first_name: string | null; last_name: string | null }>;
    },
    enabled: !!organization?.id,
  });

  const activeFilterCount = [
    filters.stageId,
    filters.unreadOnly,
    filters.blockedOnly,
    filters.instanceId,
    filters.unassignedOnly,
    filters.assignedMemberIds.length > 0 ? "members" : null,
  ].filter(Boolean).length;

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleClear = () => {
    const clearedFilters: ContactFilters = {
      stageId: null,
      unreadOnly: false,
      blockedOnly: false,
      instanceId: null,
      assignedMemberIds: [],
      unassignedOnly: false,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    setOpen(false);
  };

  const toggleMember = (memberId: string) => {
    setLocalFilters((prev) => {
      const has = prev.assignedMemberIds.includes(memberId);
      return {
        ...prev,
        assignedMemberIds: has
          ? prev.assignedMemberIds.filter((id) => id !== memberId)
          : [...prev.assignedMemberIds, memberId],
        unassignedOnly: false, // mutually exclusive when picking specific members
      };
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative overflow-visible h-9 w-9 sm:h-8 sm:w-8 ${
            activeFilterCount > 0 
              ? "text-accent bg-accent/20" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span 
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground text-xs font-medium flex items-center justify-center z-10 leading-none"
            >
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 bg-card border-border p-4 max-h-[80vh] overflow-y-auto quantum-scrollbar" 
        align="start"
        sideOffset={8}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-foreground">Filtros</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Instance filter - only shown when "Todas as instâncias" is selected */}
          {showInstanceFilter && instances && instances.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Smartphone className="h-3 w-3" />
                Instância
              </Label>
              <Select
                value={localFilters.instanceId || "all"}
                onValueChange={(value) => 
                  setLocalFilters(prev => ({ 
                    ...prev, 
                    instanceId: value === "all" ? null : value 
                  }))
                }
              >
                <SelectTrigger className="h-9 bg-muted border-border text-sm">
                  <SelectValue placeholder="Todas as instâncias" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Todas as instâncias</SelectItem>
                  {instances.map((inst) => (
                    <SelectItem 
                      key={inst.id} 
                      value={inst.id}
                      className="cursor-pointer hover:bg-accent/20"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          inst.status === "connected" ? "bg-success" : "bg-muted-foreground"
                        }`} />
                        <span>{inst.name}</span>
                        {inst.phone_number && (
                          <span className="text-muted-foreground text-xs">
                            +{inst.phone_number.substring(0, 4)}...
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Attendants filter (multi) */}
          {teamMembers && teamMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Atendentes
              </Label>
              <div className="rounded-md border border-border bg-muted/40 max-h-44 overflow-y-auto quantum-scrollbar divide-y divide-border/60">
                <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/10">
                  <Checkbox
                    checked={localFilters.unassignedOnly}
                    onCheckedChange={(checked) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        unassignedOnly: checked === true,
                        assignedMemberIds: checked === true ? [] : prev.assignedMemberIds,
                      }))
                    }
                  />
                  <span className="text-sm text-foreground">Sem atendente</span>
                </label>
                {teamMembers.map((m) => {
                  const fullName = `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Sem nome";
                  const checked = localFilters.assignedMemberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/10 ${
                        localFilters.unassignedOnly ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={localFilters.unassignedOnly}
                        onCheckedChange={() => toggleMember(m.id)}
                      />
                      <span className="text-sm text-foreground truncate">{fullName}</span>
                    </label>
                  );
                })}
              </div>
              {localFilters.assignedMemberIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {localFilters.assignedMemberIds.length} atendente(s) selecionado(s)
                </p>
              )}
            </div>
          )}
          
          {/* Stage filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Etapa do Pipeline</Label>
            <Select
              value={localFilters.stageId || "all"}
              onValueChange={(value) => 
                setLocalFilters(prev => ({ 
                  ...prev, 
                  stageId: value === "all" ? null : value 
                }))
              }
            >
              <SelectTrigger className="h-9 bg-muted border-border text-sm">
                <SelectValue placeholder="Todas as etapas" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todas as etapas</SelectItem>
                <SelectItem value="unassigned">Não atribuído</SelectItem>
                {pipelineGroups?.map((group) => (
                  <div key={group.pipeline.id}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.pipeline.name}
                    </div>
                    {group.stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stage.color || "#71717a" }}
                          />
                          <span>{stage.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Unread filter */}
          <div className="flex items-center justify-between">
            <Label htmlFor="unread-filter" className="text-sm text-foreground">
              Apenas não lidos
            </Label>
            <Switch
              id="unread-filter"
              checked={localFilters.unreadOnly}
              onCheckedChange={(checked) => 
                setLocalFilters(prev => ({ ...prev, unreadOnly: checked }))
              }
            />
          </div>
          
          {/* Blocked filter */}
          <div className="flex items-center justify-between">
            <Label htmlFor="blocked-filter" className="text-sm text-foreground">
              Apenas bloqueados
            </Label>
            <Switch
              id="blocked-filter"
              checked={localFilters.blockedOnly}
              onCheckedChange={(checked) => 
                setLocalFilters(prev => ({ ...prev, blockedOnly: checked }))
              }
            />
          </div>
          
          {/* Apply button */}
          <Button 
            className="w-full gradient-primary text-white hover:opacity-90" 
            size="sm"
            onClick={handleApply}
          >
            Aplicar Filtros
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
