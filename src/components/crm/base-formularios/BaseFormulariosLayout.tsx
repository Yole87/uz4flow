import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { getSources } from "@/services/prospectSourceService";
import { Button } from "@/components/ui/button";
import { Plus, Database, Loader2 } from "lucide-react";
import { SourcesList } from "./SourcesList";
import { CreateSourceDialog } from "./CreateSourceDialog";
import { SourceDetail } from "./SourceDetail";

export function BaseFormulariosLayout() {
  const navigate = useNavigate();
  const { sourceId } = useParams<{ sourceId?: string }>();
  const { data: org } = useUserOrganization();
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sources, isLoading } = useQuery({
    queryKey: ["prospect-sources", org?.id],
    queryFn: () => getSources(org!.id),
    enabled: !!org?.id,
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fontes de Formulário</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie as fontes de webhook conectadas a formulários externos (Elementor, Typeform, etc.)
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gradient-primary hover:opacity-90 text-primary-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Fonte
        </Button>
      </div>

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
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["prospect-sources", org?.id] })}
        />
      )}

      <CreateSourceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={org?.id ?? ""}
        onCreated={(newId) => {
          queryClient.invalidateQueries({ queryKey: ["prospect-sources", org?.id] });
          navigate(`/base-formularios/${newId}`);
        }}
      />
    </div>
  );
}
