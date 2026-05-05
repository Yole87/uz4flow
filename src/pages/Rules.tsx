import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LimitAlert } from "@/components/LimitAlert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Route, 
  Edit, 
  Trash2, 
  Loader2,
  Server,
  MessageCircle,
  Shuffle,
  Filter
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface RoutingRule {
  id: string;
  priority: number;
  match_type: string;
  match_value: string | null;
  instance_id: string | null;
  flow_id: string;
  is_active: boolean;
  flow?: {
    name: string;
  };
}

interface Flow {
  id: string;
  name: string;
}

const MATCH_TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  instance_id: { label: "Por Instance ID", icon: Server },
  keyword: { label: "Por palavra-chave", icon: MessageCircle },
  contains: { label: "Contém", icon: MessageCircle },
  starts_with: { label: "Começa com", icon: MessageCircle },
  regex: { label: "Regex", icon: Shuffle },
};

export default function Rules() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [saving, setSaving] = useState(false);

  const [matchType, setMatchType] = useState<"instance_id" | "keyword" | "contains" | "starts_with" | "regex">("keyword");
  const [matchValue, setMatchValue] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [priority, setPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    fetchData();
  }, [effectiveUserId]);

  async function fetchData() {
    try {
      const [rulesResult, flowsResult] = await Promise.all([
        supabase
          .from("routing_rules")
          .select(`
            *,
            flow:flows(name)
          `)
          .eq("user_id", effectiveUserId!)
          .order("priority", { ascending: false }),
        supabase
          .from("flows")
          .select("id, name")
          .eq("user_id", effectiveUserId!)
          .eq("is_active", true)
      ]);

      if (rulesResult.error) throw rulesResult.error;
      if (flowsResult.error) throw flowsResult.error;

      setRules(rulesResult.data || []);
      setFlows(flowsResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar regras");
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setMatchType("keyword");
    setMatchValue("");
    setInstanceId("");
    setFlowId("");
    setPriority("0");
    setIsActive(true);
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: RoutingRule) => {
    setEditingRule(rule);
    setMatchType((rule.match_type as typeof matchType) || "keyword");
    setMatchValue(rule.match_value || "");
    setInstanceId(rule.instance_id || "");
    setFlowId(rule.flow_id);
    setPriority(rule.priority.toString());
    setIsActive(rule.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!flowId) {
      toast.error("Selecione um fluxo");
      return;
    }

    if (matchType === "keyword" && !matchValue.trim()) {
      toast.error("Informe a palavra-chave");
      return;
    }

    if (matchType === "instance_id" && !matchValue.trim()) {
      toast.error("Informe o Instance ID");
      return;
    }

    try {
      setSaving(true);

      const ruleData = {
        user_id: effectiveUserId!,
        match_type: matchType,
        match_value: matchValue || null,
        instance_id: instanceId || null,
        flow_id: flowId,
        priority: parseInt(priority),
        is_active: isActive,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("routing_rules")
          .update(ruleData)
          .eq("id", editingRule.id);

        if (error) throw error;
        toast.success("Regra atualizada! ✅");
      } else {
        const { error } = await supabase
          .from("routing_rules")
          .insert(ruleData);

        if (error) throw error;
        toast.success("Regra criada! 🎉");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Erro ao salvar regra");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: RoutingRule) => {
    if (!confirm("Excluir esta regra?")) return;

    try {
      const { error } = await supabase
        .from("routing_rules")
        .delete()
        .eq("id", rule.id);

      if (error) throw error;
      toast.success("Regra excluída");
      fetchData();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Erro ao excluir regra");
    }
  };

  const toggleActive = async (rule: RoutingRule) => {
    try {
      const { error } = await supabase
        .from("routing_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast.error("Erro ao alterar status");
    }
  };

  if (loading) {
    return (
      <AppLayout title="Regras de Roteamento" description="Configure quando cada fluxo será acionado">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Regras de Roteamento" description="Configure quando cada fluxo será acionado">
      <div className="space-y-6 animate-fade-in">
        <LimitAlert feature="automations" className="mb-2" />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <p className="text-muted-foreground">
              {rules.length === 0 
                ? "Crie regras para direcionar eventos aos fluxos corretos"
                : `${rules.length} regra${rules.length !== 1 ? "s" : ""} configurada${rules.length !== 1 ? "s" : ""}`
              }
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={openCreateDialog} 
                className="gradient-primary hover:opacity-90 w-full sm:w-auto"
                disabled={flows.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRule ? "Editar Regra" : "Criar Nova Regra"}</DialogTitle>
                <DialogDescription>
                  Configure quando este fluxo deve ser acionado
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo de correspondência</Label>
                  <Select value={matchType} onValueChange={(v) => setMatchType(v as typeof matchType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Por palavra-chave</SelectItem>
                      <SelectItem value="instance_id">Por Instance ID</SelectItem>
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="starts_with">Começa com</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {matchType !== "instance_id" && (
                  <div className="space-y-2">
                    <Label htmlFor="match-value">
                      {matchType === "keyword" ? "Palavra-chave" : matchType === "regex" ? "Expressão Regular" : "Valor"}
                    </Label>
                    <Input
                      id="match-value"
                      placeholder={matchType === "keyword" ? "Ex: oi, olá, ajuda" : "Ex: texto a buscar"}
                      value={matchValue}
                      onChange={(e) => setMatchValue(e.target.value)}
                    />
                    {matchType === "keyword" && (
                      <p className="text-xs text-muted-foreground">
                        Separe múltiplas palavras com vírgula
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="flow">Fluxo a executar</Label>
                  <Select value={flowId} onValueChange={setFlowId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um fluxo" />
                    </SelectTrigger>
                    <SelectContent>
                      {flows.map((flow) => (
                        <SelectItem key={flow.id} value={flow.id}>
                          {flow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Input
                    id="priority"
                    type="number"
                    placeholder="0"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Regras com maior prioridade são verificadas primeiro
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="rule-active">Ativa</Label>
                    <p className="text-xs text-muted-foreground">
                      Regras inativas são ignoradas
                    </p>
                  </div>
                  <Switch
                    id="rule-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>
              <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingRule ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* No flows warning */}
        {flows.length === 0 && (
          <Card className="quantum-glass border-warning/30">
            <CardContent className="py-4">
              <p className="text-sm">
                ⚠️ Você precisa criar pelo menos um fluxo ativo antes de criar regras.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {rules.length === 0 && flows.length > 0 && (
          <EmptyState
            variant="card"
            icon={Filter}
            title="Nenhuma regra configurada"
            description="Defina como leads são roteados automaticamente. Regras determinam qual fluxo será executado com base no conteúdo do webhook."
            action={{
              label: "Criar regra",
              onClick: openCreateDialog,
              icon: Plus,
            }}
          />
        )}

        {/* Rules list */}
        <div className="space-y-3">
          {rules.map((rule) => {
            const matchInfo = MATCH_TYPE_LABELS[rule.match_type] || { label: rule.match_type, icon: MessageCircle };
            const TypeIcon = matchInfo.icon;
            return (
              <Card 
                key={rule.id} 
                className={`group hover:shadow-md transition-shadow ${!rule.is_active ? "opacity-60" : ""}`}
              >
                <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3 sm:py-4">
                  <div className="flex items-start gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <TypeIcon className="h-5 w-5 text-primary" />
                    </div>
                  
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-1">
                      <Badge variant="secondary">
                        {matchInfo.label}
                      </Badge>
                      <Badge variant="outline">
                        Prioridade: {rule.priority}
                      </Badge>
                      {!rule.is_active && (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </div>
                    <p className="text-sm break-words">
                      {`Quando ${rule.match_type === "keyword" ? "mensagem contém" : rule.match_type === "instance_id" ? "instance é" : "mensagem corresponde"}: "${rule.match_value}"`}
                      {" → "}
                      <span className="font-medium text-primary">{rule.flow?.name}</span>
                    </p>
                  </div>

                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-auto">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleActive(rule)}
                    />
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(rule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(rule)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}