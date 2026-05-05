import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Zap, ArrowRight, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PipelineAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface KeywordRule {
  id?: string;
  keyword: string;
  match_mode: string;
  target_pipeline_id: string;
  target_stage_id: string;
  priority: number;
  is_active: boolean;
  apply_on: string;
  instance_id?: string | null;
}

export function PipelineAutomationDialog({ open, onOpenChange }: PipelineAutomationDialogProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<KeywordRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const orgId = organization?.id;

  // Fetch instances
  const { data: instances } = useQuery({
    queryKey: ["crm-instances", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Array<{ id: string; name: string }>;
    },
    enabled: !!orgId && open,
  });

  // Fetch existing rules
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["keyword-rules", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("pipeline_keyword_rules")
        .select("*")
        .eq("organization_id", orgId)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && open,
  });

  // Fetch pipelines
  const { data: pipelines } = useQuery({
    queryKey: ["pipelines", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");
      return data || [];
    },
    enabled: !!orgId && open,
  });

  // Fetch stages for selected pipeline
  const selectedPipelineId = editingRule?.target_pipeline_id;
  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages-for-rule", selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return [];
      const { data } = await supabase
        .from("stages")
        .select("id, name, color")
        .eq("pipeline_id", selectedPipelineId)
        .order("order_index");
      return data || [];
    },
    enabled: !!selectedPipelineId,
  });

  // Save rule mutation
  const saveMutation = useMutation({
    mutationFn: async (rule: KeywordRule) => {
      if (!orgId) throw new Error("Sem organização");
      const payload = {
        organization_id: orgId,
        keyword: rule.keyword,
        match_mode: rule.match_mode,
        target_pipeline_id: rule.target_pipeline_id,
        target_stage_id: rule.target_stage_id,
        priority: rule.priority,
        is_active: rule.is_active,
        apply_on: rule.apply_on,
        instance_id: rule.instance_id || null,
      };
      if (rule.id) {
        const { error } = await supabase
          .from("pipeline_keyword_rules")
          .update(payload)
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pipeline_keyword_rules")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keyword-rules"] });
      setEditingRule(null);
      setIsCreating(false);
      toast.success("Regra salva!");
    },
    onError: () => toast.error("Erro ao salvar regra"),
  });

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pipeline_keyword_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keyword-rules"] });
      toast.success("Regra excluída");
    },
    onError: () => toast.error("Erro ao excluir regra"),
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("pipeline_keyword_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["keyword-rules"] }),
  });

  const handleNewRule = () => {
    setEditingRule({
      keyword: "",
      match_mode: "contains",
      target_pipeline_id: "",
      target_stage_id: "",
      priority: (rules?.length || 0) + 1,
      is_active: true,
      apply_on: "first_message",
      instance_id: null,
    });
    setIsCreating(true);
  };

  const getPipelineName = (id: string) => pipelines?.find(p => p.id === id)?.name || "—";

  // Editing form
  if (editingRule) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingRule(null); setIsCreating(false); } onOpenChange(v); }}>
        <DialogContent className="sm:max-w-[520px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              {isCreating ? "Nova Regra de Automação" : "Editar Regra"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Configure uma palavra/frase-chave para alocar leads automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Palavra ou Frase-chave</Label>
              <Input
                value={editingRule.keyword}
                onChange={(e) => setEditingRule({ ...editingRule, keyword: e.target.value })}
                placeholder='Ex: "Oi, vim do Instagram" ou "Comprei"'
                className="bg-muted border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                O sistema procura essa palavra/frase na mensagem do cliente (não diferencia maiúsculas/minúsculas).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Modo de Busca</Label>
                <Select value={editingRule.match_mode} onValueChange={(v) => setEditingRule({ ...editingRule, match_mode: v })}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="contains">Contém a palavra</SelectItem>
                    <SelectItem value="exact">Frase exata</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Quando Aplicar</Label>
                <Select value={editingRule.apply_on} onValueChange={(v) => setEditingRule({ ...editingRule, apply_on: v })}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="first_message">Primeira mensagem (novo lead)</SelectItem>
                    <SelectItem value="any_message">Qualquer mensagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Instance selector */}
            {instances && instances.length > 0 && (
              <div className="space-y-2">
                <Label className="text-foreground">Instância (opcional)</Label>
                <Select value={editingRule.instance_id || "all"} onValueChange={(v) => setEditingRule({ ...editingRule, instance_id: v === "all" ? null : v })}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="all">Todas as instâncias</SelectItem>
                    {instances.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Se selecionada, a regra só se aplica a mensagens desta instância</p>
              </div>
            )}

            <Separator className="bg-border" />

            <div className="space-y-2">
              <Label className="text-foreground">Funil Destino</Label>
              <Select
                value={editingRule.target_pipeline_id}
                onValueChange={(v) => setEditingRule({ ...editingRule, target_pipeline_id: v, target_stage_id: "" })}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Selecione o funil" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {pipelines?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Estágio (Coluna) Destino</Label>
              <Select
                value={editingRule.target_stage_id}
                onValueChange={(v) => setEditingRule({ ...editingRule, target_stage_id: v })}
                disabled={!editingRule.target_pipeline_id}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder={editingRule.target_pipeline_id ? "Selecione o estágio" : "Selecione um pipeline primeiro"} />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {stages?.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color || "#71717a" }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-foreground">Prioridade</Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" className="max-w-[220px] text-xs leading-relaxed z-[300] bg-popover border border-border shadow-lg">
                        <p className="font-medium mb-1">Como funciona?</p>
                        <p>Quando um cliente envia uma mensagem, o sistema verifica suas regras da <strong>maior</strong> prioridade para a <strong>menor</strong>.</p>
                        <p className="mt-1">A <strong>primeira regra</strong> que corresponder será aplicada e as demais serão ignoradas.</p>
                        <p className="mt-1 text-muted-foreground">Use números maiores para regras mais importantes.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  type="number"
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border text-foreground"
                  min={0}
                />
                <p className="text-xs text-muted-foreground">Maior = avaliada primeiro</p>
              </div>

              <div className="flex items-end pb-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingRule.is_active}
                    onCheckedChange={(v) => setEditingRule({ ...editingRule, is_active: v })}
                  />
                  <Label className="text-foreground">Ativa</Label>
                </div>
              </div>
            </div>

            {/* Storytelling example */}
            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 space-y-3">
              <p className="text-xs text-accent font-semibold flex items-center gap-1.5">💡 Veja como funciona na prática</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold">1</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Um cliente envia <span className="font-medium text-foreground">"Oi, vim do Instagram"</span>. O sistema encontra a palavra-chave e move o lead para <span className="font-medium text-accent">Tratativas de Contato → Ainda Não Tratado</span>.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold">2</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Outro cliente escreve <span className="font-medium text-foreground">"Comprei o produto"</span>. A regra detecta a palavra e aloca direto em <span className="font-medium text-accent">Funil de Vendas → Fechado</span>.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/70 italic">Tudo acontece automaticamente, sem intervenção manual. ✨</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingRule(null); setIsCreating(false); }} className="border-border text-muted-foreground">
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(editingRule)}
              disabled={!editingRule.keyword.trim() || !editingRule.target_pipeline_id || !editingRule.target_stage_id || saveMutation.isPending}
              className="gradient-primary text-white hover:opacity-90"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Rules list view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            Automações do Funil Kanban
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Regras de palavra-chave para alocar leads automaticamente em funis e estágios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={handleNewRule} variant="outline" className="w-full border-dashed border-border text-muted-foreground hover:bg-muted">
            <Plus className="h-4 w-4 mr-2" /> Nova Regra
          </Button>

          {rulesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rules && rules.length > 0 ? (
            <div className="space-y-3">
              {rules.map((rule) => {
                const r = rule as { id: string; keyword: string; match_mode: string; target_pipeline_id: string; target_stage_id: string; priority: number; is_active: boolean; apply_on: string };
                return (
                  <div
                    key={r.id}
                    className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3"
                  >
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, is_active: v })}
                    />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingRule(r); setIsCreating(false); }}>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-foreground truncate">"{r.keyword}"</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">{getPipelineName(r.target_pipeline_id)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {r.match_mode === "exact" ? "Exato" : "Contém"} · {r.apply_on === "first_message" ? "1ª msg" : "Qualquer msg"} · Prioridade {r.priority}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => deleteMutation.mutate(r.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma regra criada ainda</p>
              <p className="text-xs mt-1">Crie regras para alocar leads automaticamente com base em palavras-chave</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
