import { KpiCard } from "../KpiCard";
import { SectionShell, formatBytes, formatNumber } from "../SectionShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, AlertTriangle, Bell, BellOff } from "lucide-react";
import type { AdminDashboardData } from "@/hooks/admin/useAdminDashboardData";

interface Props {
  data?: AdminDashboardData;
  loading: boolean;
}

export function InfraSection({ data, loading }: Props) {
  const i = data?.infra;
  return (
    <SectionShell title="Saúde da Infraestrutura" subtitle="Storage consumido, falhas em webhooks e notificações administrativas.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Storage total" value={formatBytes(i?.totalStorageBytes ?? 0)} formula="Espaço em disco usado por todos os clientes somados (anexos, mídias, áudios). Foto do momento." icon={HardDrive} loading={loading} />
        <KpiCard label="Webhook erros (24h)" value={formatNumber(i?.webhookErrors24h ?? 0)} formula="Quantos webhooks de pagamento falharam nas últimas 24h. Acima de zero pode indicar problema na integração de cobrança." icon={AlertTriangle} accent="destructive" loading={loading} />
        <KpiCard label="Notificações OK" value={formatNumber(i?.notifSuccess ?? 0)} formula="Notificações administrativas (WhatsApp do dono) que foram entregues com sucesso no período." icon={Bell} accent="success" loading={loading} />
        <KpiCard label="Notificações falhas" value={formatNumber(i?.notifFailed ?? 0)} formula="Notificações administrativas que não foram entregues no período. Verifique configuração na aba Notificações." icon={BellOff} accent="warning" loading={loading} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Top 5 organizações por storage</CardTitle>
        </CardHeader>
        <CardContent>
          {(i?.topStorageOrgs?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <ol className="space-y-2">
              {i!.topStorageOrgs.map((o, idx) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground font-mono text-xs w-4">{idx + 1}.</span>
                    <span className="truncate">{o.name}</span>
                  </span>
                  <span className="font-mono tabular-nums text-xs">{formatBytes(o.bytes)}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}
