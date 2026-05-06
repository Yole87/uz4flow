import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Handshake, Users, Wallet, Settings, MousePointerClick, TrendingUp, DollarSign, Power, AlertTriangle, FileText, History, Eye, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import { EmptyState } from "@/components/ui/empty-state";

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  default_commission_percent: "Comissão padrão (%)",
  min_payout: "Saque mínimo",
  tax_percent: "Imposto (%)",
  grace_period_days: "Carência (dias)",
  attribution_window_days: "Janela atribuição (dias)",
  payout_processing_hours: "Prazo pagamento (h)",
  current_terms_version: "Versão dos termos",
  program_enabled: "Programa ativo",
  commission_type: "Tipo de comissão",
  payout_day_of_month: "Dia do pagamento",
  approval_sla_hours: "SLA aprovação (h)",
  allow_self_referral: "Auto-indicação",
  allow_paid_traffic_on_brand: "Tráfego pago marca",
  kit_url: "URL kit divulgação",
};

function formatDiffValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
}

const STATUS_AFF: Record<string, { label: string; variant: any }> = {
  pending: { label: "Pendente", variant: "outline" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  suspended: { label: "Suspenso", variant: "destructive" },
};

const STATUS_PAY: Record<string, { label: string; variant: any }> = {
  requested: { label: "Solicitado", variant: "outline" },
  processing: { label: "Em processamento", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

function DashboardTab() {
  const { data } = useQuery({
    queryKey: ["admin-affiliates-dashboard"],
    staleTime: 60000,
    queryFn: async () => {
      const [aff, clicks, refs, comms, payouts] = await Promise.all([
        supabase.from("affiliates").select("id, status"),
        supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
        supabase.from("affiliate_referrals").select("id, current_status"),
        supabase.from("affiliate_commissions").select("commission_amount, status"),
        supabase.from("affiliate_payouts").select("requested_amount, net_amount, status"),
      ]);
      const affiliates = (aff.data || []) as any[];
      const referrals = (refs.data || []) as any[];
      const commissions = (comms.data || []) as any[];
      const pays = (payouts.data || []) as any[];
      const totalAffiliates = affiliates.length;
      const approvedAffiliates = affiliates.filter((a) => a.status === "approved").length;
      const pendingAffiliates = affiliates.filter((a) => a.status === "pending").length;
      const totalClicks = clicks.count || 0;
      const totalSignups = referrals.length;
      const activeConv = referrals.filter((r) => r.current_status === "active").length;
      const conversionRate = totalClicks > 0 ? (activeConv / totalClicks) * 100 : 0;
      const totalToPay = commissions.filter((c) => c.status === "available").reduce((s, c) => s + Number(c.commission_amount || 0), 0);
      const totalPaid = pays.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.net_amount || 0), 0);
      return {
        totalAffiliates, approvedAffiliates, pendingAffiliates,
        totalClicks, totalSignups, activeConv, conversionRate,
        totalToPay, totalPaid,
      };
    },
  });

  const kpis = [
    { label: "Afiliados", value: data?.totalAffiliates ?? 0, icon: Users },
    { label: "Aprovados", value: data?.approvedAffiliates ?? 0, icon: Handshake },
    { label: "Pendentes", value: data?.pendingAffiliates ?? 0, icon: Settings },
    { label: "Cliques", value: data?.totalClicks ?? 0, icon: MousePointerClick },
    { label: "Cadastros", value: data?.totalSignups ?? 0, icon: Users },
    { label: "Conversões ativas", value: data?.activeConv ?? 0, icon: TrendingUp },
    { label: "Conversão %", value: `${(data?.conversionRate ?? 0).toFixed(1)}%`, icon: TrendingUp },
    { label: "A pagar", value: formatBRL(data?.totalToPay ?? 0), icon: Wallet },
    { label: "Total pago", value: formatBRL(data?.totalPaid ?? 0), icon: DollarSign },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <Card key={k.label} className="quantum-glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase">{k.label}</span>
              <k.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-bold">{k.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ApprovalDialog({ aff, open, onOpenChange }: any) {
  const qc = useQueryClient();
  const [percent, setPercent] = useState(aff?.commission_percent || 20);
  const [minPayout, setMinPayout] = useState(aff?.min_payout || 50);
  const [notes, setNotes] = useState(aff?.admin_notes || "");

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("affiliates")
        .update({
          status: "approved",
          commission_percent: percent,
          min_payout: minPayout,
          admin_notes: notes,
          approved_at: new Date().toISOString(),
        })
        .eq("id", aff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Afiliado aprovado!");
      qc.invalidateQueries({ queryKey: ["admin-affiliates-list"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("affiliates")
        .update({ status: "rejected", admin_notes: notes })
        .eq("id", aff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Afiliado rejeitado");
      qc.invalidateQueries({ queryKey: ["admin-affiliates-list"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Aprovar afiliado</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Comissão (%)</Label>
            <Input type="number" value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
          </div>
          <div>
            <Label>Saque mínimo (R$)</Label>
            <Input type="number" value={minPayout} onChange={(e) => setMinPayout(Number(e.target.value))} />
          </div>
          <div>
            <Label>Notas (interno)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>Rejeitar</Button>
          <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Aprovar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AffiliatesListTab() {
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: list = [] } = useQuery({
    queryKey: ["admin-affiliates-list", filter],
    staleTime: 30000,
    queryFn: async () => {
      let q = supabase
        .from("affiliates")
        .select("id, user_id, code, status, commission_percent, min_payout, pix_key, pix_key_type, bank_holder_name, created_at, approved_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filter !== "all") q = q.eq("status", filter as "approved" | "pending" | "rejected" | "suspended");
      const { data } = await q;
      const affs = (data || []) as any[];

      // Enrich with profiles (full_name) — emails not exposed via RLS, but profile name is enough
      if (affs.length > 0) {
        const userIds = [...new Set(affs.map((a) => a.user_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", userIds);
        const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        return affs.map((a) => ({ ...a, _profile: profMap.get(a.user_id) }));
      }
      return affs;
    },
  });

  return (
    <Card className="quantum-glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Afiliados</span>
          <select className="bg-background border border-border rounded px-2 py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
            <option value="suspended">Suspensos</option>
          </select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum afiliado encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Afiliado</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Saque mín</TableHead>
                <TableHead>PIX</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => {
                const s = STATUS_AFF[a.status] || { label: a.status, variant: "outline" };
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{a._profile?.full_name || a.bank_holder_name || "—"}</div>
                      {a._profile?.phone && <div className="text-muted-foreground font-mono">{a._profile.phone}</div>}
                    </TableCell>
                    <TableCell className="font-mono">{a.code}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell>{a.commission_percent ? `${a.commission_percent}%` : "—"}</TableCell>
                    <TableCell>{a.min_payout ? formatBRL(Number(a.min_payout)) : "—"}</TableCell>
                    <TableCell className="text-xs">{a.pix_key_type}: {a.pix_key}</TableCell>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelected(a)}>
                        {a.status === "pending" ? "Revisar" : "Editar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {selected && <ApprovalDialog aff={selected} open={!!selected} onOpenChange={(o: boolean) => !o && setSelected(null)} />}
    </Card>
  );
}

function PayoutsTab() {
  const qc = useQueryClient();
  const [proofUrl, setProofUrl] = useState("");
  const [editing, setEditing] = useState<any>(null);

  const { data: list = [] } = useQuery({
    queryKey: ["admin-payouts"],
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_payouts")
        .select("*, affiliate:affiliates(code, bank_holder_name)")
        .order("requested_at", { ascending: false })
        .limit(500);
      return (data || []) as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, proof }: any) => {
      const patch: any = { status };
      if (status === "paid") {
        patch.paid_at = new Date().toISOString();
        patch.proof_url = proof || null;
      }
      if (status === "processing") patch.processed_at = new Date().toISOString();
      const { error } = await supabase.from("affiliate_payouts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setEditing(null);
      setProofUrl("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="quantum-glass">
      <CardHeader><CardTitle>Solicitações de saque</CardTitle></CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Sem solicitações de saque"
            description="Quando afiliados pedirem saque, aparecerão aqui para aprovação."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Afiliado</TableHead>
                <TableHead>Bruto</TableHead>
                <TableHead>Imposto 6%</TableHead>
                <TableHead>Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const s = STATUS_PAY[p.status] || { label: p.status, variant: "outline" };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{new Date(p.requested_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono">{p.affiliate?.code}</div>
                      <div className="text-muted-foreground">{p.bank_holder_name}</div>
                    </TableCell>
                    <TableCell>{formatBRL(Number(p.requested_amount))}</TableCell>
                    <TableCell>{formatBRL(Number(p.tax_amount))}</TableCell>
                    <TableCell className="font-semibold">{formatBRL(Number(p.net_amount))}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell>
                      {p.status === "requested" && (
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" className="gradient-primary" onClick={() => setEditing(p)}>Pagar agora</Button>
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: p.id, status: "processing" })}>Processar</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: p.id, status: "rejected" })}>Rejeitar</Button>
                        </div>
                      )}
                      {p.status === "processing" && (
                        <Button size="sm" onClick={() => setEditing(p)}>Marcar pago</Button>
                      )}
                      {p.proof_url && <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">comprovante</a>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>URL do comprovante (opcional)</Label>
              <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateStatus.mutate({ id: editing?.id, status: "paid", proof: proofUrl })}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["affiliate-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("affiliate_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [form, setForm] = useState<any>(null);

  // Sincronizar form quando dados chegam
  if (settings && !form) {
    setForm({
      default_commission_percent: settings.default_commission_percent,
      commission_type: settings.commission_type ?? "recurring",
      min_payout: settings.min_payout,
      payout_day_of_month: settings.payout_day_of_month ?? 10,
      tax_percent: settings.tax_percent,
      payout_processing_hours: settings.payout_processing_hours,
      approval_sla_hours: settings.approval_sla_hours ?? 48,
      attribution_window_days: settings.attribution_window_days,
      grace_period_days: settings.grace_period_days,
      allow_self_referral: settings.allow_self_referral ?? false,
      allow_paid_traffic_on_brand: settings.allow_paid_traffic_on_brand ?? false,
      kit_url: settings.kit_url ?? "",
    });
  }

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!settings || !form) return;
      // Validações simples
      if (form.default_commission_percent < 0 || form.default_commission_percent > 100) throw new Error("Comissão deve estar entre 0 e 100%");
      if (form.tax_percent < 0 || form.tax_percent > 100) throw new Error("Imposto deve estar entre 0 e 100%");
      if (form.min_payout < 0) throw new Error("Saque mínimo inválido");
      if (form.payout_day_of_month < 0 || form.payout_day_of_month > 28) throw new Error("Dia de pagamento deve estar entre 0 e 28 (0 = sem dia fixo)");
      if (form.approval_sla_hours < 1 || form.approval_sla_hours > 168) throw new Error("SLA de aprovação entre 1 e 168h");
      if (form.kit_url && form.kit_url.length > 0 && !/^https?:\/\//i.test(form.kit_url)) throw new Error("URL do kit deve começar com http(s)://");

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("affiliate_settings")
        .update({
          ...form,
          kit_url: form.kit_url?.trim() || null,
          updated_by: user?.id ?? null,
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas. Mudanças refletem em até 5 minutos.");
      qc.invalidateQueries({ queryKey: ["affiliate-settings-admin"] });
      qc.invalidateQueries({ queryKey: ["affiliate-settings"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  if (isLoading || !form) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const LabelWithHint = ({ children, hint }: { children: React.ReactNode; hint: string }) => (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Label className="m-0">{children}</Label>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Ajuda">
              <Info className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-warning/40 bg-warning/10">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Alterações afetam <strong>imediatamente</strong> a página pública <code className="text-xs">/affiliates/onboarding</code> e o painel dos afiliados (cache de 5 min). Revise antes de salvar.
        </p>
      </div>

      <Card className="quantum-glass">
        <CardHeader><CardTitle>Comissão e pagamento</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <LabelWithHint hint="Percentual da venda que o afiliado recebe como comissão. Pode ser sobrescrito individualmente por afiliado.">
              Comissão padrão (%)
            </LabelWithHint>
            <Input type="number" step="0.01" min="0" max="100" value={form.default_commission_percent}
              onChange={(e) => setField("default_commission_percent", Number(e.target.value))} />
          </div>
          <div>
            <LabelWithHint hint="Recorrente: o afiliado ganha a cada renovação enquanto o cliente continuar pagando. Pagamento único: comissão paga apenas na primeira venda.">
              Tipo de comissão
            </LabelWithHint>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
              value={form.commission_type}
              onChange={(e) => setField("commission_type", e.target.value)}
            >
              <option value="recurring">Recorrente (todo mês)</option>
              <option value="one_time">Pagamento único</option>
            </select>
          </div>
          <div>
            <LabelWithHint hint="Valor mínimo acumulado em comissões disponíveis para que o afiliado possa solicitar saque.">
              Saque mínimo (R$)
            </LabelWithHint>
            <Input type="number" step="0.01" min="0" value={form.min_payout}
              onChange={(e) => setField("min_payout", Number(e.target.value))} />
          </div>
          <div>
            <LabelWithHint hint="Dia do mês em que os pagamentos são processados em lote. Selecione 'Sem dia fixo' para processar apenas pelo Prazo de processamento abaixo, sem calendário fixo.">
              Dia do mês para pagamento
            </LabelWithHint>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
              value={form.payout_day_of_month}
              onChange={(e) => setField("payout_day_of_month", Number(e.target.value))}
            >
              <option value={0}>Sem dia fixo (apenas por prazo)</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Dia {d}</option>
              ))}
            </select>
          </div>
          <div>
            <LabelWithHint hint="Imposto retido sobre o valor bruto da comissão antes do pagamento ao afiliado (ex.: 6% de IRRF para PJ).">
              Imposto retido (%)
            </LabelWithHint>
            <Input type="number" step="0.01" min="0" max="100" value={form.tax_percent}
              onChange={(e) => setField("tax_percent", Number(e.target.value))} />
          </div>
          <div>
            <LabelWithHint hint="Tempo (em horas úteis) que sua equipe leva para processar e enviar o pagamento após uma solicitação de saque ser aprovada.">
              Prazo de processamento (h úteis)
            </LabelWithHint>
            <Input type="number" min="1" value={form.payout_processing_hours}
              onChange={(e) => setField("payout_processing_hours", Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card className="quantum-glass">
        <CardHeader><CardTitle>Atribuição e aprovação</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>SLA de aprovação (h)</Label>
            <Input type="number" min="1" max="168" value={form.approval_sla_hours}
              onChange={(e) => setField("approval_sla_hours", Number(e.target.value))} />
          </div>
          <div>
            <Label>Janela de atribuição (dias)</Label>
            <Input type="number" min="1" max="365" value={form.attribution_window_days}
              onChange={(e) => setField("attribution_window_days", Number(e.target.value))} />
          </div>
          <div>
            <Label>Período de carência (dias)</Label>
            <Input type="number" min="0" value={form.grace_period_days}
              onChange={(e) => setField("grace_period_days", Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card className="quantum-glass">
        <CardHeader><CardTitle>Regras e materiais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="block">Permitir auto-indicação</Label>
              <p className="text-xs text-muted-foreground">Afiliado pode usar o próprio link para se cadastrar.</p>
            </div>
            <Switch checked={form.allow_self_referral}
              onCheckedChange={(v) => setField("allow_self_referral", v)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="block">Permitir tráfego pago na marca "Uz4Flow"</Label>
              <p className="text-xs text-muted-foreground">Permite usar o termo "Uz4Flow" em campanhas pagas (Google/Meta Ads).</p>
            </div>
            <Switch checked={form.allow_paid_traffic_on_brand}
              onCheckedChange={(v) => setField("allow_paid_traffic_on_brand", v)} />
          </div>
          <div>
            <Label>URL do kit de divulgação (opcional)</Label>
            <Input type="url" placeholder="https://drive.google.com/..." value={form.kit_url}
              onChange={(e) => setField("kit_url", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Se preenchido, aparece para os afiliados na seção de materiais.</p>
          </div>
          <div className="text-xs text-muted-foreground border-t border-border pt-3">
            <p>📜 Os <strong>termos do programa</strong> são versionados. Para publicar uma nova versão, use a aba <strong>Termos</strong>.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-primary neon-glow-pink">
          {save.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>

      <SettingsHistory />
    </div>
  );
}

function SettingsHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ["affiliate-settings-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_settings_history" as any)
        .select("id, changed_at, changed_by, changes")
        .order("changed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const userIds = Array.from(new Set((data || []).map((d) => d.changed_by).filter(Boolean)));
  const { data: profiles } = useQuery({
    queryKey: ["affiliate-history-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const nameOf = (uid: string | null) =>
    (profiles || []).find((p: any) => p.user_id === uid)?.full_name || (uid ? uid.slice(0, 8) : "—");

  return (
    <Accordion type="single" collapsible className="quantum-glass rounded-lg border border-border">
      <AccordionItem value="history" className="border-0">
        <AccordionTrigger className="px-4 hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="w-4 h-4 text-primary" />
            Histórico de alterações ({data?.length ?? 0})
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
          {!isLoading && (!data || data.length === 0) && (
            <p className="text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>
          )}
          <div className="space-y-3">
            {(data || []).map((entry) => {
              const fields = Object.keys(entry.changes || {});
              return (
                <div key={entry.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                    <span>{new Date(entry.changed_at).toLocaleString("pt-BR")}</span>
                    <span>·</span>
                    <span className="text-foreground">{nameOf(entry.changed_by)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fields.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs font-mono">
                        {SETTINGS_FIELD_LABELS[f] || f}: {formatDiffValue(entry.changes[f]?.from)} → <strong className="ml-0.5">{formatDiffValue(entry.changes[f]?.to)}</strong>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function TermsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["affiliate-terms-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_terms_versions")
        .select("id, version, body_md, published_at, created_by")
        .order("version", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const userIds = Array.from(new Set((versions || []).map((v) => v.created_by).filter(Boolean)));
  const { data: profiles } = useQuery({
    queryKey: ["terms-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const nameOf = (uid: string | null) =>
    (profiles || []).find((p: any) => p.user_id === uid)?.full_name || (uid ? uid.slice(0, 8) : "—");

  const openDialog = () => {
    const current = versions?.[0]?.body_md || "";
    setBody(current);
    setOpen(true);
  };

  const publish = useMutation({
    mutationFn: async () => {
      const trimmed = body.trim();
      if (trimmed.length < 200) throw new Error("Os termos devem ter pelo menos 200 caracteres.");
      const nextVersion = (versions?.[0]?.version ?? 0) + 1;

      const { error: insErr } = await supabase
        .from("affiliate_terms_versions")
        .insert({ version: nextVersion, body_md: trimmed, created_by: user?.id ?? null });
      if (insErr) throw insErr;

      const { data: settingsRow } = await supabase.from("affiliate_settings").select("id").limit(1).maybeSingle();
      if (settingsRow?.id) {
        const { error: updErr } = await supabase
          .from("affiliate_settings")
          .update({ current_terms_version: nextVersion, updated_by: user?.id ?? null })
          .eq("id", settingsRow.id);
        if (updErr) throw updErr;
      }
      return nextVersion;
    },
    onSuccess: (v) => {
      toast.success(`Versão ${v} publicada com sucesso.`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["affiliate-terms-versions"] });
      qc.invalidateQueries({ queryKey: ["affiliate-terms-current"] });
      qc.invalidateQueries({ queryKey: ["affiliate-settings"] });
      qc.invalidateQueries({ queryKey: ["affiliate-settings-admin"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao publicar."),
  });

  const previewVersion = versions?.find((v) => v.id === previewId);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-warning/40 bg-warning/10">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Publicar uma nova versão obriga afiliados existentes a <strong>re-aceitar os termos</strong> antes da próxima ação relevante. Use somente para mudanças efetivas.
        </p>
      </div>

      <Card className="quantum-glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Versões dos termos
          </CardTitle>
          <Button onClick={openDialog} className="gradient-primary">
            Publicar nova versão
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && (!versions || versions.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhuma versão publicada ainda.</p>
          )}
          {versions && versions.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Versão</TableHead>
                  <TableHead>Publicada em</TableHead>
                  <TableHead>Por</TableHead>
                  <TableHead>Prévia</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v, i) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Badge variant={i === 0 ? "default" : "outline"}>v{v.version}{i === 0 ? " · atual" : ""}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(v.published_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{nameOf(v.created_by)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                      {(v.body_md || "").slice(0, 200)}…
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setPreviewId(v.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Publicar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Publicar nova versão dos termos</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh]">
            <div className="flex flex-col">
              <Label className="mb-2 text-xs">Markdown ({body.length} chars · mín. 200)</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs flex-1 min-h-96 resize-none"
                placeholder="# Termos do programa de afiliados&#10;&#10;## 1. Aceitação..."
              />
            </div>
            <div className="flex flex-col">
              <Label className="mb-2 text-xs">Preview</Label>
              <ScrollArea className="flex-1 min-h-96 border border-border rounded p-4 quantum-scrollbar">
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{body || "*Comece a digitar para ver o preview…*"}</ReactMarkdown>
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => publish.mutate()}
              disabled={publish.isPending || body.trim().length < 200}
              className="gradient-primary"
            >
              {publish.isPending ? "Publicando…" : `Publicar v${(versions?.[0]?.version ?? 0) + 1}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview de versão antiga */}
      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Termos · v{previewVersion?.version}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] quantum-scrollbar">
            <div className="prose prose-invert prose-sm max-w-none p-2">
              <ReactMarkdown>{previewVersion?.body_md || ""}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgramToggle() {
  const qc = useQueryClient();
  const [confirmOff, setConfirmOff] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["affiliate-program-toggle"],
    queryFn: async () => {
      const { data } = await supabase.from("affiliate_settings").select("id, program_enabled").limit(1).maybeSingle();
      return data as any;
    },
  });

  const setEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("affiliate_settings")
        .update({ program_enabled: enabled })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? "Programa ativado" : "Programa desativado");
      qc.invalidateQueries({ queryKey: ["affiliate-program-toggle"] });
      qc.invalidateQueries({ queryKey: ["affiliate-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enabled = settings?.program_enabled !== false;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg quantum-glass border border-border">
        <Power className={`w-5 h-5 ${enabled ? "text-success" : "text-muted-foreground"}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Programa de afiliados</span>
            <Badge variant={enabled ? "default" : "outline"} className={enabled ? "bg-success/20 text-success border-success/40" : ""}>
              {enabled ? "ATIVO" : "DESATIVADO"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "Clientes podem se cadastrar e indicar."
              : "Esconde o programa de todos os clientes. Indicações em andamento são preservadas."}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            if (!v) setConfirmOff(true);
            else setEnabled.mutate(true);
          }}
        />
      </div>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Desativar programa de afiliados?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso impedirá novos cadastros e esconderá o programa para todos os clientes. 
              Indicações, comissões e saques em andamento serão preservados, mas não aparecerão para os afiliados até reativar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setEnabled.mutate(false);
                setConfirmOff(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function AdminAffiliates() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Afiliados</h1>
            <p className="text-muted-foreground mt-1">Gestão completa do programa de indicações</p>
          </div>
          <div className="w-full sm:min-w-[320px]">
            <ProgramToggle />
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
            <TabsTrigger value="payouts">Saques</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            <TabsTrigger value="terms">Termos</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="affiliates"><AffiliatesListTab /></TabsContent>
          <TabsContent value="payouts"><PayoutsTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
          <TabsContent value="terms"><TermsTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
