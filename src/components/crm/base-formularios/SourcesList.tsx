import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeads, updateSource, getNewLeadsCount, softDeleteSource } from "@/services/prospectSourceService";
import type { ProspectSource } from "@/types/prospect";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

interface SourcesListProps {
  sources: ProspectSource[];
  onManage: (id: string) => void;
  onRefresh: () => void;
}

function SourceCard({
  source,
  onManage,
  onRefresh,
}: {
  source: ProspectSource;
  onManage: (id: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(source.name);

  // Fetch lead count — use page 0, pageSize 1 just to get the total count
  const { data: leadsResult } = useQuery({
    queryKey: ["prospect-leads-count", source.id],
    queryFn: () => getLeads(source.id, 0, 1),
    staleTime: 1000 * 60 * 2,
  });

  const lastVisit = localStorage.getItem(`last_visit_${source.id}`) || "1970-01-01T00:00:00.000Z";

  // Fetch count of new leads
  const { data: newLeadsCount = 0 } = useQuery({
    queryKey: ["prospect-new-leads-count", source.id, lastVisit],
    queryFn: () => getNewLeadsCount(source.id, lastVisit),
    staleTime: 1000 * 60 * 2,
  });

  const toggleMutation = useMutation({
    mutationFn: (newActive: boolean) =>
      updateSource(source.id, { is_active: newActive }),
    onSuccess: () => {
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ["prospect-source", source.id] });
      queryClient.invalidateQueries({ queryKey: ["prospect-total-new-leads"] });
    },
    onError: () => toast.error("Erro ao alterar status da fonte"),
  });

  const editMutation = useMutation({
    mutationFn: (newName: string) => updateSource(source.id, { name: newName }),
    onSuccess: () => {
      toast.success("Nome da fonte atualizado");
      setIsEditing(false);
      onRefresh();
    },
    onError: () => toast.error("Erro ao atualizar o nome da fonte"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteSource(source.id),
    onSuccess: () => {
      toast.success("Fonte movida para a lixeira");
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ["deleted-prospect-sources"] });
    },
    onError: () => toast.error("Erro ao excluir fonte"),
  });

  const handleSave = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditName(source.name);
      setIsEditing(false);
      return;
    }
    if (trimmed === source.name) {
      setIsEditing(false);
      return;
    }
    editMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditName(source.name);
      setIsEditing(false);
    }
  };

  return (
    <Card 
      className="border-border hover:border-accent/40 transition-colors cursor-pointer"
      onClick={() => onManage(source.id)}
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
              <p className="font-semibold text-foreground truncate">{source.name}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Criado em {new Date(source.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge
              variant="outline"
              className={
                source.is_active
                  ? "bg-success/10 text-success border-success/30 shrink-0"
                  : "bg-muted text-muted-foreground border-border shrink-0"
              }
            >
              {source.is_active ? "Ativa" : "Inativa"}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditName(source.name);
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
                  <AlertDialogTitle>Excluir fonte de webhook</AlertDialogTitle>
                  <AlertDialogDescription>
                    Excluir esta fonte moverá ela e todos os seus leads para a lixeira. Deseja continuar?
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
        {/* Lead count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {leadsResult !== undefined ? (
            <div className="flex items-center gap-1.5 flex-wrap text-muted-foreground">
              <span>
                {leadsResult.count} lead{leadsResult.count !== 1 ? "s" : ""}
              </span>
              {newLeadsCount > 0 && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30 font-medium px-1.5 py-0.5 text-[11px] h-5">
                    {newLeadsCount} novo{newLeadsCount !== 1 ? "s" : ""}
                  </Badge>
                </>
              )}
            </div>
          ) : (
            <Loader2 className="h-3 w-3 animate-spin inline" />
          )}
        </div>

        {/* Toggle only (Manage button removed) */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={source.is_active}
              onCheckedChange={(val) => toggleMutation.mutate(val)}
              disabled={toggleMutation.isPending}
              aria-label="Ativar ou desativar fonte"
            />
            <span className={`text-xs ${source.is_active ? "text-success font-medium" : "text-destructive"}`}>
              {source.is_active ? "Ativa" : "Inativa"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export function SourcesList({ sources, onManage, onRefresh }: SourcesListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sources.map((source) => (
        <SourceCard
          key={source.id}
          source={source}
          onManage={onManage}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
