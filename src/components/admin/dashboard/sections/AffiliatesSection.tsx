import { KpiCard } from "../KpiCard";
import { SectionShell, formatNumber, formatCurrency } from "../SectionShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MousePointer, UserPlus, CheckCircle2, Percent, DollarSign } from "lucide-react";
import type { AdminDashboardData } from "@/hooks/admin/useAdminDashboardData";

interface Props {
  data?: AdminDashboardData;
  loading: boolean;
}

export function AffiliatesSection({ data, loading }: Props) {
  const a = data?.affiliates;
  return (
    <SectionShell title="Programa de Afiliados" subtitle="Performance do canal de indicações: cliques, conversões e comissões.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Cliques" value={formatNumber(a?.clicks ?? 0)} formula="Quantas pessoas clicaram em links de afiliados no período." icon={MousePointer} loading={loading} />
        <KpiCard label="Cadastros" value={formatNumber(a?.signups ?? 0)} formula="Quantos cliques viraram cadastro na plataforma dentro do período." icon={UserPlus} loading={loading} />
        <KpiCard label="Conversões pagas" value={formatNumber(a?.paidConversions ?? 0)} formula="Quantos indicados fizeram a primeira compra paga no período. É o que gera comissão." icon={CheckCircle2} accent="success" loading={loading} />
        <KpiCard label="Conversão clique→cliente" value={`${(a?.clickToCustomer ?? 0).toFixed(2)}%`} formula="% dos cliques em links de afiliados que viraram cliente pagante. Mede a qualidade do tráfego dos parceiros." icon={Percent} loading={loading} />
        <KpiCard label="Comissões geradas" value={formatCurrency(a?.totalCommissions ?? 0)} formula="Total de comissões que a plataforma deve aos afiliados pelas vendas do período." icon={DollarSign} loading={loading} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Top 5 afiliados por comissão</CardTitle>
        </CardHeader>
        <CardContent>
          {(a?.topAffiliates?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ol className="space-y-2">
              {a!.topAffiliates.map((af, i) => (
                <li key={af.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs w-4">{i + 1}.</span>
                    <span className="font-mono">{af.code}</span>
                  </span>
                  <span className="font-mono tabular-nums text-xs">{formatCurrency(af.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}
