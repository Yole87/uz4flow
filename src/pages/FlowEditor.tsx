import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  ArrowLeft, 
  Plus, 
  MessageSquare, 
  FileText, 
  Trash2,
  Loader2,
  Clock,
  Upload,
  X,
  MessageCircleQuestion,
  ChevronDown,
  Variable,
  FileInput,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { FlowWebhookConfig } from "@/components/flows/FlowWebhookConfig";
import { FlowExecutionLogs } from "@/components/flows/FlowExecutionLogs";
import { FlowCanvas } from "@/components/flows/FlowCanvas";
import { FlowAIPanel } from "@/components/flows/FlowAIPanel";
import { ConditionConfigDialog } from "@/components/flows/ConditionConfigDialog";
import { FlowToolbar } from "@/components/flows/FlowToolbar";
import { TriggerConfigDialog } from "@/components/flows/TriggerConfigDialog";
import { BlockContentDialog, type BlockContentItem } from "@/components/flows/BlockContentDialog";
import { ActiveMessageConfigDialog, type ActiveMessageConfig } from "@/components/flows/ActiveMessageConfigDialog";
import { MenuConfigDialog, type MenuConfig } from "@/components/flows/MenuConfigDialog";
import { VoiceCallConfigDialog, type VoiceCallConfig } from "@/components/flows/VoiceCallConfigDialog";
import type { FlowConnectionData } from "@/components/flows/flowCanvasUtils";

interface FlowStep {
  id: string;
  order_index: number;
  step_type: string;
  text_content: string | null;
  file_id: string | null;
  delay_ms: number;
  requires_response: boolean;
  variable_name: string | null;
  validation_type: string;
  invalid_response_message: string | null;
  step_timeout_minutes: number | null;
  accept_file_response: boolean;
  position_x?: number;
  position_y?: number;
  condition_config?: {
    variable: string;
    operator: string;
    value: string;
  } | null;
  block_contents?: any[] | null;
  tag_config?: {
    action: string;
    tags: string[];
  } | null;
  lane_config?: {
    stage_id: string;
    stage_name: string;
  } | null;
  active_message_config?: ActiveMessageConfig | null;
  random_config?: {
    splits: { percentage: number; label: string }[];
  } | null;
  delay_config?: {
    delay_seconds: number;
  } | null;
  menu_config?: MenuConfig | null;
  file?: {
    file_name: string;
    mime_type: string;
  } | null;
}

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
  schedule_enabled: boolean;
  schedule_type: string | null;
  schedule_config: any | null;
}


const VALIDATION_OPTIONS = [
  { value: "any", label: "Qualquer resposta" },
  { value: "text", label: "Apenas texto (sem números)" },
  { value: "number", label: "Apenas números" },
  { value: "email", label: "Email válido" },
  { value: "phone", label: "Telefone válido" },
];

const TIMEOUT_OPTIONS = [
  { value: "default", label: "Usar padrão do fluxo" },
  { value: "5", label: "5 minutos" },
  { value: "10", label: "10 minutos" },
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
];

const REENGAGEMENT_DELAY_OPTIONS = [
  { value: "5", label: "5 minutos" },
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "120", label: "2 horas" },
  { value: "360", label: "6 horas" },
  { value: "1440", label: "24 horas" },
];

const MAX_ATTEMPTS_OPTIONS = [
  { value: "1", label: "1 tentativa" },
  { value: "2", label: "2 tentativas" },
  { value: "3", label: "3 tentativas" },
];

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/mp3",
  "video/mp4",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
}

interface ReengagementConfig {
  id?: string;
  is_enabled: boolean;
  delay_minutes: number;
  template_id: string | null;
  custom_message: string;
  max_attempts: number;
}

