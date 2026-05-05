import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  History,
  Map,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  StopCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/ui/empty-state";

interface ProspectSearch {
  id: string;
  keyword: string;
  location: string | null;
  social_networks: string[];
  whatsapp_only: boolean;
  provider_used: string;
  status: string;
  total_results: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function ProspectionHistory() {
  const { data: organization } = useUserOrganization();

  const { data: searches, isLoading } = useQuery({
    queryKey: ["prospect-searches", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from("prospect_searches")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ProspectSearch[];
    },
    enabled: !!organization?.id,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluída
          </Badge>
        );
      case "processing":
      case "running":
        return (
          <Badge className="bg-secondary/20 text-secondary border-secondary/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case "stopped":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <StopCircle className="h-3 w-3 mr-1" />
            Interrompida
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-border">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getProviderBadge = (providerUsed: string) => {
    if (providerUsed === "google_places") {
      return (
        <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/30">
          <Map className="h-3 w-3 mr-1" />
          Places API
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
        <Map className="h-3 w-3 mr-1" />
        Scraping
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!searches || searches.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={History}
        title="Sem histórico ainda"
        description="Suas buscas de prospecção aparecerão aqui assim que você iniciar a primeira."
      />
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-accent" />
          Histórico de Buscas
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Últimas {searches.length} buscas realizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Palavra-chave</TableHead>
                <TableHead className="text-muted-foreground">Localização</TableHead>
                <TableHead className="text-muted-foreground">Provedor</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-center">Resultados</TableHead>
                <TableHead className="text-muted-foreground">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searches.map((search) => (
                <TableRow key={search.id} className="border-border hover:bg-muted/50">
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{search.keyword}</p>
                      {search.social_networks.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Redes: {search.social_networks.join(", ")}
                        </p>
                      )}
                      {search.whatsapp_only && (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                          Apenas WhatsApp
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {search.location || "-"}
                  </TableCell>
                  <TableCell>
                    {getProviderBadge(search.provider_used)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(search.status)}
                    {search.error_message && (
                      <p className="text-xs text-destructive mt-1">{search.error_message}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{search.total_results}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(search.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
