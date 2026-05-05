import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAffiliate, useAffiliateSettings, useAffiliateStats } from "@/hooks/useAffiliate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

const STATUS: Record<string, { label: string; variant: any }> = {
  requested: { label: "Solicitado", variant: "outline" },
  processing: { label: "Em processamento", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

export function AffiliatePayoutsTab() {
  const qc = useQueryClient();
  const { data: affiliate } = useAffiliate();
  const { data: settings } = useAffiliateSettings();
  const { data: stats } = useAffiliateStats(affiliate?.id);
  const [amount, setAmount] = useState("");

  const { data: payouts = [] } = useQuery({
    queryKey: ["affiliate-payouts", affiliate?.id],
    queryFn: async () => {
      if (!affiliate) return [];
      const { data } = await supabase
        .from("affiliate_payouts")
        .select("id, requested_at, requested_amount, tax_amount, net_amount, status, proof_url")
        .eq("affiliate_id", affiliate.id)
        .order("requested_at", { ascending: false })
        .limit(200);
      return (data || []) as any[];
    },
    enabled: !!affiliate,
    staleTime: 30000,
  });

  const minPayout = Number(affiliate?.min_payout ?? settings?.min_payout ?? 50);
  const taxPct = Number(settings?.tax_percent ?? 6);
  const available = stats?.availableAmount ?? 0;
  const hasPendingPayout = payouts.some((p: any) => p.status === "requested" || p.status === "processing");

  const request = useMutation({
    mutationFn: async () => {
      if (!affiliate) throw new Error("Sem afiliado");
      if (hasPendingPayout) throw new Error("Você já tem um saque pendente. Aguarde o processamento antes de pedir outro.");
      const v = Number(amount.replace(",", "."));
      if (!v || v < minPayout) throw new Error(`Valor mínimo: ${formatBRL(minPayout)}`);
      if (v > available) throw new Error(`Você tem apenas ${formatBRL(available)} disponível`);
      const tax = (v * taxPct) / 100;
      const net = v - tax;
      const { error } = await supabase.from("affiliate_payouts").insert({
        affiliate_id: affiliate.id,
        requested_amount: v,
        tax_percent: taxPct,
        tax_amount: tax,
        net_amount: net,
        pix_key_type: affiliate.pix_key_type,
        pix_key: affiliate.pix_key,
        bank_holder_name: affiliate.bank_holder_name,
        bank_holder_document: affiliate.bank_holder_document,
      });
      if (error) throw error;

      // Fire admin notification (fire-and-forget)
      void supabase.functions.invoke("admin-notify", {
        body: {
          event_type: "affiliate_payout_request",
          variables: {
            user_name: affiliate.bank_holder_name || "Afiliado",
            affiliate_code: affiliate.code,
            amount: v.toFixed(2),
            net_amount: net.toFixed(2),
            pix_key: affiliate.pix_key,
            pix_key_type: affiliate.pix_key_type,
            date: new Date().toLocaleString("pt-BR"),
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Solicitação enviada! Pagamento em até 72h úteis.");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["affiliate-payouts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao solicitar saque"),
  });

  const previewTax = amount ? (Number(amount.replace(",", ".")) * taxPct) / 100 : 0;
  const previewNet = amount ? Number(amount.replace(",", ".")) - previewTax : 0;

  return (
    <div className="space-y-6">
      <Card className="quantum-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Solicitar saque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Disponível</label>
              <div className="text-lg font-bold text-success">{formatBRL(available)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Saque mínimo</label>
              <div className="text-lg font-bold">{formatBRL(minPayout)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Imposto retido</label>
              <div className="text-lg font-bold">{taxPct}%</div>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm">Valor a sacar</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Mín. ${formatBRL(minPayout)}`}
                min={minPayout}
                max={available}
              />
            </div>
            <Button
              className="gradient-primary"
              disabled={!amount || request.isPending || affiliate?.status !== "approved" || hasPendingPayout}
              onClick={() => request.mutate()}
            >
              Solicitar
            </Button>
          </div>
          {hasPendingPayout && (
            <div className="text-xs text-warning rounded border border-warning/30 bg-warning/5 p-2">
              Você já possui um saque em andamento. Aguarde a conclusão antes de solicitar outro.
            </div>
          )}
          {amount && !hasPendingPayout && (
            <div className="text-xs text-muted-foreground rounded border border-border p-2">
              Imposto ({taxPct}%): <strong>{formatBRL(previewTax)}</strong> · Você recebe: <strong className="text-success">{formatBRL(previewNet)}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="quantum-glass">
        <CardHeader><CardTitle>Histórico de saques</CardTitle></CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum saque solicitado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Bruto</TableHead>
                  <TableHead>Imposto</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => {
                  const s = STATUS[p.status] || { label: p.status, variant: "outline" };
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.requested_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{formatBRL(Number(p.requested_amount))}</TableCell>
                      <TableCell>{formatBRL(Number(p.tax_amount))}</TableCell>
                      <TableCell className="font-semibold text-success">{formatBRL(Number(p.net_amount))}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell>
                        {p.proof_url ? (
                          <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">Ver</a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
