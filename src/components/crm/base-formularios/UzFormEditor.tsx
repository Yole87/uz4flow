import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFormSteps,
  createStep,
  updateStep,
  deleteStep,
  reorderSteps,
  createField,
  updateField,
  deleteField,
  reorderFields,
} from "@/services/uzFormService";
import { supabase } from "@/integrations/supabase/client";
import type { UzForm, UzFormStep, UzFormField, UzFormFieldType, UzFormMediaType } from "@/types/uzForm";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  X,
  User,
  Mail,
  Phone,
  AlignLeft,
  FileText,
  Calendar,
  CheckSquare,
  List,
  Upload,
  MapPin,
  CreditCard,
  Building,
} from "lucide-react";
import { toast } from "sonner";

interface UzFormEditorProps {
  form: UzForm;
}

const FIELD_TYPES = [
  { type: "name", label: "Nome completo", icon: User },
  { type: "email", label: "E-mail", icon: Mail },
  { type: "phone", label: "Celular / WhatsApp", icon: Phone },
  { type: "short_text", label: "Texto curto", icon: AlignLeft },
  { type: "long_text", label: "Texto longo", icon: FileText },
  { type: "date", label: "Data", icon: Calendar },
  { type: "multiple_choice", label: "Múltipla escolha (Radio)", icon: CheckSquare },
  { type: "select_list", label: "Lista de seleção (Dropdown)", icon: List },
  { type: "file_upload", label: "Upload de arquivo", icon: Upload },
  { type: "address", label: "Endereço completo", icon: MapPin },
  { type: "cpf", label: "CPF", icon: CreditCard },
  { type: "cnpj", label: "CNPJ", icon: Building },
] as const;

