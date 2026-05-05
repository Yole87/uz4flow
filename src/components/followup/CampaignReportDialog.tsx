import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, MessageSquare, Webhook, AlertTriangle, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface CampaignReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
}

export function CampaignReportDialog({ open, onOpenChange, campaignId, campaignName }: CampaignReportDialogProps) {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["campaign-report", campaignId],
    queryFn: async () => {
      const { data: campaignContacts, error } = await supabase
        .from("voice_campaign_contacts")
        .select("id, name, phone, status, voice_call_id, error_message, attempted_at")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!campaignContacts?.length) return [];

      const callIds = campaignContacts
        .map((c: any) => c.voice_call_id)
        .filter(Boolean);

      let callsMap: Record<string, any> = {};
      if (callIds.length > 0) {
        const { data: calls } = await supabase
          .from("voice_calls")
          .select("id, status, created_at, duration_seconds, whatsapp_followup_sent, whatsapp_followup_enabled, webhook_url, ended_reason")
          .in("id", callIds);

        if (calls) {
          for (const call of calls) {
            callsMap[call.id] = call;
          }
        }
      }

      return campaignContacts.map((c: any) => {
        const call = c.voice_call_id ? callsMap[c.voice_call_id] : null;
        // Prefer Vapi's ended_reason; fallback to our local error_message (pre-Vapi failures)
        const failureReason = call?.ended_reason || c.error_message || null;
        return {
          name: c.name || "—",
          phone: c.phone || "—",
          status: c.status,
          callTime: call?.created_at || c.attempted_at || null,
          answered: call ? call.status === "completed" && call.ended_reason !== "customer-did-not-answer" : false,
          callStatus: call?.status || c.status || "pending",
          endedReason: failureReason,
          duration: call?.duration_seconds || 0,
          whatsappSent: call?.whatsapp_followup_sent || false,
          whatsappEnabled: call?.whatsapp_followup_enabled || false,
          webhookUrl: call?.webhook_url || null,
        };
      });
    },
    enabled: open && !!campaignId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório — {campaignName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum contato encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Atendeu</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead>CTA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{c.name}</TableCell>
                  <TableCell className="text-sm font-mono">{c.phone}</TableCell>
                  <TableCell className="text-sm">
                    {c.callTime ? format(new Date(c.callTime), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.callStatus === "failed" ? (
                      <Badge variant="outline" className="text-destructive border-destructive/50">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Erro
                      </Badge>
                    ) : c.callStatus === "pending" || c.callStatus === "ringing" ? (
                      <Badge variant="outline" className="text-muted-foreground border-muted">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    ) : c.answered ? (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive/50">
                        <XCircle className="h-3 w-3 mr-1" />
                        Não
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[220px]">
                    {c.endedReason && c.callStatus === "failed" ? (
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[180px] truncate block">
                          {c.endedReason}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(c.endedReason);
                            toast.success("Copiado!");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : c.endedReason && c.endedReason !== "unknown" ? (
                      <span className="text-muted-foreground">{c.endedReason}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.whatsappEnabled && (
                        <Badge variant="outline" className={c.whatsappSent ? "text-emerald-500 border-emerald-500/50" : "text-muted-foreground border-muted"}>
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {c.whatsappSent ? "Enviado" : "Não enviado"}
                        </Badge>
                      )}
                      {c.webhookUrl && (
                        <Badge variant="outline" className={c.answered ? "text-emerald-500 border-emerald-500/50" : "text-muted-foreground border-muted"}>
                          <Webhook className="h-3 w-3 mr-1" />
                          {c.answered ? "Disparado" : "—"}
                        </Badge>
                      )}
                      {!c.whatsappEnabled && !c.webhookUrl && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
