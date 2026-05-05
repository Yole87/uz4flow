import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, MousePointerClick, Users, TrendingUp, Wallet, DollarSign, CheckCircle2 } from "lucide-react";
import { useAffiliate, useAffiliateSettings, useAffiliateStats } from "@/hooks/useAffiliate";
import { toast } from "sonner";

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export function AffiliateOverviewTab() {
  const { data: affiliate } = useAffiliate();
  const { data: settings } = useAffiliateSettings();
  const { data: stats } = useAffiliateStats(affiliate?.id);
  const [copied, setCopied] = useState(false);

  if (!affiliate) return null;

  const link = `${window.location.origin}/?ref=${affiliate.code}`;
  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const minPayout = Number(affiliate.min_payout ?? settings?.min_payout ?? 50);
  const commissionPct = Number(affiliate.commission_percent ?? settings?.default_commission_percent ?? 20);

  const kpis = [
    { label: "Cliques", value: stats?.totalClicks ?? 0, icon: MousePointerClick, color: "text-blue-500" },
    { label: "Indicados", value: stats?.totalSignups ?? 0, icon: Users, color: "text-purple-500" },
    { label: "Ativos pagantes", value: stats?.activePaying ?? 0, icon: CheckCircle2, color: "text-success" },
    { label: "Conversão %", value: `${(stats?.conversionRate ?? 0).toFixed(1)}%`, icon: TrendingUp, color: "text-primary" },
    { label: "A liberar", value: formatBRL(stats?.pendingAmount ?? 0), icon: Wallet, color: "text-warning" },
    { label: "Disponível", value: formatBRL(stats?.availableAmount ?? 0), icon: DollarSign, color: "text-success" },
    { label: "Total pago", value: formatBRL(stats?.paidAmount ?? 0), icon: DollarSign, color: "text-muted-foreground" },
    { label: "Comissão", value: `${commissionPct}%`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {affiliate.status === "pending" && (
        <Card className="quantum-glass border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Seu cadastro está em análise. Você receberá uma notificação assim que for aprovado.
          </CardContent>
        </Card>
      )}
      {affiliate.status === "rejected" && (
        <Card className="quantum-glass border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Seu cadastro foi rejeitado. Entre em contato com o suporte para mais informações.
          </CardContent>
        </Card>
      )}
      {affiliate.status === "suspended" && (
        <Card className="quantum-glass border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Sua conta de afiliado está suspensa. Entre em contato com o suporte.
          </CardContent>
        </Card>
      )}

      {affiliate.status === "approved" && (
        <Card className="quantum-glass">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Seu link de afiliado</span>
              <Badge className="gradient-primary text-white font-mono font-bold border-0 shadow-md shadow-primary/30">{affiliate.code}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button onClick={copy} variant="outline">
                <Copy className="w-4 h-4 mr-2" />
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Atribuição válida por 30 dias após o clique. Saque mínimo: <strong>{formatBRL(minPayout)}</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="quantum-glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</span>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <div className="text-xl font-bold text-foreground">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
