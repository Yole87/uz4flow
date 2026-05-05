import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Clock, XCircle, AlertTriangle, Send } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const EVENT_LABELS: Record<string, string> = {
  payment_approved: "Pagamento Aprovado",
  payment_pending: "Pagamento Pendente",
  payment_rejected: "Cartão Recusado",
  subscription_paused: "Assinatura Suspensa",
  subscription_cancelled: "Assinatura Cancelada",
  payment_refunded: "Reembolso",
  renewal_reminder: "Lembrete Renovação",
  payment_overdue: "Cobrança em Atraso",
};

export function BillingDashboardTab() {
  const [eventFilter, setEventFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["billing-logs", eventFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("billing_notifications_log")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventFilter !== "all") {
        query = query.eq("event_type", eventFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["billing-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0] + "T00:00:00Z";
      
      const { data: todayLogs } = await (supabase as any)
        .from("billing_notifications_log")
        .select("event_type, status")
        .gte("created_at", today)
        .limit(2000);

      const sent = todayLogs?.filter((l: any) => l.status === "sent").length || 0;
      const failed = todayLogs?.filter((l: any) => l.status === "failed").length || 0;
      const pending = todayLogs?.filter((l: any) => l.event_type === "payment_pending").length || 0;
      const rejected = todayLogs?.filter((l: any) => l.event_type === "payment_rejected").length || 0;

      return { sent, failed, pending, rejected };
    },
    staleTime: 30000,
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="bg-primary text-primary-foreground">Enviado</Badge>;
      case "delivered": return <Badge className="bg-accent text-accent-foreground">Entregue</Badge>;
      case "failed": return <Badge variant="destructive">Falhou</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Send className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                <p className="text-sm text-muted-foreground">Enviados Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats?.rejected || 0}</p>
                <p className="text-sm text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                <p className="text-sm text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Notificações Enviadas</CardTitle>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma notificação enviada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{log.organizations?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{EVENT_LABELS[log.event_type] || log.event_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{log.phone}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                      {log.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
