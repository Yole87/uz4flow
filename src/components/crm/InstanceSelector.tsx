import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Wifi, WifiOff, QrCode, Loader2, MoreVertical, Trash2, Zap } from "lucide-react";
import { ChannelIcon } from "@/components/icons/ChannelIcon";

import { DeleteInstanceDialog } from "./DeleteInstanceDialog";
import { toast } from "sonner";

interface Instance {
  id: string;
  name: string;
  status: string;
  phone_number: string | null;
  openbot_instance_id: string | null;
  has_openbot_api_key: boolean;
  provider: string | null;
  channel: string | null;
}

interface InstanceSelectorProps {
  selectedInstanceId: string | null;
  onInstanceChange: (instanceId: string | null) => void;
}

export function InstanceSelector({ selectedInstanceId, onInstanceChange }: InstanceSelectorProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [testingInstanceId, setTestingInstanceId] = useState<string | null>(null);
  const { data: organization } = useUserOrganization();
  const orgId = organization?.id;

  const { data: instances, isLoading } = useQuery({
    queryKey: ["crm-instances", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name, status, phone_number, openbot_instance_id, has_openbot_api_key, provider, channel")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Instance[];
    },
    enabled: !!orgId,
  });

  // Fetch unread counts per instance
  const { data: unreadCounts } = useQuery({
    queryKey: ["crm-unread-counts", orgId],
    queryFn: async () => {
      if (!orgId) return {};
      // Get instance IDs for this org first
      const instanceIds = instances?.map(i => i.id) || [];
      if (instanceIds.length === 0) return {};
      const { data, error } = await supabase
        .from("conversations")
        .select("instance_id, unread_count")
        .in("instance_id", instanceIds);
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      let total = 0;
      for (const conv of (data || [])) {
        const uc = conv.unread_count || 0;
        if (uc > 0) {
          total += uc;
          if (conv.instance_id) {
            counts[conv.instance_id] = (counts[conv.instance_id] || 0) + uc;
          }
        }
      }
      counts["__total__"] = total;
      return counts;
    },
    enabled: !!orgId && !!instances,
    staleTime: 5000,
    refetchInterval: 15000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="h-3 w-3 text-emerald-500" />;
      case "connecting":
        return <Loader2 className="h-3 w-3 text-yellow-500 animate-spin" />;
      case "qr_code":
        return <QrCode className="h-3 w-3 text-blue-500" />;
      default:
        return <WifiOff className="h-3 w-3 text-zinc-500" />;
    }
  };

  // Determine if instance is "pending":
  // - Instagram instances rely on Meta OAuth, not OpenBot → never pending here
  // - meta_official with credentials configured is NOT pending
  // - everything else needs openbot_instance_id
  const isPending = (instance: Instance) => {
    if (instance.channel === "instagram") return false;
    if (instance.provider === "meta_official" && instance.has_openbot_api_key) return false;
    return !instance.openbot_instance_id;
  };


  const handleDelete = (instance: Instance, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInstance(instance);
    setDeleteDialogOpen(true);
  };

  const handleTestConnection = async (instance: Instance, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!instance.has_openbot_api_key) {
      toast.error("Esta instância não possui API Key configurada");
      return;
    }

    setTestingInstanceId(instance.id);

    try {
      const response = await supabase.functions.invoke("crm-test-openbot", {
        body: { 
          send_url: "https://api.digitalbotia.com.br/sendWebhook"
        },
      });

      if (response.error) {
        toast.error("Erro no teste: " + response.error.message);
      } else if (response.data?.success) {
        toast.success(response.data.message || "Conexão estabelecida com sucesso!");
      } else {
        toast.error(response.data?.error || "Falha na conexão");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao testar: " + errorMessage);
    } finally {
      setTestingInstanceId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        <span className="text-sm text-muted-foreground hidden sm:inline">Carregando...</span>
      </div>
    );
  }

  if (!instances || instances.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border border-dashed border-border">
        <Smartphone className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground hidden sm:inline">Nenhuma instância</span>
      </div>
    );
  }

  const currentInstance = instances.find(i => i.id === selectedInstanceId);
  const totalUnread = unreadCounts?.["__total__"] || 0;

  return (
    <>
      <div className="flex items-center gap-1">
        <Select value={selectedInstanceId || "all"} onValueChange={(v) => onInstanceChange(v === "all" ? null : v)}>
          <SelectTrigger className="w-full min-w-0 bg-muted border-border text-foreground focus:ring-emerald-500/50">
            <SelectValue placeholder="Todas as instâncias">
              {selectedInstanceId ? (
                <div className="flex items-center gap-2 min-w-0">
                  <ChannelIcon channel={currentInstance?.channel} size={18} />
                  <span className="truncate text-sm min-w-0 flex-1">{currentInstance?.name}</span>
                  {unreadCounts && unreadCounts[selectedInstanceId] > 0 && (
                    <Badge className="bg-accent text-accent-foreground h-4 min-w-[16px] text-xs px-1">
                      {unreadCounts[selectedInstanceId]}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Todas</span>
                  {totalUnread > 0 && (
                    <Badge className="bg-accent text-accent-foreground h-4 min-w-[16px] text-xs px-1">
                      {totalUnread}
                    </Badge>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-muted border-border z-[200]">
            <SelectItem value="all" className="text-foreground focus:bg-accent/20 focus:text-foreground">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span>Todas as instâncias</span>
                {totalUnread > 0 && (
                  <Badge className="bg-accent text-accent-foreground h-4 min-w-[16px] text-xs px-1 ml-auto">
                    {totalUnread}
                  </Badge>
                )}
              </div>
            </SelectItem>
            {instances.map((instance) => {
              const instanceUnread = unreadCounts?.[instance.id] || 0;
              return (
                <SelectItem 
                  key={instance.id} 
                  value={instance.id}
                  className="text-foreground focus:bg-accent/20 focus:text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <ChannelIcon channel={instance.channel} size={18} />
                    <span className="truncate">{instance.name}</span>
                    <span className="opacity-60">{getStatusIcon(instance.status)}</span>
                    {isPending(instance) && (
                      <span className="text-xs text-yellow-500 bg-yellow-500/10 px-1 rounded">
                        Pendente
                      </span>
                    )}
                    {instance.provider === "meta_official" && (
                      <span className="text-xs text-blue-400 bg-blue-500/10 px-1 rounded">
                        Meta
                      </span>
                    )}
                    {instanceUnread > 0 && (
                      <Badge className="bg-accent text-accent-foreground h-4 min-w-[16px] text-xs px-1 ml-auto">
                        {instanceUnread}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Actions menu for selected instance */}
        {selectedInstanceId && currentInstance && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-muted border-border">
              <DropdownMenuItem 
                onClick={(e) => handleTestConnection(currentInstance, e)}
                disabled={testingInstanceId === currentInstance.id}
                className="text-foreground focus:bg-accent focus:text-foreground cursor-pointer"
              >
                {testingInstanceId === currentInstance.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem 
                onClick={(e) => handleDelete(currentInstance, e)}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <DeleteInstanceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        instance={selectedInstance}
      />
    </>
  );
}
