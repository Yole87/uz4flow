import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, differenceInDays, format } from "date-fns";
import type { ReportPeriod } from "@/components/reports/ReportFilters";

const STALE = 5 * 60 * 1000;

const CLOSED_STAGE_REGEX = /(fechad|ganho|won|cliente)/i;

// Local view-model types for report aggregations
type ContactRow = { id: string; created_at: string; channel?: string | null; pipeline_stage_id?: string | null; updated_at?: string; name?: string | null; assigned_to_member_id?: string | null; organization_id?: string };
type MessageRow = { id?: string; conversation_id: string; direction: "inbound" | "outbound" | string; timestamp: string };
type StageRow = { id: string; name: string; color: string; order_index: number; pipeline_id?: string };
type MemberRow = { id: string; first_name: string | null; last_name?: string | null; user_id?: string | null };

interface BaseArgs {
  organizationId?: string;
  effectiveUserId?: string | null;
  period: ReportPeriod;
  instanceId: string | null;
  enabled?: boolean;
}

function previousPeriod(period: ReportPeriod): ReportPeriod {
  const days = Math.max(1, differenceInDays(period.end, period.start) || 1);
  const prevEnd = new Date(period.start);
  const prevStart = subDays(prevEnd, days);
  return { preset: period.preset, start: prevStart, end: prevEnd };
}

