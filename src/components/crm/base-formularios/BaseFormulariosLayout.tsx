import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { getForms } from "@/services/uzFormService";
import {
  getSources,
  getDeletedSources,
  restoreSource,
  permanentDeleteSource,
} from "@/services/prospectSourceService";
import { Button } from "@/components/ui/button";
import { Plus, Database, Loader2, RotateCcw, Trash2, ChevronDown, ChevronRight, FileText, Globe } from "lucide-react";
import { SourcesList } from "./SourcesList";
import { CreateSourceDialog } from "./CreateSourceDialog";
import { SourceDetail } from "./SourceDetail";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UzFormsList } from "./UzFormsList";
import { CreateFormDialog } from "./CreateFormDialog";

export function BaseFormulariosLayout() {
  const navigate = useNavigate();
  const { sourceId } = useParams<{ sourceId?: string }>();
  const { data: org } = useUserOrganization();
  const [createOpen, setCreateOpen] = useState(false);
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"webhooks" | "formularios">("webhooks");
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const queryClient = useQueryClient();

  const { plan, features } = useOrganizationSubscription();

  const { data: forms } = useQuery({
    queryKey: ["uz-forms", org?.id],
    queryFn: () => getForms(org!.id),
    enabled: !!org?.id,
  });

  const handleCreateFormClick = () => {
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

    setCreateFormOpen(true);
  };

  const { data: sources, isLoading } = useQuery({
    queryKey: ["prospect-sources", org?.id],
    queryFn: () => getSources(org!.id),
    enabled: !!org?.id,
  });

  const { data: deletedSources } = useQuery({
    queryKey: ["deleted-prospect-sources", org?.id],
    queryFn: () => getDeletedSources(org!.id),
    enabled: !!org?.id,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreSource(id),
    onSuccess: () => {
      toast.success("Fonte recuperada. Ative o toggle para reativar.");
      queryClient.invalidateQueries({ queryKey: ["prospect-sources", org?.id] });
      queryClient.invalidateQueries({ queryKey: ["deleted-prospect-sources", org?.id] });
    },
    onError: () => {
      toast.error("Erro ao recuperar fonte");
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => permanentDeleteSource(id),
    onSuccess: () => {
      toast.success("Fonte excluída definitivamente");
      queryClient.invalidateQueries({ queryKey: ["deleted-prospect-sources", org?.id] });
    },
    onError: () => {
      toast.error("Erro ao excluir fonte definitivamente");
    },
  });

  // If navigated to /base-formularios/:sourceId, show detail view
  if (sourceId) {
    return (
      <SourceDetail
        sourceId={sourceId}
        onBack={() => navigate("/base-formularios")}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-x-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground truncate">Base e Formulários</h2>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            Gerencie fontes de webhooks e crie formulários multi-etapa personalizados.
          </p>
        </div>
        {activeTab === "webhooks" ? (
          <Button
            onClick={() => setCreateOpen(true)}
            className="gradient-primary hover:opacity-90 text-primary-foreground shrink-0 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Fonte
          </Button>
        ) : (
          <Button
            onClick={handleCreateFormClick}
            className="gradient-primary hover:opacity-90 text-primary-foreground shrink-0 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Formulário
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "webhooks" | "formularios")}
        className="space-y-4"
      >
        <TabsList className="bg-background border border-border/50">
          <TabsTrigger value="webhooks" className="gap-2">
            <Globe className="h-4 w-4" />
            Via Cadastros
          </TabsTrigger>
          <TabsTrigger value="formularios" className="gap-2">
            <FileText className="h-4 w-4" />
            Via Uz4Forms
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-6 mt-0">
          {/* Empty state */}
          {(!sources || sources.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Database className="h-8 w-8 text-accent" />
              </div>
              <div className="text-center">
                <p className="text-foreground font-medium">Nenhuma fonte criada ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie sua primeira fonte para começar a receber leads via webhook
                </p>
              </div>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gradient-primary hover:opacity-90 text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira fonte
              </Button>
            </div>
          ) : (
            <SourcesList
              sources={sources}
              onManage={(id) => navigate(`/base-formularios/${id}`)}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ["prospect-sources", org?.id] });
                queryClient.invalidateQueries({ queryKey: ["deleted-prospect-sources", org?.id] });
              }}
            />
          )}

          {deletedSources && deletedSources.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen} className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-foreground">
                    {isCollapsibleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium text-sm">
                      Fontes excluídas ({deletedSources.length})
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <div className="rounded-md border border-border divide-y divide-border bg-card">
                    {deletedSources.map((source) => (
                      <div key={source.id} className="flex items-center justify-between p-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{source.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Excluída em {source.deleted_at ? new Date(source.deleted_at).toLocaleDateString("pt-BR") : "N/A"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-success hover:text-success hover:bg-success/10 gap-1.5 h-8"
                            onClick={() => restoreMutation.mutate(source.id)}
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
                                  Esta ação é irreversível e apagará todos os leads desta fonte. Confirmar?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  onClick={() => permanentDeleteMutation.mutate(source.id)}
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
        </TabsContent>

        <TabsContent value="formularios" className="space-y-6 mt-0">
          <UzFormsList
            organizationId={org?.id ?? ""}
            onCreateOpen={handleCreateFormClick}
          />
        </TabsContent>
      </Tabs>

      <CreateSourceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={org?.id ?? ""}
        onCreated={(newId) => {
          queryClient.invalidateQueries({ queryKey: ["prospect-sources", org?.id] });
          navigate(`/base-formularios/${newId}`);
        }}
      />

      <CreateFormDialog
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
        organizationId={org?.id ?? ""}
      />
    </div>
  );
}
