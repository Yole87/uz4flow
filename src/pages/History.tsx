import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { toast } from "sonner";
import { translateError, shouldShowMarkAsFailed } from "@/lib/errorMessages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  User,
  Server,
  Webhook,
  Send,
  Zap,
  Info } from
"lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/ui/empty-state";

interface Event {
  id: string;
  instance_id: string;
  chat_id: string;
  push_name: string | null;
  message_id: string;
  message_text: string | null;
  received_payload_json: unknown;
  status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
  chosen_flow_id: string | null;
  flow?: {
    name: string;
  } | null;
}

interface EventAction {
  id: string;
  step_order: number;
  sent_payload_json: unknown;
  status: string;
  attempt_count: number;
  error_message: string | null;
  latency_ms: number | null;
  sent_at: string | null;
  step?: {
    step_type: string;
    text_content: string | null;
  } | null;
}

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
  connector?: {
    name: string;
    source_type: string;
  } | null;
}

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, color: "bg-warning text-warning-foreground" },
  processing: { label: "Processando", icon: Loader2, color: "bg-primary text-primary-foreground" },
  completed: { label: "Concluído", icon: CheckCircle, color: "bg-success text-success-foreground" },
  failed: { label: "Falhou", icon: XCircle, color: "bg-destructive text-destructive-foreground" },
  no_match: { label: "Sem regra", icon: AlertCircle, color: "bg-muted text-muted-foreground" },
  no_steps: { label: "Sem etapas", icon: AlertCircle, color: "bg-muted text-muted-foreground" },
  partial: { label: "Parcial", icon: AlertCircle, color: "bg-warning text-warning-foreground" }
};

const CONNECTOR_STATUS_CONFIG = {
  discovery: { label: "Descoberta", icon: Zap, color: "bg-secondary/10 text-secondary" },
  pending: { label: "Pendente", icon: Clock, color: "bg-warning text-warning-foreground" },
  processing: { label: "Processando", icon: Loader2, color: "bg-primary text-primary-foreground" },
  sending: { label: "Enviando", icon: Send, color: "bg-accent/10 text-accent" },
  sent: { label: "Enviado", icon: CheckCircle, color: "bg-success text-success-foreground" },
  failed: { label: "Falhou", icon: XCircle, color: "bg-destructive text-destructive-foreground" },
  timeout: { label: "Timeout", icon: AlertCircle, color: "bg-warning text-warning-foreground" }
};

// Detect events that are stuck (processing for more than 5 minutes)
function isStaleEvent(createdAt: string, status: string): boolean {
  if (!["processing", "sending", "pending"].includes(status)) return false;

  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - createdDate.getTime()) / (1000 * 60);

  return diffMinutes > 5;
}

function getEffectiveStatus(status: string, createdAt: string): string {
  return isStaleEvent(createdAt, status) ? "timeout" : status;
}

