import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useInstagramAutomations, InstagramAutomation } from "@/hooks/useInstagramAutomations";
import { InstagramAccount } from "@/hooks/useInstagramAccounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronRight, GripVertical, MessageSquare, Phone, Tag, UserPlus, Reply, Zap, FileText, Paperclip, X, Heart, MousePointerClick, HelpCircle, UserCheck, Variable } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOpenBotConfig } from "@/hooks/useOpenBotConfig";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  automation: InstagramAutomation | null;
  accounts: InstagramAccount[];
  onClose: () => void;
}

interface StepDef {
  type: string;
  config: Record<string, any>;
  _client_id: string;
}

interface QuickReplyButton {
  title: string;
  payload: string;
}

let _nextClientId = 1;
function genClientId(): string {
  return `step_${Date.now()}_${_nextClientId++}`;
}

const TRIGGER_TOOLTIPS: Record<string, string> = {
  dm_received: "Dispara quando alguém envia uma mensagem direta. Ex: usuário escreve \"quero saber mais\" na DM.",
  comment_received: "Dispara quando alguém comenta em um post ou reel. Ex: comentário com palavra-chave \"preço\" ativa a automação.",
  live_comment: "Dispara durante uma transmissão ao vivo quando alguém comenta. Ex: \"EU QUERO\" nos comentários da live.",
  reaction: "Dispara quando alguém reage com emoji a uma mensagem na DM. Ex: ❤️ em uma mensagem do bot.",
  referral: "Dispara quando alguém chega via link ig.me ou anúncio do Instagram. Ex: tráfego de um anúncio de stories.",
};

const STEP_TYPES = [
  { type: "send_dm", label: "Enviar DM", icon: MessageSquare, tooltip: "Envia uma mensagem direta ao usuário. Suporta botões de resposta rápida (Quick Replies). Ex: enviar boas-vindas ou link de conteúdo." },
  { type: "ask_and_wait", label: "Perguntar e Aguardar", icon: MessageSquare, tooltip: "Envia uma pergunta e pausa o fluxo até o usuário responder. Suporta botões de resposta rápida. Ex: \"Qual seu nome?\" e salva a resposta em uma variável." },
  { type: "check_follower", label: "Verificar Seguidor", icon: UserCheck, tooltip: "Verifica automaticamente via API da Meta (is_user_follow_business) se o usuário segue sua conta. Se já segue, continua silenciosamente. Se não, envia botão para clicar após seguir e re-verifica." },
  { type: "validate_phone", label: "Validar Telefone", icon: Phone, tooltip: "Detecta e valida automaticamente o telefone no contexto da conversa. Pode pedir confirmação ao usuário. Ex: formata \"19983226145\" para \"+55 (19) 98322-6145\"." },
  { type: "save_lead", label: "Salvar Lead", icon: UserPlus, tooltip: "Salva os dados coletados como lead e sincroniza com o CRM. Cria contato com telefone, nome e tags automaticamente." },
  { type: "tag_lead", label: "Adicionar Tags", icon: Tag, tooltip: "Adiciona tags ao lead para categorização. Tags são mescladas (nunca sobrescritas). Ex: \"interessado, instagram, promo-verao\"." },
  { type: "reply_comment", label: "Responder Comentário", icon: Reply, tooltip: "Responde ao comentário que ativou a automação. Pode ser resposta pública (no post) ou privada (via DM). Ex: \"Vou te enviar no privado!\"." },
  // like_comment hidden from UI — requires Facebook Login Page Token (architectural change pending)
  // { type: "like_comment", label: "Curtir Comentário", icon: Heart, tooltip: "Curte automaticamente o comentário que ativou a automação." },
  { type: "openbot_start_whatsapp", label: "Iniciar WhatsApp (WhatsApp AI)", icon: Zap, tooltip: "Envia mensagem no WhatsApp via Sistema de WhatsApp AI para o telefone coletado. Pode incluir arquivo em anexo (PDF, imagem). Ex: enviar proposta comercial após captar o lead." },
];

