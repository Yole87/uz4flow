import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  Loader2,
  Search,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  User,
  MessageSquare,
  FileText,
  Send,
  Sparkles,
  Settings2
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FlowSession {
  id: string;
  chat_id: string;
  instance_id: string;
  push_name: string | null;
  status: string;
  collected_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  current_step_index: number;
}

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface SessionResponse {
  id: string;
  step_index: number;
  variable_name: string;
  response_type: string;
  response_text: string | null;
  file_id: string | null;
  received_at: string;
  is_valid: boolean;
  file?: {
    file_name: string;
    storage_path: string;
  } | null;
}

interface Flow {
  id: string;
  name: string;
  description: string | null;
  is_interactive: boolean;
}

interface FlowStep {
  id: string;
  order_index: number;
  step_type: string;
  text_content: string | null;
  variable_name: string | null;
  requires_response: boolean;
}

const STATUS_CONFIG = {
  active: { label: "Em andamento", icon: Clock, className: "bg-accent/20 text-accent" },
  completed: { label: "Completo", icon: CheckCircle, className: "bg-success/20 text-success" },
  timeout: { label: "Expirado", icon: AlertCircle, className: "bg-warning/20 text-warning" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "bg-destructive/20 text-destructive" },
};

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "completed", label: "Completos" },
  { value: "active", label: "Em andamento" },
  { value: "timeout", label: "Expirados" },
];

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
}

