import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret to prevent unauthorized invocation
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRoleCall && (!cronSecret || providedSecret !== cronSecret)) {
    console.warn("[billing-reminders] Unauthorized invocation blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = serviceRoleKey;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const results = { renewal_reminders: 0, overdue_notices: 0, overdue_escalations: 0, auto_suspensions: 0, errors: 0 };

    // Helper to call billing-notify
    async function notify(event_type: string, organization_id: string, metadata: Record<string, unknown>) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/billing-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
            ...(Deno.env.get("CRON_SECRET")
              ? { "x-cron-secret": Deno.env.get("CRON_SECRET")! }
              : {}),
          },
          body: JSON.stringify({ event_type, organization_id, metadata }),
        });
        const text = await resp.text();
        console.log(`[billing-reminders] ${event_type} for ${organization_id}: ${resp.status} - ${text}`);
        return resp.ok;
      } catch (e) {
        console.error(`[billing-reminders] Failed to notify ${event_type}:`, e);
        return false;
      }
    }

    // Check if notification already sent today for this org+event
    async function alreadySentToday(event_type: string, organization_id: string): Promise<boolean> {
      const { data } = await supabase
        .from("billing_notifications_log")
        .select("id")
        .eq("event_type", event_type)
        .eq("organization_id", organization_id)
        .gte("created_at", `${today}T00:00:00Z`)
        .limit(1);
      return (data?.length || 0) > 0;
    }

    // ── D-3: Renewal reminders ──
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const d3Start = threeDaysFromNow.toISOString().split("T")[0] + "T00:00:00Z";
    const d3End = threeDaysFromNow.toISOString().split("T")[0] + "T23:59:59Z";

    const { data: renewalSubs } = await supabase
      .from("subscriptions")
      .select("id, organization_id, current_period_end, organizations(name), plans(name, price)")
      .eq("status", "active")
      .gte("current_period_end", d3Start)
      .lte("current_period_end", d3End);

    for (const sub of renewalSubs || []) {
      const orgId = sub.organization_id;
      if (await alreadySentToday("renewal_reminder", orgId)) continue;

      const orgName = (sub as any).organizations?.name || "Cliente";
      const planName = (sub as any).plans?.name || "N/A";
      const planPrice = (sub as any).plans?.price || 0;

      const ok = await notify("renewal_reminder", orgId, {
        nome: orgName,
        valor: planPrice,
        plano: planName,
        vencimento: new Date(sub.current_period_end).toLocaleDateString("pt-BR"),
      });
      if (ok) results.renewal_reminders++;
      else results.errors++;
    }

    // ── D+3 (legacy): Overdue notices for paused/pending without grace period ──
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const d3AgoStart = threeDaysAgo.toISOString().split("T")[0] + "T00:00:00Z";
    const d3AgoEnd = threeDaysAgo.toISOString().split("T")[0] + "T23:59:59Z";

    const { data: overdueSubs } = await supabase
      .from("subscriptions")
      .select("id, organization_id, current_period_end, organizations(name), plans(name, price)")
      .in("status", ["paused", "pending"])
      .is("overdue_since", null)
      .gte("current_period_end", d3AgoStart)
      .lte("current_period_end", d3AgoEnd);

    for (const sub of overdueSubs || []) {
      const orgId = sub.organization_id;
      if (await alreadySentToday("payment_overdue", orgId)) continue;

      const orgName = (sub as any).organizations?.name || "Cliente";
      const planName = (sub as any).plans?.name || "N/A";
      const planPrice = (sub as any).plans?.price || 0;

      const ok = await notify("payment_overdue", orgId, {
        nome: orgName,
        valor: planPrice,
        plano: planName,
        vencimento: new Date(sub.current_period_end).toLocaleDateString("pt-BR"),
      });
      if (ok) results.overdue_notices++;
      else results.errors++;
    }

    // ── Grace Period: Escalating overdue reminders D+1 to D+3, auto-suspend D+4 ──
    const { data: graceSubs } = await supabase
      .from("subscriptions")
      .select("id, organization_id, overdue_since, organizations(name), plans(name, price)")
      .not("overdue_since", "is", null)
      .in("status", ["active", "paused", "pending"]);

    for (const sub of graceSubs || []) {
      const orgId = sub.organization_id;
      const overdueSince = new Date((sub as any).overdue_since);
      const daysOverdue = Math.floor((now.getTime() - overdueSince.getTime()) / (1000 * 60 * 60 * 24));

      const orgName = (sub as any).organizations?.name || "Cliente";
      const planName = (sub as any).plans?.name || "N/A";
      const planPrice = (sub as any).plans?.price || 0;

      const meta = {
        nome: orgName,
        valor: planPrice,
        plano: planName,
        vencimento: overdueSince.toLocaleDateString("pt-BR"),
      };

      if (daysOverdue >= 4) {
        // D+4: Auto-suspend
        console.log(`[billing-reminders] D+4 auto-suspend for org ${orgId}`);

        await supabase.from("subscriptions")
          .update({ status: "suspended", updated_at: new Date().toISOString() })
          .eq("id", sub.id);

        await supabase.from("organizations")
          .update({
            is_active: false,
            block_reason: "Assinatura suspensa por falta de pagamento após 4 dias",
          })
          .eq("id", orgId);

        await supabase.from("admin_notifications").insert({
          type: "auto_suspension",
          title: "Assinatura suspensa automaticamente",
          message: `O cliente "${orgName}" teve a assinatura suspensa por falta de pagamento (${daysOverdue} dias em atraso).`,
          metadata: { organization_id: orgId, days_overdue: daysOverdue },
        });

        await notify("subscription_paused", orgId, meta);

        // Admin WhatsApp notification: cancel due to non-payment
        try {
          await fetch(`${supabaseUrl}/functions/v1/admin-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              event_type: "cancel_unpaid",
              variables: {
                user_name: orgName,
                plan_name: planName,
                amount: planPrice?.toFixed?.(2) || planPrice,
                days_overdue: daysOverdue,
                reason: "Inadimplência (4+ dias em atraso)",
              },
            }),
          });
        } catch (e) {
          console.warn("[billing-reminders] admin-notify cancel_unpaid failed:", e);
        }

        results.auto_suspensions++;
      } else if (daysOverdue >= 1 && daysOverdue <= 3) {
        // D+1, D+2, D+3: Escalating reminders
        const eventType = `overdue_d${daysOverdue}`;
        if (await alreadySentToday(eventType, orgId)) continue;

        const ok = await notify(eventType, orgId, meta);
        if (ok) results.overdue_escalations++;
        else results.errors++;
      }
      // D+0 is handled by the webhook directly
    }

    console.log("[billing-reminders] Results:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[billing-reminders] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
