import { useState } from "react";
import { useInstagramAutomations } from "@/hooks/useInstagramAutomations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CharCounter } from "@/components/ui/char-counter";
import { Plus, Pencil, Trash2, Copy, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function InstagramTemplatesTab() {
  const { templates, isLoadingTemplates, createTemplate, updateTemplate, deleteTemplate } = useInstagramAutomations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "general", body: "" });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: "general", body: "" });
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, category: t.category, body: t.body });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error("Preencha nome e corpo do template");
      return;
    }
    if (editing) {
      updateTemplate.mutate({ id: editing.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createTemplate.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDuplicate = (t: any) => {
    createTemplate.mutate({ name: `${t.name} (cópia)`, category: t.category, body: t.body });
  };

  if (isLoadingTemplates) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-1">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-accent" />
          O que são Templates?
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Templates são <strong>modelos de mensagem reutilizáveis</strong> (saudações, FAQs, promoções etc.).
          Ao configurar passos como "Enviar DM" ou "Perguntar e aguardar" no Editor de Automações, você pode
          selecionar um template pelo botão "Usar template" para preencher o campo de mensagem automaticamente,
          evitando reescrever o mesmo texto toda vez.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Templates de mensagem reutilizáveis para automações.</p>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="quantum-glass rounded-xl p-8 text-center space-y-3">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-foreground font-medium">Nenhum template</h3>
          <p className="text-sm text-muted-foreground">Crie templates para reutilizar nas automações.</p>
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Criar Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t: any) => (
            <Card key={t.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground truncate">{t.name}</span>
                  <Badge variant="secondary" className="text-xs shrink-0">{t.category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{t.body}</p>
                <div className="flex gap-1.5 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)} className="h-7 px-2 text-xs">
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicate(t)} className="h-7 px-2 text-xs">
                    <Copy className="h-3 w-3 mr-1" /> Duplicar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteTemplate.mutate(t.id)} className="h-7 px-2 text-xs text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Saudação inicial" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="greeting">Saudação</SelectItem>
                  <SelectItem value="capture">Captação</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="promo">Promoção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Corpo da mensagem</Label>
                <CharCounter current={form.body.length} max={1000} />
              </div>
              <Textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Olá! Obrigado por entrar em contato..." rows={5} className="bg-muted border-border" />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={createTemplate.isPending || updateTemplate.isPending}>
              {(createTemplate.isPending || updateTemplate.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar Alterações" : "Criar Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
