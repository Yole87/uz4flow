import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  start: string; // ISO
  end: string; // ISO
  compareStart?: string;
  compareEnd?: string;
  organizationId?: string | null;
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

/* ---------------- helpers ---------------- */

function dayBuckets(start: string, end: string) {
  const out: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const last = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function bucketByDay<T extends { created_at?: string | null }>(
  rows: T[],
  field: keyof T,
  buckets: string[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const b of buckets) map[b] = 0;
  for (const r of rows) {
    const v = r[field] as unknown as string | null;
    if (!v) continue;
    const day = v.slice(0, 10);
    if (day in map) map[day] += 1;
  }
  return map;
}

function sumByDay(
  rows: Array<{ created_at: string | null; amount: number | string | null }>,
  buckets: string[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const b of buckets) map[b] = 0;
  for (const r of rows) {
    if (!r.created_at) continue;
    const day = r.created_at.slice(0, 10);
    if (day in map) map[day] += Number(r.amount ?? 0);
  }
  return map;
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null; // null = N/A
  return ((curr - prev) / prev) * 100;
}

/* ---------------- main ---------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("Method not allowed", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization");
  if (!auth) return err("Não autorizado", 401);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return err("Sessão inválida", 401);

  const admin = createClient(url, serviceKey);

  // Validate admin_master
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin_master")
    .maybeSingle();
  if (!roleRow) return err("Acesso restrito", 403);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return err("Payload inválido");
  }

  const { start, end, compareStart, compareEnd, organizationId } = body;
  if (!start || !end) return err("start e end obrigatórios");

  const orgFilter = organizationId ?? null;
  const buckets = dayBuckets(start, end);

  // Helper to apply org filter when column exists
  const applyOrg = <T>(q: T, col = "organization_id"): T => {
    if (!orgFilter) return q;
    // @ts-ignore — generic builder
    return q.eq(col, orgFilter);
  };

  try {
    /* ============ A. REVENUE & FINANCIAL HEALTH ============ */
    // Active subs + plans for MRR
    const subsQ = admin
      .from("subscriptions")
      .select("id, organization_id, plan_id, status, current_period_end, cancelled_at, created_at, total_refunded");
    const { data: allSubs } = await applyOrg(subsQ);
    const subs = allSubs ?? [];

    const planIds = Array.from(new Set(subs.map((s) => s.plan_id).filter(Boolean)));
    const { data: plans } = planIds.length
      ? await admin.from("subscription_plans").select("id, price, name").in("id", planIds)
      : { data: [] as Array<{ id: string; price: number; name: string }> };
    const planMap = new Map((plans ?? []).map((p) => [p.id, { price: Number(p.price), name: p.name }]));

    const activeSubs = subs.filter((s) => s.status === "active");
    const mrr = activeSubs.reduce(
      (sum, s) => sum + (planMap.get(s.plan_id)?.price ?? 0),
      0,
    );
    const payingCustomers = activeSubs.filter(
      (s) => (planMap.get(s.plan_id)?.price ?? 0) > 0,
    ).length;
    const arpu = payingCustomers > 0 ? mrr / payingCustomers : 0;

    const pastDue = subs.filter((s) => s.status === "past_due").length;
    const suspended = subs.filter((s) => s.status === "suspended").length;

    // Payments in current range
    const paymentsQ = admin
      .from("subscription_payments")
      .select("id, organization_id, amount, status, created_at")
      .gte("created_at", start)
      .lte("created_at", end);
    const { data: payments } = await applyOrg(paymentsQ);
    const approvedPayments = (payments ?? []).filter((p) => p.status === "approved");
    const refundedPayments = (payments ?? []).filter(
      (p) => p.status === "refunded" || p.status === "charged_back",
    );
    const revenueRecognized = approvedPayments.reduce(
      (s, p) => s + Number(p.amount ?? 0),
      0,
    );
    const totalRefunded = refundedPayments.reduce(
      (s, p) => s + Number(p.amount ?? 0),
      0,
    );
    const refundRate =
      approvedPayments.length + refundedPayments.length > 0
        ? (refundedPayments.length /
            (approvedPayments.length + refundedPayments.length)) *
          100
        : 0;

    const revenueByDay = sumByDay(
      approvedPayments.map((p) => ({ created_at: p.created_at, amount: p.amount })),
      buckets,
    );

    // Compare period revenue
    let revenuePrev = 0;
    let revenueByDayPrev: Record<string, number> = {};
    if (compareStart && compareEnd) {
      const prevQ = admin
        .from("subscription_payments")
        .select("amount, status, created_at")
        .gte("created_at", compareStart)
        .lte("created_at", compareEnd)
        .eq("status", "approved");
      const { data: prev } = await applyOrg(prevQ);
      revenuePrev = (prev ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
      revenueByDayPrev = sumByDay(
        (prev ?? []).map((p) => ({ created_at: p.created_at, amount: p.amount })),
        dayBuckets(compareStart, compareEnd),
      );
    }

    // Churn calc — only over PAYING subs to avoid trial noise distorting LTV
    const isPaying = (s: { plan_id: string | null }) =>
      (planMap.get(s.plan_id ?? "")?.price ?? 0) > 0;
    const cancelledInRange = subs.filter(
      (s) => s.cancelled_at && s.cancelled_at >= start && s.cancelled_at <= end,
    );
    const cancelledPaying = cancelledInRange.filter(isPaying);
    // ISO strings are lexicographically comparable when both have same TZ format (UTC)
    const activeAtStart = subs.filter(
      (s) =>
        isPaying(s) &&
        s.created_at <= start &&
        (!s.cancelled_at || s.cancelled_at > start),
    ).length;
    const churnRate =
      activeAtStart > 0 ? (cancelledPaying.length / activeAtStart) * 100 : 0;
    // Normalize churn to monthly basis based on selected range (range can be 7d, 30d, year...)
    const daysInRange = Math.max(
      1,
      (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
    );
    const monthlyChurn = Math.min(0.95, (churnRate / 100) * (30 / daysInRange));
    const ltv = monthlyChurn > 0 ? arpu / monthlyChurn : 0;
    const mrrLost = cancelledPaying.reduce(
      (s, c) => s + (planMap.get(c.plan_id)?.price ?? 0),
      0,
    );

    /* ============ B. ACQUISITION ============ */
    const orgsQ = admin
      .from("organizations")
      .select("id, name, created_at")
      .gte("created_at", start)
      .lte("created_at", end);
    const { data: newOrgs } = orgFilter
      ? await orgsQ.eq("id", orgFilter)
      : await orgsQ;
    const newSignups = (newOrgs ?? []).length;
    const signupsByDay = bucketByDay(newOrgs ?? [], "created_at", buckets);

    // First payments (new paying)
    const allFirstPaymentsQ = admin
      .from("subscriptions")
      .select("id, organization_id, plan_id, created_at, status")
      .gte("created_at", start)
      .lte("created_at", end)
      .neq("status", "cancelled");
    const { data: newSubs } = await applyOrg(allFirstPaymentsQ);
    const newPaying = (newSubs ?? []).filter(
      (s) => (planMap.get(s.plan_id)?.price ?? 0) > 0,
    ).length;
    const trialsCount = (newSubs ?? []).filter(
      (s) => (planMap.get(s.plan_id)?.price ?? 0) === 0,
    ).length;
    const conversionFreeToPaid =
      trialsCount + newPaying > 0
        ? (newPaying / (trialsCount + newPaying)) * 100
        : 0;

    // Compare signups
    let signupsPrev = 0;
    if (compareStart && compareEnd) {
      const q = admin
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", compareStart)
        .lte("created_at", compareEnd);
      const { count } = orgFilter ? await q.eq("id", orgFilter) : await q;
      signupsPrev = count ?? 0;
    }

    // Origin split
    const newOrgIds = (newOrgs ?? []).map((o) => o.id);
    let affiliateSignups = 0;
    let couponSignups = 0;
    if (newOrgIds.length) {
      const { data: refs } = await admin
        .from("affiliate_referrals")
        .select("referred_org_id")
        .in("referred_org_id", newOrgIds as string[]);
      affiliateSignups = (refs ?? []).length;

      const { data: coupons } = await admin
        .from("coupon_redemptions")
        .select("organization_id")
        .in("organization_id", newOrgIds as string[]);
      couponSignups = (coupons ?? []).length;
    }
    const organicSignups = Math.max(0, newSignups - affiliateSignups - couponSignups);

    // Orgs sem assinatura ativa (nunca tiveram OU já cancelaram)
    let pendingLeads = 0;
    {
      const { count: totalOrgs } = await admin
        .from("organizations")
        .select("id", { count: "exact", head: true });
      const { data: orgsWithActive } = await admin
        .from("subscriptions")
        .select("organization_id")
        .eq("status", "active");
      const activeOrgsSet = new Set(
        (orgsWithActive ?? []).map((s) => s.organization_id).filter(Boolean),
      );
      pendingLeads = Math.max(0, (totalOrgs ?? 0) - activeOrgsSet.size);
    }

    /* ============ C. RETENTION ============ */
    const cancelByDay = bucketByDay(
      cancelledInRange.map((c) => ({ created_at: c.cancelled_at })),
      "created_at",
      buckets,
    );
    const newSubsByDay = bucketByDay(newSubs ?? [], "created_at", buckets);

    // Trials expiring next 7 days
    const now = new Date();
    const in7 = new Date(Date.now() + 7 * 86400000);
    const { data: trialsExpiring } = await admin
      .from("subscriptions")
      .select("id, organization_id, current_period_end, plan_id")
      .eq("status", "active")
      .gte("current_period_end", now.toISOString())
      .lte("current_period_end", in7.toISOString());
    const trialsExpiringCount = (trialsExpiring ?? []).filter(
      (t) => (planMap.get(t.plan_id)?.price ?? 0) === 0,
    ).length;

    // Avg lifetime (cancelled subs)
    const lifetimes = cancelledInRange
      .filter((c) => c.created_at && c.cancelled_at)
      .map(
        (c) =>
          (new Date(c.cancelled_at!).getTime() - new Date(c.created_at).getTime()) /
          86400000,
      );
    const avgLifetimeDays =
      lifetimes.length > 0
        ? lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length
        : 0;

    // NRR cohort-based: clientes ativos no início vs MRR atual desses mesmos
    const cohortAtStart = subs.filter(
      (s) =>
        isPaying(s) &&
        s.created_at <= start &&
        (!s.cancelled_at || s.cancelled_at > start),
    );
    const mrrCohortStart = cohortAtStart.reduce(
      (s, c) => s + (planMap.get(c.plan_id)?.price ?? 0),
      0,
    );
    const cohortIds = new Set(cohortAtStart.map((s) => s.id));
    const mrrCohortNow = activeSubs
      .filter((s) => cohortIds.has(s.id))
      .reduce((acc, s) => acc + (planMap.get(s.plan_id)?.price ?? 0), 0);
    const nrr = mrrCohortStart > 0 ? (mrrCohortNow / mrrCohortStart) * 100 : 0;

    /* ============ D. ENGAGEMENT — via RPC para escalar acima de 1000 linhas ============ */
    const { data: msgAgg, error: msgAggErr } = await admin.rpc(
      "admin_dashboard_messages_agg",
      { p_start: start, p_end: end, p_org_id: orgFilter },
    );
    if (msgAggErr) console.error("[messages_agg] error", msgAggErr);
    const aggRows = (msgAgg ?? []) as Array<{
      day: string;
      organization_id: string | null;
      msg_count: number;
      conversation_count: number;
    }>;

    let messagesCount = 0;
    const messagesByDay: Record<string, number> = {};
    for (const b of buckets) messagesByDay[b] = 0;
    const orgMsgCount = new Map<string, number>();
    const dayOrgSet = new Map<string, Set<string>>();
    const convByOrg = new Map<string, number>();
    for (const r of aggRows) {
      const c = Number(r.msg_count ?? 0);
      messagesCount += c;
      const d = String(r.day).slice(0, 10);
      if (d in messagesByDay) messagesByDay[d] += c;
      if (r.organization_id) {
        orgMsgCount.set(
          r.organization_id,
          (orgMsgCount.get(r.organization_id) ?? 0) + c,
        );
        if (!dayOrgSet.has(d)) dayOrgSet.set(d, new Set());
        dayOrgSet.get(d)!.add(r.organization_id);
        convByOrg.set(
          r.organization_id,
          (convByOrg.get(r.organization_id) ?? 0) +
            Number(r.conversation_count ?? 0),
        );
      }
    }
    // activeConversations = soma de conversas distintas por dia (aproximação superior — mesma conversa em dias diferentes conta uma vez por dia). Pra valor único, usa o MAX por org como proxy:
    const activeConversations = aggRows.reduce(
      (s, r) => s + Number(r.conversation_count ?? 0),
      0,
    );

    const contactsQ = admin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end);
    const { count: contactsCreated } = await applyOrg(contactsQ);

    // Top 5 orgs by messages — agora com contagem real (sem corte de 1000 linhas)
    const topOrgIds = Array.from(orgMsgCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const { data: topOrgsRows } = topOrgIds.length
      ? await admin
          .from("organizations")
          .select("id, name")
          .in("id", topOrgIds.map((o) => o[0]))
      : { data: [] };
    const topOrgsByMessages = topOrgIds.map(([id, count]) => ({
      id,
      name: (topOrgsRows ?? []).find((o) => o.id === id)?.name ?? "—",
      count,
    }));

    const dauByDay: Record<string, number> = {};
    for (const b of buckets) dauByDay[b] = dayOrgSet.get(b)?.size ?? 0;
    const mau = new Set(
      aggRows.map((r) => r.organization_id).filter(Boolean) as string[],
    ).size;
    const avgDau =
      buckets.length > 0
        ? Object.values(dauByDay).reduce((a, b) => a + b, 0) / buckets.length
        : 0;
    const stickiness = mau > 0 ? (avgDau / mau) * 100 : 0;

    /* ============ E. AUTOMATION & AI ============ */
    const flowSessionsQ = admin
      .from("flow_sessions")
      .select("id, user_id, created_at")
      .gte("created_at", start)
      .lte("created_at", end);
    // flow_sessions has user_id, not organization_id — skip org filter for this
    const { data: flowSessions } = await flowSessionsQ;
    const flowSessionsCount = (flowSessions ?? []).length;
    const flowSessionsByDay = bucketByDay(flowSessions ?? [], "created_at", buckets);

    const { count: activeFlows } = await admin
      .from("flows")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    const evalsQ = admin
      .from("conversation_evaluations")
      .select("id, organization_id, evaluated_at, extracted_data")
      .gte("evaluated_at", start)
      .lte("evaluated_at", end);
    const { data: evals } = await applyOrg(evalsQ);
    const evalsCount = (evals ?? []).length;
    const evalsPositive = (evals ?? []).filter((e) => {
      const score = (e.extracted_data as Record<string, unknown> | null)?.score;
      return typeof score === "number" && score >= 7;
    }).length;
    const evalsPositiveRate = evalsCount > 0 ? (evalsPositive / evalsCount) * 100 : 0;

    const { count: reengagements } = await admin
      .from("auto_reengagement_queue")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end)
      .eq("status", "sent");

    /* ============ F. VOICE AI ============ */
    const voiceQ = admin
      .from("voice_calls")
      .select("id, organization_id, status, duration_seconds, cost_cents, created_at")
      .gte("created_at", start)
      .lte("created_at", end);
    const { data: voiceCalls } = await applyOrg(voiceQ);
    const voiceTotal = (voiceCalls ?? []).length;
    const voiceCompleted = (voiceCalls ?? []).filter(
      (c) => c.status === "completed",
    ).length;
    const voiceFailed = (voiceCalls ?? []).filter(
      (c) => c.status === "failed" || c.status === "no-answer",
    ).length;
    const voiceAnswerRate = voiceTotal > 0 ? (voiceCompleted / voiceTotal) * 100 : 0;
    const voiceDurations = (voiceCalls ?? [])
      .map((c) => Number(c.duration_seconds ?? 0))
      .filter((d) => d > 0);
    const voiceAvgDuration =
      voiceDurations.length > 0
        ? voiceDurations.reduce((a, b) => a + b, 0) / voiceDurations.length
        : 0;
    const voiceCost =
      (voiceCalls ?? []).reduce((s, c) => s + Number(c.cost_cents ?? 0), 0) / 100;

    // by day grouped by status
    const voiceByDay: Record<string, { completed: number; failed: number; other: number }> = {};
    for (const b of buckets) voiceByDay[b] = { completed: 0, failed: 0, other: 0 };
    for (const c of voiceCalls ?? []) {
      const d = c.created_at?.slice(0, 10);
      if (!d || !(d in voiceByDay)) continue;
      if (c.status === "completed") voiceByDay[d].completed += 1;
      else if (c.status === "failed" || c.status === "no-answer")
        voiceByDay[d].failed += 1;
      else voiceByDay[d].other += 1;
    }

    const { count: voiceCampaignsActive } = await admin
      .from("voice_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "running");

    /* ============ G. PROSPECTION ============ */
    const searchesQ = admin
      .from("prospect_searches")
      .select("id, organization_id, created_at, total_results")
      .gte("created_at", start)
      .lte("created_at", end);
    const { data: searches } = await applyOrg(searchesQ);
    const searchesCount = (searches ?? []).length;
    const totalLeadsFound = (searches ?? []).reduce(
      (s, x) => s + Number(x.total_results ?? 0),
      0,
    );

    const resultsQ = admin
      .from("prospect_results")
      .select("id, organization_id, imported_to_contact_id, created_at")
      .gte("created_at", start)
      .lte("created_at", end);
    const { data: results } = await applyOrg(resultsQ);
    const resultsCount = (results ?? []).length;
    const importedCount = (results ?? []).filter((r) => r.imported_to_contact_id).length;
    const importedIds = (results ?? [])
      .map((r) => r.imported_to_contact_id)
      .filter(Boolean) as string[];
    let conversedCount = 0;
    if (importedIds.length) {
      const { count } = await admin
        .from("conversations")
        .select("contact_id", { count: "exact", head: true })
        .in("contact_id", importedIds);
      conversedCount = count ?? 0;
    }
    const importRate = resultsCount > 0 ? (importedCount / resultsCount) * 100 : 0;
    const conversionToConv =
      importedCount > 0 ? (conversedCount / importedCount) * 100 : 0;

    // Top 3 orgs by leads found
    const orgLeadsCount = new Map<string, number>();
    for (const r of results ?? []) {
      if (!r.organization_id) continue;
      orgLeadsCount.set(
        r.organization_id,
        (orgLeadsCount.get(r.organization_id) ?? 0) + 1,
      );
    }
    const topProspectIds = Array.from(orgLeadsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const { data: topProspectOrgs } = topProspectIds.length
      ? await admin
          .from("organizations")
          .select("id, name")
          .in("id", topProspectIds.map((o) => o[0]))
      : { data: [] };
    const topOrgsByLeads = topProspectIds.map(([id, count]) => ({
      id,
      name: (topProspectOrgs ?? []).find((o) => o.id === id)?.name ?? "—",
      count,
    }));

    /* ============ H. INSTAGRAM ============ */
    const igEventsQ = admin
      .from("instagram_events")
      .select("id", { count: "exact", head: true })
      .gte("received_at", start)
      .lte("received_at", end);
    const { count: igEvents } = await applyOrg(igEventsQ);

    const igLeadsQ = admin
      .from("instagram_leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end);
    const { count: igLeads } = await applyOrg(igLeadsQ);

    const igAccountsQ = admin
      .from("instagram_accounts")
      .select("id", { count: "exact", head: true })
      .eq("token_status", "active");
    const { count: igAccounts } = await applyOrg(igAccountsQ);

    /* ============ I. AFFILIATES ============ */
    const { count: clicks } = await admin
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end);

    const { data: affRefs } = await admin
      .from("affiliate_referrals")
      .select("id, affiliate_id, first_payment_at, signup_at")
      .gte("signup_at", start)
      .lte("signup_at", end);
    const affSignups = (affRefs ?? []).length;
    const affPaid = (affRefs ?? []).filter((r) => r.first_payment_at).length;
    const clickToCustomer = (clicks ?? 0) > 0 ? (affPaid / (clicks ?? 1)) * 100 : 0;

    const { data: commissions } = await admin
      .from("affiliate_commissions")
      .select("commission_amount, affiliate_id")
      .gte("created_at", start)
      .lte("created_at", end);
    const totalCommissions = (commissions ?? []).reduce(
      (s, c) => s + Number(c.commission_amount ?? 0),
      0,
    );
    const affMap = new Map<string, number>();
    for (const c of commissions ?? []) {
      affMap.set(
        c.affiliate_id,
        (affMap.get(c.affiliate_id) ?? 0) + Number(c.commission_amount ?? 0),
      );
    }
    const topAffIds = Array.from(affMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const { data: topAffRows } = topAffIds.length
      ? await admin
          .from("affiliates")
          .select("id, code")
          .in("id", topAffIds.map((a) => a[0]))
      : { data: [] };
    const topAffiliates = topAffIds.map(([id, total]) => ({
      id,
      code: (topAffRows ?? []).find((a) => a.id === id)?.code ?? "—",
      total,
    }));

    /* ============ J. INFRA ============ */
    const { data: storage } = await admin
      .from("organization_storage_usage")
      .select("organization_id, used_bytes, file_count");
    const totalStorageBytes = (storage ?? []).reduce(
      (s, x) => s + Number(x.used_bytes ?? 0),
      0,
    );
    const topStorage = (storage ?? [])
      .sort((a, b) => Number(b.used_bytes ?? 0) - Number(a.used_bytes ?? 0))
      .slice(0, 5);
    const topStorageIds = topStorage.map((s) => s.organization_id);
    const { data: storageOrgRows } = topStorageIds.length
      ? await admin.from("organizations").select("id, name").in("id", topStorageIds)
      : { data: [] };
    const topStorageOrgs = topStorage.map((s) => ({
      id: s.organization_id,
      name: (storageOrgRows ?? []).find((o) => o.id === s.organization_id)?.name ?? "—",
      bytes: Number(s.used_bytes ?? 0),
    }));

    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count: webhookErrors } = await admin
      .from("payment_webhook_logs")
      .select("id", { count: "exact", head: true })
      .eq("processed", false)
      .gte("created_at", oneDayAgo);

    const { data: notifLogs } = await admin
      .from("admin_notification_logs")
      .select("status")
      .gte("created_at", start)
      .lte("created_at", end);
    const notifSuccess = (notifLogs ?? []).filter((n) => n.status === "sent").length;
    const notifFailed = (notifLogs ?? []).filter((n) => n.status !== "sent").length;

    /* ============ K. INSIGHTS ============ */
    // Compare current org messages vs previous period to find at-risk
    let atRiskClients: Array<{ id: string; name: string; current: number; previous: number; dropPct: number }> = [];
    let championClients: Array<{ id: string; name: string; current: number; previous: number; growthPct: number }> = [];
    if (compareStart && compareEnd) {
      const { data: prevAgg } = await admin.rpc(
        "admin_dashboard_messages_agg",
        { p_start: compareStart, p_end: compareEnd, p_org_id: orgFilter },
      );
      const prevOrgMap = new Map<string, number>();
      for (const r of (prevAgg ?? []) as Array<{
        organization_id: string | null;
        msg_count: number;
      }>) {
        if (!r.organization_id) continue;
        prevOrgMap.set(
          r.organization_id,
          (prevOrgMap.get(r.organization_id) ?? 0) + Number(r.msg_count ?? 0),
        );
      }

      const allOrgIds = new Set<string>([
        ...orgMsgCount.keys(),
        ...prevOrgMap.keys(),
      ]);
      const orgIdsList = Array.from(allOrgIds);
      const { data: orgNamesRows } = orgIdsList.length
        ? await admin.from("organizations").select("id, name").in("id", orgIdsList)
        : { data: [] };
      const nameMap = new Map((orgNamesRows ?? []).map((o) => [o.id, o.name]));

      const insights: Array<{ id: string; name: string; current: number; previous: number; pct: number }> = [];
      for (const id of allOrgIds) {
        const c = orgMsgCount.get(id) ?? 0;
        const p = prevOrgMap.get(id) ?? 0;
        if (p < 5) continue; // ignore very low signals
        const pct = p > 0 ? ((c - p) / p) * 100 : 0;
        insights.push({ id, name: nameMap.get(id) ?? "—", current: c, previous: p, pct });
      }
      atRiskClients = insights
        .filter((i) => i.pct <= -50 && i.current < i.previous)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          name: i.name,
          current: i.current,
          previous: i.previous,
          dropPct: Math.abs(i.pct),
        }));
      championClients = insights
        .filter((i) => i.pct >= 50)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          name: i.name,
          current: i.current,
          previous: i.previous,
          growthPct: i.pct,
        }));
    }

    // Success cases: paying ≥3 months + heavy usage + AI evaluations
    const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const successCandidates = activeSubs
      .filter(
        (s) =>
          s.created_at <= threeMonthsAgo &&
          (planMap.get(s.plan_id)?.price ?? 0) > 0 &&
          (orgMsgCount.get(s.organization_id) ?? 0) > 100,
      )
      .slice(0, 5);
    const { data: succOrgRows } = successCandidates.length
      ? await admin
          .from("organizations")
          .select("id, name")
          .in(
            "id",
            successCandidates.map((s) => s.organization_id),
          )
      : { data: [] };
    const successCases = successCandidates.map((s) => ({
      id: s.organization_id,
      name:
        (succOrgRows ?? []).find((o) => o.id === s.organization_id)?.name ?? "—",
      messages: orgMsgCount.get(s.organization_id) ?? 0,
      plan: planMap.get(s.plan_id)?.name ?? "—",
    }));

    /* ============ RESPONSE ============ */
    return ok({
      meta: { start, end, compareStart, compareEnd, organizationId: orgFilter, buckets },
      revenue: {
        mrr,
        arr: mrr * 12,
        arpu,
        ltv,
        revenueRecognized,
        revenuePrev,
        revenuePctChange: pctChange(revenueRecognized, revenuePrev),
        refundRate,
        totalRefunded,
        pastDue,
        suspended,
        revenueByDay,
        revenueByDayPrev,
      },
      acquisition: {
        newSignups,
        newSignupsPrev: signupsPrev,
        signupsPctChange: pctChange(newSignups, signupsPrev),
        newPaying,
        conversionFreeToPaid,
        pendingLeads,
        organicSignups,
        affiliateSignups,
        couponSignups,
        signupsByDay,
      },
      retention: {
        churnRate,
        cancelledCount: cancelledInRange.length,
        mrrLost,
        nrr,
        trialsExpiring: trialsExpiringCount,
        avgLifetimeDays,
        cancelByDay,
        newSubsByDay,
      },
      engagement: {
        messagesCount,
        activeConversations,
        contactsCreated: contactsCreated ?? 0,
        avgDau,
        mau,
        stickiness,
        topOrgsByMessages,
        messagesByDay,
        dauByDay,
      },
      ai: {
        flowSessionsCount,
        activeFlows: activeFlows ?? 0,
        evalsCount,
        evalsPositiveRate,
        reengagements: reengagements ?? 0,
        flowSessionsByDay,
      },
      voice: {
        total: voiceTotal,
        completed: voiceCompleted,
        failed: voiceFailed,
        answerRate: voiceAnswerRate,
        avgDuration: voiceAvgDuration,
        cost: voiceCost,
        campaignsActive: voiceCampaignsActive ?? 0,
        byDay: voiceByDay,
      },
      prospection: {
        searchesCount,
        leadsFound: totalLeadsFound,
        resultsCount,
        importedCount,
        conversedCount,
        importRate,
        conversionToConv,
        topOrgsByLeads,
      },
      instagram: {
        events: igEvents ?? 0,
        leads: igLeads ?? 0,
        accountsActive: igAccounts ?? 0,
      },
      affiliates: {
        clicks: clicks ?? 0,
        signups: affSignups,
        paidConversions: affPaid,
        clickToCustomer,
        totalCommissions,
        topAffiliates,
      },
      infra: {
        totalStorageBytes,
        topStorageOrgs,
        webhookErrors24h: webhookErrors ?? 0,
        notifSuccess,
        notifFailed,
      },
      insights: {
        atRiskClients,
        championClients,
        successCases,
      },
    });
  } catch (e) {
    console.error("[admin-dashboard-metrics] error", e);
    return err("Erro ao calcular métricas", 500);
  }
});
