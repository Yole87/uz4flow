import { KpiCard } from "../KpiCard";
import { SectionShell, formatNumber } from "../SectionShell";
import { Instagram, MessageCircle, Users } from "lucide-react";
import type { AdminDashboardData } from "@/hooks/admin/useAdminDashboardData";

interface Props {
  data?: AdminDashboardData;
  loading: boolean;
}

export function InstagramSection({ data, loading }: Props) {
  const i = data?.instagram;
  return (
    <SectionShell title="Instagram" subtitle="Eventos recebidos via API Meta e leads capturados pelas automações.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Eventos recebidos" value={formatNumber(i?.events ?? 0)} formula="Total de interações recebidas via Instagram no período: DMs, comentários, menções e respostas." icon={MessageCircle} loading={loading} />
        <KpiCard label="Leads capturados" value={formatNumber(i?.leads ?? 0)} formula="Quantos leads as automações de Instagram dos clientes geraram no período." icon={Users} loading={loading} />
        <KpiCard label="Contas conectadas" value={formatNumber(i?.accountsActive ?? 0)} formula="Quantas contas de Instagram estão conectadas e funcionando agora. Foto do momento." icon={Instagram} accent="success" loading={loading} />
      </div>
    </SectionShell>
  );
}
