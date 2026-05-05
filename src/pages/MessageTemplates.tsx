import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, FileText, Star, MessageSquare } from "lucide-react";
import { CharCounter } from "@/components/ui/char-counter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { LimitAlert } from "@/components/LimitAlert";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { EmptyState } from "@/components/ui/empty-state";

interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  category: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "reengajamento", label: "Reengajamento" },
  { value: "boas-vindas", label: "Boas-vindas" },
  { value: "lembrete", label: "Lembrete" },
  { value: "promocao", label: "Promoção" },
  { value: "outros", label: "Outros" },
];

const AVAILABLE_VARIABLES = [
  { name: "pushName", description: "Nome do WhatsApp" },
  { name: "nome", description: "Nome coletado" },
  { name: "email", description: "E-mail coletado" },
  { name: "telefone", description: "Telefone coletado" },
];

const getCategoryLabel = (value: string) => {
  return CATEGORIES.find(c => c.value === value)?.label || value;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    reengajamento: "border-warning/50 text-warning",
    "boas-vindas": "border-success/50 text-success",
    lembrete: "border-accent/50 text-accent",
    promocao: "border-secondary/50 text-secondary",
    outros: "border-muted-foreground/30 text-muted-foreground",
  };
  return colors[category] || colors.outros;
};

export default function MessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const { effectiveUserId } = useEffectiveUserId();

  // Form state
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("reengajamento");

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormName("");
    setFormContent("");
    setFormCategory("reengajamento");
    setDialogOpen(true);
  }

  function openEditDialog(template: MessageTemplate) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormContent(template.content);
    setFormCategory(template.category);
    setDialogOpen(true);
  }

  function insertVariable(variable: string) {
    const textarea = document.getElementById("template-content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = formContent.slice(0, start) + `{{${variable}}}` + formContent.slice(end);
      setFormContent(newContent);
      // Focus back and set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + variable.length + 4;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else {
      setFormContent(prev => prev + `{{${variable}}}`);
    }
  }

  async function handleSave() {
    if (!formName.trim() || !formContent.trim()) {
      toast.error("Preencha nome e conteúdo do template");
      return;
    }

    setSaving(true);

    try {
      if (!effectiveUserId) throw new Error("Usuário não autenticado");

      if (editingTemplate) {
        // Update existing
        const { error } = await supabase
          .from("message_templates")
          .update({
            name: formName.trim(),
            content: formContent.trim(),
            category: formCategory,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template atualizado!");
      } else {
        // Create new
        const { error } = await supabase
          .from("message_templates")
          .insert({
            user_id: effectiveUserId,
            name: formName.trim(),
            content: formContent.trim(),
            category: formCategory,
            is_default: false,
          });

        if (error) throw error;
        toast.success("Template criado!");
      }

      setDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Erro ao salvar template");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(template: MessageTemplate) {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!templateToDelete) return;

    try {
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", templateToDelete.id);

      if (error) throw error;
      toast.success("Template excluído!");
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir template");
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  }

  const userTemplates = templates.filter(t => !t.is_default);
  const defaultTemplates = templates.filter(t => t.is_default);

  return (
    <AppLayout title="Templates de Mensagem" description="Respostas rápidas, follow-ups e disparos para contatos">
      <div className="space-y-6">
        <LimitAlert feature="automations" className="mb-2" />
        {/* Action Button */}
        <div className="flex justify-end">
          <Button onClick={openCreateDialog} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Novo Template
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* User Templates */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Meus Templates
              </h2>
              
              {userTemplates.length === 0 ? (
                <EmptyState
                  variant="card"
                  icon={FileText}
                  title="Nenhum template criado"
                  description="Crie mensagens reutilizáveis para respostas rápidas, follow-ups e disparos em massa."
                  action={{
                    label: "Novo template",
                    onClick: openCreateDialog,
                    icon: Plus,
                  }}
                />
              ) : (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {userTemplates.map((template) => (
                    <Card key={template.id} className="group hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <Badge variant="outline" className={getCategoryColor(template.category)}>
                              {getCategoryLabel(template.category)}
                            </Badge>
                          </div>
                          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(template)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => confirmDelete(template)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {template.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Default Templates */}
            {defaultTemplates.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Templates Padrão
                </h2>
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {defaultTemplates.map((template) => (
                    <Card key={template.id} className="quantum-glass">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              {template.name}
                              <Badge variant="secondary" className="text-xs">Padrão</Badge>
                            </CardTitle>
                            <Badge variant="outline" className={getCategoryColor(template.category)}>
                              {getCategoryLabel(template.category)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {template.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Editar Template" : "Novo Template"}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate 
                  ? "Atualize as informações do template de mensagem."
                  : "Crie um novo template de mensagem para reengajamento."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input
                  id="template-name"
                  placeholder="Ex: Lembrete amigável"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-category">Categoria</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Variáveis disponíveis</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_VARIABLES.map((variable) => (
                    <Button
                      key={variable.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => insertVariable(variable.name)}
                      title={variable.description}
                    >
                      {`{{${variable.name}}}`}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
                <Textarea
                  id="template-content"
                  placeholder="Olá {{pushName}}! 👋 Notamos que você não concluiu seu cadastro..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={5}
                  maxLength={1000}
                />
                <div className="flex justify-end">
                  <CharCounter current={formContent.length} max={1000} />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? "Salvando..." : editingTemplate ? "Atualizar" : "Criar Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir template?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o template "{templateToDelete?.name}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
