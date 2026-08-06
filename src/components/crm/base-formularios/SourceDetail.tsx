import { useQuery } from "@tanstack/react-query";
import { getSources, getColumns } from "@/services/prospectSourceService";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Loader2, Database } from "lucide-react";
import { ColumnsConfig } from "./ColumnsConfig";
import { LeadsTable } from "./LeadsTable";

interface SourceDetailProps {
  sourceId: string;
  onBack: () => void;
}

export function SourceDetail({ sourceId, onBack }: SourceDetailProps) {
  const { data: org } = useUserOrganization();

  // Fetch the specific source from the org's source list
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["prospect-sources", org?.id],
    queryFn: () => getSources(org!.id),
    enabled: !!org?.id,
  });
  const source = sources?.find((s) => s.id === sourceId);

  const { data: columns = [], isLoading: columnsLoading } = useQuery({
    queryKey: ["prospect-columns", sourceId],
    queryFn: () => getColumns(sourceId),
    enabled: !!sourceId,
  });

  if (sourcesLoading || columnsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Database className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Fonte não encontrada</p>
        <Button variant="outline" onClick={onBack} className="border-border">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Voltar para lista de fontes"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{source.name}</h2>
          <p className="text-xs text-muted-foreground">
            {source.is_active ? "● Ativa" : "○ Inativa"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="quantum-glass border border-border/50">
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configurar Campos
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <ColumnsConfig source={source} columns={columns} />
        </TabsContent>

        <TabsContent value="leads">
          <LeadsTable source={source} columns={columns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
