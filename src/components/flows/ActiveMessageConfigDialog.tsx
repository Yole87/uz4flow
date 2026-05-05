import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Loader2,
  X,
  Plus,
  Upload,
  Type,
  Clock,
  Image as ImageIcon,
  Trash2,
  GripVertical,
  FileUp,
  AlertTriangle,
} from "lucide-react";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";

export interface ContentItem {
  type: "text" | "interval" | "media";
  value?: string;
  delay_ms?: number;
  file_id?: string;
  file_name?: string;
}

export interface ActiveMessageConfig {
  instance_id: string;
  filter_tags: string[];
  recipients: string[];
  content_items: ContentItem[];
  meta_template_name?: string;
  meta_template_language?: string;
}

interface InstanceInfo {
  id: string;
  name: string;
  provider: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ActiveMessageConfig | null;
  effectiveUserId: string;
  saving: boolean;
  onSave: (config: ActiveMessageConfig) => void;
}

export function ActiveMessageConfigDialog({
  open,
  onOpenChange,
  config,
  effectiveUserId,
  saving,
  onSave,
}: Props) {
  const [instanceId, setInstanceId] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [metaTemplateName, setMetaTemplateName] = useState("");
  const [metaTemplateLanguage, setMetaTemplateLanguage] = useState("pt_BR");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: organization } = useUserOrganization();

  const selectedInstance = instances.find((i) => i.id === instanceId);
  const isMetaOfficial = selectedInstance?.provider === "meta_official";

  const { templates: metaTemplates, isLoading: loadingTemplates } = useMetaTemplates(
    isMetaOfficial ? instanceId : undefined
  );

  useEffect(() => {
    if (!open) return;
    setInstanceId(config?.instance_id || "");
    setFilterTags(config?.filter_tags || []);
    setRecipients(config?.recipients || []);
    setContentItems(config?.content_items || []);
    setMetaTemplateName(config?.meta_template_name || "");
    setMetaTemplateLanguage(config?.meta_template_language || "pt_BR");
    setTagInput("");
    setRecipientInput("");
    fetchInstances();
    fetchAvailableTags();
  }, [open, config]);

  async function fetchInstances() {
    try {
      const orgId = await supabase.rpc("get_user_organization_id", { _user_id: effectiveUserId });
      if (!orgId.data) return;
      const { data } = await supabase
        .from("instances")
        .select("id, name, provider")
        .eq("organization_id", orgId.data);
      setInstances((data as any[]) || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchAvailableTags() {
    try {
      const orgId = await supabase.rpc("get_user_organization_id", { _user_id: effectiveUserId });
      if (!orgId.data) return;
      const { data } = await supabase
        .from("contacts")
        .select("tags")
        .eq("organization_id", orgId.data)
        .not("tags", "is", null);
      const tagSet = new Set<string>();
      (data || []).forEach((c: any) => {
        if (Array.isArray(c.tags)) c.tags.forEach((t: string) => tagSet.add(t));
      });
      setAvailableTags(Array.from(tagSet).sort());
    } catch (err) {
      console.error(err);
    }
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !filterTags.includes(t)) setFilterTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function addRecipient(phone: string) {
    const p = phone.trim().replace(/\D/g, "");
    if (p && !recipients.includes(p)) setRecipients((prev) => [...prev, p]);
    setRecipientInput("");
  }

  function addContentItem(type: ContentItem["type"]) {
    if (type === "text") setContentItems((prev) => [...prev, { type: "text", value: "" }]);
    else if (type === "interval") setContentItems((prev) => [...prev, { type: "interval", delay_ms: 3000 }]);
    else if (type === "media") fileInputRef.current?.click();
  }

  function updateContentItem(index: number, updates: Partial<ContentItem>) {
    setContentItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  }

  function removeContentItem(index: number) {
    setContentItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleMediaUpload(file: File) {
    if (!organization?.id) {
      toast.error("Organização não encontrada");
      return;
    }
    try {
      setUploading(true);
      const filePath = `${organization.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("flow-files").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: fileData, error: fileErr } = await supabase
        .from("files")
        .insert({
          user_id: effectiveUserId,
          organization_id: organization.id,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: filePath,
        })
        .select("id")
        .single();
      if (fileErr) throw fileErr;

      setContentItems((prev) => [
        ...prev,
        { type: "media", file_id: fileData.id, file_name: file.name },
      ]);
      toast.success("Mídia adicionada!");
      supabase.rpc("recalculate_org_storage", { p_org_id: organization.id }).then(() => {});
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar mídia");
    } finally {
      setUploading(false);
    }
  }

  async function handleImportList() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const phones = text
        .split(/[\r\n,;]+/)
        .map((l) => l.trim().replace(/\D/g, ""))
        .filter((p) => p.length >= 10);
      const unique = Array.from(new Set([...recipients, ...phones]));
      setRecipients(unique);
      toast.success(`${phones.length} números importados`);
    };
    input.click();
  }

  function handleSave() {
    if (!instanceId) {
      toast.error("Selecione uma instância WhatsApp");
      return;
    }
    if (filterTags.length === 0 && recipients.length === 0) {
      toast.error("Adicione ao menos uma tag ou destinatário");
      return;
    }
    if (isMetaOfficial) {
      if (!metaTemplateName.trim()) {
        toast.error("Para instâncias Meta Official, selecione um Modelo Meta (Template)");
        return;
      }
      onSave({
        instance_id: instanceId,
        filter_tags: filterTags,
        recipients,
        content_items: contentItems,
        meta_template_name: metaTemplateName.trim(),
        meta_template_language: metaTemplateLanguage,
      });
    } else {
      if (contentItems.length === 0) {
        toast.error("Adicione ao menos um item de conteúdo");
        return;
      }
      onSave({
        instance_id: instanceId,
        filter_tags: filterTags,
        recipients,
        content_items: contentItems,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Mensagem Ativa</DialogTitle>
          <DialogDescription>
            Envie mensagens proativas a destinatários selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Instance Select */}
          <div className="space-y-2">
            <Label>Instância WhatsApp *</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conexão" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    <div className="flex items-center gap-2">
                      {inst.name}
                      {inst.provider === "meta_official" && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">Meta</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meta Official Warning & Template Selector */}
          {isMetaOfficial && (
            <div className="space-y-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-200">
                  <p className="font-medium mb-1">Instância Meta Official</p>
                  <p>Mensagens ativas (fora da janela de 24h) exigem um <strong>Modelo Meta (Template)</strong> aprovado. O conteúdo livre abaixo será ignorado para este provedor.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Modelo Meta (Template) *</Label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando templates...
                  </div>
                ) : metaTemplates.length > 0 ? (
                  <Select value={metaTemplateName} onValueChange={setMetaTemplateName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {metaTemplates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.template_name}>
                          {tpl.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-1">
                    <Input
                      placeholder="Nome exato do template (ex: hello_world)"
                      value={metaTemplateName}
                      onChange={(e) => setMetaTemplateName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nenhum template cadastrado. Digite o nome exato do template aprovado no Meta Business.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Idioma do Template</Label>
                <Select value={metaTemplateLanguage} onValueChange={setMetaTemplateLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (BR)</SelectItem>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Filter Tags */}
          <div className="space-y-2">
            <Label>Filtrar por Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                list="available-tags"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <datalist id="available-tags">
              {availableTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            {filterTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filterTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <button onClick={() => setFilterTags((prev) => prev.filter((t) => t !== tag))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label>Destinatários manuais</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Número (ex: 5511999999999)"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && recipientInput.trim()) {
                    e.preventDefault();
                    addRecipient(recipientInput);
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => addRecipient(recipientInput)}
                disabled={!recipientInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleImportList}>
              <FileUp className="h-3.5 w-3.5" /> Importar Lista (CSV/TXT)
            </Button>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {recipients.map((phone) => (
                  <Badge key={phone} variant="outline" className="gap-1 text-xs">
                    {phone}
                    <button onClick={() => setRecipients((prev) => prev.filter((p) => p !== phone))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Content Items — only for Baileys */}
          {!isMetaOfficial && (
            <div className="space-y-2">
              <Label>Conteúdo da Mensagem</Label>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addContentItem("text")}>
                  <Type className="h-3.5 w-3.5" /> Texto
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addContentItem("interval")}>
                  <Clock className="h-3.5 w-3.5" /> Intervalo
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addContentItem("media")} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Mídia
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMediaUpload(file);
                  e.target.value = "";
                }}
              />

              {contentItems.length > 0 && (
                <div className="space-y-2 mt-2">
                  {contentItems.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 rounded-md border border-border/50 bg-muted/30">
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        {item.type === "text" && (
                          <Textarea
                            placeholder="Digite a mensagem... Use {{pushName}}, {{chatId}}"
                            value={item.value || ""}
                            onChange={(e) => updateContentItem(idx, { value: e.target.value })}
                            rows={2}
                            className="text-xs"
                          />
                        )}
                        {item.type === "interval" && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="number"
                              min={1}
                              value={Math.round((item.delay_ms || 3000) / 1000)}
                              onChange={(e) => updateContentItem(idx, { delay_ms: (parseInt(e.target.value) || 1) * 1000 })}
                              className="w-20 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">segundos</span>
                          </div>
                        )}
                        {item.type === "media" && (
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{item.file_name || "Mídia"}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeContentItem(idx)}
                        className="p-1 hover:bg-destructive/20 rounded shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
