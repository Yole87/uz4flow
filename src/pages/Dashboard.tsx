import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { OnboardingSection } from "@/components/onboarding/OnboardingSection";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, CheckCircle, XCircle, Clock, GitBranch, Settings, Plus, ArrowRight, Zap,
  Users, MessageSquare, Kanban, UserSearch, Search, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Lightbulb, PhoneCall, Megaphone,
  Instagram, HardDrive, Crown, Phone, Bot, Smartphone
} from "lucide-react";
import { format, subDays } from "date-fns";
import { LimitAlert } from "@/components/LimitAlert";
import { TeamFilter } from "@/components/dashboard/TeamFilter";
import { PipelineFilter } from "@/components/dashboard/PipelineFilter";
import { ChannelFilterSelect, type ChannelFilter } from "@/components/dashboard/ChannelFilter";

// ... keep existing code (PeriodStats interface and emptyStats)
interface PeriodStats {
  totalContacts: number;
  newContacts: number;
  activeConversations: number;
  totalInPipeline: number;
  totalProspects: number;
  completedSearches: number;
  todayEvents: number;
  successEvents: number;
  failedEvents: number;
  avgTimeMs: number;
  totalFlows: number;
  activeFlows: number;
  scheduledCampaigns: number;
  completedCampaigns: number;
  runningCampaigns: number;
  voiceCalls: number;
  voiceCompleted: number;
  voiceFailed: number;
  instagramAccounts: number;
  instagramAutomationsActive: number;
  instagramEvents: number;
  contactsWhatsapp: number;
  contactsInstagram: number;
  // Novos KPIs avançados
  avgFirstResponseMs: number;
  funnelConversionPct: number;
  unansweredOver1h: number;
}

const emptyStats: PeriodStats = {
  totalContacts: 0, newContacts: 0, activeConversations: 0, totalInPipeline: 0,
  totalProspects: 0, completedSearches: 0, todayEvents: 0, successEvents: 0,
  failedEvents: 0, avgTimeMs: 0, totalFlows: 0, activeFlows: 0,
  scheduledCampaigns: 0, completedCampaigns: 0, runningCampaigns: 0,
  voiceCalls: 0, voiceCompleted: 0, voiceFailed: 0,
  instagramAccounts: 0, instagramAutomationsActive: 0, instagramEvents: 0,
  contactsWhatsapp: 0, contactsInstagram: 0,
  avgFirstResponseMs: 0, funnelConversionPct: 0, unansweredOver1h: 0,
};