export default function FlowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { data: organization } = useUserOrganization();
  
  const [flow, setFlow] = useState<Flow | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  const [uploading, setUploading] = useState(false);
  const [responseConfigOpen, setResponseConfigOpen] = useState(false);
  const [conditionDialogOpen, setConditionDialogOpen] = useState(false);
  const [editingConditionStep, setEditingConditionStep] = useState<FlowStep | null>(null);
  const [connections, setConnections] = useState<FlowConnectionData[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [routingRules, setRoutingRules] = useState<{ match_type: string; match_value: string }[]>([]);
  const [hasRuleConflicts, setHasRuleConflicts] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlockStep, setEditingBlockStep] = useState<FlowStep | null>(null);
  const [endNodeDialogOpen, setEndNodeDialogOpen] = useState(false);
  const [editingEndStep, setEditingEndStep] = useState<FlowStep | null>(null);
  const [endFinalMessage, setEndFinalMessage] = useState("");
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTagStep, setEditingTagStep] = useState<FlowStep | null>(null);
  const [tagAction, setTagAction] = useState<"add" | "remove">("add");
  const [tagInput, setTagInput] = useState("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [laneDialogOpen, setLaneDialogOpen] = useState(false);
  const [editingLaneStep, setEditingLaneStep] = useState<FlowStep | null>(null);
  const [laneStageId, setLaneStageId] = useState("");
  const [pipelineStages, setPipelineStages] = useState<{ id: string; name: string; pipeline_name: string }[]>([]);
  const [activeMessageDialogOpen, setActiveMessageDialogOpen] = useState(false);
  const [editingActiveMessageStep, setEditingActiveMessageStep] = useState<FlowStep | null>(null);
  const [randomDialogOpen, setRandomDialogOpen] = useState(false);
  const [editingRandomStep, setEditingRandomStep] = useState<FlowStep | null>(null);
  const [randomSplits, setRandomSplits] = useState<{ percentage: number; label: string }[]>([]);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [editingDelayStep, setEditingDelayStep] = useState<FlowStep | null>(null);
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [editingMenuStep, setEditingMenuStep] = useState<FlowStep | null>(null);
  const [voiceCallDialogOpen, setVoiceCallDialogOpen] = useState(false);
  const [editingVoiceCallStep, setEditingVoiceCallStep] = useState<FlowStep | null>(null);
  const [savingVoiceCall, setSavingVoiceCall] = useState(false);
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Form state
  const [stepType, setStepType] = useState<"text" | "file">("text");
  const [textContent, setTextContent] = useState("");
  const [delayValue, setDelayValue] = useState("0");
  const [delayUnit, setDelayUnit] = useState<"seconds" | "minutes">("seconds");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  
  // Response configuration state
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [variableName, setVariableName] = useState("");
  const [validationType, setValidationType] = useState("any");
  const [invalidResponseMessage, setInvalidResponseMessage] = useState("");
  const [stepTimeoutMinutes, setStepTimeoutMinutes] = useState("");
  const [acceptFileResponse, setAcceptFileResponse] = useState(false);

  // Auto-reengagement state
  const [reengagementConfig, setReengagementConfig] = useState<ReengagementConfig>({
    is_enabled: false,
    delay_minutes: 30,
    template_id: null,
    custom_message: "",
    max_attempts: 1,
  });
  const [reengagementConfigOpen, setReengagementConfigOpen] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [savingReengagement, setSavingReengagement] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);

  useEffect(() => {
    if (!effectiveUserId || !id) return;
    fetchFlowAndSteps();
    fetchMessageTemplates();
    fetchReengagementConfig();
    fetchPipelineStages();
    fetchRoutingRules();
  }, [effectiveUserId, id]);

  async function fetchRoutingRules() {
    if (!id || !effectiveUserId) return;
    try {
      // Fetch this flow's rules
      const { data } = await supabase
        .from("routing_rules")
        .select("match_type, match_value")
        .eq("flow_id", id)
        .eq("is_active", true);
      setRoutingRules(data || []);

      // Check for keyword conflicts with other flows
      const myKeywords = (data || [])
        .filter((r) => r.match_type === "keyword" && r.match_value)
        .flatMap((r) => r.match_value!.split(",").map((k) => k.trim().toLowerCase()))
        .filter(Boolean);

      if (myKeywords.length > 0) {
        const { data: otherRules } = await supabase
          .from("routing_rules")
          .select("match_value")
          .eq("user_id", effectiveUserId!)
          .neq("flow_id", id)
          .eq("is_active", true)
          .eq("match_type", "keyword");

        const otherKeywords = (otherRules || [])
          .flatMap((r) => (r.match_value || "").split(",").map((k: string) => k.trim().toLowerCase()))
          .filter(Boolean);

        const hasConflict = myKeywords.some((kw) => otherKeywords.includes(kw));
        setHasRuleConflicts(hasConflict);
      } else {
        setHasRuleConflicts(false);
      }
    } catch (e) {
      console.error("Error fetching routing rules:", e);
    }
  }

  async function fetchPipelineStages() {
    try {
      const orgId = await supabase.rpc("get_user_organization_id", { _user_id: effectiveUserId! });
      if (!orgId.data) return;
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("organization_id", orgId.data);
      if (!pipelines) return;
      const pipelineIds = pipelines.map((p: any) => p.id);
      const { data: stages } = await supabase
        .from("stages")
        .select("id, name, pipeline_id, order_index")
        .in("pipeline_id", pipelineIds)
        .order("order_index", { ascending: true });
      if (!stages) return;
      const pMap = new Map(pipelines.map((p: any) => [p.id, p.name]));
      setPipelineStages(
        (stages as any[]).map((s) => ({
          id: s.id,
          name: s.name,
          pipeline_name: pMap.get(s.pipeline_id) || "",
        }))
      );
    } catch (err) {
      console.error("Error fetching pipeline stages:", err);
    }
  }

  async function fetchMessageTemplates() {
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, name, content, category")
        .or(`user_id.eq.${effectiveUserId!},is_default.eq.true`)
        .eq("category", "reengajamento")
        .order("name");

      if (error) throw error;
      setMessageTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  }

  async function fetchReengagementConfig() {
    try {
      const { data, error } = await supabase
        .from("auto_reengagement_config")
        .select("id, is_enabled, delay_minutes, template_id, custom_message, max_attempts")
        .eq("flow_id", id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setReengagementConfig({
          id: data.id,
          is_enabled: data.is_enabled,
          delay_minutes: data.delay_minutes,
          template_id: data.template_id,
          custom_message: data.custom_message || "",
          max_attempts: data.max_attempts,
        });
        setUseTemplate(!!data.template_id);
        if (data.is_enabled) {
          setReengagementConfigOpen(true);
        }
      }
    } catch (error) {
      console.error("Error fetching reengagement config:", error);
    }
  }

  async function saveReengagementConfig() {
    if (!flow || !user) return;
    
    if (reengagementConfig.is_enabled) {
      if (useTemplate && !reengagementConfig.template_id) {
        toast.error("Selecione um template de mensagem");
        return;
      }
      if (!useTemplate && !reengagementConfig.custom_message.trim()) {
        toast.error("Digite a mensagem de reengajamento");
        return;
      }
    }

    try {
      setSavingReengagement(true);

      const configData = {
        flow_id: id,
        user_id: effectiveUserId!,
        is_enabled: reengagementConfig.is_enabled,
        delay_minutes: reengagementConfig.delay_minutes,
        template_id: useTemplate ? reengagementConfig.template_id : null,
        custom_message: useTemplate ? null : reengagementConfig.custom_message.trim() || null,
        max_attempts: reengagementConfig.max_attempts,
      };

      if (reengagementConfig.id) {
        const { error } = await supabase
          .from("auto_reengagement_config")
          .update(configData)
          .eq("id", reengagementConfig.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("auto_reengagement_config")
          .insert(configData)
          .select("id")
          .single();

        if (error) throw error;
        setReengagementConfig(prev => ({ ...prev, id: data.id }));
      }

      toast.success("Configuração de reengajamento salva!");
    } catch (error) {
      console.error("Error saving reengagement config:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSavingReengagement(false);
    }
  }

  async function fetchFlowAndSteps() {
    try {
      // Fetch flow with new fields
      const { data: flowData, error: flowError } = await supabase
        .from("flows")
        .select("id, name, description, is_active, is_default, is_interactive, session_timeout_minutes, timeout_action, timeout_message, schedule_enabled, schedule_type, schedule_config")
        .eq("id", id)
        .eq("user_id", effectiveUserId!)
        .single();

      if (flowError) throw flowError;
      setFlow(flowData);

      // Fetch steps with new fields
      const { data: stepsData, error: stepsError } = await supabase
        .from("flow_steps")
        .select(`
          id,
          order_index,
          step_type,
          text_content,
          file_id,
          delay_ms,
          requires_response,
          variable_name,
          validation_type,
          invalid_response_message,
          step_timeout_minutes,
          accept_file_response,
          position_x,
          position_y,
          condition_config,
           block_contents,
           end_config,
           tag_config,
           lane_config,
           active_message_config,
           random_config,
           delay_config,
           menu_config,
           file:files(file_name, mime_type)
        `)
        .eq("flow_id", id)
        .order("order_index", { ascending: true });

      if (stepsError) throw stepsError;
      setSteps((stepsData || []) as unknown as FlowStep[]);

      // Fetch connections
      const { data: connData, error: connError } = await supabase
        .from("flow_connections")
        .select("id, source_step_id, target_step_id, source_handle, label")
        .eq("flow_id", id!);

      if (connError) throw connError;
      setConnections((connData || []) as FlowConnectionData[]);
    } catch (error) {
      console.error("Error fetching flow:", error);
      toast.error("Erro ao carregar fluxo");
      navigate("/flows");
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setStepType("text");
    setTextContent("");
    setDelayValue("0");
    setDelayUnit("seconds");
    setSelectedFile(null);
    setUploadedFileId(null);
    setUploadedFileName("");
    setEditingStep(null);
    // Reset response config
    setRequiresResponse(false);
    setVariableName("");
    setValidationType("any");
    setInvalidResponseMessage("");
    setStepTimeoutMinutes("default");
    setAcceptFileResponse(false);
    setResponseConfigOpen(false);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (step: FlowStep) => {
    setEditingStep(step);
    setStepType(step.step_type as "text" | "file");
    setTextContent(step.text_content || "");
    if (step.delay_ms >= 60000 && step.delay_ms % 60000 === 0) {
      setDelayValue((step.delay_ms / 60000).toString());
      setDelayUnit("minutes");
    } else {
      setDelayValue((step.delay_ms / 1000).toString());
      setDelayUnit("seconds");
    }
    if (step.file_id && step.file) {
      setUploadedFileId(step.file_id);
      setUploadedFileName(step.file.file_name);
    }
    // Load response config
    setRequiresResponse(step.requires_response);
    setVariableName(step.variable_name || "");
    setValidationType(step.validation_type || "any");
    setInvalidResponseMessage(step.invalid_response_message || "");
    setStepTimeoutMinutes(step.step_timeout_minutes?.toString() || "default");
    setAcceptFileResponse(step.accept_file_response);
    setResponseConfigOpen(step.requires_response);
    setDialogOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB)");
      return;
    }

    if (!organization?.id) {
      toast.error("Organização não encontrada");
      return;
    }

    try {
      setUploading(true);
      const filePath = `${organization.id}/${Date.now()}-${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("flow-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create file record
      const { data: fileData, error: fileError } = await supabase
        .from("files")
        .insert({
          user_id: effectiveUserId!,
          organization_id: organization.id,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: filePath,
        })
        .select()
        .single();

      if (fileError) throw fileError;

      setUploadedFileId(fileData.id);
      setUploadedFileName(file.name);
      setSelectedFile(null);
      toast.success("Arquivo enviado!");
      // Update org storage usage
      supabase.rpc("recalculate_org_storage", { p_org_id: organization.id }).then(() => {});
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveStep = async () => {
    if (stepType === "text" && !textContent.trim()) {
      toast.error("Informe o conteúdo da mensagem");
      return;
    }

    if (stepType === "file" && !uploadedFileId) {
      toast.error("Selecione um arquivo");
      return;
    }

    if (requiresResponse && !variableName.trim()) {
      toast.error("Informe o nome da variável para salvar a resposta");
      return;
    }

    try {
      setSaving(true);

      const stepData = {
        step_type: stepType,
        text_content: stepType === "text" ? textContent : null,
        file_id: stepType === "file" ? uploadedFileId : null,
        delay_ms: (parseInt(delayValue) || 0) * (delayUnit === "minutes" ? 60000 : 1000),
        requires_response: requiresResponse,
        variable_name: requiresResponse ? variableName.trim() : null,
        validation_type: requiresResponse ? validationType : "any",
        invalid_response_message: requiresResponse && invalidResponseMessage.trim() ? invalidResponseMessage.trim() : null,
        step_timeout_minutes: requiresResponse && stepTimeoutMinutes && stepTimeoutMinutes !== "default" ? parseInt(stepTimeoutMinutes) : null,
        accept_file_response: requiresResponse ? acceptFileResponse : false,
      };

      if (editingStep) {
        const { error } = await supabase
          .from("flow_steps")
          .update(stepData)
          .eq("id", editingStep.id);

        if (error) throw error;
        toast.success("Etapa atualizada!");
      } else {
        const newOrder = steps.length;
        // Calculate position for new node below the last one
        const lastStep = steps[steps.length - 1];
        const newPosX = lastStep?.position_x ?? 250;
        const newPosY = (lastStep?.position_y ?? -180) + 180;

        const { error } = await supabase
          .from("flow_steps")
          .insert({
            flow_id: id,
            order_index: newOrder,
            position_x: newPosX,
            position_y: newPosY,
            ...stepData,
          });

        if (error) throw error;
        toast.success("Etapa adicionada!");
      }

      setDialogOpen(false);
      resetForm();
      fetchFlowAndSteps();
    } catch (error) {
      console.error("Error saving step:", error);
      toast.error("Erro ao salvar etapa");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (step: FlowStep) => {
    if (!confirm("Excluir esta etapa?")) return;

    try {
      // Delete orphan connections first
      await supabase
        .from("flow_connections")
        .delete()
        .or(`source_step_id.eq.${step.id},target_step_id.eq.${step.id}`);

      const { error } = await supabase
        .from("flow_steps")
        .delete()
        .eq("id", step.id);

      if (error) throw error;

      // Reorder remaining steps
      const remaining = steps.filter(s => s.id !== step.id);
      for (let i = 0; i < remaining.length; i++) {
        await supabase
          .from("flow_steps")
          .update({ order_index: i })
          .eq("id", remaining[i].id);
      }

      toast.success("Etapa excluída");
      fetchFlowAndSteps();
    } catch (error) {
      console.error("Error deleting step:", error);
      toast.error("Erro ao excluir etapa");
    }
  };

  const handleAddConditionNode = async () => {
    try {
      setSaving(true);
      const newOrder = steps.length;
      const lastStep = steps[steps.length - 1];
      const newPosX = (lastStep?.position_x ?? 250) + 320;
      const newPosY = lastStep?.position_y ?? 0;

      const { error } = await supabase
        .from("flow_steps")
        .insert({
          flow_id: id,
          order_index: newOrder,
          step_type: "condition",
          text_content: null,
          delay_ms: 0,
          requires_response: false,
          position_x: newPosX,
          position_y: newPosY,
          condition_config: { variable: "", operator: "equals", value: "" },
        });

      if (error) throw error;
      toast.success("Nó condicional adicionado!");
      fetchFlowAndSteps();
    } catch (error) {
      console.error("Error adding condition:", error);
      toast.error("Erro ao adicionar condição");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCondition = async (config: { variable: string; operator: string; value: string }) => {
    if (!editingConditionStep) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("flow_steps")
        .update({ condition_config: config as any })
        .eq("id", editingConditionStep.id);

      if (error) throw error;
      toast.success("Condição salva!");
      setConditionDialogOpen(false);
      setEditingConditionStep(null);
      fetchFlowAndSteps();
    } catch (error) {
      console.error("Error saving condition:", error);
      toast.error("Erro ao salvar condição");
    } finally {
      setSaving(false);
    }
  };

  const handleTestFlow = useCallback(() => {
    if (steps.length === 0) return;
    setIsTesting(true);

    // Build adjacency from connections (supports multiple outgoing per node via "default" handle)
    const adj = new Map<string, string>();
    for (const c of connections) {
      // Prefer "default" handle for standard traversal
      if (c.source_handle === "default" || c.source_handle === "true") {
        if (!adj.has(c.source_step_id)) adj.set(c.source_step_id, c.target_step_id);
      }
    }
    // Fill remaining from any handle
    for (const c of connections) {
      if (!adj.has(c.source_step_id)) adj.set(c.source_step_id, c.target_step_id);
    }

    // Find root: prefer lowest order_index node without incoming, fallback to lowest order_index
    const hasIncoming = new Set<string>();
    for (const c of connections) hasIncoming.add(c.target_step_id);
    const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
    const root = sortedSteps.find((s) => !hasIncoming.has(s.id))?.id || sortedSteps[0]?.id;

    // Build ordered path with cycle protection (allow revisiting up to 2x for visual feedback)
    const path: string[] = [];
    const visitCount = new Map<string, number>();
    let current: string | undefined = root;
    const MAX_SIM_STEPS = steps.length * 2 + 5; // generous limit
    while (current && path.length < MAX_SIM_STEPS) {
      const count = visitCount.get(current) || 0;
      if (count >= 2) {
        // Already visited twice — cycle detected, stop
        break;
      }
      visitCount.set(current, count + 1);
      path.push(current);
      current = adj.get(current);
    }

    let idx = 0;
    const advance = () => {
      if (idx >= path.length) {
        setIsTesting(false);
        const hasCycle = current !== undefined;
        toast.success(hasCycle ? "Simulação concluída (loop detectado)" : "Simulação concluída!");
        document.querySelectorAll(".flow-node-active").forEach((el) => el.classList.remove("flow-node-active"));
        return;
      }

      document.querySelectorAll(".flow-node-active").forEach((el) => el.classList.remove("flow-node-active"));

      const nodeEl = document.querySelector(`[data-id="${path[idx]}"]`);
      if (nodeEl) nodeEl.classList.add("flow-node-active");

      const step = steps.find((s) => s.id === path[idx]);
      if (step) {
        const preview = step.text_content
          ? step.text_content.substring(0, 80) + (step.text_content.length > 80 ? "..." : "")
          : step.step_type === "condition"
          ? "Condição avaliada → Sim"
          : step.step_type === "block"
          ? "Bloco de conteúdo"
          : step.step_type === "end"
          ? "🛑 Fluxo finalizado (desativarFluxo: true)"
          : step.step_type === "tag"
          ? `🏷 ${(step.tag_config?.action === "remove" ? "Remover" : "Adicionar")} tags: ${(step.tag_config?.tags || []).join(", ") || "(vazio)"}`
           : step.step_type === "lane"
           ? `📋 Mover para: ${step.lane_config?.stage_name || "(não configurado)"}`
           : step.step_type === "active_message"
           ? `📤 Mensagem Ativa: ${(step.active_message_config?.filter_tags?.length || 0) + (step.active_message_config?.recipients?.length || 0)} destinatários, ${step.active_message_config?.content_items?.length || 0} itens`
           : step.step_type === "random"
           ? `🎲 Aleatório: ${(step.random_config?.splits || []).map(s => `${s.label} ${s.percentage}%`).join(", ") || "(não configurado)"}`
           : step.step_type === "delay"
           ? `⏳ Intervalo: ${step.delay_config?.delay_seconds || 0}s`
           : step.step_type === "menu"
           ? `📋 Menu: ${(step.menu_config?.options?.filter(o => o.trim()) || []).length} opções — aguardando resposta`
           : `Etapa ${step.step_type}`;
        toast.info(`▶ Etapa ${idx + 1}: ${preview}`);

        // If this is an end node, stop the simulation
        if (step.step_type === "end") {
          idx++;
          setTimeout(() => {
            setIsTesting(false);
            toast.success("Simulação concluída — fluxo encerrado pelo nó Fim");
            document.querySelectorAll(".flow-node-active").forEach((el) => el.classList.remove("flow-node-active"));
          }, 1500);
          return;
        }
      }

      idx++;
      testTimerRef.current = setTimeout(advance, 1500);
    };

    advance();
  }, [steps, connections]);

  if (loading) {
    return (
      <AppLayout title="Carregando..." description="">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!flow) {
    return null;
  }

  return (
    <AppLayout 
      title={flow.name} 
      description={flow.description || "Gerencie as etapas deste fluxo"}
    >
      <div className="space-y-6 animate-fade-in min-w-0 max-w-full overflow-hidden">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate("/flows")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para fluxos
        </Button>

        {/* Interactive flow indicator */}
        {flow.is_interactive && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 flex-wrap">
                <MessageCircleQuestion className="h-5 w-5 text-primary" />
                <span className="font-medium">Fluxo Interativo</span>
                <Badge variant="secondary">Timeout: {flow.session_timeout_minutes} min</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Este fluxo pode coletar respostas dos usuários e salvar dados.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Flow Canvas */}
        <div className="space-y-4">
          <FlowCanvas
              steps={steps}
              connections={connections}
              flowId={flow.id}
              onTriggerClick={() => setTriggerDialogOpen(true)}
              triggerData={{
                scheduleEnabled: flow.schedule_enabled,
                scheduleType: flow.schedule_type,
                scheduleConfig: flow.schedule_config,
                isDefault: flow.is_default,
                routingRules,
                hasConflicts: hasRuleConflicts,
              }}
              aiPanelSlot={
                <FlowAIPanel
                  open={aiPanelOpen}
                  onClose={() => setAiPanelOpen(false)}
                  flowId={flow.id}
                  onFlowApplied={() => fetchFlowAndSteps()}
                />
              }
              toolbarSlot={
                <div className="flex items-center gap-2">
                  <FlowToolbar
                    flowId={flow.id}
                    flowName={flow.name}
                    steps={steps}
                    onImportComplete={() => fetchFlowAndSteps()}
                    onTestFlow={handleTestFlow}
                    isTesting={isTesting}
                  />
                  <div className="w-px h-6 bg-border/50" />
                  <Button
                    size="sm"
                    className={`h-8 text-xs ${aiPanelOpen ? "bg-violet-600 hover:bg-violet-700" : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90"} text-white`}
                    onClick={() => setAiPanelOpen((v) => !v)}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    IA
                  </Button>
                </div>
              }
              onNodeClick={(stepId) => {
                if (stepId === "__trigger__") return; // handled by TriggerNode onClick
                const step = steps.find((s) => s.id === stepId);
                if (step) {
                  if (step.step_type === "condition") {
                    setEditingConditionStep(step);
                    setConditionDialogOpen(true);
                  } else if (step.step_type === "block") {
                    setEditingBlockStep(step);
                    setBlockDialogOpen(true);
                  } else if (step.step_type === "end") {
                    setEditingEndStep(step);
                    setEndFinalMessage((step as any).end_config?.final_message || "");
                    setEndNodeDialogOpen(true);
                  } else if (step.step_type === "tag") {
                    setEditingTagStep(step);
                    setTagAction((step.tag_config?.action as "add" | "remove") || "add");
                    setTagList(step.tag_config?.tags || []);
                    setTagInput("");
                    setTagDialogOpen(true);
                  } else if (step.step_type === "lane") {
                    setEditingLaneStep(step);
                    setLaneStageId(step.lane_config?.stage_id || "");
                    setLaneDialogOpen(true);
                  } else if (step.step_type === "active_message") {
                    setEditingActiveMessageStep(step);
                    setActiveMessageDialogOpen(true);
                  } else if (step.step_type === "random") {
                    setEditingRandomStep(step);
                    setRandomSplits(step.random_config?.splits || [{ percentage: 50, label: "A" }, { percentage: 50, label: "B" }]);
                    setRandomDialogOpen(true);
                  } else if (step.step_type === "delay") {
                    setEditingDelayStep(step);
                    setDelaySeconds(step.delay_config?.delay_seconds || 5);
                    setDelayDialogOpen(true);
                  } else if (step.step_type === "menu") {
                    setEditingMenuStep(step);
                    setMenuDialogOpen(true);
                  } else if (step.step_type === "voice_call") {
                    setEditingVoiceCallStep(step);
                    setVoiceCallDialogOpen(true);
                  } else {
                    openEditDialog(step);
                  }
                }
              }}
              onAddStep={openAddDialog}
              onAddCondition={flow.is_interactive ? handleAddConditionNode : undefined}
              onDeleteStep={(stepId) => {
                const step = steps.find((s) => s.id === stepId);
                if (step) handleDeleteStep(step);
              }}
              onConnectionsChange={() => fetchFlowAndSteps()}
              onDropNewNode={async (type, position) => {
                if (type === "condition") {
                  if (!flow.is_interactive) {
                    toast.error("Ative o modo interativo para usar condições");
                    return;
                  }
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "condition",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      condition_config: { variable: "", operator: "equals", value: "" },
                    });
                    toast.success("Condição adicionada!");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "block") {
                  try {
                    setSaving(true);
                    const { error: blockErr } = await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "block",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      block_contents: [],
                    });
                    if (blockErr) {
                      console.error("Block insert error:", blockErr);
                      toast.error("Erro ao adicionar bloco");
                      return;
                    }
                    toast.success("Bloco adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "end") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "end",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      end_config: { final_message: "" },
                    });
                    toast.success("Nó de fim adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "tag") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "tag",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      tag_config: { action: "add", tags: [] },
                    });
                    toast.success("Nó de tag adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "lane") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "lane",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      lane_config: { stage_id: "", stage_name: "" },
                    });
                    toast.success("Nó de lane adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "active_message") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "active_message",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      active_message_config: { instance_id: "", filter_tags: [], recipients: [], content_items: [] },
                    });
                    toast.success("Mensagem ativa adicionada! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "random") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "random",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      random_config: { splits: [{ percentage: 50, label: "A" }, { percentage: 50, label: "B" }] },
                    });
                    toast.success("Nó aleatório adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "delay") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "delay",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      delay_config: { delay_seconds: 5 },
                    });
                    toast.success("Nó de intervalo adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "menu") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "menu",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      menu_config: { message: "", menu_type: "numbered", options: ["", "", ""], error_enabled: false, error_message: "Opção inválida. Digite o número correspondente." },
                    });
                    toast.success("Menu adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else if (type === "voice_call") {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: "voice_call",
                      text_content: null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                      voice_config: {
                        label: "Chamada Voice AI",
                        script: "",
                        voice_id: "pFZP5JQG7iQjIQuC4Bku",
                        max_duration_seconds: 120,
                        allowed_hours: { start: "09:00", end: "18:00", tz: "America/Sao_Paulo" },
                        max_attempts: 1,
                        retry_interval_minutes: 60,
                      },
                    });
                    toast.success("Nó Voice AI adicionado! Clique para configurar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                } else {
                  try {
                    setSaving(true);
                    await supabase.from("flow_steps").insert({
                      flow_id: id,
                      order_index: steps.length,
                      step_type: type,
                      text_content: type === "text" ? "" : null,
                      delay_ms: 0,
                      requires_response: false,
                      position_x: position.x,
                      position_y: position.y,
                    });
                    toast.success("Etapa adicionada! Clique para editar.");
                    fetchFlowAndSteps();
                  } finally {
                    setSaving(false);
                  }
                }
              }}
            />
        </div>

        {/* Info card */}
        {steps.length > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground break-words">
                💡 <strong>Dica:</strong> A última etapa do fluxo enviará automaticamente{" "}
                <code className="bg-muted px-1 rounded">desativarFluxo: true</code> ao Sistema de WhatsApp AI
                {flow.is_interactive && " (exceto se aguardar resposta)"}.
                <br />
                Variáveis disponíveis: <code>{"{{pushName}}"}</code>, <code>{"{{chatId}}"}</code>, <code>{"{{instanceId}}"}</code>
                {flow.is_interactive && steps.some(s => s.variable_name) && (
                  <>
                    , e as variáveis coletadas: {steps.filter(s => s.variable_name).map(s => (
                      <code key={s.id}>{`{{${s.variable_name}}}`}</code>
                    )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ", ", curr], [] as React.ReactNode[])}
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Logs de Execução */}
        {flow && effectiveUserId && (
          <FlowExecutionLogs flowId={flow.id} userId={effectiveUserId} />
        )}

        {/* Reengajamento Automático */}
        {flow.is_interactive && (
          <Card>
            <Collapsible open={reengagementConfigOpen} onOpenChange={setReengagementConfigOpen}>
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Reengajamento Automático</CardTitle>
                      {reengagementConfig.is_enabled && (
                        <Badge variant="secondary" className="ml-2">Ativo</Badge>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${reengagementConfigOpen ? "rotate-180" : ""}`} />
                  </div>
                </CollapsibleTrigger>
                <CardDescription>
                  Enviar mensagem automaticamente após timeout de sessão
                </CardDescription>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Label htmlFor="reengagement-enabled" className="font-medium">Ativar reengajamento automático</Label>
                      <p className="text-xs text-muted-foreground">
                        Quando uma sessão expirar, uma mensagem será agendada
                      </p>
                    </div>
                    <Switch
                      id="reengagement-enabled"
                      checked={reengagementConfig.is_enabled}
                      onCheckedChange={(checked) => setReengagementConfig(prev => ({ ...prev, is_enabled: checked }))}
                    />
                  </div>

                  {reengagementConfig.is_enabled && (
                    <>
                      <div className="space-y-2">
                        <Label>Enviar após</Label>
                        <Select 
                          value={reengagementConfig.delay_minutes.toString()} 
                          onValueChange={(v) => setReengagementConfig(prev => ({ ...prev, delay_minutes: parseInt(v) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REENGAGEMENT_DELAY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Tempo após o timeout da sessão para enviar a mensagem
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de mensagem</Label>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="message-type"
                              checked={!useTemplate}
                              onChange={() => setUseTemplate(false)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">Mensagem personalizada</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="message-type"
                              checked={useTemplate}
                              onChange={() => setUseTemplate(true)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">Usar template</span>
                          </label>
                        </div>
                      </div>

                      {useTemplate ? (
                        <div className="space-y-2">
                          <Label>Template de mensagem</Label>
                          <Select 
                            value={reengagementConfig.template_id || ""} 
                            onValueChange={(v) => setReengagementConfig(prev => ({ ...prev, template_id: v || null }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um template" />
                            </SelectTrigger>
                            <SelectContent>
                              {messageTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {messageTemplates.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Nenhum template de reengajamento encontrado.{" "}
                              <button 
                                type="button" 
                                onClick={() => navigate("/templates")}
                                className="text-primary hover:underline"
                              >
                                Criar template
                              </button>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="custom-message">Mensagem personalizada</Label>
                          <Textarea
                            id="custom-message"
                            placeholder="Olá {{pushName}}! Notamos que você não concluiu o cadastro. Podemos ajudar?"
                            value={reengagementConfig.custom_message}
                            onChange={(e) => setReengagementConfig(prev => ({ ...prev, custom_message: e.target.value }))}
                            rows={3}
                          />
                          <div className="flex flex-wrap gap-1">
                            {["pushName", "chatId", ...steps.filter(s => s.variable_name).map(s => s.variable_name!)].map((v) => (
                              <Badge 
                                key={v} 
                                variant="outline" 
                                className="cursor-pointer hover:bg-muted text-xs"
                                onClick={() => setReengagementConfig(prev => ({ 
                                  ...prev, 
                                  custom_message: prev.custom_message + `{{${v}}}` 
                                }))}
                              >
                                {`{{${v}}}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Máximo de tentativas</Label>
                        <Select 
                          value={reengagementConfig.max_attempts.toString()} 
                          onValueChange={(v) => setReengagementConfig(prev => ({ ...prev, max_attempts: parseInt(v) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MAX_ATTEMPTS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        onClick={saveReengagementConfig} 
                        disabled={savingReengagement}
                        className="w-full"
                      >
                        {savingReengagement && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Salvar Configuração
                      </Button>
                    </>
                  )}

                  {!reengagementConfig.is_enabled && reengagementConfig.id && (
                    <Button 
                      onClick={saveReengagementConfig} 
                      disabled={savingReengagement}
                      variant="outline"
                      className="w-full"
                    >
                      {savingReengagement && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Desativar Reengajamento
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Webhook de Conclusão */}
        {flow && effectiveUserId && steps.length > 0 && (
          <FlowWebhookConfig
            flowId={flow.id}
            userId={effectiveUserId}
            availableVariables={steps.filter(s => s.variable_name).map(s => s.variable_name!)}
          />
        )}
      </div>

      {/* Add/Edit Step Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStep ? "Editar Etapa" : "Adicionar Etapa"}</DialogTitle>
            <DialogDescription>
              Configure o tipo e conteúdo da etapa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step Type */}
            <div className="space-y-2">
              <Label>Tipo de etapa</Label>
              <Select value={stepType} onValueChange={(v) => setStepType(v as "text" | "file")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Mensagem de texto
                    </div>
                  </SelectItem>
                  <SelectItem value="file">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Enviar arquivo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content based on type */}
            {stepType === "text" ? (
              <div className="space-y-2">
                <Label htmlFor="text-content">Conteúdo da mensagem</Label>
                <Textarea
                  id="text-content"
                  placeholder="Digite sua mensagem...
Use {{pushName}} para o nome do contato
Use {{chatId}} para o número"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={4}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Arquivo</Label>
                {uploadedFileId ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <span className="flex-1 min-w-0 break-words">{uploadedFileName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setUploadedFileId(null);
                        setUploadedFileName("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.mp4,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        {uploading ? (
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        ) : (
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {uploading ? "Enviando..." : "Clique para selecionar um arquivo"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          PDF, JPG, PNG, MP3, MP4, DOC (máx 10MB)
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Delay */}
            <div className="space-y-2">
              <Label>Delay antes de enviar</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="number"
                  min={0}
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  className="flex-1 min-w-0"
                  placeholder="0"
                />
                <Select value={delayUnit} onValueChange={(v: "seconds" | "minutes") => setDelayUnit(v)}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Segundos</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(parseInt(delayValue) || 0) === 0 && (
                <p className="text-xs text-muted-foreground">Sem delay — envio imediato</p>
              )}
            </div>

            {/* Response Configuration - Collapsible */}
            {flow.is_interactive && (
              <Collapsible open={responseConfigOpen} onOpenChange={setResponseConfigOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" type="button">
                    <div className="flex items-center gap-2">
                      <MessageCircleQuestion className="h-4 w-4" />
                      Configuração de Resposta
                      {requiresResponse && (
                        <Badge variant="secondary" className="ml-2">Ativo</Badge>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${responseConfigOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Requires Response Toggle */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Label htmlFor="requires-response" className="font-medium">Aguardar resposta do usuário</Label>
                      <p className="text-xs text-muted-foreground">
                        O fluxo pausará e aguardará o usuário responder
                      </p>
                    </div>
                    <Switch
                      id="requires-response"
                      checked={requiresResponse}
                      onCheckedChange={setRequiresResponse}
                    />
                  </div>

                  {requiresResponse && (
                    <>
                      {/* Variable Name */}
                      <div className="space-y-2">
                        <Label htmlFor="variable-name">Nome da variável *</Label>
                        <Input
                          id="variable-name"
                          placeholder="Ex: nome, idade, email"
                          value={variableName}
                          onChange={(e) => setVariableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use nas próximas etapas como <code>{`{{${variableName || "variavel"}}}`}</code>
                        </p>
                      </div>

                      {/* Validation Type */}
                      <div className="space-y-2">
                        <Label>Tipo de validação</Label>
                        <Select value={validationType} onValueChange={setValidationType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VALIDATION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Accept File Response */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <Label htmlFor="accept-file" className="font-medium">Aceitar arquivo como resposta</Label>
                          <p className="text-xs text-muted-foreground">
                            Permite que o usuário envie arquivos
                          </p>
                        </div>
                        <Switch
                          id="accept-file"
                          checked={acceptFileResponse}
                          onCheckedChange={setAcceptFileResponse}
                        />
                      </div>

                      {/* Invalid Response Message */}
                      <div className="space-y-2">
                        <Label htmlFor="invalid-message">Mensagem se resposta inválida</Label>
                        <Input
                          id="invalid-message"
                          placeholder="Ex: Por favor, envie um email válido"
                          value={invalidResponseMessage}
                          onChange={(e) => setInvalidResponseMessage(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Mensagem enviada se a resposta não passar na validação
                        </p>
                      </div>

                      {/* Step Timeout */}
                      <div className="space-y-2">
                        <Label>Timeout desta etapa</Label>
                        <Select value={stepTimeoutMinutes} onValueChange={setStepTimeoutMinutes}>
                          <SelectTrigger>
                            <SelectValue placeholder="Usar padrão do fluxo" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEOUT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Tempo máximo de espera pela resposta do usuário
                        </p>
                      </div>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Warning if not interactive */}
            {!flow.is_interactive && (
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <p className="text-xs text-muted-foreground">
                    💡 Para coletar respostas dos usuários, ative a opção "Fluxo interativo" nas configurações do fluxo.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSaveStep} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingStep ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Condition Config Dialog */}
      <ConditionConfigDialog
        open={conditionDialogOpen}
        onOpenChange={setConditionDialogOpen}
        config={editingConditionStep?.condition_config as any || null}
        availableVariables={steps.filter(s => s.variable_name).map(s => s.variable_name!)}
        onSave={handleSaveCondition}
        onDelete={editingConditionStep ? () => {
          handleDeleteStep(editingConditionStep);
          setConditionDialogOpen(false);
          setEditingConditionStep(null);
        } : undefined}
        saving={saving}
      />

      {effectiveUserId && (
        <TriggerConfigDialog
          open={triggerDialogOpen}
          onOpenChange={setTriggerDialogOpen}
          flowId={flow.id}
          userId={effectiveUserId}
          scheduleEnabled={flow.schedule_enabled}
          scheduleType={flow.schedule_type}
          scheduleConfig={flow.schedule_config}
          isDefault={flow.is_default}
          onSaved={(updates) => {
            setFlow((prev) =>
              prev ? { ...prev, ...updates } : prev
            );
            fetchRoutingRules();
          }}
        />
      )}

      {editingBlockStep && flow && effectiveUserId && (
        <BlockContentDialog
          open={blockDialogOpen}
          onOpenChange={setBlockDialogOpen}
          initialContents={(editingBlockStep.block_contents as BlockContentItem[]) || []}
          flowId={flow.id}
          userId={effectiveUserId}
          organizationId={organization?.id}
          onSave={async (contents) => {
            try {
              const { error } = await supabase
                .from("flow_steps")
                .update({ block_contents: contents as any })
                .eq("id", editingBlockStep.id);
              if (error) throw error;
              toast.success("Bloco atualizado!");
              fetchFlowAndSteps();
            } catch (err) {
              console.error(err);
              toast.error("Erro ao salvar bloco");
            }
          }}
        />
      )}

      {/* End Node Config Dialog */}
      <Dialog open={endNodeDialogOpen} onOpenChange={setEndNodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Fim do Fluxo</DialogTitle>
            <DialogDescription>
              Este nó encerra o fluxo e envia <code className="bg-muted px-1 rounded text-xs">desativarFluxo: true</code> ao sistema WhatsApp AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mensagem final (opcional)</Label>
              <Textarea
                placeholder="Ex: Obrigado pelo contato, {{pushName}}! Até logo."
                value={endFinalMessage}
                onChange={(e) => setEndFinalMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se preenchida, será enviada junto com o sinal de encerramento. Suporta variáveis como {`{{pushName}}`}, {`{{chatId}}`}.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndNodeDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!editingEndStep) return;
                setSaving(true);
                try {
                  const { error } = await supabase
                    .from("flow_steps")
                    .update({ end_config: { final_message: endFinalMessage } as any })
                    .eq("id", editingEndStep.id);
                  if (error) throw error;
                  toast.success("Nó de fim atualizado!");
                  setEndNodeDialogOpen(false);
                  fetchFlowAndSteps();
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao salvar configuração");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Config Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Tag</DialogTitle>
            <DialogDescription>
              Adicione ou remova tags do contato durante a execução do fluxo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={tagAction} onValueChange={(v) => setTagAction(v as "add" | "remove")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Adicionar Tags</SelectItem>
                  <SelectItem value="remove">Remover Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma tag e pressione Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                      e.preventDefault();
                      const newTag = tagInput.trim().replace(/,/g, "");
                      if (newTag && !tagList.includes(newTag)) {
                        setTagList((prev) => [...prev, newTag]);
                      }
                      setTagInput("");
                    }
                  }}
                />
              </div>
              {tagList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tagList.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTagList((prev) => prev.filter((t) => t !== tag))}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pressione Enter ou vírgula para adicionar cada tag.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!editingTagStep) return;
                setSaving(true);
                try {
                  const { error } = await supabase
                    .from("flow_steps")
                    .update({ tag_config: { action: tagAction, tags: tagList } as any })
                    .eq("id", editingTagStep.id);
                  if (error) throw error;
                  toast.success("Tag configurada!");
                  setTagDialogOpen(false);
                  fetchFlowAndSteps();
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao salvar configuração de tag");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lane Config Dialog */}
      <Dialog open={laneDialogOpen} onOpenChange={setLaneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Lane</DialogTitle>
            <DialogDescription>
              Mova o contato para um estágio do Kanban durante a execução do fluxo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mover para</Label>
              <Select value={laneStageId} onValueChange={setLaneStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um estágio" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const grouped = new Map<string, typeof pipelineStages>();
                    pipelineStages.forEach((s) => {
                      const list = grouped.get(s.pipeline_name) || [];
                      list.push(s);
                      grouped.set(s.pipeline_name, list);
                    });
                    return Array.from(grouped.entries()).map(([pipeline, stages]) => (
                      <div key={pipeline}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{pipeline}</div>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </div>
                    ));
                  })()}
                </SelectContent>
              </Select>
              {pipelineStages.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum pipeline/estágio encontrado.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaneDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={saving || !laneStageId}
              onClick={async () => {
                if (!editingLaneStep || !laneStageId) return;
                setSaving(true);
                try {
                  const stage = pipelineStages.find((s) => s.id === laneStageId);
                  const { error } = await supabase
                    .from("flow_steps")
                    .update({
                      lane_config: {
                        stage_id: laneStageId,
                        stage_name: stage?.name || "",
                      } as any,
                    })
                    .eq("id", editingLaneStep.id);
                  if (error) throw error;
                  toast.success("Lane configurada!");
                  setLaneDialogOpen(false);
                  fetchFlowAndSteps();
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao salvar configuração de lane");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Message Config Dialog */}
      {editingActiveMessageStep && effectiveUserId && (
        <ActiveMessageConfigDialog
          open={activeMessageDialogOpen}
          onOpenChange={setActiveMessageDialogOpen}
          config={editingActiveMessageStep.active_message_config || null}
          effectiveUserId={effectiveUserId}
          saving={saving}
          onSave={async (cfg) => {
            setSaving(true);
            try {
              const { error } = await supabase
                .from("flow_steps")
                .update({ active_message_config: cfg as any })
                .eq("id", editingActiveMessageStep.id);
              if (error) throw error;
              toast.success("Mensagem ativa configurada!");
              setActiveMessageDialogOpen(false);
              fetchFlowAndSteps();
            } catch (err) {
              console.error(err);
              toast.error("Erro ao salvar configuração");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {/* Random Config Dialog */}
      <Dialog open={randomDialogOpen} onOpenChange={setRandomDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Aleatório</DialogTitle>
            <DialogDescription>
              Divida o fluxo em caminhos aleatórios baseados em percentuais. O total deve ser 100%.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {randomSplits.map((split, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input
                  className="w-20"
                  value={split.label}
                  onChange={(e) => {
                    const updated = [...randomSplits];
                    updated[i] = { ...updated[i], label: e.target.value };
                    setRandomSplits(updated);
                  }}
                  placeholder="Label"
                />
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={split.percentage}
                    onChange={(e) => {
                      const updated = [...randomSplits];
                      updated[i] = { ...updated[i], percentage: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) };
                      setRandomSplits(updated);
                    }}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                {randomSplits.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRandomSplits(randomSplits.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={randomSplits.length >= 5}
                onClick={() => setRandomSplits([...randomSplits, { percentage: 10, label: String.fromCharCode(65 + randomSplits.length) }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Adicionar divisão
              </Button>
              <span className={`text-sm font-medium ${randomSplits.reduce((a, s) => a + s.percentage, 0) === 100 ? "text-emerald-400" : "text-destructive"}`}>
                Total: {randomSplits.reduce((a, s) => a + s.percentage, 0)}%
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRandomDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={saving || randomSplits.reduce((a, s) => a + s.percentage, 0) !== 100}
              onClick={async () => {
                if (!editingRandomStep) return;
                setSaving(true);
                try {
                  const { error } = await supabase
                    .from("flow_steps")
                    .update({ random_config: { splits: randomSplits } as any })
                    .eq("id", editingRandomStep.id);
                  if (error) throw error;
                  toast.success("Aleatório configurado!");
                  setRandomDialogOpen(false);
                  fetchFlowAndSteps();
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao salvar configuração");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delay Config Dialog */}
      <Dialog open={delayDialogOpen} onOpenChange={setDelayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar Intervalo</DialogTitle>
            <DialogDescription>
              Pausa a execução do fluxo pelo tempo definido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tempo em segundos</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">Máximo permitido: 120 segundos</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelayDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!editingDelayStep) return;
                setSaving(true);
                try {
                  const { error } = await supabase
                    .from("flow_steps")
                    .update({ delay_config: { delay_seconds: delaySeconds } as any })
                    .eq("id", editingDelayStep.id);
                  if (error) throw error;
                  toast.success("Intervalo configurado!");
                  setDelayDialogOpen(false);
                  fetchFlowAndSteps();
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao salvar configuração");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Config Dialog */}
      {editingMenuStep && (
        <MenuConfigDialog
          open={menuDialogOpen}
          onOpenChange={setMenuDialogOpen}
          config={editingMenuStep.menu_config || null}
          saving={saving}
          onSave={async (cfg) => {
            setSaving(true);
            try {
              const { error } = await supabase
                .from("flow_steps")
                .update({ menu_config: cfg as any })
                .eq("id", editingMenuStep.id);
              if (error) throw error;
              toast.success("Menu configurado!");
              setMenuDialogOpen(false);
              fetchFlowAndSteps();
            } catch (err) {
              console.error(err);
              toast.error("Erro ao salvar configuração do menu");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {/* Voice Call Config Dialog */}
      {editingVoiceCallStep && (
        <VoiceCallConfigDialog
          open={voiceCallDialogOpen}
          onOpenChange={setVoiceCallDialogOpen}
          initialConfig={(editingVoiceCallStep as any).voice_config || null}
          saving={savingVoiceCall}
          onSave={async (cfg) => {
            setSavingVoiceCall(true);
            try {
              const { error } = await supabase
                .from("flow_steps")
                .update({ voice_config: cfg as any })
                .eq("id", editingVoiceCallStep.id);
              if (error) throw error;
              toast.success("Chamada Voice AI configurada!");
              setVoiceCallDialogOpen(false);
              setEditingVoiceCallStep(null);
              fetchFlowAndSteps();
            } catch (err) {
              console.error(err);
              toast.error("Erro ao salvar configuração da ligação");
            } finally {
              setSavingVoiceCall(false);
            }
          }}
        />
      )}
    </AppLayout>
  );
}
