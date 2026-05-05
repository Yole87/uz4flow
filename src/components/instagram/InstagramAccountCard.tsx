import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Unplug, Loader2, Smartphone, Trash2, MessageSquarePlus } from "lucide-react";
import type { InstagramAccount } from "@/hooks/useInstagramAccounts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  account: InstagramAccount;
  onRefresh: (id: string) => void;
  onDisconnect: (id: string) => void;
  isRefreshing?: boolean;
  isDisconnecting?: boolean;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "border-emerald-500/50 text-emerald-400" },
  expired: { label: "Expirado", className: "border-yellow-500/50 text-yellow-400" },
  revoked: { label: "Revogado", className: "border-destructive/50 text-destructive" },
};

export function InstagramAccountCard({ account, onRefresh, onDisconnect, isRefreshing, isDisconnecting }: Props) {
  const status = statusConfig[account.token_status] ?? statusConfig.active;
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);

  // Fetch instances for this org
  const { data: instances } = useQuery({
    queryKey: ["ig-card-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from("instances_safe" as any)
        .select("id, name, provider")
        .eq("organization_id", organization.id)
        .order("name");
      return (data || []) as unknown as { id: string; name: string; provider: string }[];
    },
    enabled: !!organization?.id,
  });

  // Fetch current mappings for this account
  const { data: accountInstances } = useQuery({
    queryKey: ["ig-account-instances", account.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_account_instances")
        .select("instance_id")
        .eq("account_id", account.id);
      return (data || []).map(d => d.instance_id);
    },
  });

  const openEditDialog = () => {
    setSelectedInstanceIds(accountInstances || []);
    setEditOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (instanceIds: string[]) => {
      await supabase.from("instagram_account_instances").delete().eq("account_id", account.id);
      if (instanceIds.length > 0) {
        const rows = instanceIds.map(iid => ({ account_id: account.id, instance_id: iid }));
        const { error } = await supabase.from("instagram_account_instances").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ig-account-instances"] });
      setEditOpen(false);
      toast.success("Instâncias atualizadas!");
    },
    onError: () => toast.error("Erro ao salvar instâncias"),
  });

  const enableInCrm = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("Sem organização");
      const { data: existing } = await supabase
        .from("instances")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("instagram_account_id", account.id)
        .eq("channel", "instagram")
        .maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await (supabase.from("instances") as any).insert({
        organization_id: organization.id,
        instagram_account_id: account.id,
        channel: "instagram",
        provider: "instagram_dm",
        name: account.username ? `@${account.username}` : `Instagram ${account.id.slice(0, 8)}`,
        status: "connected",
      }).select("id").single();
      if (error) throw error;
      return created.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-instances"] });
      queryClient.invalidateQueries({ queryKey: ["ig-card-instances"] });
      toast.success("Conta Instagram habilitada no CRM!", {
        description: "Acesse o CRM para começar a conversar.",
      });
    },
    onError: (e: any) => {
      console.error("[enableInCrm] erro:", e);
      const msg = e?.message || e?.error_description || e?.details || "Tente novamente em alguns instantes.";
      toast.error("Erro ao habilitar no CRM", { description: msg });
    },
  });

  const toggleInstance = (id: string) => {
    setSelectedInstanceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const linkedCount = accountInstances?.length || 0;

  return (
    <>
      <div className="quantum-glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {account.profile_picture_url ? (
            <img src={account.profile_picture_url} alt="" className="h-10 w-10 rounded-full border border-border/50" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted/30 border border-border/50 flex items-center justify-center text-muted-foreground text-sm font-bold">
              {(account.username ?? "?")[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">@{account.username ?? account.ig_user_id}</span>
              <Badge variant="outline" className={status.className + " text-xs"}>
                {status.label}
              </Badge>
            </div>
            {account.token_expires_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Token expira em {format(new Date(account.token_expires_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <Smartphone className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {linkedCount > 0 ? `${linkedCount} instância(s)` : "Todas as instâncias"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => enableInCrm.mutate()} disabled={enableInCrm.isPending} className="border-pink-500/40 text-pink-400 hover:bg-pink-500/10">
            {enableInCrm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />}
            Habilitar no CRM
          </Button>
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Smartphone className="h-3.5 w-3.5 mr-1.5" />
            Instâncias
          </Button>
          <Button variant="outline" size="sm" onClick={() => onRefresh(account.id)} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Renovar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(true)} disabled={isDisconnecting} className="text-destructive hover:text-destructive">
            {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
            Excluir
          </Button>
        </div>
      </div>

      {/* Edit Instances Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Instâncias da Conta</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Selecione quais instâncias WhatsApp esta conta Instagram pode usar para disparos. Vazio = todas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-muted/50 rounded-md border border-border">
            {instances?.map(inst => (
              <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedInstanceIds.includes(inst.id)}
                  onCheckedChange={() => toggleInstance(inst.id)}
                />
                <span className="text-sm text-foreground">{inst.name}</span>
                {inst.provider === "meta_official" && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-400">Meta</Badge>
                )}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-border text-muted-foreground">Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(selectedInstanceIds)} disabled={saveMutation.isPending} className="gradient-primary text-white hover:opacity-90">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir conta @{account.username ?? account.ig_user_id}?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              O token será revogado na Meta e a conta será removida permanentemente do sistema, incluindo vínculos com instâncias. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDisconnect(account.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
