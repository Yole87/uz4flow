import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface ConnectorEvent {
  id: string;
  connector_id: string;
  received_payload: Record<string, unknown>;
  transformed_payload: Record<string, unknown> | null;
  generated_message: string | null;
  status: string;
  error_message: string | null;
  openbot_response: Record<string, unknown> | null;
  created_at: string;
}

interface Connector {
  id: string;
  name: string;
  source_type: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "Pendente", icon: <Clock className="h-4 w-4" />, color: "bg-warning/10 text-warning" },
  processing: { label: "Processando", icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "bg-accent/10 text-accent" },
  sending: { label: "Enviando", icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "bg-accent/10 text-accent" },
  sent: { label: "Enviado", icon: <CheckCircle className="h-4 w-4" />, color: "bg-success/10 text-success" },
  failed: { label: "Falhou", icon: <XCircle className="h-4 w-4" />, color: "bg-destructive/10 text-destructive" },
  discovery: { label: "Descoberta", icon: <Eye className="h-4 w-4" />, color: "bg-secondary/10 text-secondary" },
};

export default function ConnectorHistory() {
  const { id } = useParams<{ id: string }>();
  const [connector, setConnector] = useState<Connector | null>(null);
  const [events, setEvents] = useState<ConnectorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<ConnectorEvent | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch connector
      const { data: connectorData, error: connectorError } = await supabase
        .from("webhook_connectors")
        .select("id, name, source_type")
        .eq("id", id)
        .single();

      if (connectorError) throw connectorError;
      setConnector(connectorData as Connector);

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from("connector_events")
        .select("*")
        .eq("connector_id", id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;
      setEvents((eventsData as ConnectorEvent[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar histórico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AppLayout title="Histórico" description="Eventos recebidos pelo conector">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Histórico: ${connector?.name || ''}`} description="Eventos recebidos pelo conector">
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/connectors")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{events.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {events.filter(e => e.status === "sent").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Falhas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {events.filter(e => e.status === "failed").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Descobertas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {events.filter(e => e.status === "discovery").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Events Table */}
        <Card>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum evento registrado ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Mensagem</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(event => {
                    const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending;
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            {statusConfig.icon}
                            <span className="ml-1">{statusConfig.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate hidden sm:table-cell">
                          {event.generated_message || event.error_message || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Evento</DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <Tabs defaultValue="received">
              <TabsList className="w-full flex-wrap h-auto gap-1">
                <TabsTrigger value="received">Payload</TabsTrigger>
                <TabsTrigger value="transformed">Transformado</TabsTrigger>
                <TabsTrigger value="message">Mensagem</TabsTrigger>
                <TabsTrigger value="response">Resposta</TabsTrigger>
              </TabsList>

              <TabsContent value="received">
                <ScrollArea className="h-[400px]">
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto">
                    {JSON.stringify(selectedEvent.received_payload, null, 2)}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="transformed">
                <ScrollArea className="h-[400px]">
                  {selectedEvent.transformed_payload ? (
                    <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto">
                      {JSON.stringify(selectedEvent.transformed_payload, null, 2)}
                    </pre>
                  ) : (
                    <div className="p-4 text-muted-foreground text-center">
                      Nenhum payload transformado
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="message">
                <ScrollArea className="h-[400px]">
                  <div className="p-4 space-y-4">
                    {selectedEvent.generated_message ? (
                      <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
                        {selectedEvent.generated_message}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-center">
                        Nenhuma mensagem gerada
                      </div>
                    )}

                    {selectedEvent.error_message && (
                      <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                        <strong>Erro:</strong> {selectedEvent.error_message}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="response">
                <ScrollArea className="h-[400px]">
                  {selectedEvent.openbot_response ? (
                    <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto">
                      {JSON.stringify(selectedEvent.openbot_response, null, 2)}
                    </pre>
                  ) : (
                    <div className="p-4 text-muted-foreground text-center">
                      Nenhuma resposta do Sistema de WhatsApp AI
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