// ─────────────────────────────────────── Overview
export function useReportOverview({ organizationId, period, instanceId, enabled = true }: BaseArgs) {
  const startISO = period.start.toISOString();
  const endISO = period.end.toISOString();
  const prev = previousPeriod(period);

  return useQuery({
    queryKey: ["report", "overview", organizationId, instanceId, startISO, endISO],
    enabled: enabled && !!organizationId,
    staleTime: STALE,
    queryFn: async () => {
      // Contacts
      let contactsQ = supabase
        .from("contacts")
        .select("id, created_at, channel, pipeline_stage_id")
        .eq("organization_id", organizationId!)
        .gte("created_at", prev.start.toISOString())
        .lte("created_at", endISO);
      if (instanceId) contactsQ = contactsQ.eq("instance_id", instanceId);
      const { data: contacts = [] } = await contactsQ;

      const inPeriod = (d: string) => new Date(d) >= period.start && new Date(d) <= period.end;
      const inPrev = (d: string) => new Date(d) >= prev.start && new Date(d) < period.start;

      const newContacts = contacts.filter((c) => inPeriod(c.created_at)).length;
      const newContactsPrev = contacts.filter((c) => inPrev(c.created_at)).length;

      // Conversations started
      let convsQ = supabase
        .from("conversations")
        .select("id, created_at, channel, contact_id, instance_id")
        .gte("created_at", prev.start.toISOString())
        .lte("created_at", endISO);
      if (instanceId) convsQ = convsQ.eq("instance_id", instanceId);
      const { data: convs = [] } = await convsQ;

      // Filter by org via contacts
      const orgContactIds = new Set(contacts.map((c) => c.id));
      // Need to also load contacts beyond the date range for conversations whose contacts were created earlier
      const convContactIds = Array.from(new Set(convs.map((c) => c.contact_id))).filter(
        (id) => !orgContactIds.has(id)
      );
      let extraContacts: ContactRow[] = [];
      if (convContactIds.length > 0) {
        const { data } = await supabase
          .from("contacts")
          .select("id, organization_id, channel")
          .in("id", convContactIds)
          .eq("organization_id", organizationId!);
        extraContacts = (data || []) as ContactRow[];
      }
      const allContactsMap = new Map<string, ContactRow>();
      contacts.forEach((c) => allContactsMap.set(c.id, c as ContactRow));
      extraContacts.forEach((c) => allContactsMap.set(c.id, c));
      const orgConvs = convs.filter((c) => allContactsMap.has(c.contact_id));

      const convsCurrent = orgConvs.filter((c) => inPeriod(c.created_at));
      const convsPrev = orgConvs.filter((c) => inPrev(c.created_at));

      // Messages (for response rate + first response time)
      const convIdsCurrent = convsCurrent.map((c) => c.id);
      const convIdsPrev = convsPrev.map((c) => c.id);
      const allConvIds = [...convIdsCurrent, ...convIdsPrev];

      let avgFirstResponseMs = 0;
      let avgFirstResponseMsPrev = 0;
      let responseRateCurrent = 0;
      let responseRatePrev = 0;
      const newByDay = new Map<string, number>();
      const channelByDay = new Map<string, { whatsapp: number; instagram: number }>();

      // Build daily series for current period
      contacts
        .filter((c) => inPeriod(c.created_at))
        .forEach((c) => {
          const day = format(new Date(c.created_at), "yyyy-MM-dd");
          newByDay.set(day, (newByDay.get(day) || 0) + 1);
        });
      orgConvs
        .filter((c) => inPeriod(c.created_at))
        .forEach((c) => {
          const day = format(new Date(c.created_at), "yyyy-MM-dd");
          const ch = (c.channel || "whatsapp") as "whatsapp" | "instagram";
          const cur = channelByDay.get(day) || { whatsapp: 0, instagram: 0 };
          if (ch === "instagram") cur.instagram += 1;
          else cur.whatsapp += 1;
          channelByDay.set(day, cur);
        });

      if (allConvIds.length > 0) {
        // Batch in chunks of 200
        const chunks: string[][] = [];
        for (let i = 0; i < allConvIds.length; i += 200) chunks.push(allConvIds.slice(i, i + 200));
        const allMsgs: MessageRow[] = [];
        for (const chunk of chunks) {
          const { data } = await supabase
            .from("messages")
            .select("id, conversation_id, direction, timestamp")
            .in("conversation_id", chunk)
            .gte("timestamp", prev.start.toISOString())
            .lte("timestamp", endISO)
            .order("timestamp", { ascending: true });
          if (data) allMsgs.push(...(data as MessageRow[]));
        }

        // Group by conversation
        const byConv = new Map<string, MessageRow[]>();
        allMsgs.forEach((m) => {
          const arr = byConv.get(m.conversation_id) || [];
          arr.push(m);
          byConv.set(m.conversation_id, arr);
        });

        const computeStats = (ids: string[]) => {
          const deltas: number[] = [];
          let answered = 0;
          let withInbound = 0;
          ids.forEach((id) => {
            const msgs = byConv.get(id);
            if (!msgs) return;
            const firstInbound = msgs.find((m) => m.direction === "inbound");
            if (!firstInbound) return;
            withInbound += 1;
            const firstOutboundAfter = msgs.find(
              (m) => m.direction === "outbound" && new Date(m.timestamp) > new Date(firstInbound.timestamp)
            );
            if (firstOutboundAfter) {
              answered += 1;
              deltas.push(
                new Date(firstOutboundAfter.timestamp).getTime() - new Date(firstInbound.timestamp).getTime()
              );
            }
          });
          const avg = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
          const rate = withInbound > 0 ? (answered / withInbound) * 100 : 0;
          return { avg, rate };
        };

        const cur = computeStats(convIdsCurrent);
        const pre = computeStats(convIdsPrev);
        avgFirstResponseMs = cur.avg;
        avgFirstResponseMsPrev = pre.avg;
        responseRateCurrent = cur.rate;
        responseRatePrev = pre.rate;
      }

      // Conversions: contacts whose stage name matches "fechado"
      const stageIds = Array.from(
        new Set(contacts.map((c) => c.pipeline_stage_id).filter(Boolean))
      ) as string[];
      let closedStageIds: Set<string> = new Set();
      if (stageIds.length > 0) {
        const { data: stages } = await supabase
          .from("stages")
          .select("id, name")
          .in("id", stageIds);
        stages?.forEach((s) => {
          if (CLOSED_STAGE_REGEX.test(s.name || "")) closedStageIds.add(s.id);
        });
      }
      const conversionsCurrent = contacts.filter(
        (c) => inPeriod(c.created_at) && c.pipeline_stage_id && closedStageIds.has(c.pipeline_stage_id)
      ).length;
      const conversionsPrev = contacts.filter(
        (c) => inPrev(c.created_at) && c.pipeline_stage_id && closedStageIds.has(c.pipeline_stage_id)
      ).length;

      // Build series array sorted by day
      const days: string[] = [];
      const cursor = new Date(period.start);
      cursor.setHours(0, 0, 0, 0);
      const endDay = new Date(period.end);
      endDay.setHours(0, 0, 0, 0);
      while (cursor <= endDay) {
        days.push(format(cursor, "yyyy-MM-dd"));
        cursor.setDate(cursor.getDate() + 1);
      }

      const dailySeries = days.map((d) => ({
        date: d,
        label: format(new Date(d), "dd/MM"),
        contacts: newByDay.get(d) || 0,
        whatsapp: channelByDay.get(d)?.whatsapp || 0,
        instagram: channelByDay.get(d)?.instagram || 0,
      }));

      return {
        kpis: {
          newContacts,
          newContactsPrev,
          conversations: convsCurrent.length,
          conversationsPrev: convsPrev.length,
          responseRate: responseRateCurrent,
          responseRatePrev,
          avgFirstResponseMs,
          avgFirstResponseMsPrev,
          conversions: conversionsCurrent,
          conversionsPrev,
        },
        dailySeries,
      };
    },
  });
}