export default function FlowResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  
  const [flow, setFlow] = useState<Flow | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [sessions, setSessions] = useState<FlowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<FlowSession | null>(null);
  const [sessionResponses, setSessionResponses] = useState<SessionResponse[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [periodDays, setPeriodDays] = useState("30");
  const [statusFilter, setStatusFilter] = useState("all");

  // Variable columns
  const [variableColumns, setVariableColumns] = useState<string[]>([]);

  // Resend message state
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendSession, setResendSession] = useState<FlowSession | null>(null);
  const [resendMessage, setResendMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  
  // Message templates state
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    if (!effectiveUserId || !id) return;
    fetchFlowAndSessions();
  }, [effectiveUserId, id, periodDays, statusFilter]);

  async function fetchFlowAndSessions() {
    try {
      setLoading(true);

      // Fetch flow
      const { data: flowData, error: flowError } = await supabase
        .from("flows")
        .select("id, name, description, is_interactive")
        .eq("id", id)
        .eq("user_id", effectiveUserId!)
        .single();

      if (flowError) throw flowError;
      
      if (!flowData.is_interactive) {
        toast.error("Este fluxo não é interativo");
        navigate(`/flows/${id}`);
        return;
      }
      
      setFlow(flowData);

      // Fetch steps to get variable names
      const { data: stepsData, error: stepsError } = await supabase
        .from("flow_steps")
        .select("id, order_index, step_type, text_content, variable_name, requires_response")
        .eq("flow_id", id)
        .order("order_index", { ascending: true });

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      // Extract variable columns
      const vars = (stepsData || [])
        .filter(s => s.requires_response && s.variable_name)
        .map(s => s.variable_name as string);
      setVariableColumns(vars);

      // Build query for sessions
      let query = supabase
        .from("flow_sessions")
        .select("*")
        .eq("flow_id", id)
        .order("started_at", { ascending: false });

      // Apply period filter
      if (periodDays !== "all") {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(periodDays));
        query = query.gte("started_at", startDate.toISOString());
      }

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: sessionsData, error: sessionsError } = await query;

      if (sessionsError) throw sessionsError;
      
      // Cast collected_data to proper type
      const typedSessions = (sessionsData || []).map(s => ({
        ...s,
        collected_data: (typeof s.collected_data === 'object' && s.collected_data !== null && !Array.isArray(s.collected_data)) 
          ? s.collected_data as Record<string, unknown>
          : {}
      }));
      setSessions(typedSessions);

    } catch (error) {
      console.error("Error fetching flow results:", error);
      toast.error("Erro ao carregar resultados");
      navigate("/flows");
    } finally {
      setLoading(false);
    }
  }

  async function openSessionDetails(session: FlowSession) {
    setSelectedSession(session);
    setDetailsLoading(true);

    try {
      const { data, error } = await supabase
        .from("session_responses")
        .select(`
          id,
          step_index,
          variable_name,
          response_type,
          response_text,
          file_id,
          received_at,
          is_valid,
          file:files(file_name, storage_path)
        `)
        .eq("session_id", session.id)
        .order("step_index", { ascending: true });

      if (error) throw error;
      setSessionResponses(data || []);
    } catch (error) {
      console.error("Error fetching session responses:", error);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function downloadFile(storagePath: string, fileName: string) {
    try {
      const { data, error } = await supabase.storage
        .from("flow-files")
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  }

  function exportToCSV() {
    if (sessions.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    // Build CSV headers
    const headers = ["Data", "Contato", "Nome", "Status", ...variableColumns];
    
    // Build CSV rows
    const rows = filteredSessions.map(session => {
      const data = session.collected_data || {};
      return [
        format(new Date(session.started_at), "dd/MM/yyyy HH:mm"),
        session.chat_id,
        session.push_name || "-",
        STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG]?.label || session.status,
        ...variableColumns.map(col => {
          const value = data[col];
          if (typeof value === "object" && value !== null) {
            return (value as { file_name?: string }).file_name || "arquivo";
          }
          return String(value || "-");
        }),
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow?.name || "resultados"}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Arquivo exportado!");
  }

  // Fetch message templates
  async function fetchMessageTemplates() {
    setTemplatesLoading(true);
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, name, content, is_default")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;
      setMessageTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setTemplatesLoading(false);
    }
  }

  // Open resend dialog
  function openResendDialog(session: FlowSession, e: React.MouseEvent) {
    e.stopPropagation();
    setResendSession(session);
    setResendMessage("");
    setResendDialogOpen(true);
    fetchMessageTemplates();
  }

  // Insert variable into message
  function insertVariable(variable: string) {
    setResendMessage(prev => prev + `{{${variable}}}`);
  }

  // Apply template
  function applyTemplate(template: string) {
    setResendMessage(template);
  }

  // Preview message with replaced variables
  function getMessagePreview(): string {
    if (!resendSession || !resendMessage) return "";
    
    let preview = resendMessage;
    preview = preview.replace(/\{\{pushName\}\}/gi, resendSession.push_name || "(sem nome)");
    
    for (const [key, value] of Object.entries(resendSession.collected_data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
      if (typeof value === "object" && value !== null) {
        const fileValue = value as { file_name?: string };
        preview = preview.replace(regex, fileValue.file_name || "arquivo");
      } else {
        preview = preview.replace(regex, String(value || "(não preenchido)"));
      }
    }
    
    return preview;
  }

  // Send message
  async function handleResendMessage() {
    if (!resendSession || !resendMessage.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    setResendLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("resend-flow-message", {
        body: {
          session_id: resendSession.id,
          message: resendMessage,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Mensagem enviada com sucesso!");
      setResendDialogOpen(false);
      setResendSession(null);
      setResendMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar mensagem");
    } finally {
      setResendLoading(false);
    }
  }

  // Get available variables for resend
  function getAvailableVariables(): string[] {
    const vars = ["pushName"];
    if (resendSession) {
      vars.push(...Object.keys(resendSession.collected_data));
    }
    return vars;
  }

  // Filter sessions by search term
  const filteredSessions = sessions.filter(session => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      session.chat_id.toLowerCase().includes(search) ||
      (session.push_name?.toLowerCase() || "").includes(search) ||
      JSON.stringify(session.collected_data).toLowerCase().includes(search)
    );
  });

  // Check if session can be re-engaged
  function canResend(status: string): boolean {
    return status === "timeout" || status === "active";
  }

  if (loading) {
    return (
      <AppLayout title="Carregando..." description="">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!flow) {
    return null;
  }

  return (
    <AppLayout 
      title={`Resultados: ${flow.name}`}
      description="Visualize os dados coletados das conversas"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate(`/flows/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para o fluxo
        </Button>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por contato ou dados..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full md:w-48 space-y-2">
                <Label>Período</Label>
                <Select value={periodDays} onValueChange={setPeriodDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-48 space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={exportToCSV} className="w-full md:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold">{sessions.length}</div>
              <div className="text-sm text-muted-foreground">Total de sessões</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-success">
                {sessions.filter(s => s.status === "completed").length}
              </div>
              <div className="text-sm text-muted-foreground">Completas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-accent">
                {sessions.filter(s => s.status === "active").length}
              </div>
              <div className="text-sm text-muted-foreground">Em andamento</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-warning">
                {sessions.filter(s => s.status === "timeout").length}
              </div>
              <div className="text-sm text-muted-foreground">Expiradas</div>
            </CardContent>
          </Card>
        </div>

        {/* Results table */}
        <Card>
          <CardHeader>
            <CardTitle>Sessões ({filteredSessions.length})</CardTitle>
            <CardDescription>
              Clique em uma linha para ver os detalhes da conversa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma sessão encontrada para os filtros selecionados
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Nome</TableHead>
                      {variableColumns.map(col => (
                        <TableHead key={col} className="capitalize">{col}</TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session) => {
                      const statusConfig = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG];
                      const StatusIcon = statusConfig?.icon || Clock;
                      
                      return (
                        <TableRow 
                          key={session.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openSessionDetails(session)}
                        >
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(session.started_at), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {session.chat_id.substring(0, 13)}...
                          </TableCell>
                          <TableCell>
                            {session.push_name || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          {variableColumns.map(col => {
                            const value = session.collected_data[col];
                            let displayValue = "-";
                            
                            if (value !== undefined && value !== null) {
                              if (typeof value === "object" && (value as { file_name?: string }).file_name) {
                                displayValue = `📎 ${(value as { file_name: string }).file_name}`;
                              } else {
                                displayValue = String(value);
                              }
                            }
                            
                            return (
                              <TableCell key={col} className="max-w-[200px] truncate" title={displayValue}>
                                {displayValue}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <Badge className={statusConfig?.className}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig?.label || session.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {canResend(session.status) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => openResendDialog(session, e)}
                                title="Reengajar lead"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
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

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Sessão</DialogTitle>
            <DialogDescription>
              Conversa com {selectedSession?.push_name || selectedSession?.chat_id}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedSession && (
            <div className="space-y-6">
              {/* Session info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Contato:</span>
                  <span className="ml-2 font-mono truncate inline-block max-w-full">{selectedSession.chat_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="ml-2">{selectedSession.push_name || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Início:</span>
                  <span className="ml-2">
                    {format(new Date(selectedSession.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fim:</span>
                  <span className="ml-2">
                    {selectedSession.completed_at 
                      ? format(new Date(selectedSession.completed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                      : "-"
                    }
                  </span>
                </div>
              </div>

              {/* Resend button for incomplete sessions */}
              {canResend(selectedSession.status) && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={(e) => {
                    setSelectedSession(null);
                    openResendDialog(selectedSession, e);
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Reengajar este lead
                </Button>
              )}

              {/* Transcript */}
              <div>
                <h4 className="font-semibold mb-3">Transcrito da Conversa</h4>
                <div className="space-y-3 bg-muted/30 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                  {steps.map((step, index) => {
                    const response = sessionResponses.find(r => r.step_index === index);
                    
                    return (
                      <div key={step.id} className="space-y-2">
                        {/* Bot message */}
                        {step.text_content && (
                          <div className="flex gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="h-3 w-3 text-primary" />
                            </div>
                            <div className="bg-background rounded-lg px-3 py-2 text-sm max-w-[80%]">
                              {step.text_content}
                            </div>
                          </div>
                        )}
                        
                        {/* User response */}
                        {response && (
                          <div className="flex gap-2 justify-end">
                            <div className="bg-primary/10 rounded-lg px-3 py-2 text-sm max-w-[80%]">
                              {response.response_type === "file" && response.file ? (
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>{response.file.file_name}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => downloadFile(response.file!.storage_path, response.file!.file_name)}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                response.response_text
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(response.received_at), "HH:mm")}
                              </div>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                              <User className="h-3 w-3" />
                            </div>
                          </div>
                        )}
                        
                        {/* Waiting indicator for current step without response */}
                        {step.requires_response && !response && selectedSession.current_step_index === index && selectedSession.status === "active" && (
                          <div className="flex gap-2 justify-end">
                            <div className="bg-muted rounded-lg px-3 py-2 text-sm italic text-muted-foreground">
                              Aguardando resposta...
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Collected data */}
              <div>
                <h4 className="font-semibold mb-3">Dados Coletados</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(selectedSession.collected_data).map(([key, value]) => (
                    <div key={key} className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground capitalize">{key}</div>
                      <div className="font-medium mt-1">
                        {typeof value === "object" && value !== null ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {(value as { file_name?: string }).file_name || "arquivo"}
                          </div>
                        ) : (
                          String(value)
                        )}
                      </div>
                    </div>
                  ))}
                  {Object.keys(selectedSession.collected_data).length === 0 && (
                    <div className="col-span-2 text-muted-foreground text-sm">
                      Nenhum dado coletado ainda
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resend Message Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Reengajar Lead
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem personalizada para {resendSession?.push_name || resendSession?.chat_id}
            </DialogDescription>
          </DialogHeader>

          {resendSession && (
            <div className="space-y-4">
              {/* Collected data summary */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm font-medium mb-2">Dados coletados:</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(resendSession.collected_data).length === 0 ? (
                    <span className="text-muted-foreground">Nenhum dado coletado ainda</span>
                  ) : (
                    Object.entries(resendSession.collected_data).map(([key, value]) => (
                      <Badge key={key} variant="secondary">
                        {key}: {typeof value === "object" ? "arquivo" : String(value)}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Templates from database */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Templates salvos</Label>
                  <Link 
                    to="/templates" 
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Settings2 className="h-3 w-3" />
                    Gerenciar templates
                  </Link>
                </div>
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Carregando...
                  </div>
                ) : messageTemplates.length === 0 ? (
                  <div className="text-muted-foreground text-sm">
                    Nenhum template salvo.{" "}
                    <Link to="/templates" className="text-primary hover:underline">
                      Criar template
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {messageTemplates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template.content)}
                        className="text-xs"
                        title={template.content}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {template.name}
                        {template.is_default && (
                          <Badge variant="secondary" className="ml-1 text-xs py-0 px-1">
                            Padrão
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Variable chips */}
              <div>
                <Label className="text-sm">Inserir variável</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {getAvailableVariables().map((variable) => (
                    <Button
                      key={variable}
                      variant="secondary"
                      size="sm"
                      onClick={() => insertVariable(variable)}
                      className="text-xs font-mono"
                    >
                      {`{{${variable}}}`}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Message textarea */}
              <div className="space-y-2">
                <Label htmlFor="resend-message">Mensagem</Label>
                <Textarea
                  id="resend-message"
                  placeholder="Digite sua mensagem personalizada..."
                  value={resendMessage}
                  onChange={(e) => setResendMessage(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Preview */}
              {resendMessage && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Prévia da mensagem</Label>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    {getMessagePreview()}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setResendDialogOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleResendMessage} disabled={resendLoading || !resendMessage.trim()} className="w-full sm:w-auto">
              {resendLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Mensagem
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
