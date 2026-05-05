import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, Edit2, ShieldCheck, Building2, Briefcase, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  PERMISSION_TREE,
  makeEmptyPermissions,
  makeFullPermissions,
  mergeWithTree,
  type PermissionsObject,
  type MenuDef,
} from "@/lib/permissionsCatalog";

interface ProfileForm {
  id?: string;
  name: string;
  department: string;
  title: string;
  description: string;
  permissions: PermissionsObject;
}

const emptyForm = (): ProfileForm => ({
  name: "",
  department: "",
  title: "",
  description: "",
  permissions: makeEmptyPermissions(),
});

export function TeamProfilesTab() {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm>(emptyForm());
  const orgId = organization?.id;

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["team-profiles", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("team_profiles")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: instances } = useQuery({
    queryKey: ["org-instances-list", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("instances")
        .select("id, name, channel")
        .eq("organization_id", orgId)
        .order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (profile: ProfileForm) => {
      if (!orgId) throw new Error("Sem organização");
      const payload: Record<string, unknown> = {
        organization_id: orgId,
        name: profile.name || profile.department,
        department: profile.department,
        title: profile.title,
        description: profile.description,
        permissions: profile.permissions,
      };
      if (profile.id) {
        const { error } = await supabase.from("team_profiles").update(payload).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_profiles").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-profiles"] });
      setDialogOpen(false);
      toast.success("Perfil salvo!");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar perfil"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-profiles"] });
      toast.success("Perfil excluído");
    },
    onError: () => toast.error("Erro ao excluir perfil"),
  });

  const openCreate = () => { setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      name: p.name,
      department: p.department || p.name || "",
      title: p.title || "",
      description: p.description || "",
      permissions: mergeWithTree(p.permissions),
    });
    setDialogOpen(true);
  };

  const setMenuField = (menuKey: string, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [menuKey]: { ...(prev.permissions[menuKey] || {}), [field]: value },
      },
    }));
  };

  const setChildAction = (menuKey: string, childKey: string, actionKey: string, value: boolean) => {
    setForm((prev) => {
      const child = { ...(prev.permissions[menuKey]?.[childKey] || {}), [actionKey]: value };
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [menuKey]: { ...(prev.permissions[menuKey] || {}), [childKey]: child },
        },
      };
    });
  };

  const setAllForMenu = (menu: MenuDef, value: boolean) => {
    setForm((prev) => {
      const node: any = { ...(prev.permissions[menu.key] || {}) };
      for (const a of menu.actions) node[a.key] = value;
      if (menu.children) {
        for (const c of menu.children) {
          const sub: any = { ...(node[c.key] || {}) };
          for (const a of c.actions) sub[a.key] = value;
          node[c.key] = sub;
        }
      }
      if (menu.instancesScope && !value) node.instances_scope = [];
      return { ...prev, permissions: { ...prev.permissions, [menu.key]: node } };
    });
  };

  const toggleInstanceScope = (instanceId: string) => {
    setForm((prev) => {
      const current: string[] = prev.permissions.crm?.instances_scope || [];
      const next = current.includes(instanceId)
        ? current.filter((i) => i !== instanceId)
        : [...current, instanceId];
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          crm: { ...(prev.permissions.crm || {}), instances_scope: next },
        },
      };
    });
  };

  const applyPreset = (preset: "full" | "empty") => {
    setForm((prev) => ({
      ...prev,
      permissions: preset === "full" ? makeFullPermissions() : makeEmptyPermissions(),
    }));
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-5 w-5 text-accent" />
              Perfis de Equipe
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Crie perfis com Departamento, Cargo e permissões granulares por menu
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm" className="gradient-primary text-white hover:opacity-90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" /> Novo Perfil
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : profiles && profiles.length > 0 ? (
            <div className="space-y-3">
              {profiles.map((p: any) => {
                const dept = p.department || p.name;
                const merged = mergeWithTree(p.permissions);
                const enabledMenus = PERMISSION_TREE.filter((m) => merged[m.key]?.view).map((m) => m.label);
                return (
                  <div key={p.id} className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="font-medium text-foreground">{dept}</span>
                        {p.title && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <Briefcase className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{p.title}</span>
                          </>
                        )}
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {enabledMenus.length > 0 ? (
                          enabledMenus.slice(0, 6).map((label) => (
                            <span key={label} className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded">{label}</span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Nenhum menu habilitado</span>
                        )}
                        {enabledMenus.length > 6 && (
                          <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">+{enabledMenus.length - 6}</span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8 text-muted-foreground"><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum perfil criado</p>
              <p className="text-xs mt-1">Crie perfis como "Comercial", "Suporte", etc.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col bg-card border-border p-0 gap-0">
          <DialogHeader className="p-6 pb-3 border-b border-border">
            <DialogTitle className="text-foreground">{form.id ? "Editar Perfil" : "Novo Perfil"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Departamento, cargo e permissões granulares por menu
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 quantum-scrollbar">
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Departamento
                  </Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value, name: form.name || e.target.value })}
                    placeholder="Ex: Comercial"
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Cargo
                  </Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ex: Gerente"
                    className="bg-muted border-border text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Perfil para qualificação de leads"
                  className="bg-muted border-border text-foreground resize-none"
                  rows={2}
                />
              </div>

              {form.department && (
                <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md p-2.5">
                  Como aparecerá: <span className="text-accent font-medium">{form.department}{form.title ? ` · ${form.title}` : ""}</span>
                </div>
              )}

              <Separator className="bg-border" />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Permissões por Menu</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Habilite o menu e configure as ações permitidas</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => applyPreset("full")} className="border-border text-xs h-7">
                    Marcar tudo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => applyPreset("empty")} className="border-border text-xs h-7">
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {PERMISSION_TREE.map((menu) => (
                  <PermissionMenuRow
                    key={menu.key}
                    menu={menu}
                    perms={form.permissions[menu.key] || {}}
                    instances={instances || []}
                    onActionToggle={(action, val) => setMenuField(menu.key, action, val)}
                    onChildToggle={(child, action, val) => setChildAction(menu.key, child, action, val)}
                    onMasterToggle={(val) => setAllForMenu(menu, val)}
                    onInstanceToggle={toggleInstanceScope}
                  />
                ))}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 pt-3 border-t border-border bg-card">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border text-muted-foreground w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.department.trim() || saveMutation.isPending} className="gradient-primary text-white hover:opacity-90 w-full sm:w-auto">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface MenuRowProps {
  menu: MenuDef;
  perms: any;
  instances: Array<{ id: string; name: string; channel: string }>;
  onActionToggle: (action: string, val: boolean) => void;
  onChildToggle: (child: string, action: string, val: boolean) => void;
  onMasterToggle: (val: boolean) => void;
  onInstanceToggle: (id: string) => void;
}

function PermissionMenuRow({
  menu, perms, instances, onActionToggle, onChildToggle, onMasterToggle, onInstanceToggle,
}: MenuRowProps) {
  const isViewEnabled = !!perms.view;
  const [open, setOpen] = useState(false);
  const selectedInstances: string[] = perms.instances_scope || [];

  const hasExtraActions = menu.actions.filter((a) => a.key !== "view").length > 0;
  const hasChildren = !!menu.children && menu.children.length > 0;
  const hasInstancesScope = !!menu.instancesScope;
  const isExpandable = hasExtraActions || hasChildren || hasInstancesScope;

  // Contador de ações habilitadas para mostrar na linha colapsada
  const enabledCount = (() => {
    let c = 0;
    for (const a of menu.actions) if (perms[a.key]) c++;
    if (menu.children) {
      for (const child of menu.children) {
        const sub = perms[child.key] || {};
        for (const a of child.actions) if (sub[a.key]) c++;
      }
    }
    return c;
  })();

  return (
    <Collapsible open={open && isViewEnabled && isExpandable} onOpenChange={(v) => isViewEnabled && isExpandable && setOpen(v)}>
      <div className="border border-border rounded-lg bg-muted/30 overflow-hidden">
        <div className="flex items-center justify-between p-3 gap-2">
          <CollapsibleTrigger
            disabled={!isViewEnabled || !isExpandable}
            className="flex items-center gap-2 flex-1 min-w-0 text-left disabled:cursor-default"
          >
            {isExpandable ? (
              isViewEnabled ? (
                open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground truncate">{menu.label}</span>
            {isViewEnabled && enabledCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent/15 text-accent tabular-nums shrink-0">
                {enabledCount} {enabledCount === 1 ? "ação" : "ações"}
              </span>
            )}
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 shrink-0">
            {isViewEnabled && isExpandable && (
              <>
                <button
                  type="button"
                  onClick={() => onMasterToggle(true)}
                  className="text-xs text-accent hover:underline"
                >
                  tudo
                </button>
                <button
                  type="button"
                  onClick={() => onMasterToggle(false)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  limpar
                </button>
              </>
            )}
            <Switch
              checked={isViewEnabled}
              onCheckedChange={(v) => {
                onActionToggle("view", v);
                if (!v) onMasterToggle(false);
                if (v && isExpandable) setOpen(true);
              }}
            />
          </div>
        </div>

        {isExpandable && (
          <CollapsibleContent>
            <div className="px-4 pb-3 pt-1 space-y-3 border-t border-border/60 bg-background/40">
            {/* Ações principais (exceto view, já é o master) */}
            {menu.actions.filter((a) => a.key !== "view").length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2">
                {menu.actions.filter((a) => a.key !== "view").map((a) => (
                  <label key={a.key} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <Checkbox
                      checked={!!perms[a.key]}
                      onCheckedChange={(v) => onActionToggle(a.key, !!v)}
                    />
                    <span>{a.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Sub-menus (children) */}
            {menu.children?.map((child) => {
              const childPerms = perms[child.key] || {};
              return (
                <div key={child.key} className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {child.label}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {child.actions.map((a) => (
                      <label key={a.key} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                        <Checkbox
                          checked={!!childPerms[a.key]}
                          onCheckedChange={(v) => onChildToggle(child.key, a.key, !!v)}
                        />
                        <span>{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Instances scope (só para CRM) */}
            {menu.instancesScope && (
              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Instâncias acessíveis
                </div>
                {instances.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma instância cadastrada</p>
                ) : (
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <Checkbox
                        checked={selectedInstances.length === 0}
                        onCheckedChange={() => {
                          // Limpar = todas
                          selectedInstances.forEach((id) => onInstanceToggle(id));
                        }}
                      />
                      <span className="font-medium">Todas as instâncias</span>
                    </label>
                    {instances.map((inst) => (
                      <label key={inst.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer pl-4">
                        <Checkbox
                          checked={selectedInstances.includes(inst.id)}
                          onCheckedChange={() => onInstanceToggle(inst.id)}
                        />
                        <span>{inst.name}</span>
                        <span className="text-xs text-muted-foreground">({inst.channel})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
