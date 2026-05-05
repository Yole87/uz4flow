import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChevronDown, Copy, Trash2, FileText, MessageSquare, Workflow, Plus, Save } from "lucide-react";
import { toast } from "sonner";

interface FollowUpTemplatesProps {
  onLoadTemplate?: (template: any) => void;
}

export function FollowUpTemplates({ onLoadTemplate }: FollowUpTemplatesProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formScript, setFormScript] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formWhatsappEnabled, setFormWhatsappEnabled] = useState(false);
  const [formWhatsappText, setFormWhatsappText] = useState("");
  const [formWebhookEnabled, setFormWebhookEnabled] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["followup-templates", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("followup_templates")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // Auto-create default template for new orgs
  const defaultCreatedRef = useRef(false);
  useEffect(() => {
    if (!organization?.id || isLoading || defaultCreatedRef.current) return;
    if (templates.length === 0) {
      defaultCreatedRef.current = true;
      supabase.from("followup_templates").insert({
        organization_id: organization.id,
        name: "Remarketing - Modelo Padrão",
        script_content: "Olá {{NOME}}, tudo bem? Aqui é da equipe comercial.\n\nEstou entrando em contato porque temos uma condição especial disponível para você.\n\nGostaria de saber se posso te apresentar os detalhes?",
        call_reason: "Remarketing / Reativação de cliente",
        whatsapp_followup_enabled: true,
        whatsapp_followup_text: "Olá {{NOME}}! Conforme conversamos na ligação, segue o material com os detalhes da nossa proposta. Qualquer dúvida, estou à disposição!",
        webhook_enabled: false,
      }).then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["followup-templates"] });
        }
      });
    }
  }, [organization?.id, templates.length, isLoading]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("Organização não encontrada");
      if (templates.length >= 5) throw new Error("Limite de 5 templates atingido");
      if (!formName.trim()) throw new Error("Nome é obrigatório");
      const { error } = await supabase.from("followup_templates").insert({
        organization_id: organization.id,
        name: formName.trim(),
        script_content: formScript || null,
        call_reason: formReason || null,
        whatsapp_followup_enabled: formWhatsappEnabled,
        whatsapp_followup_text: formWhatsappEnabled ? formWhatsappText : null,
        webhook_enabled: formWebhookEnabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-templates"] });
      toast.success("Template criado");
      resetForm();
      setShowCreateDialog(false);
    },
    onError: () => toast.error("Erro ao salvar template"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: any) => {
      if (templates.length >= 5) throw new Error("Limite de 5 templates atingido");
      const { id, created_at, updated_at, ...rest } = template;
      const { error } = await supabase
        .from("followup_templates")
        .insert({ ...rest, name: `${rest.name} (cópia)` });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-templates"] });
      toast.success("Template duplicado");
    },
    onError: () => toast.error("Erro ao duplicar template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("followup_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-templates"] });
      toast.success("Template excluído");
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormScript("");
    setFormReason("");
    setFormWhatsappEnabled(false);
    setFormWhatsappText("");
    setFormWebhookEnabled(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{templates.length}/5 templates salvos</p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={templates.length >= 5}
          onClick={() => { resetForm(); setShowCreateDialog(true); }}
        >
          <Plus className="h-3 w-3" />
          Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum template salvo</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Crie um template para reutilizar configurações em suas campanhas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Collapsible key={t.id}>
              <div className="border border-border rounded-lg">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onLoadTemplate && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onLoadTemplate(t)}>
                        Usar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateMutation.mutate(t)} title="Duplicar">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O template "{t.name}" será excluído permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(t.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                    {t.call_reason && (
                      <p className="text-xs text-muted-foreground">
                        <strong>Motivo:</strong> {t.call_reason}
                      </p>
                    )}
                    {t.script_content && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        <strong>Script:</strong> {t.script_content}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {t.whatsapp_followup_enabled && (
                        <Badge variant="outline" className="text-xs">
                          <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                        </Badge>
                      )}
                      {t.webhook_enabled && (
                        <Badge variant="outline" className="text-xs">
                          <Workflow className="h-3 w-3 mr-1" /> Fluxo
                        </Badge>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Template</DialogTitle>
            <DialogDescription>Crie um template para reutilizar em campanhas de follow-up.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-sm">Nome do Template *</Label>
              <Input placeholder="Ex: Lembrete de vencimento" value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Motivo da Ligação</Label>
              <Input placeholder="Ex: Lembrete de fatura" value={formReason} onChange={(e) => setFormReason(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Texto da Ligação (Script)</Label>
              <Textarea
                placeholder="Olá {{NOME}}, estamos entrando em contato..."
                value={formScript}
                onChange={(e) => setFormScript(e.target.value)}
                rows={4}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Não inclua frases de encerramento. A IA encerra automaticamente.
              </p>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                <Label className="text-sm">WhatsApp CTA</Label>
              </div>
              <Switch checked={formWhatsappEnabled} onCheckedChange={setFormWhatsappEnabled} />
            </div>
            {formWhatsappEnabled && (
              <div>
                <Label className="text-sm">Texto do WhatsApp</Label>
                <Textarea
                  placeholder="Mensagem de follow-up via WhatsApp..."
                  value={formWhatsappText}
                  onChange={(e) => setFormWhatsappText(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-accent" />
                <Label className="text-sm">Webhook / Fluxo</Label>
              </div>
              <Switch checked={formWebhookEnabled} onCheckedChange={setFormWebhookEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formName.trim()}>
              <Save className="h-4 w-4 mr-1" />
              {createMutation.isPending ? "Salvando..." : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