// ─────────────────────────────────────── Funnel
export function useReportFunnel({ organizationId, period, instanceId, enabled = true }: BaseArgs) {
  return useQuery({
    queryKey: ["report", "funnel", organizationId, instanceId, period.start.toISOString(), period.end.toISOString()],
    enabled: enabled && !!organizationId,
    staleTime: STALE,
    queryFn: async () => {
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("id, name, is_default")
        .eq("organization_id", organizationId!)
        .order("is_default", { ascending: false });

      const { data: stages } = await supabase
        .from("stages")
        .select("id, name, color, order_index, pipeline_id")
        .in("pipeline_id", (pipelines || []).map((p) => p.id))
        .order("order_index", { ascending: true });

      let contactsQ = supabase
        .from("contacts")
        .select("id, name, pipeline_stage_id, updated_at, created_at, assigned_to_member_id")
        .eq("organization_id", organizationId!);
      if (instanceId) contactsQ = contactsQ.eq("instance_id", instanceId);
      const { data: contacts = [] } = await contactsQ;

      const { data: members } = await supabase
        .from("team_members")
        .select("id, first_name")
        .eq("organization_id", organizationId!);
      const memberMap = new Map<string, string>();
      (members as MemberRow[] | null)?.forEach((m) => memberMap.set(m.id, m.first_name || "—"));

      const stageMap = new Map<string, StageRow>(
        ((stages as StageRow[] | null) ?? []).map((s) => [s.id, s])
      );
      const closedStageIds = new Set(
        ((stages ?? []) as StageRow[]).filter((s) => CLOSED_STAGE_REGEX.test(s.name)).map((s) => s.id)
      );

      const pipelineData = (pipelines || []).map((p) => {
        const pStages = ((stages ?? []) as StageRow[]).filter((s) => s.pipeline_id === p.id);
        const counts = pStages.map((s) => {
          const count = contacts.filter((c) => c.pipeline_stage_id === s.id).length;
          return { id: s.id, name: s.name, color: s.color, order_index: s.order_index, count };
        });
        const withConv = counts.map((s, idx) => {
          const prev = idx > 0 ? counts[idx - 1].count : null;
          const conversionPct = prev !== null && prev > 0 ? (s.count / prev) * 100 : null;
          const isBottleneck = conversionPct !== null && conversionPct < 50 && idx > 0;
          return { ...s, conversionPct, isBottleneck };
        });
        return { id: p.id, name: p.name, stages: withConv };
      });

      // Stagnant leads: in non-final stages, updated >7 days ago
      const sevenDaysAgo = subDays(new Date(), 7);
      const stagnant = contacts
        .filter((c) => c.pipeline_stage_id && !closedStageIds.has(c.pipeline_stage_id))
        .filter((c) => new Date(c.updated_at) < sevenDaysAgo)
        .map((c) => {
          const stage = stageMap.get(c.pipeline_stage_id!) as StageRow | undefined;
          const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: c.id,
            name: c.name || "Sem nome",
            stage: stage?.name || "—",
            stageColor: stage?.color || "#888",
            assignedTo: c.assigned_to_member_id ? memberMap.get(c.assigned_to_member_id) || "—" : "Sem responsável",
            daysStagnant: days,
            updatedAt: c.updated_at,
          };
        })
        .sort((a, b) => b.daysStagnant - a.daysStagnant);

      // Avg cycle time (approximate)
      const closedContacts = contacts.filter(
        (c) => c.pipeline_stage_id && closedStageIds.has(c.pipeline_stage_id)
      );
      const avgCycleDays =
        closedContacts.length > 0
          ? closedContacts.reduce(
              (acc, c) =>
                acc + (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24),
              0
            ) / closedContacts.length
          : 0;

      return {
        pipelines: pipelineData,
        stagnant,
        avgCycleDays,
        closedCount: closedContacts.length,
        totalContacts: contacts.length,
      };
    },
  });
}

