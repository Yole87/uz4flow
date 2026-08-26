import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import {
  getForms,
  getDeletedForms,
  updateForm,
  softDeleteForm,
  restoreForm,
  permanentDeleteForm,
  getFormResponses,
  getNewFormResponsesCount,
} from "@/services/uzFormService";
import type { UzForm } from "@/types/uzForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Users, Pencil, Trash2, RotateCcw, ChevronDown, ChevronRight, FileText, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UzFormsListProps {
  organizationId: string;
  onCreateOpen: () => void;
}

function FormCard({
  form,
  onRefresh,
}: {
  form: UzForm;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(form.name);

  // Fetch responses count and latest response (pageSize=1)
  const { data: responsesResult } = useQuery({
    queryKey: ["uz-form-responses-count", form.id],
    queryFn: () => getFormResponses(form.id, 0, 1),
    staleTime: 1000 * 60 * 2,
  });

  const responsesCount = responsesResult?.count ?? 0;

  // Congela a marcação de "visto" no momento da montagem para o selo não piscar/voltar.
  const [lastVisit] = useState(
    () => localStorage.getItem(`last_visit_form_${form.id}`) || "1970-01-01T00:00:00.000Z",
  );

  // Após exibir o card, marca como visto e atualiza o selo do menu lateral.
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`last_visit_form_${form.id}`, new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ["prospect-total-new-leads"] });
    }, 2000);
    return () => clearTimeout(timer);
  }, [form.id, queryClient]);

  // Fetch count of new responses since last visit
  const { data: newResponsesCount = 0 } = useQuery({
    queryKey: ["uz-form-new-responses-count", form.id, lastVisit],
    queryFn: () => getNewFormResponsesCount(form.id, lastVisit),
    staleTime: 1000 * 60 * 2,
  });

  const toggleMutation = useMutation({
    mutationFn: (newActive: boolean) =>
      updateForm(form.id, { is_active: newActive }),
    onSuccess: () => {
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ["uz-form", form.id] });
    },
    onError: () => toast.error("Erro ao alterar status do formulário"),
  });

  const editMutation = useMutation({
    mutationFn: (newName: string) => updateForm(form.id, { name: newName }),
    onSuccess: () => {
      toast.success("Nome do formulário atualizado");
      setIsEditing(false);
      onRefresh();
    },
    onError: () => toast.error("Erro ao atualizar o nome da fonte"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteForm(form.id),
    onSuccess: () => {
      toast.success("Formulário movido para a lixeira");
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ["deleted-uz-forms", form.organization_id] });
    },
    onError: () => toast.error("Erro ao excluir formulário"),
  });

  const handleSave = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditName(form.name);
      setIsEditing(false);
      return;
    }
    if (trimmed === form.name) {
      setIsEditing(false);
      return;
    }
    editMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditName(form.name);
      setIsEditing(false);
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/f/${form.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link do formulário copiado!");
  };

  return (
    <Card 
      className="border-border hover:border-accent/40 transition-colors cursor-pointer"
      onClick={() => navigate(`/base-formularios/form/${form.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="w-full text-sm font-semibold bg-background border border-input rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <p className="font-semibold text-foreground truncate">{form.name}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Criado em {new Date(form.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge
              variant="outline"
              className={
                form.is_active
                  ? "bg-success/10 text-success border-success/30 shrink-0"
                  : "bg-muted text-muted-foreground border-border shrink-0"
              }
            >
              {form.is_active ? "Ativo" : "Inativo"}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditName(form.name);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir formulário</AlertDialogTitle>
                  <AlertDialogDescription>
                    Excluir este formulário moverá ele e todas as suas respostas para a lixeira. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => deleteMutation.mutate()}
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Response count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {responsesResult !== undefined ? (
            <div className="flex items-center gap-1.5 flex-wrap text-muted-foreground">
              <span>
                {responsesCount} resposta{responsesCount !== 1 ? "s" : ""}
              </span>
              {newResponsesCount > 0 && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30 font-medium px-1.5 py-0.5 text-[11px] h-5">
                    {newResponsesCount} {newResponsesCount === 1 ? "nova" : "novas"}
                  </Badge>
                </>
              )}
            </div>
          ) : (
            <Loader2 className="h-3 w-3 animate-spin inline" />
          )}
        </div>

        {/* Public link chip */}
        <div className="flex items-center gap-2 pt-1 border-t border-border" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground font-medium shrink-0">Link público:</span>
          <div
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-[11px] font-mono cursor-pointer border border-border transition-colors truncate max-w-full"
          >
            <span className="truncate">/f/{form.token}</span>
            <Copy className="h-3.5 w-3.5 shrink-0" />
          </div>
        </div>

        {/* Toggle switch */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={form.is_active}
              onCheckedChange={(val) => toggleMutation.mutate(val)}
              disabled={toggleMutation.isPending}
              aria-label="Ativar ou desativar formulário"
            />
            <span className={`text-xs ${form.is_active ? "text-success font-medium" : "text-destructive"}`}>
              {form.is_active ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UzFormsList({ organizationId, onCreateOpen }: UzFormsListProps) {
  const queryClient = useQueryClient();
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const { plan, features } = useOrganizationSubscription();

  const handleCreateClick = () => {
    const limits = (plan?.limits as any) || {};
    const allowsForms = features.includes("uz_forms") || limits.uz_forms_enabled;
    if (!allowsForms) {
      toast.error("Seu plano não inclui formulários com URL. Faça upgrade para usar este recurso.");
      return;
    }

    const currentCount = forms?.length ?? 0;
    const maxForms = limits.max_uz_forms ?? -1;
    if (maxForms !== -1 && currentCount >= maxForms) {
      toast.error("Você atingiu o limite de formulários do seu plano.");
      return;
    }

    onCreateOpen();
  };

  const { data: forms, isLoading, refetch } = useQuery({
    queryKey: ["uz-forms", organizationId],
    queryFn: () => getForms(organizationId),
    enabled: !!organizationId,
  });

  const { data: deletedForms } = useQuery({
    queryKey: ["deleted-uz-forms", organizationId],
    queryFn: () => getDeletedForms(organizationId),
    enabled: !!organizationId,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreForm(id),
    onSuccess: () => {
      toast.success("Formulário recuperado. Ative o toggle para reativar.");
      queryClient.invalidateQueries({ queryKey: ["uz-forms", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["deleted-uz-forms", organizationId] });
    },
    onError: () => {
      toast.error("Erro ao recuperar formulário");
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => permanentDeleteForm(id),
    onSuccess: () => {
      toast.success("Formulário excluído definitivamente");
      queryClient.invalidateQueries({ queryKey: ["deleted-uz-forms", organizationId] });
    },
    onError: () => {
      toast.error("Erro ao excluir formulário definitivamente");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const hasForms = forms && forms.length > 0;

  return (
    <div className="space-y-6">
      {!hasForms ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <FileText className="h-8 w-8 text-accent" />
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">Nenhum formulário criado ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie seu primeiro formulário para começar a coletar leads de forma personalizada
            </p>
          </div>
          <Button
            onClick={handleCreateClick}
            className="gradient-primary hover:opacity-90 text-primary-foreground"
          >
            Criar primeiro formulário
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      {deletedForms && deletedForms.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-foreground">
                {isCollapsibleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium text-sm">
                  Formulários excluídos ({deletedForms.length})
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              <div className="rounded-md border border-border divide-y divide-border bg-card">
                {deletedForms.map((form) => (
                  <div key={form.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{form.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Excluído em {form.deleted_at ? new Date(form.deleted_at).toLocaleDateString("pt-BR") : "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-success hover:text-success hover:bg-success/10 gap-1.5 h-8"
                        onClick={() => restoreMutation.mutate(form.id)}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Recuperar
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={permanentDeleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir permanentemente</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação é irreversível e apagará todos os passos, campos e respostas deste formulário. Confirmar?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              onClick={() => permanentDeleteMutation.mutate(form.id)}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
