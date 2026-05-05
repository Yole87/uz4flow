import { useState } from "react";
import { 
  MessageSquare, 
  FileText, 
  Sparkles, 
  Clock, 
  Trash2, 
  GripVertical, 
  Plus,
  Upload,
  X,
  Eye,
  Loader2,
  Edit2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useUserOrganization } from "@/hooks/useUserOrganization";

export interface FieldMapping {
  path: string;
  label: string;
}

export interface ConnectorInteraction {
  id: string;
  order_index: number;
  type: "text" | "file";
  text_mode?: "fixed" | "ai";
  template?: string;
  ai_prompt?: string;
  file_id?: string;
  file_name?: string;
  delay_ms: number;
}

interface InteractionEditorProps {
  interactions: ConnectorInteraction[];
  fieldMappings: FieldMapping[];
  samplePayload: Record<string, unknown> | null;
  onInteractionsChange: (interactions: ConnectorInteraction[]) => void;
}

type DelayUnit = "seconds" | "minutes";

function parseDelayMs(ms: number): { value: string; unit: DelayUnit } {
  if (ms <= 0) return { value: "0", unit: "seconds" };
  if (ms >= 60000 && ms % 60000 === 0) return { value: String(ms / 60000), unit: "minutes" };
  return { value: String(ms / 1000), unit: "seconds" };
}

function formatDelay(ms: number): string {
  if (ms <= 0) return "";
  if (ms >= 60000 && ms % 60000 === 0) return `${ms / 60000}min`;
  return `${ms / 1000}s`;
}

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

function generateId(): string {
  return crypto.randomUUID();
}

