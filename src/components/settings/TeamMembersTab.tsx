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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Users, UserX, UserCheck, Smartphone, MessageSquareQuote, Settings2 } from "lucide-react";
import { buildAttendantSignature, SIGNATURE_FORMAT_LABELS, type SignatureFormat } from "@/lib/signatureFormat";

interface MemberForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  team_profile_id: string;
  instance_ids: string[];
  signature_format: SignatureFormat;
  silent_mode: boolean;
}

const emptyForm: MemberForm = {
  first_name: "", last_name: "", email: "", password: "",
  team_profile_id: "", instance_ids: [],
  signature_format: "name_role_dept", silent_mode: false,
};

export function TeamMembersTab() {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState<string | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [reactivationDate, setReactivationDate] = useState("");
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const orgId = organization?.id;

  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("team_members")
        .select("*, team_profiles:team_profile_id(name, title, department)")
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
      const { data } = await supabase.from("team_profiles").select("id, name, title, department").eq("organization_id", orgId).order("department", { nullsFirst: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch instances for multi-select
  const { data: instances } = useQuery({
    queryKey: ["team-instances", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("instances_safe" as any)
        .select("id, name, provider")
        .eq("organization_id", orgId)
        .order("name");
      return (data || []) as unknown as { id: string; name: string; provider: string }[];
    },
    enabled: !!orgId,
  });

  // Fetch member-instance mappings
  const { data: memberInstances } = useQuery({
    queryKey: ["team-member-instances", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("team_member_instances")
        .select("team_member_id, instance_id");
      return (data || []) as { team_member_id: string; instance_id: string }[];
    },
    enabled: !!orgId,
  });

  const getMemberInstanceIds = (memberId: string) =>
    (memberInstances || []).filter(mi => mi.team_member_id === memberId).map(mi => mi.instance_id);

  const getInstanceName = (instanceId: string) =>
    instances?.find(i => i.id === instanceId)?.name || "—";

  const saveMemberInstances = async (memberId: string, instanceIds: string[]) => {
    // Delete existing
    await supabase.from("team_member_instances").delete().eq("team_member_id", memberId);
    // Insert new
    if (instanceIds.length > 0) {
      const rows = instanceIds.map(iid => ({ team_member_id: memberId, instance_id: iid }));
      await supabase.from("team_member_instances").insert(rows);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (f: MemberForm) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const sanitizedEmail = f.email.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-team-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "create", ...f, email: sanitizedEmail }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao criar membro");
      // Save instance mappings
      if (result.member_id && f.instance_ids.length > 0) {
        await saveMemberInstances(result.member_id, f.instance_ids);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-member-instances"] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast.success("Membro criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar membro"),
  });

  const updateSignatureMutation = useMutation({
    mutationFn: async ({ id, signature_format, silent_mode }: { id: string; signature_format?: SignatureFormat; silent_mode?: boolean }) => {
      const payload: Record<string, unknown> = {};
      if (signature_format !== undefined) payload.signature_format = signature_format;
      if (silent_mode !== undefined) payload.silent_mode = silent_mode;
      const { error } = await supabase.from("team_members").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Assinatura atualizada");
    },
    onError: () => toast.error("Erro ao atualizar assinatura"),
  });

  const updateOrgSignatureToggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!orgId) return;
      const { error } = await supabase.from("organizations").update({ message_signature_enabled: enabled } as any).eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-organization"] });
      toast.success("Configuração da organização salva");
    },
    onError: () => toast.error("Erro ao atualizar configuração"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active, reason, date }: { id: string; is_active: boolean; reason?: string; date?: string }) => {
      const { error } = await supabase.from("team_members").update({
        is_active,
        deactivation_reason: is_active ? null : (reason || null),
        reactivation_date: is_active ? null : (date || null),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setDeactivateOpen(null);
      setDeactivateReason("");
      setReactivationDate("");
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-team-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "delete", member_id: memberId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao excluir");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-member-instances"] });
      toast.success("Membro excluído");
    },
    onError: () => toast.error("Erro ao excluir membro"),
  });

  // Edit instances for existing member
  const [editInstancesOpen, setEditInstancesOpen] = useState<string | null>(null);
  const [editInstanceIds, setEditInstanceIds] = useState<string[]>([]);

  const openEditInstances = (memberId: string) => {
    setEditInstanceIds(getMemberInstanceIds(memberId));
    setEditInstancesOpen(memberId);
  };

  const saveEditInstances = async () => {
    if (!editInstancesOpen) return;
    await saveMemberInstances(editInstancesOpen, editInstanceIds);
    queryClient.invalidateQueries({ queryKey: ["team-member-instances"] });
    setEditInstancesOpen(null);
    toast.success("Instâncias atualizadas");
  };

  const toggleInstanceId = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const [signatureMember, setSignatureMember] = useState<any | null>(null);

  return (
    <>
      {/* Card: assinatura global da organização */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <MessageSquareQuote className="h-4 w-4 text-accent" />
            Assinatura nas mensagens
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Quando ativa, mensagens enviadas via CRM vão prefixadas com a identidade do atendente (Nome — Cargo · Departamento).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Habilitar assinatura na organização</span>
            <Switch
              checked={(organization as any)?.message_signature_enabled !== false}
              onCheckedChange={(v) => updateOrgSignatureToggle.mutate(v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-accent" />
              Membros da Equipe
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Adicione e gerencie os atendentes da sua organização
            </CardDescription>
          </div>
          <Button onClick={() => { setForm(emptyForm); setCreateOpen(true); }} size="sm" className="gradient-primary text-white hover:opacity-90 w-full sm:w-auto" disabled={!profiles || profiles.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Novo Membro
          </Button>
        </CardHeader>
        <CardContent>
          {!profiles || profiles.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Crie um perfil de equipe primeiro na aba acima</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : members && members.length > 0 ? (
            <div className="space-y-3">
              {members.map((m: any) => {
                const profile = m.team_profiles as any;
                const dept = profile?.department || profile?.name || "—";
                const role = profile?.title;
                const mInstanceIds = getMemberInstanceIds(m.id);
                const previewSignature = buildAttendantSignature({
                  firstName: m.first_name,
                  lastName: m.last_name,
                  role,
                  department: dept,
                  format: m.signature_format || "name_role_dept",
                  silentMode: m.silent_mode,
                  organizationEnabled: (organization as any)?.message_signature_enabled !== false,
                });
                return (
                  <div key={m.id} className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1 sm:gap-2">
                        <span className="font-medium text-foreground">{m.first_name} {m.last_name}</span>
                        <Badge variant={m.is_active ? "default" : "secondary"} className={m.is_active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground"}>
                          {m.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        {m.silent_mode && (
                          <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">Modo silencioso</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-accent">{dept}</span>
                        {role && <span className="text-xs text-muted-foreground">· {role}</span>}
                      </div>
                      {previewSignature && (
                        <p className="text-xs text-muted-foreground/80 mt-1 italic truncate">
                          Cliente verá: <span className="text-foreground/70">{previewSignature}</span>
                        </p>
                      )}
                      {/* Instance badges */}
                      {mInstanceIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {mInstanceIds.map(iid => (
                            <Badge key={iid} variant="outline" className="text-xs px-1.5 py-0 border-primary/30 text-primary">
                              <Smartphone className="h-2.5 w-2.5 mr-0.5" />
                              {getInstanceName(iid)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Todas as instâncias</p>
                      )}
                      {!m.is_active && m.deactivation_reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">Motivo: {m.deactivation_reason}</p>
                      )}
                      {!m.is_active && m.reactivation_date && (
                        <p className="text-xs text-accent mt-0.5">Reativação: {new Date(m.reactivation_date).toLocaleDateString("pt-BR")}</p>
                      )}
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => setSignatureMember(m)} className="h-8 w-8 text-muted-foreground hover:text-accent" title="Configurar assinatura">
                      <MessageSquareQuote className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="icon" onClick={() => openEditInstances(m.id)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Editar instâncias">
                      <Smartphone className="h-4 w-4" />
                    </Button>

                    {m.is_active ? (
                      <Button variant="ghost" size="icon" onClick={() => setDeactivateOpen(m.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Desativar">
                        <UserX className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => toggleActiveMutation.mutate({ id: m.id, is_active: true })} className="h-8 w-8 text-muted-foreground hover:text-emerald-400" title="Reativar">
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum membro adicionado</p>
              <p className="text-xs mt-1">Adicione atendentes para distribuir o atendimento</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature config dialog */}
      <Dialog open={!!signatureMember} onOpenChange={(v) => { if (!v) setSignatureMember(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5 text-accent" />
              Assinatura de {signatureMember?.first_name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Como a identidade deste atendente aparecerá no chat do cliente.
            </DialogDescription>
          </DialogHeader>
          {signatureMember && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Formato</Label>
                <Select
                  value={signatureMember.signature_format || "name_role_dept"}
                  onValueChange={(v: SignatureFormat) => {
                    setSignatureMember({ ...signatureMember, signature_format: v });
                    updateSignatureMutation.mutate({ id: signatureMember.id, signature_format: v });
                  }}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    {(Object.keys(SIGNATURE_FORMAT_LABELS) as SignatureFormat[]).map(k => (
                      <SelectItem key={k} value={k}>{SIGNATURE_FORMAT_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border">
                <div>
                  <span className="text-sm text-foreground">Modo silencioso</span>
                  <p className="text-xs text-muted-foreground">Não anexa assinatura nem notifica este membro.</p>
                </div>
                <Switch
                  checked={!!signatureMember.silent_mode}
                  onCheckedChange={(v) => {
                    setSignatureMember({ ...signatureMember, silent_mode: v });
                    updateSignatureMutation.mutate({ id: signatureMember.id, silent_mode: v });
                  }}
                />
              </div>

              <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Pré-visualização (cliente verá):</p>
                <p className="text-sm font-mono text-foreground">
                  {buildAttendantSignature({
                    firstName: signatureMember.first_name,
                    lastName: signatureMember.last_name,
                    role: (signatureMember.team_profiles as any)?.title,
                    department: (signatureMember.team_profiles as any)?.department || (signatureMember.team_profiles as any)?.name,
                    format: signatureMember.signature_format || "name_role_dept",
                    silentMode: signatureMember.silent_mode,
                    organizationEnabled: (organization as any)?.message_signature_enabled !== false,
                  }) || <span className="text-muted-foreground italic">— sem assinatura —</span>}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureMember(null)} className="border-border text-muted-foreground">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Member Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Membro</DialogTitle>
            <DialogDescription className="text-muted-foreground">Crie um novo atendente para a equipe</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Nome</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="João" className="bg-muted border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Sobrenome</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Silva" className="bg-muted border-border text-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao@empresa.com" className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Senha</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Perfil</Label>
              <Select value={form.team_profile_id} onValueChange={(v) => setForm({ ...form, team_profile_id: v })}>
                <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue placeholder="Selecione o perfil" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {profiles?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.title ? `(${p.title})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Instance multi-select */}
            {instances && instances.length > 0 && (
              <div className="space-y-2">
                <Label className="text-foreground">Instâncias</Label>
                <p className="text-xs text-muted-foreground">Selecione em quais instâncias este membro irá atuar. Deixe vazio para todas.</p>
                <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-muted/50 rounded-md border border-border">
                  {instances.map(inst => (
                    <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.instance_ids.includes(inst.id)}
                        onCheckedChange={() => toggleInstanceId(inst.id, form.instance_ids, (v) => setForm({ ...form, instance_ids: v }))}
                      />
                      <span className="text-sm text-foreground">{inst.name}</span>
                      {inst.provider === "meta_official" && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-400">Meta</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-border text-muted-foreground w-full sm:w-auto">Cancelar</Button>
            <Button onClick={() => {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(form.email.trim())) {
                toast.error("E-mail inválido. Verifique o formato (ex: usuario@dominio.com)");
                return;
              }
              if (form.password.length < 6) {
                toast.error("A senha deve ter no mínimo 6 caracteres");
                return;
              }
              createMutation.mutate(form);
            }} disabled={!form.first_name || !form.email || !form.password || !form.team_profile_id || createMutation.isPending} className="bg-accent hover:bg-accent/90 w-full sm:w-auto">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Membro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Instances Dialog */}
      <Dialog open={!!editInstancesOpen} onOpenChange={(v) => { if (!v) setEditInstancesOpen(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Instâncias do Membro</DialogTitle>
            <DialogDescription className="text-muted-foreground">Selecione em quais instâncias este membro irá atuar. Vazio = todas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-muted/50 rounded-md border border-border">
            {instances?.map(inst => (
              <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={editInstanceIds.includes(inst.id)}
                  onCheckedChange={() => toggleInstanceId(inst.id, editInstanceIds, setEditInstanceIds)}
                />
                <span className="text-sm text-foreground">{inst.name}</span>
                {inst.provider === "meta_official" && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-400">Meta</Badge>
                )}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInstancesOpen(null)} className="border-border text-muted-foreground">Cancelar</Button>
            <Button onClick={saveEditInstances} className="gradient-primary text-white hover:opacity-90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={!!deactivateOpen} onOpenChange={(v) => { if (!v) setDeactivateOpen(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Desativar Membro</DialogTitle>
            <DialogDescription className="text-muted-foreground">Informe o motivo e data de reativação (opcional)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Motivo</Label>
              <Input value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} placeholder="Ex: Férias, Licença, etc." className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Data de Reativação (opcional)</Label>
              <Input type="date" value={reactivationDate} onChange={(e) => setReactivationDate(e.target.value)} className="bg-muted border-border text-foreground" />
              <p className="text-xs text-muted-foreground">Deixe vazio para tempo indeterminado</p>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setDeactivateOpen(null)} className="border-border text-muted-foreground w-full sm:w-auto">Cancelar</Button>
            <Button variant="destructive" onClick={() => deactivateOpen && toggleActiveMutation.mutate({ id: deactivateOpen, is_active: false, reason: deactivateReason, date: reactivationDate || undefined })} disabled={toggleActiveMutation.isPending} className="w-full sm:w-auto">
              {toggleActiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
