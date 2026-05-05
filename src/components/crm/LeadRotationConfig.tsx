import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, RefreshCw } from "lucide-react";

interface RotationForm {
  id?: string;
  team_profile_id: string;
  is_enabled: boolean;
  is_random: boolean;
  keyword_filter: string;
  target_pipeline_id: string;
}

const emptyForm: RotationForm = { team_profile_id: "", is_enabled: true, is_random: false, keyword_filter: "", target_pipeline_id: "" };

export function LeadRotationConfig() {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RotationForm>(emptyForm);
  const orgId = organization?.id;

  const { data: configs, isLoading } = useQuery({
    queryKey: ["lead-rotation", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("lead_rotation_config")
        .select("*, team_profiles:team_profile_id(name, title), pipelines:target_pipeline_id(name)")
        .eq("organization_id", orgId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["team-profiles", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("team_profiles").select("id, name, title").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: pipelines } = useQuery({
    queryKey: ["pipelines", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("pipelines").select("id, name").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (f: RotationForm) => {
      if (!orgId) throw new Error("Sem organização");
      const payload = {
        organization_id: orgId,
        team_profile_id: f.team_profile_id,
        is_enabled: f.is_enabled,
        is_random: f.is_random,
        keyword_filter: f.keyword_filter || null,
        target_pipeline_id: f.target_pipeline_id || null,
      };
      if (f.id) {
        const { error } = await supabase.from("lead_rotation_config").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lead_rotation_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-rotation"] });
      setDialogOpen(false);
      toast.success("Rotação salva!");
    },
    onError: () => toast.error("Erro ao salvar rotação"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_rotation_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-rotation"] });
      toast.success("Rotação excluída");
    },
    onError: () => toast.error("Erro ao excluir rotação"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase.from("lead_rotation_config").update({ is_enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-rotation"] }),
  });

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <RefreshCw className="h-5 w-5 text-accent" />
              Rotação de Leads
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Distribua novos leads automaticamente entre os atendentes (round-robin)
            </CardDescription>
          </div>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} size="sm" className="gradient-primary text-white hover:opacity-90" disabled={!profiles || profiles.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Nova Rotação
          </Button>
        </CardHeader>
        <CardContent>
          {!profiles || profiles.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Crie perfis de equipe primeiro em Configurações → Equipe</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : configs && configs.length > 0 ? (
            <div className="space-y-3">
              {configs.map((c: any) => (
                <div key={c.id} className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
                  <Switch checked={c.is_enabled} onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, is_enabled: v })} />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setForm({ id: c.id, team_profile_id: c.team_profile_id, is_enabled: c.is_enabled, is_random: (c as any).is_random ?? false, keyword_filter: c.keyword_filter || "", target_pipeline_id: c.target_pipeline_id || "" }); setDialogOpen(true); }}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{(c as any).team_profiles?.name || "—"}</span>
                      {c.keyword_filter && <span className="text-xs text-muted-foreground">· Filtro: "{c.keyword_filter}"</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(c as any).pipelines?.name ? `Funil: ${(c as any).pipelines.name}` : "Todos os funis"}
                      {(c as any).is_random ? " · Aleatório" : " · Sequencial"}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma rotação configurada</p>
              <p className="text-xs mt-1">Configure para distribuir leads entre atendentes automaticamente</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border-border max-h-[90vh] !overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">{form.id ? "Editar Rotação" : "Nova Rotação"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">Configure a rotação round-robin de leads</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Perfil de Equipe</Label>
              <Select value={form.team_profile_id} onValueChange={(v) => setForm({ ...form, team_profile_id: v })}>
                <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue placeholder="Selecione o perfil" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {profiles?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.title ? `(${p.title})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Leads serão distribuídos entre os membros ativos deste perfil</p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Palavra-chave de Filtro (opcional)</Label>
              <Input value={form.keyword_filter} onChange={(e) => setForm({ ...form, keyword_filter: e.target.value })} placeholder='Ex: "Morumbi", "Alphaville"' className="bg-muted border-border text-foreground" />
              <p className="text-xs text-muted-foreground">Se preenchido, a rotação só se aplica quando a mensagem contém essa palavra</p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Funil Associado (opcional)</Label>
              <Select value={form.target_pipeline_id || "all"} onValueChange={(v) => setForm({ ...form, target_pipeline_id: v === "all" ? "" : v })}>
                <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="all">Todos os funis</SelectItem>
                  {pipelines?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} />
              <Label className="text-foreground">Ativa</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_random} onCheckedChange={(v) => setForm({ ...form, is_random: v })} />
              <Label className="text-foreground">Distribuição Aleatória</Label>
            </div>

            {/* Example */}
            <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
              <p className="text-xs text-accent font-medium mb-1">💡 Como funciona</p>
              <p className="text-xs text-muted-foreground">
                Novo lead chega → Sistema verifica os membros ativos do perfil → Atribui ao próximo da fila (João → Maria → José → João...).
                Se um membro estiver inativo (férias), ele é pulado automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border text-muted-foreground">Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.team_profile_id || saveMutation.isPending} className="gradient-primary text-white hover:opacity-90">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