function ComparisonBadge({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  const diff = current - previous;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((diff / previous) * 100);
  if (diff === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> Sem variação</span>;
  const isUp = diff > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isUp ? "text-success" : "text-destructive"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{diff}{suffix} ({isUp ? "+" : ""}{pct}%)
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return `${h}h ${remMin}m`;
}

// Para tempo de resposta: queda (negativo) é BOM (verde), subida é RUIM (vermelho)
function ResponseTimeBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-xs text-muted-foreground">Sem comparativo</span>;
  const diff = current - previous;
  if (diff === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> Estável</span>;
  const isImprovement = diff < 0;
  const pct = Math.round(Math.abs(diff / previous) * 100);
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isImprovement ? "text-success" : "text-destructive"}`}>
      {isImprovement ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {isImprovement ? "−" : "+"}{pct}% vs. anterior
    </span>
  );
}

function PctComparisonBadge({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> Estável</span>;
  const isUp = diff > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isUp ? "text-success" : "text-destructive"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{diff.toFixed(1)} p.p. vs. anterior
    </span>
  );
}

function generateInsight(label: string, current: PeriodStats, previous: PeriodStats, days: number): string {
  if (label === "crm") {
    const diff = current.newContacts - previous.newContacts;
    const pct = previous.newContacts === 0 ? (current.newContacts > 0 ? 100 : 0) : Math.round(Math.abs(diff / previous.newContacts) * 100);
    if (diff > 0) return `Você teve ${pct}% mais contatos novos nos últimos ${days} dias comparado ao período anterior.`;
    if (diff < 0) return `Houve uma queda de ${pct}% nos novos contatos comparado ao período anterior.`;
    return `O volume de novos contatos se manteve estável nos últimos ${days} dias.`;
  }
  if (label === "prospection") {
    const diff = current.completedSearches - previous.completedSearches;
    if (diff > 0) return `${diff} busca(s) a mais que o período anterior. Prospecção em alta!`;
    if (diff < 0) return `${Math.abs(diff)} busca(s) a menos que o período anterior.`;
    return `Mesmo volume de buscas nos últimos ${days} dias.`;
  }
  if (label === "followup") {
    const total = current.scheduledCampaigns + current.completedCampaigns + current.runningCampaigns;
    const prevTotal = previous.scheduledCampaigns + previous.completedCampaigns + previous.runningCampaigns;
    const diff = total - prevTotal;
    if (diff > 0) return `${diff} campanha(s) a mais que o período anterior. Follow-up crescendo!`;
    if (diff < 0) return `${Math.abs(diff)} campanha(s) a menos que o período anterior.`;
    if (total === 0) return `Nenhuma campanha de follow-up nos últimos ${days} dias.`;
    return `Volume de campanhas estável nos últimos ${days} dias.`;
  }
  if (label === "instagram") {
    const diff = current.instagramEvents - previous.instagramEvents;
    if (diff > 0) return `${diff} evento(s) a mais no Instagram comparado ao período anterior.`;
    if (diff < 0) return `${Math.abs(diff)} evento(s) a menos no Instagram.`;
    if (current.instagramEvents === 0) return `Nenhum evento do Instagram nos últimos ${days} dias.`;
    return `Volume de eventos do Instagram estável nos últimos ${days} dias.`;
  }
  if (label === "voice") {
    const diff = current.voiceCalls - previous.voiceCalls;
    if (diff > 0) return `${diff} ligação(ões) a mais que o período anterior.`;
    if (diff < 0) return `${Math.abs(diff)} ligação(ões) a menos que o período anterior.`;
    if (current.voiceCalls === 0) return `Nenhuma ligação Voice AI nos últimos ${days} dias.`;
    return `Volume de ligações estável nos últimos ${days} dias.`;
  }
  const curRate = current.todayEvents > 0 ? Math.round((current.successEvents / current.todayEvents) * 100) : 0;
  const prevRate = previous.todayEvents > 0 ? Math.round((previous.successEvents / previous.todayEvents) * 100) : 0;
  if (curRate > prevRate) return `Taxa de sucesso subiu de ${prevRate}% para ${curRate}%.`;
  if (curRate < prevRate) return `Taxa de sucesso caiu de ${prevRate}% para ${curRate}%.`;
  return `Taxa de sucesso estável em ${curRate}% nos últimos ${days} dias.`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useOnboardingTour(); // Guided tour for new users
  const { effectiveUserId } = useEffectiveUserId();
  const { data: organization } = useUserOrganization();
  const {
    plan, subscription, isTrial, trialDaysRemaining, isActive,
    storageLimitMB, storageUsedMB, storagePercentage, isNearLimit, isAtLimit,
  } = useOrganizationSubscription();

  const [currentStats, setCurrentStats] = useState<PeriodStats>(emptyStats);
  const [previousStats, setPreviousStats] = useState<PeriodStats>(emptyStats);
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState<number>(() => Number(localStorage.getItem("tenant-dashboard-period")) || 7);
  const [instanceFilter, setInstanceFilter] = useState<string | null>(() => localStorage.getItem("tenant-dashboard-instance") || null);
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(() => localStorage.getItem("tenant-dashboard-pipeline") || null);
  const [teamFilter, setTeamFilter] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tenant-dashboard-team") || "[]"); } catch { return []; }
  });
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(() => (localStorage.getItem("tenant-dashboard-channel") as ChannelFilter) || "all");

  // Persist filters
  useEffect(() => { localStorage.setItem("tenant-dashboard-period", String(periodDays)); }, [periodDays]);
  useEffect(() => { localStorage.setItem("tenant-dashboard-instance", instanceFilter || ""); }, [instanceFilter]);
  useEffect(() => { localStorage.setItem("tenant-dashboard-pipeline", pipelineFilter || ""); }, [pipelineFilter]);
  useEffect(() => { localStorage.setItem("tenant-dashboard-team", JSON.stringify(teamFilter)); }, [teamFilter]);
  useEffect(() => { localStorage.setItem("tenant-dashboard-channel", channelFilter); }, [channelFilter]);
  // Collapsible states
  const [crmOpen, setCrmOpen] = useState(false);
  const [prospectionOpen, setProspectionOpen] = useState(false);
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);

  // Fetch instances for filter
  const { data: instances } = useQuery({
    queryKey: ["dashboard-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from("instances_safe" as any)
        .select("id, name, provider")
        .eq("organization_id", organization.id)
        .order("name");
      return (data || []) as unknown as { id: string; name: string; provider: string }[];
    },
    enabled: !!organization?.id,
  });

  const periodLabel = useMemo(() => {
    const end = new Date();
    const start = subDays(end, periodDays);
    return `${format(start, "dd/MM")} — ${format(end, "dd/MM")}`;
  }, [periodDays]);

  useEffect(() => {
    if (!user || !effectiveUserId) return;
    const orgId = organization?.id;
    const iid = instanceFilter; // instance filter
    const pid = pipelineFilter;
    const team = teamFilter;
    const channel = channelFilter;

    async function fetchPeriodData(startDate: Date, endDate: Date): Promise<PeriodStats> {
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();
      let newContacts = 0, totalContacts = 0, activeConversations = 0, totalInPipeline = 0;
      let contactsWhatsapp = 0, contactsInstagram = 0;
      let totalProspects = 0, completedSearches = 0;
      let todayEvents = 0, successEvents = 0, failedEvents = 0, avgTimeMs = 0;
      let totalFlows = 0, activeFlows = 0;
      let scheduledCampaigns = 0, completedCampaigns = 0, runningCampaigns = 0;
      let voiceCalls = 0, voiceCompleted = 0, voiceFailed = 0;
      let instagramAccounts = 0, instagramAutomationsActive = 0, instagramEvents = 0;
      let avgFirstResponseMs = 0, funnelConversionPct = 0, unansweredOver1h = 0;

      // Resolve stage IDs do pipeline filtrado
      let pipelineStageIds: string[] | null = null;
      if (pid && orgId) {
        const { data: pStages } = await supabase
          .from("stages")
          .select("id")
          .eq("pipeline_id", pid);
        pipelineStageIds = (pStages || []).map((s: any) => s.id);
      }

      // Events
      let eventsQuery = supabase
        .from("events")
        .select("status, created_at, completed_at")
        .eq("user_id", effectiveUserId)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (iid) eventsQuery = eventsQuery.eq("instance_id", iid);
      const { data: events } = await eventsQuery;
      todayEvents = events?.length || 0;
      successEvents = events?.filter(e => e.status === "completed").length || 0;
      failedEvents = events?.filter(e => e.status === "failed").length || 0;
      const completed = events?.filter(e => e.completed_at);
      if (completed && completed.length > 0) {
        const total = completed.reduce((acc, e) => acc + (new Date(e.completed_at!).getTime() - new Date(e.created_at).getTime()), 0);
        avgTimeMs = Math.round(total / completed.length);
      }

      // Flows
      const { data: flows } = await supabase.from("flows").select("is_active").eq("user_id", effectiveUserId);
      totalFlows = flows?.length || 0;
      activeFlows = flows?.filter(f => f.is_active).length || 0;

      if (orgId) {
        let contactsQuery = supabase
          .from("contacts")
          .select("id, created_at, pipeline_stage_id, channel, assigned_to_member_id")
          .eq("organization_id", orgId);
        if (iid) contactsQuery = contactsQuery.eq("instance_id", iid);
        if (channel !== "all") contactsQuery = contactsQuery.eq("channel", channel);
        if (team.length > 0) contactsQuery = contactsQuery.in("assigned_to_member_id", team);
        if (pipelineStageIds && pipelineStageIds.length > 0) contactsQuery = contactsQuery.in("pipeline_stage_id", pipelineStageIds);
        const { data: contacts } = await contactsQuery;
        totalContacts = contacts?.length || 0;
        newContacts = contacts?.filter(c => new Date(c.created_at) >= startDate && new Date(c.created_at) <= endDate).length || 0;
        totalInPipeline = contacts?.filter(c => c.pipeline_stage_id !== null).length || 0;
        contactsInstagram = contacts?.filter(c => c.channel === "instagram").length || 0;
        contactsWhatsapp = (totalContacts || 0) - contactsInstagram;

        // Active conversations
        if (contacts && contacts.length > 0) {
          let convsQuery = supabase
            .from("conversations")
            .select("id", { count: "exact", head: false })
            .in("contact_id", contacts.map(c => c.id))
            .eq("status", "active");
          if (iid) convsQuery = convsQuery.eq("instance_id", iid);
          const { data: convs } = await convsQuery;
          activeConversations = convs?.length || 0;
        }

        let prospectsQuery = supabase
          .from("prospect_results")
          .select("id, created_at")
          .eq("organization_id", orgId)
          .gte("created_at", startISO)
          .lte("created_at", endISO);
        const { data: prospects } = await prospectsQuery;
        totalProspects = prospects?.length || 0;

        let searchesQuery = supabase
          .from("prospect_searches")
          .select("id, status, created_at")
          .eq("organization_id", orgId)
          .gte("created_at", startISO)
          .lte("created_at", endISO);
        if (iid) searchesQuery = searchesQuery.eq("instance_id", iid);
        const { data: searches } = await searchesQuery;
        completedSearches = searches?.filter(s => s.status === "completed").length || 0;

        let followupQuery = supabase
          .from("voice_campaigns")
          .select("id, status, call_type")
          .eq("organization_id", orgId)
          .eq("call_type", "whatsapp")
          .gte("created_at", startISO)
          .lte("created_at", endISO);
        if (iid) followupQuery = followupQuery.eq("instance_id", iid);
        const { data: followupCampaigns } = await followupQuery;
        scheduledCampaigns = followupCampaigns?.filter(c => c.status === "scheduled").length || 0;
        completedCampaigns = followupCampaigns?.filter(c => c.status === "completed").length || 0;
        runningCampaigns = followupCampaigns?.filter(c => c.status === "running").length || 0;

        let voiceQuery = supabase
          .from("voice_campaigns")
          .select("id, status, completed_calls, failed_calls")
          .eq("organization_id", orgId)
          .eq("call_type", "voice")
          .gte("created_at", startISO)
          .lte("created_at", endISO);
        if (iid) voiceQuery = voiceQuery.eq("instance_id", iid);
        const { data: voiceCampaigns } = await voiceQuery;
        voiceCalls = voiceCampaigns?.length || 0;
        voiceCompleted = voiceCampaigns?.reduce((acc, c) => acc + (c.completed_calls || 0), 0) || 0;
        voiceFailed = voiceCampaigns?.reduce((acc, c) => acc + (c.failed_calls || 0), 0) || 0;

        const { data: igAccounts } = await supabase
          .from("instagram_accounts")
          .select("id")
          .eq("organization_id", orgId);
        instagramAccounts = igAccounts?.length || 0;

        const { data: igAutomations } = await supabase
          .from("instagram_automations")
          .select("id")
          .eq("organization_id", orgId)
          .eq("is_enabled", true);
        instagramAutomationsActive = igAutomations?.length || 0;

        const { data: igEvents } = await supabase
          .from("instagram_events")
          .select("id")
          .eq("organization_id", orgId)
          .gte("received_at", startISO)
          .lte("received_at", endISO);
        instagramEvents = igEvents?.length || 0;

        // === Novos KPIs avançados ===
        // 1) Tempo médio de 1ª resposta — para conversas criadas no período
        if (contacts && contacts.length > 0) {
          let convsForRespQuery = supabase
            .from("conversations")
            .select("id, created_at")
            .in("contact_id", contacts.map(c => c.id))
            .gte("created_at", startISO)
            .lte("created_at", endISO);
          if (iid) convsForRespQuery = convsForRespQuery.eq("instance_id", iid);
          const { data: convsForResp } = await convsForRespQuery;
          if (convsForResp && convsForResp.length > 0) {
            const convIds = convsForResp.map(c => c.id);
            const { data: msgs } = await supabase
              .from("messages")
              .select("conversation_id, direction, timestamp")
              .in("conversation_id", convIds)
              .order("timestamp", { ascending: true });
            const firstInbound = new Map<string, number>();
            const firstOutboundAfter = new Map<string, number>();
            for (const m of (msgs || []) as any[]) {
              const t = new Date(m.timestamp).getTime();
              if (m.direction === "inbound" && !firstInbound.has(m.conversation_id)) {
                firstInbound.set(m.conversation_id, t);
              } else if (
                m.direction === "outbound" &&
                firstInbound.has(m.conversation_id) &&
                !firstOutboundAfter.has(m.conversation_id) &&
                t >= (firstInbound.get(m.conversation_id) || 0)
              ) {
                firstOutboundAfter.set(m.conversation_id, t);
              }
            }
            const deltas: number[] = [];
            firstOutboundAfter.forEach((out, cid) => {
              const inb = firstInbound.get(cid);
              if (inb) deltas.push(out - inb);
            });
            if (deltas.length > 0) {
              avgFirstResponseMs = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
            }
          }
        }

        // 2) Taxa de conversão do funil — contatos criados no período que estão em estágios "Fechado"
        if (newContacts > 0) {
          const newContactIds = (contacts || [])
            .filter(c => new Date(c.created_at) >= startDate && new Date(c.created_at) <= endDate && c.pipeline_stage_id)
            .map(c => ({ id: c.id, stageId: c.pipeline_stage_id! }));
          if (newContactIds.length > 0) {
            const stageIds = Array.from(new Set(newContactIds.map(c => c.stageId)));
            const { data: stages } = await supabase
              .from("stages")
              .select("id, name")
              .in("id", stageIds);
            const closedStageIds = new Set(
              (stages || [])
                .filter(s => /fechad|conclu|ganho|won|closed/i.test(s.name))
                .map(s => s.id)
            );
            const closedCount = newContactIds.filter(c => closedStageIds.has(c.stageId)).length;
            funnelConversionPct = Math.round((closedCount / newContacts) * 1000) / 10;
          }
        }

        // 3) Conversas sem resposta > 1h (agora, ignora período — é alerta em tempo real)
        if (contacts && contacts.length > 0) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          let unansweredQuery = supabase
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .in("contact_id", contacts.map(c => c.id))
            .eq("status", "active")
            .eq("last_sender_type", "customer")
            .lt("last_message_at", oneHourAgo);
          if (iid) unansweredQuery = unansweredQuery.eq("instance_id", iid);
          const { count } = await unansweredQuery;
          unansweredOver1h = count || 0;
        }
      }

      return {
        totalContacts, newContacts, activeConversations, totalInPipeline,
        totalProspects, completedSearches, todayEvents, successEvents,
        failedEvents, avgTimeMs, totalFlows, activeFlows,
        scheduledCampaigns, completedCampaigns, runningCampaigns,
        voiceCalls, voiceCompleted, voiceFailed,
        instagramAccounts, instagramAutomationsActive, instagramEvents,
        contactsWhatsapp, contactsInstagram,
        avgFirstResponseMs, funnelConversionPct, unansweredOver1h,
      };
    }

    async function fetchAll() {
      setLoading(true);
      try {
        const { data: integration } = await supabase.from("integrations").select("id").eq("user_id", effectiveUserId).maybeSingle();
        setHasIntegration(!!integration);

        const now = new Date();
        const periodStart = subDays(now, periodDays);
        const prevEnd = new Date(periodStart);
        const prevStart = subDays(prevEnd, periodDays);

        const [cur, prev] = await Promise.all([
          fetchPeriodData(periodStart, now),
          fetchPeriodData(prevStart, prevEnd),
        ]);
        setCurrentStats(cur);
        setPreviousStats(prev);
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [user, effectiveUserId, organization?.id, periodDays, instanceFilter, pipelineFilter, channelFilter, JSON.stringify(teamFilter)]);

  const formatTime = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  const stats = currentStats;

  const storageColor = isAtLimit ? "text-destructive" : isNearLimit ? "text-warning" : "text-primary";

  const totalActiveCampaigns = stats.scheduledCampaigns + stats.runningCampaigns + stats.voiceCalls;

  return (
    <AppLayout title="Dashboard" description="Visão geral do OpenFlow">
      <div className="space-y-5 sm:space-y-6 animate-fade-in">
        <LimitAlert feature="analytics" className="mb-4" />

        {/* Onboarding: welcome modal + checklist persistente (auto-oculta quando completo) */}
        <OnboardingSection />

        {/* Welcome banner */}
        {hasIntegration === false && (
          <Card className="quantum-glass neon-glow-pink">
            <CardContent className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 py-4 sm:py-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl gradient-primary">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg">Bem-vindo ao OpenFlow! 🎉</h3>
                  <p className="text-sm text-muted-foreground hidden sm:block">Configure sua integração com o Sistema de WhatsApp AI para começar.</p>
                </div>
              </div>
              <Button onClick={() => navigate("/settings")} className="gradient-primary hover:opacity-90">
                <Settings className="h-4 w-4 mr-2" /> Configurar agora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Header: Period Filter + Instance Filter + Plan/Storage Card ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            {/* Instance filter */}
            {instances && instances.length > 0 && (
              <Select value={instanceFilter || "all"} onValueChange={(v) => setInstanceFilter(v === "all" ? null : v)}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue>
                    {instanceFilter ? (
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3 w-3" />
                        <span className="truncate">{instances.find(i => i.id === instanceFilter)?.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3 w-3" />
                        <span>Todas instâncias</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      Todas as instâncias
                    </div>
                  </SelectItem>
                  {instances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{inst.name}</span>
                        {inst.provider === "meta_official" && (
                          <Badge variant="outline" className="text-xs px-1 py-0 border-accent/30 text-accent ml-1">Meta</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <PipelineFilter value={pipelineFilter} onChange={setPipelineFilter} />
            <TeamFilter value={teamFilter} onChange={setTeamFilter} />
            <ChannelFilterSelect value={channelFilter} onChange={setChannelFilter} />

            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          </div>

          {/* Plan & Storage card */}
          {plan && (
            <Card className="px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 border-border/60">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Crown className="h-3.5 w-3.5 text-primary" />
                <span>{plan.name}</span>
                {isTrial && trialDaysRemaining !== null && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">Trial · {trialDaysRemaining}d</Badge>
                )}
                {isActive && !isTrial && (
                  <Badge variant="default" className="text-xs px-1.5 py-0 ml-1">Ativo</Badge>
                )}
              </div>
              <div className="hidden sm:block h-4 w-px bg-border" />
              <div className={`flex items-center gap-2 text-xs ${storageColor}`}>
                <HardDrive className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{storageUsedMB}/{storageLimitMB} MB</span>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isAtLimit ? "bg-destructive" : isNearLimit ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{Math.round(storagePercentage)}%</span>
              </div>
            </Card>
          )}
        </div>

        {/* ── KPI Strip: 7 always-visible metrics ── */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/crm")}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Contatos</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight">{stats.totalContacts}</div>
              <div className="mt-1.5 space-y-1">
                <ComparisonBadge current={stats.newContacts} previous={previousStats.newContacts} suffix={` novos`} />
                <p className="text-xs text-muted-foreground">
                  WhatsApp {stats.contactsWhatsapp} · Instagram {stats.contactsInstagram}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/crm")}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Conversas Ativas</span>
                <MessageSquare className="h-4 w-4 text-accent" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-accent">{stats.activeConversations}</div>
              <p className="text-xs text-muted-foreground mt-1.5">em andamento</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/kanban")}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">No Funil Kanban</span>
                <Kanban className="h-4 w-4 text-warning" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight">{stats.totalInPipeline}</div>
              <p className="text-xs text-muted-foreground mt-1.5">contatos em estágios</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/follow-up")}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Campanhas Ativas</span>
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">{totalActiveCampaigns}</div>
              <p className="text-xs text-muted-foreground mt-1.5">follow-up + voice</p>
            </CardContent>
          </Card>

          {/* Tempo médio 1ª resposta */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/reports")}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Tempo médio 1ª resposta</span>
                <Clock className="h-4 w-4 text-accent" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight">
                {stats.avgFirstResponseMs > 0 ? formatDuration(stats.avgFirstResponseMs) : "—"}
              </div>
              <div className="mt-1.5">
                <ResponseTimeBadge current={stats.avgFirstResponseMs} previous={previousStats.avgFirstResponseMs} />
              </div>
            </CardContent>
          </Card>

          {/* Conversão funil */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/kanban")}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Conversão funil</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
                {stats.funnelConversionPct.toFixed(1)}%
              </div>
              <div className="mt-1.5">
                <PctComparisonBadge current={stats.funnelConversionPct} previous={previousStats.funnelConversionPct} />
              </div>
            </CardContent>
          </Card>

          {/* Sem resposta > 1h */}
          <Card
            className={`cursor-pointer hover:shadow-lg transition-shadow ${stats.unansweredOver1h > 0 ? "border-warning/40 bg-warning/5" : ""}`}
            onClick={() => navigate("/crm?filter=unanswered_1h")}
          >
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Sem resposta &gt; 1h</span>
                <Clock className={`h-4 w-4 ${stats.unansweredOver1h > 0 ? "text-warning" : "text-muted-foreground"}`} />
              </div>
              <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${stats.unansweredOver1h > 0 ? "text-warning" : ""}`}>
                {stats.unansweredOver1h}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {stats.unansweredOver1h > 0 ? "clique para ver lista" : "tudo em dia"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Modules + Smart Summary side by side ── */}
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5">
          {/* Left: Navigation modules */}
          <div className="flex-1 lg:flex-[3]">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-accent" /> Módulos
            </h2>
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { icon: GitBranch, label: "Fluxos", value: `${stats.activeFlows}/${stats.totalFlows}`, path: "/flows", color: "text-primary" },
                { icon: MessageSquare, label: "CRM", value: `${stats.activeConversations} ativas`, path: "/crm", color: "text-accent" },
                { icon: Kanban, label: "Funil Kanban", value: `${stats.totalInPipeline} contatos`, path: "/kanban", color: "text-warning" },
                { icon: UserSearch, label: "Prospecção", value: `${stats.totalProspects} leads`, path: "/prospection", color: "text-primary" },
                { icon: Megaphone, label: "Follow-up", value: stats.scheduledCampaigns > 0 ? `${stats.scheduledCampaigns} agendada(s)` : "—", path: "/follow-up", color: "text-primary" },
                { icon: Phone, label: "Voice AI", value: stats.voiceCalls > 0 ? `${stats.voiceCalls} campanha(s)` : "—", path: "/voice", color: "text-accent" },
                { icon: Instagram, label: "Instagram", value: stats.instagramAccounts > 0 ? `${stats.instagramAccounts} conta(s)` : "—", path: "/instagram", color: "text-primary" },
              ].map((mod) => (
                <Card
                  key={mod.path}
                  className="cursor-pointer hover:shadow-lg transition-all group px-3 py-3"
                  onClick={() => navigate(mod.path)}
                >
                  <div className="flex items-center gap-2.5">
                    <mod.icon className={`h-4 w-4 ${mod.color} shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{mod.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{mod.value}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Right: Smart Summary */}
          <div className="lg:flex-[2]">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
              <Lightbulb className="h-3.5 w-3.5 text-accent" /> Resumo do Período
            </h2>
            <Card className="border-accent/20 h-[calc(100%-2rem)]">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">{periodLabel}</p>
                {[
                  { icon: MessageSquare, insight: generateInsight("crm", currentStats, previousStats, periodDays), color: "text-primary" },
                  { icon: UserSearch, insight: generateInsight("prospection", currentStats, previousStats, periodDays), color: "text-primary" },
                  { icon: Megaphone, insight: generateInsight("followup", currentStats, previousStats, periodDays), color: "text-primary" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-primary/5 rounded-md">
                    <item.icon className={`h-3.5 w-3.5 ${item.color} shrink-0 mt-0.5`} />
                    <p className="text-xs text-foreground/80 leading-snug">{item.insight}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Detailed sections in 2-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CRM & Funil Kanban */}
          <Card className="border-border/60">
            <Collapsible open={crmOpen} onOpenChange={setCrmOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 group cursor-pointer">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" /> CRM & Funil Kanban
                  </h3>
                  {crmOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 p-2.5 bg-accent/10 border border-accent/20 rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{generateInsight("crm", currentStats, previousStats, periodDays)}</p>
                  </div>
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Contatos</span>
                          <Users className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-xl font-bold">{stats.totalContacts}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Novos ({periodDays}d)</span>
                          <Plus className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div className="text-xl font-bold text-success">{stats.newContacts}</div>
                        <ComparisonBadge current={stats.newContacts} previous={previousStats.newContacts} />
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Conversas</span>
                          <MessageSquare className="h-3.5 w-3.5 text-accent" />
                        </div>
                        <div className="text-xl font-bold text-accent">{stats.activeConversations}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/kanban")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Pipeline</span>
                          <Kanban className="h-3.5 w-3.5 text-warning" />
                        </div>
                        <div className="text-xl font-bold">{stats.totalInPipeline}</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Prospecção */}
          <Card className="border-border/60">
            <Collapsible open={prospectionOpen} onOpenChange={setProspectionOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 group cursor-pointer">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <UserSearch className="h-4 w-4 text-primary" /> Prospecção
                  </h3>
                  {prospectionOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 p-2.5 bg-accent/10 border border-accent/20 rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{generateInsight("prospection", currentStats, previousStats, periodDays)}</p>
                  </div>
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/prospection")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Leads</span>
                          <UserSearch className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-xl font-bold">{stats.totalProspects}</div>
                        <ComparisonBadge current={stats.totalProspects} previous={previousStats.totalProspects} />
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/prospection")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Buscas</span>
                          <Search className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div className="text-xl font-bold text-success">{stats.completedSearches}</div>
                        <ComparisonBadge current={stats.completedSearches} previous={previousStats.completedSearches} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Campanhas de Follow-up (WhatsApp) */}
          <Card className="border-border/60">
            <Collapsible open={followupOpen} onOpenChange={setFollowupOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 group cursor-pointer">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" /> Campanhas de Follow-up (WhatsApp)
                  </h3>
                  {followupOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 p-2.5 bg-accent/10 border border-accent/20 rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">
                      Mensagens automáticas de reengajamento enviadas para contatos. Crie e gerencie em <button onClick={() => navigate("/follow-up")} className="underline hover:text-accent font-medium">Follow-up →</button>
                    </p>
                  </div>
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/follow-up")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Agendadas</span>
                          <Clock className="h-3.5 w-3.5 text-warning" />
                        </div>
                        <div className="text-xl font-bold text-warning">{stats.scheduledCampaigns}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/follow-up")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Rodando</span>
                          <Activity className="h-3.5 w-3.5 text-accent" />
                        </div>
                        <div className="text-xl font-bold text-accent">{stats.runningCampaigns}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/follow-up")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Concluídas</span>
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div className="text-xl font-bold text-success">{stats.completedCampaigns}</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Voice AI */}
          <Card className="border-border/60">
            <Collapsible open={voiceOpen} onOpenChange={setVoiceOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 group cursor-pointer">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" /> Voice AI
                  </h3>
                  {voiceOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 p-2.5 bg-accent/10 border border-accent/20 rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{generateInsight("voice", currentStats, previousStats, periodDays)}</p>
                  </div>
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/voice")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Campanhas</span>
                          <PhoneCall className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-xl font-bold">{stats.voiceCalls}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/voice")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Concluídas</span>
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div className="text-xl font-bold text-success">{stats.voiceCompleted}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/voice")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Falhas</span>
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        </div>
                        <div className="text-xl font-bold text-destructive">{stats.voiceFailed}</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Instagram */}
          <Card className="border-border/60">
            <Collapsible open={instagramOpen} onOpenChange={setInstagramOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 group cursor-pointer">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-primary" /> Instagram
                  </h3>
                  {instagramOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 p-2.5 bg-accent/10 border border-accent/20 rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{generateInsight("instagram", currentStats, previousStats, periodDays)}</p>
                  </div>
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/instagram")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Contas</span>
                          <Instagram className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-xl font-bold">{stats.instagramAccounts}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/instagram")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Automações</span>
                          <Bot className="h-3.5 w-3.5 text-accent" />
                        </div>
                        <div className="text-xl font-bold text-accent">{stats.instagramAutomationsActive}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/instagram")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Eventos</span>
                          <Activity className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div className="text-xl font-bold text-success">{stats.instagramEvents}</div>
                        <ComparisonBadge current={stats.instagramEvents} previous={previousStats.instagramEvents} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Automação Webhooks */}
          <Card className="border-border/60">
            <Collapsible open={webhooksOpen} onOpenChange={setWebhooksOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 group cursor-pointer">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Webhooks
                  </h3>
                  {webhooksOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 p-2.5 bg-accent/10 border border-accent/20 rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{generateInsight("webhooks", currentStats, previousStats, periodDays)}</p>
                  </div>
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/history")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Eventos ({periodDays}d)</span>
                          <Activity className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-xl font-bold">{stats.todayEvents}</div>
                        <ComparisonBadge current={stats.todayEvents} previous={previousStats.todayEvents} />
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/history")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Sucesso</span>
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div className="text-xl font-bold text-success">{stats.successEvents}</div>
                        <ComparisonBadge current={stats.successEvents} previous={previousStats.successEvents} />
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/history")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Falhas</span>
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        </div>
                        <div className="text-xl font-bold text-destructive">{stats.failedEvents}</div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/history")}>
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Tempo Médio</span>
                          <Clock className="h-3.5 w-3.5 text-warning" />
                        </div>
                        <div className="text-xl font-bold">{formatTime(stats.avgTimeMs)}</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