export default function History() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const [activeTab, setActiveTab] = useState<string>("openbot");
  const [events, setEvents] = useState<Event[]>([]);
  const [connectorEvents, setConnectorEvents] = useState<ConnectorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedConnectorEvent, setSelectedConnectorEvent] = useState<ConnectorEvent | null>(null);
  const [eventActions, setEventActions] = useState<EventAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [resendingConnector, setResendingConnector] = useState<string | null>(null);
  const [markingAsFailed, setMarkingAsFailed] = useState<string | null>(null);

  const handleMarkAsFailed = async (eventId: string, isConnector: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();

    try {
      setMarkingAsFailed(eventId);
      const table = isConnector ? "connector_events" : "events";

      const updateData = isConnector ?
      { status: "failed", error_message: "Marcado como falhou manualmente (timeout)" } :
      { status: "failed", error_message: "Marcado como falhou manualmente (timeout)", completed_at: new Date().toISOString() };

      const { error } = await supabase.
      from(table).
      update(updateData).
      eq("id", eventId);

      if (error) throw error;

      toast.success("Evento marcado como falhou");
      handleRefresh();
    } catch (error) {
      console.error("Error marking event as failed:", error);
      toast.error("Erro ao marcar evento como falhou");
    } finally {
      setMarkingAsFailed(null);
    }
  };

  useEffect(() => {
    if (!effectiveUserId) return;
    if (activeTab === "openbot") {
      fetchEvents();
    } else {
      fetchConnectorEvents();
    }
  }, [effectiveUserId, statusFilter, activeTab]);

  async function fetchEvents() {
    setLoading(true);
    try {
      let query = supabase.
      from("events").
      select(`
          *,
          flow:flows(name)
        `).
      eq("user_id", effectiveUserId!).
      order("created_at", { ascending: false }).
      limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }

  async function fetchConnectorEvents() {
    setLoading(true);
    try {
      let query = supabase.
      from("connector_events").
      select(`
          *,
          connector:webhook_connectors(name, source_type)
        `).
      eq("user_id", effectiveUserId!).
      order("created_at", { ascending: false }).
      limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConnectorEvents(data as ConnectorEvent[] || []);
    } catch (error) {
      console.error("Error fetching connector events:", error);
      toast.error("Erro ao carregar histórico de conectores");
    } finally {
      setLoading(false);
    }
  }

  const openEventDetails = async (event: Event) => {
    setSelectedEvent(event);
    setLoadingActions(true);

    try {
      const { data, error } = await supabase.
      from("event_actions").
      select(`
          *,
          step:flow_steps(step_type, text_content)
        `).
      eq("event_id", event.id).
      order("step_order", { ascending: true });

      if (error) throw error;
      setEventActions(data || []);
    } catch (error) {
      console.error("Error fetching event actions:", error);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setLoadingActions(false);
    }
  };

  const handleReprocess = async (event: Event) => {
    try {
      setReprocessing(event.id);

      // Reset event status to pending
      const { error } = await supabase.
      from("events").
      update({ status: "pending", error_message: null, retry_count: 0 }).
      eq("id", event.id);

      if (error) throw error;

      toast.success("Evento reenfileirado para processamento");
      fetchEvents();
    } catch (error) {
      console.error("Error reprocessing event:", error);
      toast.error("Erro ao reprocessar evento");
    } finally {
      setReprocessing(null);
    }
  };

  const handleResendConnectorEvent = async (event: ConnectorEvent, e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (event.status === "discovery") {
      toast.error("Eventos de descoberta não podem ser reenviados");
      return;
    }

    try {
      setResendingConnector(event.id);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Sessão não encontrada");
      }

      const response = await supabase.functions.invoke("resend-connector-event", {
        body: { event_id: event.id }
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao reenviar");
      }

      const result = response.data;

      if (result.success) {
        toast.success("Evento reenviado com sucesso!");
      } else {
        toast.error(result.error || "Falha ao reenviar evento");
      }

      fetchConnectorEvents();

      // Close dialog if open
      if (selectedConnectorEvent?.id === event.id) {
        setSelectedConnectorEvent(null);
      }
    } catch (error) {
      console.error("Error resending connector event:", error);
      toast.error("Erro ao reenviar evento");
    } finally {
      setResendingConnector(null);
    }
  };

  const filteredEvents = events.filter((event) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      event.chat_id.includes(query) ||
      event.instance_id.toLowerCase().includes(query) ||
      event.push_name?.toLowerCase().includes(query) ||
      event.message_text?.toLowerCase().includes(query));

  });

  const filteredConnectorEvents = connectorEvents.filter((event) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      event.connector?.name?.toLowerCase().includes(query) ||
      event.generated_message?.toLowerCase().includes(query) ||
      event.error_message?.toLowerCase().includes(query));

  });

  const handleRefresh = () => {
    if (activeTab === "openbot") {
      fetchEvents();
    } else {
      fetchConnectorEvents();
    }
  };

  const getSourceBadge = (sourceType: string) => {
    const sources: Record<string, {label: string;color: string;}> = {
      kiwify: { label: "Kiwify", color: "bg-success/10 text-success" },
      hotmart: { label: "Hotmart", color: "bg-warning/10 text-warning" },
      eduzz: { label: "Eduzz", color: "bg-accent/10 text-accent" },
      custom: { label: "Personalizado", color: "bg-muted text-muted-foreground" }
    };
    return sources[sourceType] || sources.custom;
  };

  if (loading) {
    return (
      <AppLayout title="Histórico" description="Veja todos os eventos recebidos e processados">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>);

  }

  return (
    <AppLayout title="Histórico" description="Veja todos os eventos recebidos e processados">
      <div className="space-y-6 animate-fade-in">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="quantum-glass border border-border/50 grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="openbot" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              WhatsApp AI
            </TabsTrigger>
            <TabsTrigger value="connectors" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Conectores
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === "openbot" ? "Buscar por número, instância, nome..." : "Buscar por conector, mensagem..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10" />

            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {activeTab === "openbot" ?
                <>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="failed">Falharam</SelectItem>
                  </> :

                <>
                    <SelectItem value="discovery">Descoberta</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="sent">Enviados</SelectItem>
                    <SelectItem value="failed">Falharam</SelectItem>
                  </>
                }
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* OpenBot Events */}
          <TabsContent value="openbot" className="mt-4">
            {loading ?
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div> :
            filteredEvents.length === 0 ?
            <EmptyState
              variant="card"
              icon={events.length === 0 ? Clock : Search}
              title={events.length === 0 ? "Sem histórico ainda" : "Nenhum evento com esses filtros"}
              description={events.length === 0 ?
              "As ações executadas via webhook do Sistema de WhatsApp AI aparecerão aqui. Configure a URL do webhook nas Configurações." :
              "Tente remover um filtro ou ampliar o intervalo de datas."
              }
            /> :

            <div className="space-y-3">
                {filteredEvents.map((event) => {
                const effectiveStatus = getEffectiveStatus(event.status, event.created_at);
                const statusKey = effectiveStatus as keyof typeof STATUS_CONFIG;
                const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const isStale = effectiveStatus === "timeout";
                return (
                  <Card
                    key={event.id}
                    className="group hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => openEventDetails(event)}>

                      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3 sm:py-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusConfig.color}`}>
                          <StatusIcon className={`h-5 w-5 ${event.status === "processing" ? "animate-spin" : ""}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-1">
                            <span className="font-medium">{event.push_name || "Desconhecido"}</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {event.chat_id}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {event.message_text || "(sem texto)"}
                          </p>
                          <div className="flex items-center flex-wrap gap-2 sm:gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              {event.instance_id}
                            </span>
                            <span>
                              {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                            {event.flow &&
                          <span className="text-primary">→ {event.flow.name}</span>
                          }
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          {shouldShowMarkAsFailed(event.status, effectiveStatus, event.error_message) &&
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleMarkAsFailed(event.id, false, e)}
                          disabled={markingAsFailed === event.id}
                          title="Marcar como falhou (erro desconhecido)">

                              {markingAsFailed === event.id ?
                          <Loader2 className="h-4 w-4 animate-spin" /> :

                          <XCircle className="h-4 w-4" />
                          }
                            </Button>
                        }
                          {event.status === "failed" &&
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReprocess(event);
                          }}
                          disabled={reprocessing === event.id}>

                              {reprocessing === event.id ?
                          <Loader2 className="h-4 w-4 animate-spin" /> :

                          <RefreshCw className="h-4 w-4" />
                          }
                            </Button>
                        }
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>);

              })}
              </div>
            }
          </TabsContent>

          {/* Connector Events */}
          <TabsContent value="connectors" className="mt-4">
            {loading ?
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div> :
            filteredConnectorEvents.length === 0 ?
            <EmptyState
              variant="card"
              icon={Webhook}
              title={connectorEvents.length === 0 ? "Sem eventos ainda" : "Nenhum evento com esses filtros"}
              description={connectorEvents.length === 0 ?
              "Aguardando webhooks de plataformas externas. Configure um conector para começar a receber eventos." :
              "Tente remover um filtro ou ampliar o intervalo de datas."
              }
            /> :

            <div className="space-y-3">
                {filteredConnectorEvents.map((event) => {
                const effectiveStatus = getEffectiveStatus(event.status, event.created_at);
                const statusKey = effectiveStatus as keyof typeof CONNECTOR_STATUS_CONFIG;
                const statusConfig = CONNECTOR_STATUS_CONFIG[statusKey] || CONNECTOR_STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const sourceBadge = getSourceBadge(event.connector?.source_type || "custom");
                const isStale = effectiveStatus === "timeout";
                return (
                  <Card
                    key={event.id}
                    className="group hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedConnectorEvent(event)}>

                      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3 sm:py-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusConfig.color}`}>
                          <StatusIcon className={`h-5 w-5 ${event.status === "processing" || event.status === "sending" ? "animate-spin" : ""}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-1">
                            <span className="font-medium">{event.connector?.name || "Conector Desconhecido"}</span>
                            <Badge className={sourceBadge.color}>
                              {sourceBadge.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {event.status === "discovery" ?
                          "(payload de descoberta)" :
                          event.generated_message || event.error_message || "(sem mensagem)"}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(event.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          {shouldShowMarkAsFailed(event.status, effectiveStatus, event.error_message) &&
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleMarkAsFailed(event.id, true, e)}
                          disabled={markingAsFailed === event.id}
                          title="Marcar como falhou (erro desconhecido)">

                              {markingAsFailed === event.id ?
                          <Loader2 className="h-4 w-4 animate-spin" /> :

                          <XCircle className="h-4 w-4" />
                          }
                            </Button>
                        }
                          {(event.status === "failed" || event.status === "sent") && !isStale &&
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleResendConnectorEvent(event, e)}
                          disabled={resendingConnector === event.id}
                          title="Reenviar evento">

                              {resendingConnector === event.id ?
                          <Loader2 className="h-4 w-4 animate-spin" /> :

                          <RefreshCw className="h-4 w-4" />
                          }
                            </Button>
                        }
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>);

              })}
              </div>
            }
          </TabsContent>
        </Tabs>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedEvent?.push_name || "Evento"}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.chat_id} • {selectedEvent?.instance_id}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent &&
          <div className="space-y-6">
              {/* Status and info */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge className={STATUS_CONFIG[selectedEvent.status as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.pending.color}>
                  {STATUS_CONFIG[selectedEvent.status as keyof typeof STATUS_CONFIG]?.label || selectedEvent.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(selectedEvent.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </span>
                {selectedEvent.flow &&
              <Badge variant="outline">
                    Fluxo: {selectedEvent.flow.name}
                  </Badge>
              }
              </div>

              {/* Error message - translated */}
              {selectedEvent.error_message && (() => {
              const translated = translateError(selectedEvent.error_message);
              return (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs px-2 py-0.5 bg-destructive/20 rounded text-destructive">
                            [{translated.code}]
                          </span>
                          {translated.isKnown ?
                        <Badge variant="outline" className="text-xs">Erro identificado</Badge> :

                        <Badge variant="secondary" className="text-xs">Erro desconhecido</Badge>
                        }
                        </div>
                        <p className="text-sm text-destructive font-medium">{translated.message}</p>
                      </div>
                    </div>
                  </div>);

            })()}

              {/* Received payload */}
              <div>
                <h4 className="font-medium mb-2">Payload Recebido</h4>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedEvent.received_payload_json, null, 2)}
                </pre>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="font-medium mb-3">Timeline de Execução</h4>
                {loadingActions ?
              <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div> :
              eventActions.length === 0 ?
              <p className="text-sm text-muted-foreground">Nenhuma ação executada ainda.</p> :

              <div className="space-y-3">
                    {eventActions.map((action, index) =>
                <div key={action.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    action.status === "sent" ? "bg-success text-success-foreground" :
                    action.status === "failed" ? "bg-destructive text-destructive-foreground" :
                    "bg-muted"}`
                    }>
                            {action.step_order + 1}
                          </div>
                          {index < eventActions.length - 1 &&
                    <div className="w-0.5 h-full bg-border" />
                    }
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <Badge variant="secondary">
                              {action.step?.step_type === "text" ? "Texto" : "Arquivo"}
                            </Badge>
                            <Badge variant={action.status === "sent" ? "default" : action.status === "failed" ? "destructive" : "secondary"}>
                              {action.status === "sent" ? "Enviado" : action.status === "failed" ? "Falhou" : "Pendente"}
                            </Badge>
                            {action.latency_ms &&
                      <span className="text-xs text-muted-foreground">
                                {action.latency_ms}ms
                              </span>
                      }
                          </div>
                          {action.step?.text_content &&
                    <p className="text-sm text-muted-foreground mb-2">
                              {action.step.text_content.substring(0, 100)}...
                            </p>
                    }
                          {action.error_message && (() => {
                      const translated = translateError(action.error_message);
                      return (
                        <div className="mt-1 p-2 bg-destructive/10 rounded text-sm">
                                <span className="font-mono text-xs text-destructive">[{translated.code}]</span>
                                <span className="text-destructive ml-1">{translated.message}</span>
                              </div>);

                    })()}
                          {action.sent_payload_json &&
                    <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">
                                Ver payload enviado
                              </summary>
                              <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-x-auto">
                                {JSON.stringify(action.sent_payload_json, null, 2)}
                              </pre>
                            </details>
                    }
                        </div>
                      </div>
                )}
                  </div>
              }
              </div>
            </div>
          }
      </DialogContent>
      </Dialog>

      {/* Connector Event Details Dialog */}
      <Dialog open={!!selectedConnectorEvent} onOpenChange={() => setSelectedConnectorEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              {selectedConnectorEvent?.connector?.name || "Evento do Conector"}
            </DialogTitle>
            <DialogDescription>
              {selectedConnectorEvent && format(new Date(selectedConnectorEvent.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          {selectedConnectorEvent &&
          <div className="space-y-6">
              {/* Status and info */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                  <Badge className={CONNECTOR_STATUS_CONFIG[selectedConnectorEvent.status as keyof typeof CONNECTOR_STATUS_CONFIG]?.color || CONNECTOR_STATUS_CONFIG.pending.color}>
                    {CONNECTOR_STATUS_CONFIG[selectedConnectorEvent.status as keyof typeof CONNECTOR_STATUS_CONFIG]?.label || selectedConnectorEvent.status}
                  </Badge>
                  {selectedConnectorEvent.connector?.source_type &&
                <Badge className={getSourceBadge(selectedConnectorEvent.connector.source_type).color}>
                      {getSourceBadge(selectedConnectorEvent.connector.source_type).label}
                    </Badge>
                }
                </div>
                {selectedConnectorEvent.status !== "discovery" &&
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResendConnectorEvent(selectedConnectorEvent)}
                disabled={resendingConnector === selectedConnectorEvent.id}>

                    {resendingConnector === selectedConnectorEvent.id ?
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> :

                <RefreshCw className="h-4 w-4 mr-2" />
                }
                    Reenviar
                  </Button>
              }
              </div>

              {/* Error message - translated */}
              {selectedConnectorEvent.error_message && (() => {
              const translated = translateError(selectedConnectorEvent.error_message);
              return (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs px-2 py-0.5 bg-destructive/20 rounded text-destructive">
                            [{translated.code}]
                          </span>
                          {translated.isKnown ?
                        <Badge variant="outline" className="text-xs">Erro identificado</Badge> :

                        <Badge variant="secondary" className="text-xs">Erro desconhecido</Badge>
                        }
                        </div>
                        <p className="text-sm text-destructive font-medium">{translated.message}</p>
                      </div>
                    </div>
                  </div>);

            })()}

              {/* Generated message */}
              {selectedConnectorEvent.generated_message &&
            <div>
                  <h4 className="font-medium mb-2">Mensagem Gerada</h4>
                  <div className="bg-success/10 p-3 rounded-lg text-sm">
                    {selectedConnectorEvent.generated_message}
                  </div>
                </div>
            }

              {/* Received payload */}
              <div>
                <h4 className="font-medium mb-2">Payload Recebido</h4>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                  {JSON.stringify(selectedConnectorEvent.received_payload, null, 2)}
                </pre>
              </div>

              {/* Transformed payload */}
              {selectedConnectorEvent.transformed_payload &&
            <div>
                  <h4 className="font-medium mb-2">Payload Transformado (WhatsApp AI)</h4>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                    {JSON.stringify(selectedConnectorEvent.transformed_payload, null, 2)}
                  </pre>
                </div>
            }

              {/* OpenBot response */}
              {selectedConnectorEvent.openbot_response &&
            <div>
                  <h4 className="font-medium mb-2">Resposta do Sistema de WhatsApp AI</h4>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                    {JSON.stringify(selectedConnectorEvent.openbot_response, null, 2)}
                  </pre>
                </div>
            }
            </div>
          }
        </DialogContent>
      </Dialog>
    </AppLayout>);

}