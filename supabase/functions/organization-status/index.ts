import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

let _corsHeaders: Record<string, string> = {};

Deno.serve(async (req) => {
  _corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "get-status";
    const impersonateOrgId = body.impersonate_org_id || null;

    // Validate impersonation: only admin_master can impersonate
    let effectiveOrgId: string | null = null;
    if (impersonateOrgId) {
      const { data: adminRole } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin_master")
        .maybeSingle();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: "Forbidden: admin_master required" }),
          { status: 403, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
        );
      }
      effectiveOrgId = impersonateOrgId;
      console.log(`[impersonation] admin ${userId} impersonating org ${impersonateOrgId}`);
    }

    if (action === "get-status") {
      return await handleGetStatus(serviceClient, userId, effectiveOrgId);
    }

    if (action === "get-webhook-urls") {
      return await handleGetWebhookUrls(serviceClient, userId);
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("organization-status error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function handleGetStatus(serviceClient: any, userId: string, effectiveOrgId: string | null = null) {
  let memberRole: string | null = null;
  let orgId: string;

  if (effectiveOrgId) {
    // Impersonation mode: use the target org, set role as "owner" for full access view
    orgId = effectiveOrgId;
    memberRole = "owner"; // Admin sees everything
  } else {
    // Normal mode: get user's organization membership
    const { data: membership, error: membershipError } = await serviceClient
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership) {
      return jsonResponse({
        organization: null,
        subscription: null,
        plan: null,
        memberRole: null,
        isActive: false,
        isBlocked: false,
        isPending: false,
        isTrial: false,
        isTrialExpired: false,
        isOwner: false,
        trialDaysRemaining: null,
        features: [],
        storageLimitMB: 500,
        storageUsedMB: 0,
        storagePercentage: 0,
        isNearLimit: false,
        isAtLimit: false,
        fileCount: 0,
      });
    }

    memberRole = membership.role ?? null;
    orgId = membership.organization_id;
  }

  // 2. Get organization
  const { data: org, error: orgError } = await serviceClient
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgError) throw orgError;

  // 3. Get subscription
  const { data: sub, error: subError } = await serviceClient
    .from("subscriptions")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (subError) throw subError;

  // 4. Get plan
  // deno-lint-ignore no-explicit-any
  let plan: any = null;
  if (sub?.plan_id) {
    const { data: planData, error: planError } = await serviceClient
      .from("subscription_plans")
      .select("*")
      .eq("id", sub.plan_id)
      .single();
    if (planError) throw planError;
    plan = planData;
  }

  // 5. Get storage usage
  const { data: storageData } = await serviceClient
    .from("organization_storage_usage")
    .select("used_bytes, file_count")
    .eq("organization_id", orgId)
    .maybeSingle();

  // === BUSINESS LOGIC: All calculations happen HERE on the backend ===

  // blocked_at = admin manually blocked; is_active=false alone is just "not yet activated" (e.g. pending payment)
  const isBlocked = org?.blocked_at !== null;

  const isActive = !!(
    sub?.status === "active" &&
    !isBlocked &&
    (sub?.current_period_end === null ||
      new Date(sub.current_period_end) > new Date())
  );

  const isPending = sub?.status === "pending";

  const isTrial = !!(
    sub?.trial_end &&
    new Date(sub.trial_end) > new Date()
  );

  const isTrialExpired = !!(
    sub?.trial_end &&
    new Date(sub.trial_end) <= new Date()
  );

  const trialDaysRemaining = sub?.trial_end
    ? Math.max(
        0,
        Math.ceil(
          (new Date(sub.trial_end).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const isOwner = memberRole === "owner";

  // Grace period (overdue) calculation
  const overdueSince = sub?.overdue_since ? new Date(sub.overdue_since) : null;
  const isOverdue = !!(overdueSince && sub?.status !== "suspended");
  const overdueDays = overdueSince
    ? Math.floor((Date.now() - overdueSince.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Limits & features
  const limitsObj = plan?.limits as Record<string, unknown> | undefined;
  const features: string[] = limitsObj
    ? (limitsObj.features as string[]) ?? []
    : [];
  const storageLimitMB: number = limitsObj
    ? (limitsObj.storage_limit_mb as number) ?? 500
    : 500;
  const memberLimit: number = limitsObj
    ? (limitsObj.member_limit as number) ?? 1
    : 1;
  const contactLimit: number = limitsObj
    ? (limitsObj.contact_limit as number) ?? 500
    : 500;
  const dataRetentionDays: number = limitsObj
    ? (limitsObj.data_retention_days as number) ?? 0
    : 0;

  // Storage calculations
  const usedBytes = storageData?.used_bytes || 0;
  const usedMB = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
  const storagePercentage =
    storageLimitMB > 0 ? Math.min(100, (usedMB / storageLimitMB) * 100) : 0;
  const isNearLimit = storagePercentage > 80;
  const isAtLimit = storagePercentage >= 100;

  return jsonResponse({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      block_reason: org.block_reason ?? null,
    },
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          billing_cycle: sub.billing_cycle,
          current_period_end: sub.current_period_end,
          current_period_start: sub.current_period_start ?? null,
          trial_end: sub.trial_end,
          mp_subscription_id: sub.mp_subscription_id,
        }
      : null,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          description: plan.description ?? null,
          price: plan.price,
          is_free: plan.is_free ?? false,
          trial_days: plan.trial_days ?? null,
          limits: plan.limits,
        }
      : null,
    memberRole,
    isActive,
    isBlocked,
    isPending,
    isTrial,
    isTrialExpired,
    isOwner,
    isOverdue,
    overdueDays,
    trialDaysRemaining,
    features,
    storageLimitMB,
    memberLimit,
    contactLimit,
    dataRetentionDays,
    storageUsedMB: usedMB,
    storageUsedBytes: usedBytes,
    storagePercentage,
    isNearLimit,
    isAtLimit,
    fileCount: storageData?.file_count || 0,
  });
}

// deno-lint-ignore no-explicit-any
async function handleGetWebhookUrls(serviceClient: any, userId: string) {
  // Fetch webhook base URL from saas_settings
  const { data: settingsData } = await serviceClient
    .from("saas_settings")
    .select("value")
    .eq("key", "general")
    .maybeSingle();

  const generalSettings = settingsData?.value as { webhook_base_url?: string } | null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const defaultBaseUrl = `${supabaseUrl}/functions/v1`;

  const baseUrl =
    generalSettings?.webhook_base_url?.trim()
      ? generalSettings.webhook_base_url.replace(/\/$/, "")
      : defaultBaseUrl;

  const webhookRoutes: Record<string, string> = {
    mercadopago: "mercadopago-webhook",
    openbot: "openbot-webhook",
    connector: "external-webhook",
    "crm-openbot-inbound": "crm-openbot-inbound",
  };

  const urls: Record<string, string> = {};

  for (const [service, functionName] of Object.entries(webhookRoutes)) {
    let url = `${baseUrl}/${functionName}`;
    if (service === "openbot") {
      url += `?user_id=${userId}`;
    }
    urls[service] = url;
  }

  return jsonResponse({
    baseUrl,
    urls,
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ..._corsHeaders, "Content-Type": "application/json" },
  });
}
