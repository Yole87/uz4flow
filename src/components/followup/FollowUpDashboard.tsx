import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { CampaignCard } from "./CampaignCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PhoneForwarded, CalendarClock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface FollowUpDashboardProps {
  onEditCampaign?: (campaign: any) => void;
}

export function FollowUpDashboard({ onEditCampaign }: FollowUpDashboardProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["followup-campaigns", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("voice_campaigns")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === "cancelled") {
        updateData.whatsapp_followup_file_url = null;
      }
      const { error } = await supabase
        .from("voice_campaigns")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-campaigns"] });
      toast.success("Status da campanha atualizado");
    },
  });

  const cleanupCampaigns = useMutation({
    mutationFn: async () => {
      if (!organization?.id) return;
      const { error } = await supabase
        .from("voice_campaigns")
        .delete()
        .eq("organization_id", organization.id)
        .in("status", ["draft", "completed", "cancelled"]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-campaigns"] });
      toast.success("Campanhas antigas removidas");
    },
    onError: () => {
      toast.error("Erro ao limpar campanhas");
    },
  });

  const scheduled = campaigns.filter((c) => c.status === "scheduled");
  const completed = campaigns.filter((c) => c.status === "completed");
  const cancelled = campaigns.filter((c) => c.status === "cancelled");
  const cleanableCount = campaigns.filter((c) =>
    ["draft", "completed", "cancelled"].includes(c.status)
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{scheduled.length}</p>
              <p className="text-xs text-muted-foreground">Agendadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{completed.length}</p>
              <p className="text-xs text-muted-foreground">Executadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-foreground">{cancelled.length}</p>
              <p className="text-xs text-muted-foreground">Canceladas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cleanup button */}
      {cleanableCount > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Limpar campanhas antigas ({cleanableCount})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar campanhas antigas?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso removerá permanentemente {cleanableCount} campanha(s) com status
                rascunho, concluída ou cancelada, incluindo seus contatos associados.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => cleanupCampaigns.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Limpar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PhoneForwarded className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma campanha criada</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Crie sua primeira campanha na aba "Nova Campanha".
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onStart={(id) => updateStatus.mutate({ id, status: "running" })}
              onPause={(id) => updateStatus.mutate({ id, status: "paused" })}
              onResume={(id) => updateStatus.mutate({ id, status: "running" })}
              onCancel={(id) => updateStatus.mutate({ id, status: "cancelled" })}
              onEdit={onEditCampaign ? (id) => {
                const c = campaigns.find((x) => x.id === id);
                if (c) onEditCampaign(c);
              } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
