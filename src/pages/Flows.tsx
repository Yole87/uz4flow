import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Plus, 
  GitBranch, 
  Edit, 
  Trash2, 
  Star, 
  Loader2,
  MoreVertical,
  Eye,
  MessageCircleQuestion,
  ChevronDown,
  BarChart3,
  Workflow
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { LimitAlert } from "@/components/LimitAlert";
import { useOrganizationLimits } from "@/hooks/useOrganizationLimits";

interface Flow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  is_interactive: boolean;
  session_timeout_minutes: number;
  timeout_action: string;
  timeout_message: string | null;
  created_at: string;
  step_count?: number;
}

const TIMEOUT_ACTION_OPTIONS = [
  { value: "end", label: "Finalizar conversa" },
  { value: "retry_step", label: "Reenviar última pergunta" },
  { value: "goto_exception", label: "Enviar mensagem de timeout" },
];

const SESSION_TIMEOUT_OPTIONS = [
  { value: "5", label: "5 minutos" },
  { value: "10", label: "10 minutos" },
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "120", label: "2 horas" },
];

export default function Flows() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const navigate = useNavigate();
  const { hasFeature, loading: limitsLoading } = useOrganizationLimits();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [saving, setSaving] = useState(false);
  const [interactiveConfigOpen, setInteractiveConfigOpen] = useState(false);

  const canCreateFlow = !limitsLoading && hasFeature("automations");
  const flowLimitReached = !limitsLoading && !hasFeature("automations");

  // Basic form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  
  // Interactive flow config
  const [isInteractive, setIsInteractive] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState("30");
  const [timeoutAction, setTimeoutAction] = useState("end");
  const [timeoutMessage, setTimeoutMessage] = useState("");

  useEffect(() => {
    if (!effectiveUserId) return;
    fetchFlows();
  }, [effectiveUserId]);

  async function fetchFlows() {
    try {
      const { data, error } = await supabase
        .from("flows")
        .select(`
          id,
          name,
          description,
          is_active,
          is_default,
          is_interactive,
          session_timeout_minutes,
          timeout_action,
          timeout_message,
          created_at,
          flow_steps(count)
        `)
        .eq("user_id", effectiveUserId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const flowsWithCount = data?.map(flow => ({
        ...flow,
        step_count: flow.flow_steps?.[0]?.count || 0
      })) || [];

      setFlows(flowsWithCount);
    } catch (error) {
      console.error("Error fetching flows:", error);
      toast.error("Erro ao carregar fluxos");
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsActive(true);
    setIsDefault(false);
    setIsInteractive(false);
    setSessionTimeoutMinutes("30");
    setTimeoutAction("end");
    setTimeoutMessage("");
    setEditingFlow(null);
    setInteractiveConfigOpen(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (flow: Flow) => {
    setEditingFlow(flow);
    setName(flow.name);
    setDescription(flow.description || "");
    setIsActive(flow.is_active);
    setIsDefault(flow.is_default);
    setIsInteractive(flow.is_interactive);
    setSessionTimeoutMinutes(flow.session_timeout_minutes.toString());
    setTimeoutAction(flow.timeout_action);
    setTimeoutMessage(flow.timeout_message || "");
    setInteractiveConfigOpen(flow.is_interactive);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome para o fluxo");
      return;
    }

    try {
      setSaving(true);

      // If setting as default, unset other defaults first
      if (isDefault) {
        await supabase
          .from("flows")
          .update({ is_default: false })
          .eq("user_id", effectiveUserId!);
      }

      const flowData = {
        name,
        description: description || null,
        is_active: isActive,
        is_default: isDefault,
        is_interactive: isInteractive,
        session_timeout_minutes: parseInt(sessionTimeoutMinutes),
        timeout_action: timeoutAction,
        timeout_message: isInteractive && timeoutAction === "goto_exception" && timeoutMessage.trim() 
          ? timeoutMessage.trim() 
          : null,
      };

      if (editingFlow) {
        const { error } = await supabase
          .from("flows")
          .update(flowData)
          .eq("id", editingFlow.id);

        if (error) throw error;
        toast.success("Fluxo atualizado! ✅");
      } else {
        const { error } = await supabase
          .from("flows")
          .insert({
            user_id: effectiveUserId!,
            ...flowData,
          });

        if (error) throw error;
        toast.success("Fluxo criado! 🎉");
      }

      setDialogOpen(false);
      resetForm();
      fetchFlows();
    } catch (error) {
      console.error("Error saving flow:", error);
      toast.error("Erro ao salvar fluxo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (flow: Flow) => {
    if (!confirm(`Tem certeza que deseja excluir "${flow.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("flows")
        .delete()
        .eq("id", flow.id);

      if (error) throw error;
      toast.success("Fluxo excluído");
      fetchFlows();
    } catch (error) {
      console.error("Error deleting flow:", error);
      toast.error("Erro ao excluir fluxo");
    }
  };

  const toggleActive = async (flow: Flow) => {
    try {
      const { error } = await supabase
        .from("flows")
        .update({ is_active: !flow.is_active })
        .eq("id", flow.id);

      if (error) throw error;
      fetchFlows();
    } catch (error) {
      console.error("Error toggling flow:", error);
      toast.error("Erro ao alterar status");
    }
  };

  if (loading) {
    return (
      <AppLayout title="Fluxos de Automação" description="Gerencie seus fluxos de automação">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Fluxos de Automação" description="Gerencie seus fluxos de automação">
      <div className="space-y-6 animate-fade-in">
        {/* Limit Alert */}
        <LimitAlert feature="automations" />

        {/* Header with create button */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <p className="text-muted-foreground">
              {flows.length === 0 
                ? "Crie seu primeiro fluxo para automatizar mensagens"
                : `${flows.length} fluxo${flows.length !== 1 ? "s" : ""} cadastrado${flows.length !== 1 ? "s" : ""}`
              }
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={openCreateDialog} 
                      className="gradient-primary hover:opacity-90 w-full sm:w-auto"
                      disabled={flowLimitReached}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Fluxo
                    </Button>
                  </DialogTrigger>
                </span>
              </TooltipTrigger>
              {flowLimitReached && (
                <TooltipContent>
                  <p>Você atingiu o limite de fluxos do seu plano</p>
                </TooltipContent>
              )}
            </Tooltip>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFlow ? "Editar Fluxo" : "Criar Novo Fluxo"}</DialogTitle>
                <DialogDescription>
                  {editingFlow 
                    ? "Atualize as informações do fluxo"
                    : "Defina o nome e descrição do seu fluxo"
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="flow-name">Nome do fluxo</Label>
                  <Input
                    id="flow-name"
                    placeholder="Ex: Boas-vindas"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flow-description">Descrição (opcional)</Label>
                  <Textarea
                    id="flow-description"
                    placeholder="Descreva o objetivo deste fluxo..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="flow-active">Ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Fluxos inativos não são executados
                    </p>
                  </div>
                  <Switch
                    id="flow-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="flow-default">Fluxo padrão</Label>
                    <p className="text-xs text-muted-foreground">
                      Usado quando nenhuma regra corresponder
                    </p>
                  </div>
                  <Switch
                    id="flow-default"
                    checked={isDefault}
                    onCheckedChange={setIsDefault}
                  />
                </div>

                {/* Interactive Flow Configuration */}
                <Collapsible open={interactiveConfigOpen} onOpenChange={setInteractiveConfigOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" type="button">
                      <div className="flex items-center gap-2">
                        <MessageCircleQuestion className="h-4 w-4" />
                        Fluxo Interativo
                        {isInteractive && (
                          <Badge variant="secondary" className="ml-2">Ativo</Badge>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${interactiveConfigOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    {/* Is Interactive Toggle */}
                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <div>
                        <Label htmlFor="flow-interactive" className="font-medium">Ativar modo interativo</Label>
                        <p className="text-xs text-muted-foreground">
                          Permite coletar respostas dos usuários durante o fluxo
                        </p>
                      </div>
                      <Switch
                        id="flow-interactive"
                        checked={isInteractive}
                        onCheckedChange={setIsInteractive}
                      />
                    </div>

                    {isInteractive && (
                      <>
                        {/* Session Timeout */}
                        <div className="space-y-2">
                          <Label>Timeout da sessão</Label>
                          <Select value={sessionTimeoutMinutes} onValueChange={setSessionTimeoutMinutes}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Tempo máximo de inatividade antes de encerrar a sessão
                          </p>
                        </div>

                        {/* Timeout Action */}
                        <div className="space-y-2">
                          <Label>Ação ao expirar</Label>
                          <Select value={timeoutAction} onValueChange={setTimeoutAction}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMEOUT_ACTION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Timeout Message (only if goto_exception) */}
                        {timeoutAction === "goto_exception" && (
                          <div className="space-y-2">
                            <Label htmlFor="timeout-message">Mensagem de timeout</Label>
                            <Textarea
                              id="timeout-message"
                              placeholder="Ex: Sua sessão expirou por inatividade. Envie uma mensagem para recomeçar."
                              value={timeoutMessage}
                              onChange={(e) => setTimeoutMessage(e.target.value)}
                              rows={2}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
              <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingFlow ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Empty state */}
        {flows.length === 0 && (
          <EmptyState
            variant="card"
            icon={Workflow}
            title="Nenhum fluxo criado"
            description="Crie automações que respondem e qualificam leads automaticamente. Fluxos são sequências de mensagens enviadas pelo Sistema de WhatsApp AI."
            action={{
              label: "Criar primeiro fluxo",
              onClick: openCreateDialog,
              icon: Plus,
            }}
          />
        )}

        {/* Flows grid */}
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Card 
              key={flow.id} 
              className={`group hover:shadow-lg transition-all cursor-pointer ${
                !flow.is_active ? "opacity-60" : ""
              }`}
              onClick={() => navigate(`/flows/${flow.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-base flex-wrap min-w-0">
                      <span className="truncate">{flow.name}</span>
                      {flow.is_default && (
                        <Star className="h-4 w-4 text-warning fill-warning shrink-0" />
                      )}
                      {flow.is_interactive && (
                        <Badge variant="outline" className="gap-1 text-xs shrink-0">
                          <MessageCircleQuestion className="h-3 w-3" />
                          Interativo
                        </Badge>
                      )}
                    </CardTitle>
                    {flow.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {flow.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/flows/${flow.id}`); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver etapas
                      </DropdownMenuItem>
                      {flow.is_interactive && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/flows/${flow.id}/results`); }}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Ver resultados
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(flow); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); handleDelete(flow); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={flow.is_active ? "default" : "secondary"}>
                      {flow.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant="outline">
                      {flow.step_count || 0} etapa{(flow.step_count || 0) !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <Switch
                    checked={flow.is_active}
                    onCheckedChange={() => toggleActive(flow)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
