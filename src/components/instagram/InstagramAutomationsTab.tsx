import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useInstagramAutomations, InstagramAutomation } from "@/hooks/useInstagramAutomations";
import { useInstagramAccounts } from "@/hooks/useInstagramAccounts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InstagramAutomationEditor } from "./InstagramAutomationEditor";
import { Plus, Pencil, Trash2, Copy, Play, Bot, Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";

export function InstagramAutomationsTab() {
  const { automations, isLoadingAutomations, toggleAutomation, deleteAutomation, simulateAutomation, createAutomation } = useInstagramAutomations();
  const { accounts } = useInstagramAccounts();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<InstagramAutomation | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const [simAutomation, setSimAutomation] = useState<InstagramAutomation | null>(null);
  const [simMockText, setSimMockText] = useState("");

  const handleEdit = (a: InstagramAutomation) => {
    setEditingAutomation(a);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setEditingAutomation(null);
    setEditorOpen(true);
  };

  const handleDuplicate = (a: InstagramAutomation) => {
    createAutomation.mutate({
      name: `${a.name} (cópia)`,
      description: a.description,
      trigger_type: a.trigger_type,
      definition_json: a.definition_json,
      account_id: a.account_id,
    });
  };

  const openSimDialog = (a: InstagramAutomation) => {
    setSimAutomation(a);
    setSimMockText("");
    setSimResult(null);
    setSimDialogOpen(true);
  };

  const handleSimulate = async () => {
    if (!simAutomation) return;
    try {
      const result = await simulateAutomation.mutateAsync({ id: simAutomation.id, mock_text: simMockText || "Olá" });
      setSimResult(result);
    } catch {
      toast.error("Erro ao simular automação");
    }
  };

  const triggerLabels: Record<string, string> = {
    dm_received: "DM Recebida",
    comment_received: "Comentário",
  };

  if (isLoadingAutomations) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Crie automações para responder DMs e comentários automaticamente.</p>
        <Button onClick={handleNew} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nova Automação
        </Button>
      </div>

      {automations.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Bot}
          title="Nenhuma automação criada"
          description="Crie sua primeira automação para responder automaticamente a DMs e comentários do Instagram com fluxos personalizados."
          action={{
            label: "Criar automação",
            onClick: handleNew,
            icon: Plus,
          }}
        />
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <Card key={a.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{a.name}</span>
                      <Badge variant="outline" className="text-xs">{triggerLabels[a.trigger_type] ?? a.trigger_type}</Badge>
                      <Badge variant={a.is_enabled ? "default" : "secondary"} className="text-xs">
                        {a.is_enabled ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {a.description && <p className="text-sm text-muted-foreground mt-1 truncate">{a.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{a.execution_count} execuções</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Switch
                      checked={a.is_enabled}
                      onCheckedChange={(v) => toggleAutomation.mutate({ id: a.id, is_enabled: v })}
                    />
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleEdit(a)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openSimDialog(a)} disabled={simulateAutomation.isPending}>
                      {simulateAutomation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                      Simular
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleDuplicate(a)}>
                      <Copy className="h-3 w-3 mr-1" /> Duplicar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => deleteAutomation.mutate(a.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] !overflow-y-auto [&]:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAutomation ? "Editar Automação" : "Nova Automação"}</DialogTitle>
          </DialogHeader>
          <InstagramAutomationEditor
            automation={editingAutomation}
            accounts={accounts}
            onClose={() => setEditorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Simulation Dialog */}
      <Dialog open={simDialogOpen} onOpenChange={(v) => { if (!v) { setSimDialogOpen(false); setSimResult(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Simular Automação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Texto de teste (simula a mensagem recebida)</label>
              <Input
                value={simMockText}
                onChange={(e) => setSimMockText(e.target.value)}
                placeholder="Ex: Titan, Olá quero saber mais..."
                className="bg-muted border-border"
              />
            </div>
            <Button onClick={handleSimulate} disabled={simulateAutomation.isPending} className="w-full">
              {simulateAutomation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Executar Simulação
            </Button>
            {simResult && (
              <div className="space-y-3">
                {/* Status card */}
                <div className={`flex items-center gap-3 p-4 rounded-lg border ${simResult.matched ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"}`}>
                  {simResult.matched ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-destructive shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">{simResult.matched ? "Keyword reconhecida ✓" : "Keyword não reconhecida"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {simResult.conditions_evaluated?.keywords?.length
                        ? `Keywords: ${simResult.conditions_evaluated.keywords.join(", ")} | Modo: ${simResult.conditions_evaluated.match_type}`
                        : "Sem condições configuradas"}
                    </p>
                  </div>
                </div>

                {/* Steps list */}
                {simResult.steps?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Passos ({simResult.steps.length})</p>
                    {simResult.steps.map((step: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                        <Badge variant="secondary" className="text-xs shrink-0 w-6 h-5 flex items-center justify-center p-0">{idx + 1}</Badge>
                        <span className="text-foreground flex-1">{step.type}</span>
                        {step.would_execute ? (
                          <Badge variant="default" className="text-xs">Executaria</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Não executaria</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