// ─────────────────────────────────────── Team
export function useReportTeam({ organizationId, period, instanceId, enabled = true }: BaseArgs) {
  return useQuery({
    queryKey: ["report", "team", organizationId, instanceId, period.start.toISOString(), period.end.toISOString()],
    enabled: enabled && !!organizationId,
    staleTime: STALE,
    queryFn: async () => {
      const startISO = period.start.toISOString();
      const endISO = period.end.toISOString();

      const { data: members = [] } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, user_id")
        .eq("organization_id", organizationId!);

      let contactsQ = supabase
        .from("contacts")
        .select("id, assigned_to_member_id, pipeline_stage_id")
        .eq("organization_id", organizationId!);
      if (instanceId) contactsQ = contactsQ.eq("instance_id", instanceId);
      const { data: contacts = [] } = await contactsQ;

      const stageIds = Array.from(new Set(contacts.map((c) => c.pipeline_stage_id).filter(Boolean))) as string[];
      let closedStageIds: Set<string> = new Set();
      if (stageIds.length > 0) {
        const { data: stages } = await supabase
          .from("stages")
          .select("id, name")
          .in("id", stageIds);
        stages?.forEach((s) => {
          if (CLOSED_STAGE_REGEX.test(s.name || "")) closedStageIds.add(s.id);
        });
      }

      let convQ = supabase
        .from("conversations")
        .select("id, contact_id, assigned_to, created_at, instance_id")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (instanceId) convQ = convQ.eq("instance_id", instanceId);
      const { data: convs = [] } = await convQ;

      // Filter convs whose contact belongs to org
      const orgContactIds = new Set(contacts.map((c) => c.id));
      const orgConvs = convs.filter((c) => orgContactIds.has(c.contact_id));
      const convIds = orgConvs.map((c) => c.id);

      // Heatmap data — fetch inbound messages timestamps in period
      const allMsgs: MessageRow[] = [];
      if (convIds.length > 0) {
        for (let i = 0; i < convIds.length; i += 200) {
          const chunk = convIds.slice(i, i + 200);
          const { data } = await supabase
            .from("messages")
            .select("conversation_id, direction, timestamp")
            .in("conversation_id", chunk)
            .gte("timestamp", startISO)
            .lte("timestamp", endISO)
            .order("timestamp", { ascending: true });
          if (data) allMsgs.push(...(data as MessageRow[]));
        }
      }

      // Per-member performance
      const perMember = (members as MemberRow[]).map((m) => {
        const memberConvs = orgConvs.filter((c) => c.assigned_to === m.user_id);
        const memberConvIds = new Set(memberConvs.map((c) => c.id));
        const memberMsgs = allMsgs.filter((msg) => memberConvIds.has(msg.conversation_id));

        // Avg response time
        const byConv = new Map<string, MessageRow[]>();
        memberMsgs.forEach((msg) => {
          const arr = byConv.get(msg.conversation_id) || [];
          arr.push(msg);
          byConv.set(msg.conversation_id, arr);
        });
        const deltas: number[] = [];
        let firstResponses: number[] = [];
        byConv.forEach((msgs) => {
          const sorted = msgs.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const firstInbound = sorted.find((m) => m.direction === "inbound");
          if (!firstInbound) return;
          const firstOut = sorted.find(
            (m) => m.direction === "outbound" && new Date(m.timestamp) > new Date(firstInbound.timestamp)
          );
          if (firstOut) {
            const delta = new Date(firstOut.timestamp).getTime() - new Date(firstInbound.timestamp).getTime();
            deltas.push(delta);
            firstResponses.push(delta);
          }
        });
        const avgRespMs = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;

        // Conversion rate
        const memberContacts = contacts.filter((c) => c.assigned_to_member_id === m.id);
        const memberClosed = memberContacts.filter(
          (c) => c.pipeline_stage_id && closedStageIds.has(c.pipeline_stage_id)
        ).length;
        const conversionPct = memberContacts.length > 0 ? (memberClosed / memberContacts.length) * 100 : 0;

        // SLA <5min
        const slaCount = firstResponses.filter((d) => d < 5 * 60 * 1000).length;

        return {
          id: m.id,
          name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Sem nome",
          conversations: memberConvs.length,
          avgRespMs,
          conversions: memberClosed,
          conversionPct,
          slaUnder5min: firstResponses.length > 0 ? (slaCount / firstResponses.length) * 100 : 0,
        };
      });

      perMember.sort((a, b) => b.conversions - a.conversions);

      // Heatmap (day-of-week × hour) from inbound msgs
      const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      allMsgs
        .filter((m) => m.direction === "inbound")
        .forEach((m) => {
          const d = new Date(m.timestamp);
          heatmap[d.getDay()][d.getHours()] += 1;
        });

      // SLA global
      const allDeltas = perMember.flatMap((m) => []) as number[];
      // Recompute global SLA based on all conversations
      const allByConv = new Map<string, MessageRow[]>();
      allMsgs.forEach((msg) => {
        const arr = allByConv.get(msg.conversation_id) || [];
        arr.push(msg);
        allByConv.set(msg.conversation_id, arr);
      });
      const globalFirstResp: number[] = [];
      allByConv.forEach((msgs) => {
        const sorted = msgs.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const fi = sorted.find((m) => m.direction === "inbound");
        if (!fi) return;
        const fo = sorted.find(
          (m) => m.direction === "outbound" && new Date(m.timestamp) > new Date(fi.timestamp)
        );
        if (fo) globalFirstResp.push(new Date(fo.timestamp).getTime() - new Date(fi.timestamp).getTime());
      });

      const slaThresholds = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
      const slaPercents = slaThresholds.map((thr) => ({
        threshold: thr,
        pct:
          globalFirstResp.length > 0
            ? (globalFirstResp.filter((d) => d <= thr).length / globalFirstResp.length) * 100
            : 0,
      }));

      return {
        members: perMember,
        heatmap,
        slaPercents,
        totalConversations: orgConvs.length,
      };
    },
  });
}

