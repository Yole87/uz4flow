import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, CalendarClock, Star, Key, Plus, Trash2, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ScheduleConfig {
  days?: number;
  weekdays?: number[];
  hour?: number;
  minute?: number;
}

interface RoutingRule {
  id?: string;
  match_type: string;
  match_value: string;
  instance_id: string;
  priority: number;
  is_active: boolean;
  isNew?: boolean;
}

interface ConflictInfo {
  keyword: string;
  flowName: string;
  flowId: string;
}

interface TriggerConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  userId: string;
  scheduleEnabled: boolean;
  scheduleType: string | null;
  scheduleConfig: ScheduleConfig | null;
  isDefault: boolean;
  onSaved: (updates: {
    schedule_enabled: boolean;
    schedule_type: string | null;
    schedule_config: ScheduleConfig | null;
    is_default: boolean;
  }) => void;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function TriggerConfigDialog({
  open,
  onOpenChange,
  flowId,
  userId,
  scheduleEnabled: initScheduleEnabled,
  scheduleType: initScheduleType,
  scheduleConfig: initScheduleConfig,
  isDefault: initIsDefault,
  onSaved,
}: TriggerConfigDialogProps) {
  const [enabled, setEnabled] = useState(false);
  const [sType, setSType] = useState<"after_days" | "weekdays">("weekdays");
  const [days, setDays] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [isDefault, setIsDefault] = useState(false);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [instances, setInstances] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [otherDefaultFlow, setOtherDefaultFlow] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEnabled(initScheduleEnabled);
    setSType((initScheduleType as "after_days" | "weekdays") || "weekdays");
    setDays(initScheduleConfig?.days ?? 1);
    setWeekdays(initScheduleConfig?.weekdays ?? [1, 2, 3, 4, 5]);
    setHour(initScheduleConfig?.hour ?? 9);
    setMinute(initScheduleConfig?.minute ?? 0);
    setIsDefault(initIsDefault);
    fetchRules();
    fetchInstances();
    fetchOtherRules();
    fetchOtherDefaultFlow();
  }, [open]);

  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const { data } = await supabase
        .from("routing_rules")
        .select("*")
        .eq("flow_id", flowId)
        .order("priority");
      setRules(
        (data || []).map((r) => ({
          id: r.id,
          match_type: r.match_type,
          match_value: r.match_value,
          instance_id: r.instance_id || "",
          priority: r.priority,
          is_active: r.is_active,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRules(false);
    }
  }, [flowId]);

  const fetchInstances = useCallback(async () => {
    // @ts-ignore - instances table may be a view
    const res = await supabase.from("instances").select("id, name").eq("user_id", userId);
    setInstances((res.data as any[]) || []);
  }, [userId]);

  // Fetch rules from OTHER flows to detect conflicts
  const fetchOtherRules = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("routing_rules")
        .select("match_type, match_value, flow_id, is_active, flow:flows(name)")
        .eq("user_id", userId)
        .neq("flow_id", flowId)
        .eq("is_active", true);

      if (!data) return;

      // Store for conflict checking
      const otherKeywords: ConflictInfo[] = [];
      for (const r of data) {
        if (r.match_type === "keyword" && r.match_value) {
          const keywords = r.match_value.split(",").map((k: string) => k.trim().toLowerCase());
          const flowName = (r.flow as any)?.name || "Outro fluxo";
          for (const kw of keywords) {
            if (kw) otherKeywords.push({ keyword: kw, flowName, flowId: r.flow_id });
          }
        }
      }
      setConflicts(otherKeywords);
    } catch (e) {
      console.error(e);
    }
  }, [userId, flowId]);

  const fetchOtherDefaultFlow = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("flows")
        .select("name")
        .eq("user_id", userId)
        .eq("is_default", true)
        .neq("id", flowId)
        .limit(1)
        .maybeSingle();
      setOtherDefaultFlow(data?.name || null);
    } catch (e) {
      console.error(e);
    }
  }, [userId, flowId]);

  // Check current rules for conflicts
  const getKeywordConflicts = (): ConflictInfo[] => {
    const found: ConflictInfo[] = [];
    for (const rule of rules) {
      if (rule.match_type !== "keyword" || !rule.match_value) continue;
      const myKeywords = rule.match_value.split(",").map((k) => k.trim().toLowerCase());
      for (const kw of myKeywords) {
        const conflict = conflicts.find((c) => c.keyword === kw);
        if (conflict) found.push(conflict);
      }
    }
    // Deduplicate
    return found.filter((c, i, arr) => arr.findIndex((x) => x.keyword === c.keyword && x.flowId === c.flowId) === i);
  };

  const toggleWeekday = (day: number) =>
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        match_type: "keyword",
        match_value: "",
        instance_id: "",
        priority: prev.length + 1,
        is_active: true,
        isNew: true,
      },
    ]);
  };

  const removeRule = async (index: number) => {
    const rule = rules[index];
    if (rule.id) {
      await supabase.from("routing_rules").delete().eq("id", rule.id);
    }
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: string, value: any) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = async () => {
    if (enabled && sType === "weekdays" && weekdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana");
      return;
    }

    // Show conflict warnings (non-blocking)
    const currentConflicts = getKeywordConflicts();
    if (currentConflicts.length > 0) {
      const grouped = new Map<string, string[]>();
      for (const c of currentConflicts) {
        if (!grouped.has(c.flowName)) grouped.set(c.flowName, []);
        grouped.get(c.flowName)!.push(c.keyword);
      }
      for (const [flowName, keywords] of grouped) {
        toast.warning(
          `Palavras-chave "${keywords.join(", ")}" já usadas no fluxo "${flowName}". A regra com maior prioridade será usada.`,
          { duration: 6000 }
        );
      }
    }

    try {
      setSaving(true);

      const config: ScheduleConfig = {
        hour,
        minute,
        ...(sType === "after_days" ? { days } : { weekdays }),
      };

      const { error } = await supabase
        .from("flows")
        .update({
          schedule_enabled: enabled,
          schedule_type: enabled ? sType : null,
          schedule_config: enabled ? (config as any) : null,
          is_default: isDefault,
        })
        .eq("id", flowId);

      if (error) throw error;

      // If marking as default, unset other defaults
      if (isDefault) {
        await supabase
          .from("flows")
          .update({ is_default: false })
          .eq("user_id", userId)
          .neq("id", flowId);
      }

      // Save routing rules
      for (const rule of rules) {
        if (!rule.match_value.trim()) continue;
        if (rule.id && !rule.isNew) {
          await supabase
            .from("routing_rules")
            .update({
              match_type: rule.match_type,
              match_value: rule.match_value,
              instance_id: rule.instance_id || null,
              priority: rule.priority,
              is_active: rule.is_active,
            })
            .eq("id", rule.id);
        } else {
          await supabase.from("routing_rules").insert({
            user_id: userId,
            flow_id: flowId,
            match_type: rule.match_type,
            match_value: rule.match_value,
            instance_id: rule.instance_id || null,
            priority: rule.priority,
            is_active: rule.is_active,
          });
        }
      }

      onSaved({
        schedule_enabled: enabled,
        schedule_type: enabled ? sType : null,
        schedule_config: enabled ? config : null,
        is_default: isDefault,
      });
      toast.success("Trigger configurado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const currentConflicts = getKeywordConflicts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-success" />
            Configurar Trigger
          </DialogTitle>
          <DialogDescription>
            Defina como e quando este fluxo será acionado.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="rules" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="rules" className="text-xs">
              <Key className="h-3.5 w-3.5 mr-1" />
              Regras
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs">
              <CalendarClock className="h-3.5 w-3.5 mr-1" />
              Agendamento
            </TabsTrigger>
            <TabsTrigger value="default" className="text-xs">
              <Star className="h-3.5 w-3.5 mr-1" />
              Padrão
            </TabsTrigger>
          </TabsList>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Regras de Roteamento</p>
                <p className="text-xs text-muted-foreground">
                  Palavras-chave ou condições que acionam este fluxo
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={addRule}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Regra
              </Button>
            </div>

            {/* Conflict warnings */}
            {currentConflicts.length > 0 && (
              <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <p className="text-sm font-medium text-warning">Conflitos detectados</p>
                </div>
                {currentConflicts.map((c, i) => (
                  <p key={i} className="text-xs text-warning/80 ml-5">
                    Palavra-chave "<strong>{c.keyword}</strong>" já usada em "<strong>{c.flowName}</strong>"
                  </p>
                ))}
                <p className="text-xs text-muted-foreground ml-5 mt-1">
                  A regra com maior prioridade será usada quando houver conflito.
                </p>
              </div>
            )}

            {loadingRules ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-lg">
                <Key className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma regra configurada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Adicione regras para acionar este fluxo por palavras-chave
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id || `new-${idx}`}
                    className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Select
                        value={rule.match_type}
                        onValueChange={(v) => updateRule(idx, "match_type", v)}
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="keyword">Palavra-chave</SelectItem>
                          <SelectItem value="contains">Contém</SelectItem>
                          <SelectItem value="starts_with">Começa com</SelectItem>
                          <SelectItem value="regex">Regex</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={rule.match_value}
                        onChange={(e) => updateRule(idx, "match_value", e.target.value)}
                        placeholder="Ex: oi, olá, menu"
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive"
                        onClick={() => removeRule(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {instances.length > 0 && (
                      <Select
                        value={rule.instance_id || "any"}
                        onValueChange={(v) => updateRule(idx, "instance_id", v === "any" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Instância (todas)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Todas as instâncias</SelectItem>
                          {instances.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="trigger-schedule" className="font-medium">
                  Agendar execução
                </Label>
                <p className="text-xs text-muted-foreground">
                  Executar automaticamente no horário configurado
                </p>
              </div>
              <Switch id="trigger-schedule" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Tipo de agendamento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSType("weekdays")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        sType === "weekdays"
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">Dias da semana</p>
                      <p className="text-xs text-muted-foreground">Executa em dias específicos</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSType("after_days")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        sType === "after_days"
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">Após X dias</p>
                      <p className="text-xs text-muted-foreground">Executa após intervalo</p>
                    </button>
                  </div>
                </div>

                {sType === "weekdays" ? (
                  <div className="space-y-2">
                    <Label className="text-sm">Dias da semana</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {WEEKDAY_LABELS.map((label, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleWeekday(idx)}
                          className={`h-9 w-11 rounded-md text-xs font-medium transition-all ${
                            weekdays.includes(idx)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm">Executar a cada</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={days}
                        onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">dia(s)</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Horário de execução
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={hour.toString().padStart(2, "0")}
                      onChange={(e) =>
                        setHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))
                      }
                      className="w-16 text-center"
                    />
                    <span className="text-lg font-bold text-muted-foreground">:</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={minute.toString().padStart(2, "0")}
                      onChange={(e) =>
                        setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
                      }
                      className="w-16 text-center"
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Default Tab */}
          <TabsContent value="default" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="trigger-default" className="font-medium">
                  Fluxo padrão (fallback)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Acionado quando nenhuma regra de roteamento corresponde à mensagem recebida
                </p>
              </div>
              <Switch id="trigger-default" checked={isDefault} onCheckedChange={setIsDefault} />
            </div>

            {isDefault && otherDefaultFlow && (
              <div className="p-3 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-warning">Substituir fluxo padrão</p>
                    <p className="text-xs text-warning/80 mt-0.5">
                      O fluxo "<strong>{otherDefaultFlow}</strong>" é o padrão atual e será desativado como fallback ao salvar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isDefault && !otherDefaultFlow && (
              <div className="p-3 rounded-lg border border-success/30 bg-success/5">
                <div className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-success">Fluxo padrão</p>
                    <p className="text-xs text-success/80 mt-0.5">
                      Este fluxo será usado quando nenhuma outra regra corresponder à mensagem.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
