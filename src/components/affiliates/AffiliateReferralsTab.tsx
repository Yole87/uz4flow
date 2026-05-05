import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAffiliate } from "@/hooks/useAffiliate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Users } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  signup: { label: "Cadastrou", variant: "secondary" },
  trial: { label: "Em teste", variant: "outline" },
  active: { label: "Ativo", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  expired_window: { label: "Fora do prazo", variant: "outline" },
};

export function AffiliateReferralsTab() {
  const { data: affiliate } = useAffiliate();

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["affiliate-referrals", affiliate?.id],
    queryFn: async () => {
      if (!affiliate) return [];
      const { data, error } = await supabase
        .from("affiliate_referrals")
        .select("*, plan:subscription_plans(name, price)")
        .eq("affiliate_id", affiliate.id)
        .order("signup_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!affiliate,
    staleTime: 30000,
  });

  const exportCsv = () => {
    const eligible = referrals.filter((r) => r.current_status === "active" || r.current_status === "cancelled");
    if (!eligible.length) {
      toast.info("Nenhum indicado convertido para exportar.");
      return;
    }
    const rows = [
      ["Data Cadastro", "Status", "Plano", "Data Conversão"],
      ...eligible.map((r) => [
        new Date(r.signup_at).toLocaleDateString("pt-BR"),
        STATUS_LABEL[r.current_status]?.label || r.current_status,
        r.plan?.name || "-",
        r.first_payment_at ? new Date(r.first_payment_at).toLocaleDateString("pt-BR") : "-",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="quantum-glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Seus indicados
          </span>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Você ainda não tem indicações. Compartilhe seu link!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Conversão</TableHead>
                  <TableHead>Atribuição até</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((r) => {
                  const meta = STATUS_LABEL[r.current_status] || { label: r.current_status, variant: "outline" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.signup_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                      <TableCell>{r.plan?.name || "-"}</TableCell>
                      <TableCell>{r.first_payment_at ? new Date(r.first_payment_at).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.attribution_expires_at).toLocaleDateString("pt-BR")}
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
  );
}