function getFieldIcon(type: UzFormFieldType) {
  const match = FIELD_TYPES.find((f) => f.type === type);
  return match ? match.icon : AlignLeft;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function UzFormEditor({ form }: UzFormEditorProps) {
  const { data: org } = useUserOrganization();
  const queryClient = useQueryClient();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["uz-form-steps", form.id],
    queryFn: () => getFormSteps(form.id),
  });

  // Automatically select the first step if none is selected
  const activeStep = steps.find((s) => s.id === selectedStepId) || steps[0] || null;

  // Mutations
  const createStepMutation = useMutation({
    mutationFn: () => createStep(form.id, steps.length),
    onSuccess: (newStep) => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
      setSelectedStepId(newStep.id);
      toast.success("Passo adicionado");
    },
    onError: () => toast.error("Erro ao adicionar passo"),
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UzFormStep> }) => updateStep(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
    },
    onError: () => toast.error("Erro ao atualizar passo"),
  });

  const deleteStepMutation = useMutation({
    mutationFn: (id: string) => deleteStep(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
      if (selectedStepId === activeStep?.id) {
        setSelectedStepId(null);
      }
      toast.success("Passo excluído");
    },
    onError: () => toast.error("Erro ao excluir passo"),
  });

  const reorderStepsMutation = useMutation({
    mutationFn: (updates: { id: string; step_order: number }[]) => reorderSteps(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: ({ stepId, field }: { stepId: string; field: Omit<UzFormField, "id" | "created_at"> }) =>
      createField(stepId, field),
    onSuccess: (newField) => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
      setExpandedFieldId(newField.id);
      setIsAddFieldOpen(false);
      toast.success("Campo adicionado");
    },
    onError: () => toast.error("Erro ao adicionar campo"),
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UzFormField> }) => updateField(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
    },
    onError: () => toast.error("Erro ao atualizar campo"),
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (id: string) => deleteField(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
      toast.success("Campo excluído");
    },
    onError: () => toast.error("Erro ao excluir campo"),
  });

  const reorderFieldsMutation = useMutation({
    mutationFn: (updates: { id: string; field_order: number }[]) => reorderFields(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uz-form-steps", form.id] });
    },
  });

  // Reorder Handlers
  const moveStepHandler = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const reordered = [...steps];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    const updates = reordered.map((s, idx) => ({ id: s.id, step_order: idx }));
    await reorderStepsMutation.mutateAsync(updates);
  };

  const moveFieldHandler = async (fields: UzFormField[], index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const reordered = [...fields];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    const updates = reordered.map((f, idx) => ({ id: f.id, field_order: idx }));
    await reorderFieldsMutation.mutateAsync(updates);
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeStep) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${form.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("form-images")
        .upload(filePath, file);

      if (uploadError && (uploadError as any).message?.includes("bucket")) {
        await supabase.storage.createBucket("form-images", { public: true });
        const { error: retryError } = await supabase.storage
          .from("form-images")
          .upload(filePath, file);
        if (retryError) throw retryError;
      } else if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("form-images")
        .getPublicUrl(filePath);

      await updateStepMutation.mutateAsync({
        id: activeStep.id,
        data: { media_url: publicUrl, media_type: "image" },
      });
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddField = (type: UzFormFieldType) => {
    if (!activeStep) return;
    const currentFields = activeStep.fields ?? [];
    
    // Auto-generate key name
    const countOfType = currentFields.filter((f) => f.field_type === type).length;
    const key_name = `${type}_${countOfType + 1}`;
    
    createFieldMutation.mutate({
      stepId: activeStep.id,
      field: {
        step_id: activeStep.id,
        field_type: type,
        label: `Campo de ${FIELD_TYPES.find((f) => f.type === type)?.label || type}`,
        key_name,
        is_required: false,
        options: [],
        field_order: currentFields.length,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="border-border gap-2"
          onClick={() => window.open(`/f/${form.token}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
          Visualizar formulário
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Panel - Steps */}
        <div className="space-y-4 border border-border rounded-lg p-4 bg-card h-fit">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Passos do Formulário</h3>
            <Badge variant="secondary">{steps.length} {steps.length === 1 ? "passo" : "passos"}</Badge>
          </div>

          <div className="space-y-2">
            {steps.map((step, idx) => {
              const isActive = activeStep?.id === step.id;
              const fieldCount = step.fields?.length ?? 0;
              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    isActive
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground font-medium">Passo {idx + 1}</p>
                    <p className="font-semibold text-foreground truncate mt-0.5">
                      {step.title || `Passo ${idx + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fieldCount} {fieldCount === 1 ? "campo" : "campos"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => moveStepHandler(idx, "up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === steps.length - 1}
                      onClick={() => moveStepHandler(idx, "down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={steps.length <= 1}
                      onClick={() => deleteStepMutation.mutate(step.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => createStepMutation.mutate()}
            disabled={createStepMutation.isPending}
            variant="outline"
            className="w-full border-dashed border-border"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar passo
          </Button>
        </div>

        {/* Right Panel - Step Details & Fields */}
        <div className="md:col-span-2 space-y-6">
          {activeStep ? (
            <div className="space-y-6">
              {/* Step Meta Settings */}
              <div className="border border-border rounded-lg p-5 bg-card space-y-4">
                <h3 className="font-semibold text-foreground border-b border-border pb-2">
                  Configurações do Passo
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="step-title">Título do passo</Label>
                    <Input
                      id="step-title"
                      value={activeStep.title || ""}
                      onChange={(e) =>
                        updateStepMutation.mutate({
                          id: activeStep.id,
                          data: { title: e.target.value },
                        })
                      }
                      placeholder="Ex: Dados Pessoais"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="step-description">Descrição / Subtítulo</Label>
                    <Input
                      id="step-description"
                      value={activeStep.description || ""}
                      onChange={(e) =>
                        updateStepMutation.mutate({
                          id: activeStep.id,
                          data: { description: e.target.value },
                        })
                      }
                      placeholder="Ex: Preencha com seus dados de contato"
                    />
                  </div>
                </div>

                {/* Media Section */}
                <div className="border-t border-border pt-4 space-y-4">
                  <div>
                    <Label className="text-sm font-semibold">Mídia do Passo</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adicione uma imagem de destaque ou um vídeo do YouTube a este passo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Tipo de mídia</Label>
                      <Select
                        value={activeStep.media_type}
                        onValueChange={(val: UzFormMediaType) =>
                          updateStepMutation.mutate({
                            id: activeStep.id,
                            data: { media_type: val, media_url: null },
                          })
                        }
                      >
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="none">Sem mídia</SelectItem>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="youtube">Vídeo do YouTube</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      {activeStep.media_type === "image" && (
                        <div className="space-y-2">
                          <Label>Upload da imagem (máx. 2MB)</Label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={isUploading}
                              className="bg-background border-border cursor-pointer text-xs"
                            />
                            {isUploading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
                          </div>
                          {activeStep.media_url && (
                            <div className="relative mt-2 border border-border rounded-lg overflow-hidden max-w-[200px]">
                              <img
                                src={activeStep.media_url}
                                alt="Mídia do Passo"
                                className="w-full h-auto object-cover max-h-32"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {activeStep.media_type === "youtube" && (
                        <div className="space-y-2">
                          <Label>Link do vídeo do YouTube</Label>
                          <Input
                            type="text"
                            value={activeStep.media_url || ""}
                            onChange={(e) =>
                              updateStepMutation.mutate({
                                id: activeStep.id,
                                data: { media_url: e.target.value },
                              })
                            }
                            placeholder="Ex: https://www.youtube.com/watch?v=..."
                          />
                          {activeStep.media_url && getYouTubeId(activeStep.media_url) && (
                            <div className="relative aspect-video rounded-lg overflow-hidden border border-border mt-2 max-w-[320px]">
                              <iframe
                                src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(
                                  activeStep.media_url
                                )}`}
                                title="YouTube Video Preview"
                                className="w-full h-full border-0"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fields Section */}
              <div className="border border-border rounded-lg p-5 bg-card space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="font-semibold text-foreground">Campos do Passo</h3>
                  <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gradient-primary text-primary-foreground">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Adicionar campo
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl bg-card border-border">
                      <DialogHeader>
                        <DialogTitle>Escolha o Tipo de Campo</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
                        {FIELD_TYPES.map((field) => {
                          const Icon = field.icon;
                          return (
                            <Button
                              key={field.type}
                              variant="outline"
                              className="flex flex-col gap-2 h-24 border-border hover:border-accent hover:bg-accent/5 justify-center items-center text-center p-2"
                              onClick={() => handleAddField(field.type)}
                            >
                              <Icon className="h-5 w-5 text-accent" />
                              <span className="text-xs font-medium text-foreground">{field.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {(activeStep.fields ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhum campo adicionado neste passo. Adicione campos acima para coletar dados.
                    </p>
                  ) : (
                    (activeStep.fields ?? []).map((field, fIdx) => {
                      const Icon = getFieldIcon(field.field_type);
                      const isExpanded = expandedFieldId === field.id;
                      const hasOptions =
                        field.field_type === "multiple_choice" || field.field_type === "select_list";

                      return (
                        <div
                          key={field.id}
                          className="border border-border rounded-lg bg-background overflow-hidden"
                        >
                          {/* Row Header */}
                          <div
                            onClick={() =>
                              setExpandedFieldId(isExpanded ? null : field.id)
                            }
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/5 transition-colors select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Icon className="h-4 w-4 text-accent shrink-0" />
                              <span className="font-medium text-sm text-foreground truncate">
                                {field.label}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded border border-border">
                                {field.key_name}
                              </span>
                            </div>

                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5 border-r border-border pr-2 mr-2">
                                <Label htmlFor={`req-${field.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                  Obrigatório
                                </Label>
                                <Switch
                                  id={`req-${field.id}`}
                                  checked={field.is_required}
                                  onCheckedChange={(val) =>
                                    updateFieldMutation.mutate({
                                      id: field.id,
                                      data: { is_required: val },
                                    })
                                  }
                                />
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-35"
                                disabled={fIdx === 0}
                                onClick={() =>
                                  moveFieldHandler(activeStep.fields || [], fIdx, "up")
                                }
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-35"
                                disabled={fIdx === (activeStep.fields ?? []).length - 1}
                                onClick={() =>
                                  moveFieldHandler(activeStep.fields || [], fIdx, "down")
                                }
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteFieldMutation.mutate(field.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>

                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="p-4 border-t border-border bg-card space-y-4 text-sm">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label>Rótulo (Label)</Label>
                                  <Input
                                    value={field.label}
                                    onChange={(e) =>
                                      updateFieldMutation.mutate({
                                        id: field.id,
                                        data: { label: e.target.value },
                                      })
                                    }
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1">
                                    <Label>Nome da chave (Payload key)</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-card border-border text-foreground">
                                          <p className="max-w-[250px] text-xs">
                                            Aviso: Alterar esta chave modificará o nome do campo nos dados enviados na resposta.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  <Input
                                    value={field.key_name}
                                    onChange={(e) => {
                                      // enforce alphanumeric and underscore only
                                      const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                                      updateFieldMutation.mutate({
                                        id: field.id,
                                        data: { key_name: sanitized },
                                      });
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Options Editor (Radio / Select dropdown only) */}
                              {hasOptions && (
                                <div className="border border-border rounded-lg p-3 bg-background space-y-3">
                                  <Label className="text-xs font-semibold">Opções de seleção</Label>
                                  <div className="space-y-2">
                                    {(field.options || []).map((option, oIdx) => (
                                      <div
                                        key={oIdx}
                                        className="flex items-center justify-between bg-card border border-border p-2 rounded-md"
                                      >
                                        <span className="text-xs font-medium text-foreground">{option}</span>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-35"
                                            disabled={oIdx === 0}
                                            onClick={() => {
                                              const reorderedOpts = [...field.options];
                                              const tempOpt = reorderedOpts[oIdx];
                                              reorderedOpts[oIdx] = reorderedOpts[oIdx - 1];
                                              reorderedOpts[oIdx - 1] = tempOpt;
                                              updateFieldMutation.mutate({
                                                id: field.id,
                                                data: { options: reorderedOpts },
                                              });
                                            }}
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-35"
                                            disabled={oIdx === field.options.length - 1}
                                            onClick={() => {
                                              const reorderedOpts = [...field.options];
                                              const tempOpt = reorderedOpts[oIdx];
                                              reorderedOpts[oIdx] = reorderedOpts[oIdx + 1];
                                              reorderedOpts[oIdx + 1] = tempOpt;
                                              updateFieldMutation.mutate({
                                                id: field.id,
                                                data: { options: reorderedOpts },
                                              });
                                            }}
                                          >
                                            <ArrowDown className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                            onClick={() => {
                                              const filteredOpts = field.options.filter(
                                                (_, fIdx) => fIdx !== oIdx
                                              );
                                              updateFieldMutation.mutate({
                                                id: field.id,
                                                data: { options: filteredOpts },
                                              });
                                            }}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}

                                    <div className="flex items-center gap-2 mt-2">
                                      <Input
                                        value={newOptionText}
                                        onChange={(e) => setNewOptionText(e.target.value)}
                                        placeholder="Nova opção..."
                                        className="h-8 text-xs bg-card border-border"
                                      />
                                      <Button
                                        size="sm"
                                        className="gradient-primary text-primary-foreground h-8"
                                        onClick={() => {
                                          const optText = newOptionText.trim();
                                          if (!optText) return;
                                          if ((field.options || []).includes(optText)) {
                                            toast.warning("Esta opção já existe");
                                            return;
                                          }
                                          updateFieldMutation.mutate({
                                            id: field.id,
                                            data: { options: [...(field.options || []), optText] },
                                          });
                                          setNewOptionText("");
                                        }}
                                      >
                                        Adicionar
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg p-12 text-center bg-card">
              <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-3" />
              <p className="text-foreground font-semibold">Nenhum passo selecionado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adicione um passo no painel esquerdo para começar a construir seu formulário.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
