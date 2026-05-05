import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Loader2, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookLog {
  id: string;
  event_type: string;
  event_action: string | null;
  mp_id: string | null;
  status: string | null;
  status_detail: string | null;
  status_detail_description: string | null;
  amount: number | null;
  payer_email: string | null;
  organization_id: string | null;
  organization_name: string | null;
  subscription_id: string | null;
  error_message: string | null;
  raw_payload: Record<string, unknown> | null;
  processed: boolean;
  created_at: string;
}

const PAGE_SIZE = 20;

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">—</Badge>;
  const s = status.toLowerCase();
  if (s === "approved" || s === "active" || s === "authorized")
    return <Badge className="bg-success/20 text-success border-success/40">{status}</Badge>;
  if (s === "rejected" || s === "cancelled" || s === "charged_back")
    return <Badge variant="destructive">{status}</Badge>;
  if (s === "pending" || s === "in_process" || s === "paused")
    return <Badge className="bg-warning/20 text-warning border-warning/40">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function PaymentWebhookLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const fetchLogs = async (p = 0) => {
    setLoading(true);
    try {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { count } = await (supabase as any)
        .from("payment_webhook_logs")
        .select("id", { count: "exact", head: true });

      setTotal(count || 0);

      const { data } = await (supabase as any)
        .from("payment_webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      setLogs((data as WebhookLog[]) || []);
    } catch (e) {
      console.error("Error fetching payment logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(page); }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Logs de Pagamento
            </span>
            <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardTitle>
          <CardDescription>
            Histórico de notificações recebidas do Mercado Pago ({total} registro{total !== 1 ? "s" : ""})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm">
                      {log.organization_name || log.payer_email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {log.status_detail_description || log.status_detail || log.error_message || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {log.amount != null ? `R$ ${Number(log.amount).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedLog(log)}>
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum log de pagamento registrado ainda.
                    </TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Evento</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">ID MP:</span> <span className="font-mono">{selectedLog.mp_id}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> {selectedLog.event_type}</div>
                <div><span className="text-muted-foreground">Ação:</span> {selectedLog.event_action || "—"}</div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(selectedLog.status)}</div>
                <div><span className="text-muted-foreground">Email:</span> {selectedLog.payer_email || "—"}</div>
                <div><span className="text-muted-foreground">Valor:</span> {selectedLog.amount != null ? `R$ ${Number(selectedLog.amount).toFixed(2)}` : "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Detalhe:</span> {selectedLog.status_detail_description || selectedLog.status_detail || "—"}</div>
                {selectedLog.error_message && (
                  <div className="col-span-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
                    {selectedLog.error_message}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Payload completo (JSON)</p>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-[300px] whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.raw_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