// ── Sortable Step Item ──
function SortableStepItem({
  step,
  index,
  isOpen,
  onToggle,
  onRemove,
  stepLabel,
  stepTooltip,
  children,
}: {
  step: StepDef;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  stepLabel: string;
  stepTooltip?: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step._client_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <div className="quantum-glass rounded-lg">
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/20 rounded-lg">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">{index + 1}</Badge>
              <span className="text-sm text-foreground flex-1">{stepLabel}</span>
              {stepTooltip && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" onClick={(e) => e.stopPropagation()} />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[280px] text-xs">
                      {stepTooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
              {children}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

// ── Quick Reply Buttons Editor ──
function QuickReplyButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: QuickReplyButton[];
  onChange: (buttons: QuickReplyButton[]) => void;
}) {
  const btn = buttons[0];

  const toggleButton = () => {
    if (btn) {
      onChange([]);
    } else {
      onChange([{ title: "", payload: "" }]);
    }
  };

  const updateButton = (field: "title" | "payload", value: string) => {
    if (!btn) return;
    onChange([{ ...btn, [field]: value }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          <MousePointerClick className="h-3 w-3" />
          Botão de Resposta Rápida
        </Label>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[280px] text-xs z-[300]">
              <p className="font-medium mb-1">Como funciona o botão:</p>
              <p>O fluxo <strong>pausa</strong> até o usuário clicar no botão ou responder com texto. O payload do botão é salvo na variável do passo e o fluxo avança para o próximo passo.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {btn ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={btn.title}
              onChange={(e) => updateButton("title", e.target.value)}
              placeholder="Texto do botão (até 20 chars)"
              maxLength={20}
              className="bg-muted border-border text-sm flex-1"
            />
            <Input
              value={btn.payload}
              onChange={(e) => updateButton("payload", e.target.value)}
              placeholder="Payload (ex: SIM)"
              className="bg-muted border-border text-sm flex-1"
            />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive shrink-0" onClick={toggleButton}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O payload é um identificador interno salvo na variável quando o botão é clicado.
          </p>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={toggleButton}>
          <Plus className="h-3 w-3" /> Adicionar botão
        </Button>
      )}
    </div>
  );
}

// ── Collected Variables Bar ──
function CollectedVariablesBar({
  steps,
  currentStepIndex,
  textareaRef,
  onInsert,
}: {
  steps: StepDef[];
  currentStepIndex: number;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  onInsert: (newValue: string) => void;
}) {
  // Collect variables from previous steps
  const variables: { label: string; variable: string }[] = [];
  for (let idx = 0; idx < currentStepIndex; idx++) {
    const step = steps[idx];
    if (!step) continue;
    const varName = step.config?.variable;
    if (varName && typeof varName === "string" && varName.trim()) {
      const stepLabel = STEP_TYPES.find((s) => s.type === step.type)?.label ?? step.type;
      variables.push({
        label: `{{${varName.trim()}}}`,
        variable: `{{${varName.trim()}}}`,
      });
    }
    // Also add implicit step index variable
    if (step.type === "ask_and_wait") {
      variables.push({
        label: `{{step_${idx}}}`,
        variable: `{{step_${idx}}}`,
      });
    }
  }

  if (variables.length === 0) return null;

  const insertAtCursor = (variable: string) => {
    const el = textareaRef?.current;
    if (!el) {
      onInsert(variable);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    const newValue = before + variable + after;
    onInsert(newValue);
    setTimeout(() => {
      el.focus();
      const pos = start + variable.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Variable className="h-3 w-3" /> Variáveis disponíveis:
      </span>
      {variables.map((v, idx) => (
        <Button
          key={`${v.variable}-${idx}`}
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => insertAtCursor(v.variable)}
        >
          {v.label}
        </Button>
      ))}
    </div>
  );
}

export function InstagramAutomationEditor({ automation, accounts, onClose }: Props) {
  const { createAutomation, updateAutomation, templates } = useInstagramAutomations();
  const { data: org } = useUserOrganization();
  const { instances: whatsappInstances } = useOpenBotConfig();

  // Fetch org AI config to suggest the configured default provider/model
  const { data: orgAiConfig } = useQuery({
    queryKey: ["organization-ai-config", org?.id],
    queryFn: async () => {
      if (!org?.id) return null;
      const { data, error } = await (supabase as any)
        .from("organization_ai_configs")
        .select("provider, default_model, is_active")
        .eq("organization_id", org.id)
        .maybeSingle();
      if (error) return null;
      return data as { provider: string; default_model: string; is_active: boolean } | null;
    },
    enabled: !!org?.id,
  });

  const def = automation?.definition_json ?? { conditions: [], steps: [] };

  const [name, setName] = useState(automation?.name ?? "");
  const [description, setDescription] = useState(automation?.description ?? "");
  const [triggerType, setTriggerType] = useState(automation?.trigger_type ?? "dm_received");
  const [accountId, setAccountId] = useState(automation?.account_id ?? "");
  const [keywords, setKeywords] = useState<string>(def.conditions?.[0]?.keywords?.join(", ") ?? "");
  const [matchMode, setMatchMode] = useState<string>(def.conditions?.[0]?.match_mode ?? "contains");
  const [aiIntentDescription, setAiIntentDescription] = useState<string>(def.conditions?.[0]?.ai_intent_description ?? "");
  const [steps, setSteps] = useState<StepDef[]>(
    (def.steps ?? []).map((s: any) => ({ ...s, config: s.config ?? {}, _client_id: genClientId() }))
  );
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const dmTextareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleStep = (clientId: string) => setOpenSteps((p) => ({ ...p, [clientId]: !p[clientId] }));

  const addStep = (type: string) => {
    const newId = genClientId();
    const defaultConfig: Record<string, any> = {};
    // Pre-fill check_follower defaults
    if (type === "check_follower") {
      defaultConfig.question = "Você já me segue aqui? O sistema só libera enviar para quem é seguidor...";
      defaultConfig.button_title = "Seguindo";
      defaultConfig.reject_message = "Para receber o conteúdo, você precisa me seguir primeiro! 😊\nDepois de seguir, clique no botão abaixo.";
      defaultConfig.variable = "follower_status";
    }
    setSteps((prev) => [...prev, { type, config: defaultConfig, _client_id: newId }]);
    setOpenSteps((p) => ({ ...p, [newId]: true }));
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSteps((prev) => {
      const oldIndex = prev.findIndex((s) => s._client_id === active.id);
      const newIndex = prev.findIndex((s) => s._client_id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleFileSelect = async (stepIndex: number, file: File) => {
    if (!org?.id) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite: 16MB");
      return;
    }
    setUploadingFile(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const storagePath = `${org.id}/ig-automation/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("message-media").upload(storagePath, file);
      if (error) throw error;
      updateStepConfig(stepIndex, "file_storage_path", storagePath);
      updateStepConfig(stepIndex, "file_name", file.name);
      updateStepConfig(stepIndex, "file_type", file.type);
      toast.success("Arquivo anexado!");
      // Update org storage usage in real-time
      supabase.rpc("recalculate_org_storage", { p_org_id: org.id }).then(() => {});
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + (err.message || "erro desconhecido"));
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = (stepIndex: number) => {
    updateStepConfig(stepIndex, "file_storage_path", undefined);
    updateStepConfig(stepIndex, "file_name", undefined);
    updateStepConfig(stepIndex, "file_type", undefined);
  };

  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const updateStepConfig = (i: number, key: string, value: any) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, config: { ...s.config, [key]: value } } : s)));
  };

  const getQuickReplies = (stepIndex: number): QuickReplyButton[] => {
    const raw = steps[stepIndex]?.config?.quick_replies;
    return Array.isArray(raw) ? raw : [];
  };

  const handleSave = () => {
    if (!name.trim()) return;
    // Remove internal _client_id before saving
    const cleanSteps = steps.map(({ _client_id, ...rest }) => rest);
    const payload = {
      name,
      description: description || null,
      trigger_type: triggerType,
      account_id: accountId || null,
      definition_json: {
        conditions: (keywords.trim() || matchMode === "ai_intent")
          ? [{
              keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
              match_mode: matchMode,
              ...(matchMode === "ai_intent" ? { ai_intent_description: aiIntentDescription } : {}),
            }]
          : [],
        steps: cleanSteps,
      },
    };
    if (automation) {
      updateAutomation.mutate({ id: automation.id, ...payload }, { onSuccess: onClose });
    } else {
      createAutomation.mutate(payload, { onSuccess: onClose });
    }
  };

  const isSaving = createAutomation.isPending || updateAutomation.isPending;
  const stepLabel = (type: string) => STEP_TYPES.find((s) => s.type === type)?.label ?? type;
  const stepTooltip = (type: string) => STEP_TYPES.find((s) => s.type === type)?.tooltip;

  const stepIds = useMemo(() => steps.map((s) => s._client_id), [steps]);

  // Template dropdown helper
  const TemplateDropdown = ({ onSelect }: { onSelect: (body: string) => void }) =>
    templates.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2">
            <FileText className="h-3 w-3" /> Usar template
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[200] max-w-[250px]">
          {templates.map((t: any) => (
            <DropdownMenuItem key={t.id} onClick={() => onSelect(t.body)}>
              <span className="truncate">{t.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Captura de leads DM" className="bg-muted border-border" />
        </div>
        <div className="space-y-2">
          <Label>Conta Instagram</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
            <SelectContent className="z-[200]">
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>@{a.username ?? a.ig_user_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição da automação" className="bg-muted border-border" />
      </div>

      {/* Trigger */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm text-foreground">1. Gatilho</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <Select value={triggerType} onValueChange={setTriggerType}>
            <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[200]">
              <SelectItem value="dm_received">DM Recebida</SelectItem>
              <SelectItem value="comment_received">Comentário em Post</SelectItem>
              <SelectItem value="live_comment">Comentário em Live</SelectItem>
              <SelectItem value="reaction">Reação em Mensagem</SelectItem>
              <SelectItem value="referral">Origem de Anúncio (Referral)</SelectItem>
            </SelectContent>
          </Select>
          {TRIGGER_TOOLTIPS[triggerType] && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <HelpCircle className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
              {TRIGGER_TOOLTIPS[triggerType]}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card className="bg-card/50 border-accent/20">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm text-foreground">2. Condições</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Keywords (separadas por vírgula)</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px] text-xs z-[300]">
                      Palavras que ativam esta automação. Deixe vazio para disparar com qualquer mensagem.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="oferta, preço, info" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Modo de correspondência</Label>
              <Select value={matchMode} onValueChange={setMatchMode}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="exact">Exato</SelectItem>
                  <SelectItem value="regex">Expressão Regular</SelectItem>
                  <SelectItem value="ai_intent">Intenção por IA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {matchMode === "ai_intent" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Descreva a intenção que deseja detectar</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-xs z-[300]">
                      Descreva em linguagem natural a intenção que a IA deve identificar. Ex: "O cliente quer saber o preço ou valores do produto", "O cliente está reclamando", "O cliente quer agendar uma consulta".
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                value={aiIntentDescription}
                onChange={(e) => setAiIntentDescription(e.target.value)}
                placeholder="Ex: O cliente quer saber o preço ou valores do produto"
                className="bg-muted border-border min-h-[60px]"
                rows={2}
              />
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Zap className="h-3 w-3 mt-0.5 shrink-0 text-success" />
                A IA analisa a mensagem recebida e identifica se corresponde à intenção descrita, mesmo que o cliente use palavras diferentes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps with DnD */}
      <Card className="bg-card/50 border-secondary/20">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm text-foreground">3. Passos da Automação</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Adicionar Passo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[200]">
              {STEP_TYPES.map((st) => (
                <DropdownMenuItem key={st.type} onClick={() => addStep(st.type)}>
                  <st.icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  {st.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Adicione passos para definir o fluxo da automação.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
              {steps.map((step, i) => (
                <SortableStepItem
                  key={step._client_id}
                  step={step}
                  index={i}
                  isOpen={!!openSteps[step._client_id]}
                  onToggle={() => toggleStep(step._client_id)}
                  onRemove={() => removeStep(i)}
                  stepLabel={stepLabel(step.type)}
                  stepTooltip={stepTooltip(step.type)}
                >
                  {step.type === "reply_comment" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Modo de resposta</Label>
                        <Select
                          value={step.config.reply_mode ?? "public"}
                          onValueChange={(v) => updateStepConfig(i, "reply_mode", v)}
                        >
                          <SelectTrigger className="bg-muted border-border text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="public">Resposta Pública (comentário)</SelectItem>
                            <SelectItem value="private">Resposta Privada (DM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Mensagens (rotação aleatória)</Label>
                          <TemplateDropdown onSelect={(body) => {
                            const current = Array.isArray(step.config.messages) ? step.config.messages : [];
                            updateStepConfig(i, "messages", [...current, body]);
                          }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Adicione múltiplas mensagens. Uma será escolhida aleatoriamente a cada execução.
                        </p>
                        {(Array.isArray(step.config.messages) && step.config.messages.length > 0
                          ? step.config.messages
                          : [step.config.message ?? ""]
                        ).map((msg: string, msgIdx: number) => (
                          <div key={msgIdx} className="flex items-start gap-2">
                            <Textarea
                              value={msg}
                              onChange={(e) => {
                                const msgs = Array.isArray(step.config.messages) && step.config.messages.length > 0
                                  ? [...step.config.messages]
                                  : [step.config.message ?? ""];
                                msgs[msgIdx] = e.target.value;
                                updateStepConfig(i, "messages", msgs);
                                // Keep legacy field in sync for single message
                                if (msgs.length === 1) updateStepConfig(i, "message", e.target.value);
                              }}
                              placeholder="Digite a mensagem de resposta..."
                              rows={2}
                              className="bg-muted border-border text-sm flex-1"
                            />
                            {(Array.isArray(step.config.messages) ? step.config.messages.length : 1) > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive shrink-0 mt-1"
                                onClick={() => {
                                  const msgs = [...(step.config.messages as string[])];
                                  msgs.splice(msgIdx, 1);
                                  updateStepConfig(i, "messages", msgs);
                                  if (msgs.length === 1) updateStepConfig(i, "message", msgs[0]);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const current = Array.isArray(step.config.messages) && step.config.messages.length > 0
                              ? step.config.messages
                              : [step.config.message ?? ""];
                            updateStepConfig(i, "messages", [...current, ""]);
                          }}
                        >
                          <Plus className="h-3 w-3" /> Adicionar mensagem
                        </Button>
                      </div>
                    </div>
                  )}
                  {step.type === "send_dm" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Modo de envio</Label>
                        <Select
                          value={step.config.mode ?? "text"}
                          onValueChange={(v) => updateStepConfig(i, "mode", v)}
                        >
                          <SelectTrigger className="bg-muted border-border text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="text">Texto fixo</SelectItem>
                            <SelectItem value="ai_prompt">Resposta por IA (prompt)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(step.config.mode ?? "text") === "ai_prompt" ? (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Prompt do sistema (instruções para a IA)</Label>
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[320px] text-xs z-[300]">
                                    Defina o papel e o estilo de resposta. A IA receberá a última mensagem do usuário e gerará uma resposta dinâmica. Use variáveis <code>{"{{nome}}"}</code> para personalizar.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Textarea
                              ref={(el) => { dmTextareaRefs.current[i] = el; }}
                              value={step.config.system_prompt ?? ""}
                              onChange={(e) => updateStepConfig(i, "system_prompt", e.target.value)}
                              placeholder="Ex: Você é um atendente cordial da loja X. Responda em até 2 frases curtas, em português, e sempre convide o cliente a deixar o telefone para receber a oferta."
                              rows={4}
                              className="bg-muted border-border text-sm"
                            />
                            <CollectedVariablesBar
                              steps={steps}
                              currentStepIndex={i}
                              textareaRef={{ current: dmTextareaRefs.current[i] } as React.RefObject<HTMLTextAreaElement>}
                              onInsert={(val) => updateStepConfig(i, "system_prompt", val)}
                            />
                          </div>

                          {(() => {
                            const defaultModel = orgAiConfig?.default_model || "google/gemini-2.5-flash";
                            const currentModel = step.config.ai_model ?? defaultModel;
                            const currentProvider = currentModel.startsWith("openai/") ? "openai" : "gemini";
                            const GEMINI_MODELS = [
                              { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (rápido/barato)" },
                              { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (equilibrado)" },
                              { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (alta qualidade)" },
                            ];
                            const OPENAI_MODELS = [
                              { value: "openai/gpt-5-nano", label: "GPT-5 Nano (rápido/barato)" },
                              { value: "openai/gpt-5-mini", label: "GPT-5 Mini (equilibrado)" },
                              { value: "openai/gpt-5", label: "GPT-5 (alta qualidade)" },
                              { value: "openai/gpt-5.2", label: "GPT-5.2 (último lançamento)" },
                            ];
                            const modelOptions = currentProvider === "openai" ? OPENAI_MODELS : GEMINI_MODELS;
                            return (
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="space-y-2">
                                  <Label className="text-xs">Provedor de IA</Label>
                                  <Select
                                    value={currentProvider}
                                    onValueChange={(v) => {
                                      const fallback = v === "openai" ? "openai/gpt-5-mini" : "google/gemini-2.5-flash";
                                      updateStepConfig(i, "ai_model", fallback);
                                    }}
                                  >
                                    <SelectTrigger className="bg-muted border-border text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[200]">
                                      <SelectItem value="gemini">Google Gemini</SelectItem>
                                      <SelectItem value="openai">OpenAI</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {orgAiConfig?.default_model && (
                                    <p className="text-xs text-muted-foreground">
                                      Padrão da org: {orgAiConfig.provider}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Modelo de IA</Label>
                                  <Select
                                    value={currentModel}
                                    onValueChange={(v) => updateStepConfig(i, "ai_model", v)}
                                  >
                                    <SelectTrigger className="bg-muted border-border text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[200]">
                                      {modelOptions.map((m) => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Mensagem fallback</Label>
                                  <Input
                                    value={step.config.message ?? ""}
                                    onChange={(e) => updateStepConfig(i, "message", e.target.value)}
                                    placeholder="Se IA falhar"
                                    className="bg-muted border-border text-sm"
                                  />
                                </div>
                              </div>
                            );
                          })()}

                          <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 flex items-start gap-1.5">
                            <Zap className="h-3 w-3 mt-0.5 shrink-0 text-success" />
                            A IA gera a resposta dinamicamente com base na última mensagem do usuário e no prompt acima.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Mensagem</Label>
                              <TemplateDropdown onSelect={(body) => updateStepConfig(i, "message", body)} />
                            </div>
                            <Textarea
                              ref={(el) => { dmTextareaRefs.current[i] = el; }}
                              value={step.config.message ?? ""}
                              onChange={(e) => updateStepConfig(i, "message", e.target.value)}
                              placeholder="Digite a mensagem..."
                              rows={3}
                              className="bg-muted border-border text-sm"
                            />
                            <CollectedVariablesBar
                              steps={steps}
                              currentStepIndex={i}
                              textareaRef={{ current: dmTextareaRefs.current[i] } as React.RefObject<HTMLTextAreaElement>}
                              onInsert={(val) => updateStepConfig(i, "message", val)}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                            💡 A mensagem é enviada imediatamente sem aguardar resposta. Use variáveis de passos anteriores para personalizar.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {step.type === "ask_and_wait" && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Pergunta</Label>
                          <TemplateDropdown onSelect={(body) => updateStepConfig(i, "message", body)} />
                        </div>
                        <Textarea
                          ref={(el) => { dmTextareaRefs.current[i] = el; }}
                          value={step.config.message ?? ""}
                          onChange={(e) => updateStepConfig(i, "message", e.target.value)}
                          placeholder="Qual seu telefone?"
                          rows={2}
                          className="bg-muted border-border text-sm"
                        />
                        <CollectedVariablesBar
                          steps={steps}
                          currentStepIndex={i}
                          textareaRef={{ current: dmTextareaRefs.current[i] } as React.RefObject<HTMLTextAreaElement>}
                          onInsert={(val) => updateStepConfig(i, "message", val)}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Nome da variável</Label>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[280px] text-xs z-[300]">
                                <p className="font-medium mb-1">O que é a variável?</p>
                                <p>A resposta do usuário (texto ou botão clicado) é salva neste nome. Nos passos seguintes, use <code className="text-primary">{"{{nome_da_variavel}}"}</code> para inserir o valor coletado.</p>
                                <p className="mt-1">Ex: variável &quot;nome&quot; → use <code className="text-primary">{"{{nome}}"}</code> em mensagens posteriores.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input value={step.config.variable ?? ""} onChange={(e) => updateStepConfig(i, "variable", e.target.value)} placeholder="Ex: nome, telefone, interesse" className="bg-muted border-border text-sm" />
                        <p className="text-xs text-muted-foreground">
                          A resposta será salva como <code className="text-primary">{"{{" + (step.config.variable || "variavel") + "}}"}</code> para uso nos próximos passos.
                        </p>
                      </div>
                      <QuickReplyButtonsEditor
                        buttons={getQuickReplies(i)}
                        onChange={(btns) => updateStepConfig(i, "quick_replies", btns)}
                      />
                    </>
                  )}
                  {step.type === "check_follower" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                        <strong>Como funciona:</strong> Verifica automaticamente via API da Meta se o usuário segue sua conta (<code>is_user_follow_business</code>). Se já segue, o fluxo continua silenciosamente. Se não segue, envia um botão para o usuário clicar após seguir — ao clicar, a API verifica novamente.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Mensagem do botão</Label>
                          <TemplateDropdown onSelect={(body) => updateStepConfig(i, "question", body)} />
                        </div>
                        <Textarea
                          value={step.config.question ?? ""}
                          onChange={(e) => updateStepConfig(i, "question", e.target.value)}
                          placeholder="Você já me segue aqui? O sistema só libera enviar para quem é seguidor..."
                          rows={3}
                          className="bg-muted border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Texto do botão</Label>
                        <Input
                          value={step.config.button_title ?? "Seguindo"}
                          onChange={(e) => updateStepConfig(i, "button_title", e.target.value)}
                          placeholder="Seguindo"
                          maxLength={20}
                          className="bg-muted border-border text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Botão do tipo postback. Ao clicar, o sistema verifica via API se o usuário realmente segue.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Mensagem quando NÃO segue</Label>
                        <Textarea
                          value={step.config.reject_message ?? ""}
                          onChange={(e) => updateStepConfig(i, "reject_message", e.target.value)}
                          placeholder="Para receber o conteúdo, você precisa me seguir primeiro! 😊"
                          rows={2}
                          className="bg-muted border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Nome da variável</Label>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[250px] text-xs z-[300]">
                                Armazena &quot;true&quot; ou &quot;false&quot; indicando se o usuário segue a conta. Pode ser usada nos próximos passos.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          value={step.config.variable ?? "follower_status"}
                          onChange={(e) => updateStepConfig(i, "variable", e.target.value)}
                          placeholder="follower_status"
                          className="bg-muted border-border text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={step.config.remember_follower !== false}
                          onCheckedChange={(v) => updateStepConfig(i, "remember_follower", v)}
                        />
                        <div>
                          <Label className="text-xs">Lembrar resposta do seguidor</Label>
                          <p className="text-xs text-muted-foreground">
                            Se ativado, usuários verificados como seguidores não serão checados novamente.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {step.type === "tag_lead" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Tags (separadas por vírgula)</Label>
                      <Input value={step.config.tags ?? ""} onChange={(e) => updateStepConfig(i, "tags", e.target.value)} placeholder="interessado, instagram" className="bg-muted border-border text-sm" />
                    </div>
                  )}
                  {step.type === "openbot_start_whatsapp" && (
                    <div className="space-y-3">
                      {/* Instance selector */}
                      <div className="space-y-2">
                        <Label className="text-xs">Instância WhatsApp</Label>
                         <Select
                          value={step.config.instance_id ?? ""}
                          onValueChange={(v) => updateStepConfig(i, "instance_id", v)}
                        >
                          <SelectTrigger className="bg-muted border-border text-sm">
                            <SelectValue placeholder="Selecione a instância" />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            {whatsappInstances.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Obrigatório: selecione de qual instância sairá o disparo.</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Mensagem inicial no WhatsApp</Label>
                          <TemplateDropdown onSelect={(body) => updateStepConfig(i, "message", body)} />
                        </div>
                        <Textarea
                          ref={(el) => { dmTextareaRefs.current[i] = el; }}
                          value={step.config.message ?? ""}
                          onChange={(e) => updateStepConfig(i, "message", e.target.value)}
                          placeholder="Olá! Vi seu interesse pelo Instagram..."
                          rows={2}
                          className="bg-muted border-border text-sm"
                        />
                        <CollectedVariablesBar
                          steps={steps}
                          currentStepIndex={i}
                          textareaRef={{ current: dmTextareaRefs.current[i] } as React.RefObject<HTMLTextAreaElement>}
                          onInsert={(val) => updateStepConfig(i, "message", val)}
                        />
                      </div>
                      {/* File attachment */}
                      <div className="space-y-2">
                        <Label className="text-xs">Anexo (opcional)</Label>
                        {step.config.file_name ? (
                          <div className="flex items-center gap-2 p-2 rounded-md bg-muted border border-border min-w-0">
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs text-foreground truncate flex-1 min-w-0">{step.config.file_name}</span>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive shrink-0" onClick={() => removeFile(i)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              ref={(el) => { fileInputRefs.current[i] = el; }}
                              className="hidden"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileSelect(i, f);
                                e.target.value = "";
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              disabled={uploadingFile}
                              onClick={() => fileInputRefs.current[i]?.click()}
                            >
                              {uploadingFile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                              Anexar arquivo
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1">PDF, imagens, planilhas — máx. 16MB</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {step.type === "save_lead" && (
                    <p className="text-xs text-muted-foreground">Este passo não requer configuração adicional.</p>
                  )}
                  {step.type === "like_comment" && (
                    <p className="text-xs text-muted-foreground">Curte automaticamente o comentário que ativou a automação. Funciona apenas com gatilhos de comentário.</p>
                  )}
                  {step.type === "validate_phone" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">DDI padrão</Label>
                        <Select
                          value={step.config.default_ddi ?? "55"}
                          onValueChange={(v) => updateStepConfig(i, "default_ddi", v)}
                        >
                          <SelectTrigger className="bg-muted border-border text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="55">🇧🇷 Brasil (+55)</SelectItem>
                            <SelectItem value="54">🇦🇷 Argentina (+54)</SelectItem>
                            <SelectItem value="1">🇺🇸 EUA / Canadá (+1)</SelectItem>
                            <SelectItem value="351">🇵🇹 Portugal (+351)</SelectItem>
                            <SelectItem value="44">🇬🇧 Reino Unido (+44)</SelectItem>
                            <SelectItem value="34">🇪🇸 Espanha (+34)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Usado quando o número não inclui o código do país.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={step.config.require_confirmation === true}
                          onCheckedChange={(v) => {
                            updateStepConfig(i, "require_confirmation", v);
                            if (v) updateStepConfig(i, "send_confirmation", true);
                          }}
                        />
                        <Label className="text-xs">Aguardar confirmação antes de continuar</Label>
                      </div>
                      {step.config.require_confirmation && (
                        <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                          <div className="space-y-2">
                            <Label className="text-xs">Mensagem de confirmação</Label>
                            <Textarea
                              value={step.config.confirmation_message ?? ""}
                              onChange={(e) => updateStepConfig(i, "confirmation_message", e.target.value)}
                              placeholder="O número *{phone_formatted}* está correto? Responda *SIM* para confirmar ou *NÃO* para corrigir."
                              rows={2}
                              className="bg-muted border-border text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              Use <code className="text-primary">{"{phone_formatted}"}</code> para inserir o número formatado.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Palavras de confirmação (SIM)</Label>
                            <Input
                              value={step.config.confirmation_keywords_yes ?? ""}
                              onChange={(e) => updateStepConfig(i, "confirmation_keywords_yes", e.target.value)}
                              placeholder="sim, confirmado, ok, correto, yes"
                              className="bg-muted border-border text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Palavras de rejeição (NÃO)</Label>
                            <Input
                              value={step.config.confirmation_keywords_no ?? ""}
                              onChange={(e) => updateStepConfig(i, "confirmation_keywords_no", e.target.value)}
                              placeholder="nao, não, errado, incorreto"
                              className="bg-muted border-border text-sm"
                            />
                          </div>
                        </div>
                      )}
                      {!step.config.require_confirmation && (
                        <>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={step.config.send_confirmation === true}
                              onCheckedChange={(v) => updateStepConfig(i, "send_confirmation", v)}
                            />
                            <Label className="text-xs">Enviar confirmação ao usuário (informativo)</Label>
                          </div>
                          {step.config.send_confirmation && (
                            <div className="space-y-2">
                              <Label className="text-xs">Mensagem de confirmação</Label>
                              <Textarea
                                value={step.config.confirmation_message ?? ""}
                                onChange={(e) => updateStepConfig(i, "confirmation_message", e.target.value)}
                                placeholder="Pode confirmar se o telefone está correto? {phone_formatted}"
                                rows={2}
                                className="bg-muted border-border text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Use <code className="text-primary">{"{phone_formatted}"}</code> para inserir o número formatado.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </SortableStepItem>
              ))}
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} className="w-full" disabled={isSaving || !name.trim()}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        {automation ? "Salvar Alterações" : "Criar Automação"}
      </Button>
    </div>
  );
}