export function InteractionEditor({ 
  interactions, 
  fieldMappings, 
  samplePayload,
  onInteractionsChange 
}: InteractionEditorProps) {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { data: organization } = useUserOrganization();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<ConnectorInteraction | null>(null);
  
  // Form state
  const [stepType, setStepType] = useState<"text" | "file">("text");
  const [textMode, setTextMode] = useState<"fixed" | "ai">("fixed");
  const [template, setTemplate] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [delayValue, setDelayValue] = useState("0");
  const [delayUnit, setDelayUnit] = useState<DelayUnit>("seconds");
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");

  const resetForm = () => {
    setStepType("text");
    setTextMode("fixed");
    setTemplate("");
    setAiPrompt("");
    setDelayValue("0");
    setDelayUnit("seconds");
    setUploadedFileId(null);
    setUploadedFileName("");
    setEditingInteraction(null);
    setPreviewMessage("");
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (interaction: ConnectorInteraction) => {
    setEditingInteraction(interaction);
    setStepType(interaction.type);
    setTextMode(interaction.text_mode || "fixed");
    setTemplate(interaction.template || "");
    setAiPrompt(interaction.ai_prompt || "");
    const parsed = parseDelayMs(interaction.delay_ms);
    setDelayValue(parsed.value);
    setDelayUnit(parsed.unit);
    if (interaction.file_id) {
      setUploadedFileId(interaction.file_id);
      setUploadedFileName(interaction.file_name || "");
    }
    setPreviewMessage("");
    setDialogOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    
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
      const targetUserId = effectiveUserId || user.id;
      const filePath = `${organization.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("flow-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: fileData, error: fileError } = await supabase
        .from("files")
        .insert({
          user_id: targetUserId,
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
      toast.success("Arquivo enviado!");
      supabase.rpc("recalculate_org_storage", { p_org_id: organization.id }).then(() => {});
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!aiPrompt || !samplePayload) return;
    
    setGeneratingPreview(true);
    try {
      const response = await supabase.functions.invoke("generate-connector-preview", {
        body: {
          prompt: aiPrompt,
          mappings: fieldMappings,
          payload: samplePayload,
        },
      });

      if (response.error) throw response.error;
      setPreviewMessage(response.data?.message || "");
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Erro ao gerar preview");
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleSave = () => {
    // Validate
    if (stepType === "text") {
      if (textMode === "fixed" && !template.trim()) {
        toast.error("Informe o template da mensagem");
        return;
      }
      if (textMode === "ai" && !aiPrompt.trim()) {
        toast.error("Informe o prompt para a IA");
        return;
      }
    } else {
      if (!uploadedFileId) {
        toast.error("Selecione um arquivo");
        return;
      }
    }

    const newInteraction: ConnectorInteraction = {
      id: editingInteraction?.id || generateId(),
      order_index: editingInteraction?.order_index ?? interactions.length,
      type: stepType,
      text_mode: stepType === "text" ? textMode : undefined,
      template: stepType === "text" && textMode === "fixed" ? template : undefined,
      ai_prompt: stepType === "text" && textMode === "ai" ? aiPrompt : undefined,
      file_id: stepType === "file" ? uploadedFileId || undefined : undefined,
      file_name: stepType === "file" ? uploadedFileName : undefined,
      delay_ms: (parseInt(delayValue) || 0) * (delayUnit === "minutes" ? 60000 : 1000),
    };

    let updated: ConnectorInteraction[];
    if (editingInteraction) {
      updated = interactions.map(i => i.id === editingInteraction.id ? newInteraction : i);
    } else {
      updated = [...interactions, newInteraction];
    }

    // Reindex
    updated = updated.map((i, idx) => ({ ...i, order_index: idx }));
    onInteractionsChange(updated);
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = interactions
      .filter(i => i.id !== id)
      .map((i, idx) => ({ ...i, order_index: idx }));
    onInteractionsChange(updated);
  };

  const getInteractionSummary = (interaction: ConnectorInteraction) => {
    if (interaction.type === "file") {
      return interaction.file_name || "Arquivo";
    }
    if (interaction.text_mode === "ai") {
      return interaction.ai_prompt?.substring(0, 60) + (interaction.ai_prompt && interaction.ai_prompt.length > 60 ? "..." : "");
    }
    return interaction.template?.substring(0, 60) + (interaction.template && interaction.template.length > 60 ? "..." : "");
  };

  return (
    <div className="space-y-4">
      {/* List of interactions */}
      {interactions.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhuma interação configurada</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Adicione mensagens ou arquivos que serão enviados quando o webhook for recebido.
            </p>
            <Button onClick={openAddDialog} className="gradient-primary hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeira interação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction, index) => (
            <Card key={interaction.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-2 sm:gap-4 py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="h-5 w-5 cursor-grab hidden sm:block" />
                  <span className="font-mono text-sm w-6">{index + 1}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {interaction.type === "text" ? (
                      <MessageSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-accent" />
                    )}
                    <Badge variant="secondary">
                      {interaction.type === "text" ? "Texto" : "Arquivo"}
                    </Badge>
                    {interaction.type === "text" && (
                      <Badge variant={interaction.text_mode === "ai" ? "default" : "outline"} className="gap-1">
                        {interaction.text_mode === "ai" ? <Sparkles className="h-3 w-3" /> : null}
                        {interaction.text_mode === "ai" ? "IA" : "Fixo"}
                      </Badge>
                    )}
                    {interaction.delay_ms > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDelay(interaction.delay_ms)}
                      </Badge>
                    )}
                    {index === interactions.length - 1 && (
                      <Badge className="bg-success text-success-foreground">
                        Última
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {getInteractionSummary(interaction)}
                  </p>
                </div>

                <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(interaction)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDelete(interaction.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button onClick={openAddDialog} variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar interação
          </Button>
        </div>
      )}

      {/* Info */}
      {interactions.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Dica:</strong> A última interação enviará automaticamente{" "}
            <code className="bg-muted px-1 rounded">desativarFluxo: true</code> ao Sistema de WhatsApp AI.
            Use os delays para espaçar as mensagens.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInteraction ? "Editar Interação" : "Adicionar Interação"}</DialogTitle>
            <DialogDescription>
              Configure o tipo e conteúdo da interação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step Type */}
            <div className="space-y-2">
              <Label>Tipo de interação</Label>
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
              <div className="space-y-4">
                <Tabs value={textMode} onValueChange={(v) => setTextMode(v as "fixed" | "ai")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="fixed" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Template Fixo
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      IA Dinâmica
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="fixed" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Template da Mensagem</Label>
                      <Textarea
                        placeholder="Olá {{nome}}! Obrigado pela compra do {{produto}}. Valor: R$ {{valor}}"
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground">
                        Use {"{{campo}}"} para inserir os valores dos campos selecionados
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Variáveis Disponíveis</Label>
                      <div className="flex flex-wrap gap-2">
                        {fieldMappings.map(field => (
                          <Button
                            key={field.path}
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplate(prev => prev + `{{${field.label}}}`)}
                          >
                            {`{{${field.label}}}`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="ai" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Instruções para a IA</Label>
                      <Textarea
                        placeholder="Crie uma mensagem de boas-vindas agradecendo a compra do produto, informando o nome do cliente e o valor pago."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground">
                        Descreva o que você quer que a IA gere. Os campos selecionados serão usados automaticamente.
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleGeneratePreview}
                      disabled={!aiPrompt || generatingPreview || !samplePayload}
                    >
                      {generatingPreview ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      Gerar Preview
                    </Button>

                    {previewMessage && (
                      <div className="p-4 bg-muted rounded-lg">
                        <Label className="text-xs text-muted-foreground">Preview da Mensagem</Label>
                        <p className="mt-1 whitespace-pre-wrap">{previewMessage}</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Arquivo</Label>
                {uploadedFileId ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="flex-1 truncate">{uploadedFileName}</span>
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
                      id="file-upload-interaction"
                      className="hidden"
                      accept={ALLOWED_MIME_TYPES.join(",")}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <label
                      htmlFor="file-upload-interaction"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {uploading ? "Enviando..." : "Clique para selecionar um arquivo"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PDF, Imagens, Áudio, Vídeo (máx 10MB)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Delay */}
            <div className="space-y-2">
              <Label>Delay antes da próxima interação</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  className="w-24"
                />
                <Select value={delayUnit} onValueChange={(v) => setDelayUnit(v as DelayUnit)}>
                  <SelectTrigger className="w-[130px]">
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
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="w-full sm:w-auto">
              {editingInteraction ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
