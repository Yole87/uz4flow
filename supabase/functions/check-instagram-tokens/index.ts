import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publicCorsHeaders, securityHeaders } from "../_shared/cors.ts";

/**
 * Cron function: checks Instagram tokens expiring within 7 days
 * and creates admin notifications for affected organizations.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...publicCorsHeaders, ...securityHeaders } });
  }

  // Validate cron secret to prevent unauthorized invocation
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRoleCall && (!cronSecret || providedSecret !== cronSecret)) {
    console.warn("[check-instagram-tokens] Unauthorized invocation blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...publicCorsHeaders, ...securityHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find tokens expiring in the next 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: expiringAccounts, error } = await supabase
      .from("instagram_accounts")
      .select("id, username, organization_id, token_expires_at, token_status")
      .lte("token_expires_at", sevenDaysFromNow.toISOString())
      .gt("token_expires_at", now.toISOString())
      .eq("token_status", "valid");

    if (error) {
      console.error("[check-instagram-tokens] Query error:", error);
      throw error;
    }

    if (!expiringAccounts || expiringAccounts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expiring tokens found", checked: 0 }),
        { headers: { ...publicCorsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org names for notifications
    const orgIds = [...new Set(expiringAccounts.map((a) => a.organization_id))];
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);

    const orgMap = new Map((orgs || []).map((o) => [o.id, o.name]));

    let notificationsCreated = 0;

    for (const account of expiringAccounts) {
      const daysLeft = Math.ceil(
        (new Date(account.token_expires_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const orgName = orgMap.get(account.organization_id) || "Organização";

      // Check if we already sent a notification for this account recently (last 3 days)
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const { data: existing } = await supabase
        .from("admin_notifications")
        .select("id")
        .eq("type", "instagram_token_expiring")
        .gte("created_at", threeDaysAgo.toISOString())
        .like("message", `%${account.id}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("admin_notifications").insert({
        type: "instagram_token_expiring",
        title: `Token Instagram expirando — ${account.username || "conta"}`,
        message: `A conta @${account.username || account.id} da organização "${orgName}" expira em ${daysLeft} dia(s). O cliente precisa reconectar para evitar interrupção das automações.`,
        metadata: {
          account_id: account.id,
          organization_id: account.organization_id,
          username: account.username,
          expires_at: account.token_expires_at,
          days_left: daysLeft,
        },
      });

      notificationsCreated++;
    }

    // Also mark tokens that have already expired
    const { data: expiredAccounts } = await supabase
      .from("instagram_accounts")
      .select("id")
      .lt("token_expires_at", now.toISOString())
      .eq("token_status", "valid");

    if (expiredAccounts && expiredAccounts.length > 0) {
      for (const acc of expiredAccounts) {
        await supabase
          .from("instagram_accounts")
          .update({ token_status: "expired" })
          .eq("id", acc.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Token check completed",
        expiring: expiringAccounts.length,
        notifications_created: notificationsCreated,
        expired_marked: expiredAccounts?.length || 0,
      }),
      { headers: { ...publicCorsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[check-instagram-tokens] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...publicCorsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
    );
  }
});