// ─────────────────────────────────────── Flows
export function useReportFlows({ organizationId, effectiveUserId, period, enabled = true }: BaseArgs) {
  return useQuery({
    queryKey: ["report", "flows", organizationId, effectiveUserId, period.start.toISOString(), period.end.toISOString()],
    enabled: enabled && !!effectiveUserId,
    staleTime: STALE,
    queryFn: async () => {
      const startISO = period.start.toISOString();
      const endISO = period.end.toISOString();

      const { data: flows = [] } = await supabase
        .from("flows")
        .select("id, name, is_active")
        .eq("user_id", effectiveUserId!);

      if (flows.length === 0) return { flows: [], topFlow: null };

      const flowIds = flows.map((f) => f.id);
      const { data: sessions = [] } = await supabase
        .from("flow_sessions")
        .select("id, flow_id, status, started_at")
        .in("flow_id", flowIds)
        .gte("started_at", startISO)
        .lte("started_at", endISO);

      const perFlow = flows.map((f) => {
        const fSessions = sessions.filter((s) => s.flow_id === f.id);
        const total = fSessions.length;
        const completed = fSessions.filter((s) => s.status === "completed").length;
        const failed = fSessions.filter((s) => s.status === "failed" || s.status === "timeout").length;
        const completionPct = total > 0 ? (completed / total) * 100 : 0;
        const abandonPct = total > 0 ? (failed / total) * 100 : 0;
        return {
          id: f.id,
          name: f.name,
          isActive: f.is_active,
          executions: total,
          completed,
          failed,
          completionPct,
          abandonPct,
        };
      });

      perFlow.sort((a, b) => b.completed - a.completed);
      const topFlow = perFlow[0] || null;

      return { flows: perFlow, topFlow };
    },
  });
}

// ─────────────────────────────────────── Voice
export function useReportVoice({ organizationId, period, instanceId, enabled = true }: BaseArgs) {
  return useQuery({
    queryKey: ["report", "voice", organizationId, instanceId, period.start.toISOString(), period.end.toISOString()],
    enabled: enabled && !!organizationId,
    staleTime: STALE,
    queryFn: async () => {
      const startISO = period.start.toISOString();
      const endISO = period.end.toISOString();

      let q = supabase
        .from("voice_campaigns")
        .select("id, name, status, total_contacts, completed_calls, failed_calls, scheduled_at, created_at, instance_id")
        .eq("organization_id", organizationId!)
        .eq("call_type", "voice")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (instanceId) q = q.eq("instance_id", instanceId);
      const { data: campaigns = [] } = await q;

      const totalDispatched = campaigns.reduce((acc, c) => acc + (c.total_contacts || 0), 0);
      const totalCompleted = campaigns.reduce((acc, c) => acc + (c.completed_calls || 0), 0);
      const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_calls || 0), 0);
      const answerRate = totalDispatched > 0 ? (totalCompleted / totalDispatched) * 100 : 0;

      // Top hours by scheduled_at
      const byHour = new Map<number, number>();
      campaigns.forEach((c) => {
        if (!c.scheduled_at) return;
        const h = new Date(c.scheduled_at).getHours();
        byHour.set(h, (byHour.get(h) || 0) + (c.completed_calls || 0));
      });
      const hourSeries = Array.from({ length: 24 }, (_, h) => ({
        hour: `${h.toString().padStart(2, "0")}h`,
        calls: byHour.get(h) || 0,
      }));

      return {
        campaigns,
        kpis: {
          totalDispatched,
          totalCompleted,
          totalFailed,
          answerRate,
          campaignCount: campaigns.length,
        },
        hourSeries,
      };
    },
  });
}
