import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface CreatePlanRequest {
  action: "create-plan";
  planId: string;
}

interface CreateSubscriptionRequest {
  action: "create-subscription";
  organizationId: string;
  planId: string;
  billingCycle?: string;
  backUrl: string;
  couponCode?: string | null;
}

interface CancelSubscriptionRequest {
  action: "cancel-subscription";
  subscriptionId: string;
}

interface GetSubscriptionRequest {
  action: "get-subscription";
  subscriptionId: string;
}

interface SyncPlansRequest {
  action: "sync-plans";
}

interface TestConnectionRequest {
  action: "test-connection";
}

interface SaveAccessTokenRequest {
  action: "save-access-token";
  accessToken: string;
}

interface RetryCheckoutRequest {
  action: "retry-checkout";
  backUrl?: string;
}

interface GetAccessTokenRequest {
  action: "get-access-token";
}

interface RefundPaymentRequest {
  action: "refund-payment";
  paymentId: string;
  amount?: number;
}

interface ChangePlanRequest {
  action: "change-plan";
  newPlanId: string;
  billingCycle?: string;
  couponCode?: string | null;
  backUrl?: string;
}

type RequestBody = 
  | CreatePlanRequest 
  | CreateSubscriptionRequest 
  | CancelSubscriptionRequest 
  | GetSubscriptionRequest
  | SyncPlansRequest
  | TestConnectionRequest
  | SaveAccessTokenRequest
  | RetryCheckoutRequest
  | GetAccessTokenRequest
  | RefundPaymentRequest
  | ChangePlanRequest;

interface MercadoPagoPlanResponse {
  id: string;
  status: string;
  reason: string;
  init_point?: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
}

interface MercadoPagoSubscriptionResponse {
  id: string;
  status: string;
  init_point: string;
  payer_id: number;
  external_reference: string;
}

// Maps our billing cycle to Mercado Pago frequency params
function getCycleFrequency(billingCycle: string): { frequency: number; frequency_type: string } {
  switch (billingCycle) {
    case "quarterly":
      return { frequency: 3, frequency_type: "months" };
    case "semiannual":
      return { frequency: 6, frequency_type: "months" };
    case "yearly":
      return { frequency: 12, frequency_type: "months" };
    case "monthly":
    default:
      return { frequency: 1, frequency_type: "months" };
  }
}

// Gets the price for a given billing cycle from a plan
function getPriceForCycle(plan: Record<string, unknown>, billingCycle: string): number {
  switch (billingCycle) {
    case "quarterly":
      return (plan.price_quarterly as number) || (plan.price as number) * 3;
    case "semiannual":
      return (plan.price_semiannual as number) || (plan.price as number) * 6;
    case "yearly":
      return (plan.price_yearly as number) || (plan.price as number) * 12;
    case "monthly":
    default:
      return plan.price as number;
  }
}

async function callMercadoPago(
  endpoint: string, 
  method: string, 
  accessToken: string, 
  body?: unknown
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (method.toUpperCase() === "POST") {
    headers["X-Idempotency-Key"] = crypto.randomUUID();
  }
  const options: RequestInit = { method, headers };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  return fetch(`https://api.mercadopago.com${endpoint}`, options);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";

    // Helper: resolve access token from env or DB
    const resolveAccessToken = async (svcClient: ReturnType<typeof createClient>) => {
      if (accessToken) return accessToken;
      // Fallback: read encrypted token from saas_settings
      try {
        const { data } = await svcClient
          .from("saas_settings")
          .select("value")
          .eq("key", "mercadopago_access_token_encrypted")
          .single();
        if (data?.value) {
          const { decrypt } = await import("../_shared/encryption.ts");
          accessToken = await decrypt(data.value as string);
          return accessToken;
        }
      } catch (e) {
        console.warn("Failed to read access token from DB:", e);
      }
      return "";
    };

    // Helper function to require access token (only for paid plan operations)
    const requireAccessToken = async (svcClient: ReturnType<typeof createClient>) => {
      const token = await resolveAccessToken(svcClient);
      if (!token) {
        throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
      }
      return token;
    };

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Rate limiting: 3 req/min per user ──
    const windowStart = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: rlCount } = await serviceClient
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", userId)
      .eq("endpoint", "mercadopago-subscription")
      .gte("window_start", windowStart);

    if ((rlCount || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde um minuto." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    await serviceClient.from("rate_limits").insert({
      identifier: userId,
      endpoint: "mercadopago-subscription",
      window_start: new Date().toISOString(),
    });

    const body: RequestBody = await req.json();

    // Handle get-access-token - admin only, returns decrypted token
    if (body.action === "get-access-token") {
      const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: userId, _role: "admin_master" });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: admin_master required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const { data } = await serviceClient
          .from("saas_settings")
          .select("value")
          .eq("key", "mercadopago_access_token_encrypted")
          .maybeSingle();

        if (data?.value) {
          const { decrypt } = await import("../_shared/encryption.ts");
          const decrypted = await decrypt(data.value as string);
          return new Response(
            JSON.stringify({ success: true, token: decrypted }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, token: "" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("Failed to retrieve access token:", e);
        return new Response(
          JSON.stringify({ error: "Failed to retrieve token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle save-access-token - admin only
    if (body.action === "save-access-token") {
      // Verify admin_master role
      const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: userId, _role: "admin_master" });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: admin_master required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawToken = (body as SaveAccessTokenRequest).accessToken;
      if (!rawToken || !rawToken.trim()) {
        return new Response(
          JSON.stringify({ error: "Access token is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encrypt and store
      const { encrypt } = await import("../_shared/encryption.ts");
      const encrypted = await encrypt(rawToken.trim());

      await serviceClient
        .from("saas_settings")
        .upsert(
          { key: "mercadopago_access_token_encrypted", value: encrypted },
          { onConflict: "key" }
        );

      // Also update the mpSettings flag — preserve existing fields
      const { data: currentMp } = await serviceClient
        .from("saas_settings")
        .select("value")
        .eq("key", "mercadopago")
        .maybeSingle();

      const existingMp = (currentMp?.value && typeof currentMp.value === "object") ? currentMp.value as Record<string, unknown> : {};
      await serviceClient
        .from("saas_settings")
        .upsert(
          { key: "mercadopago", value: { ...existingMp, access_token_configured: true } },
          { onConflict: "key" }
        );

      // Update in-memory so subsequent test-connection in same request works
      accessToken = rawToken.trim();

      return new Response(
        JSON.stringify({ success: true, message: "Access token saved securely" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle test connection - requires access token
    if (body.action === "test-connection") {
      const token = await requireAccessToken(serviceClient);
      const response = await callMercadoPago("/users/me", "GET", token);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("MP connection test failed:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to connect to Mercado Pago" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userData = await response.json();
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Connected successfully",
          account: {
            id: userData.id,
            email: userData.email,
            nickname: userData.nickname,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle create plan - requires access token
    if (body.action === "create-plan") {
      const mpToken = await requireAccessToken(serviceClient);
      const { planId } = body;

      // Fetch plan from database
      const { data: plan, error: planError } = await serviceClient
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ error: "Plan not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Skip free plans
      if (plan.is_free || plan.price === 0) {
        return new Response(
          JSON.stringify({ error: "Cannot create MP plan for free plans" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create plan in Mercado Pago (default monthly)
      const freq = getCycleFrequency("monthly");
      const mpPlanData = {
        reason: plan.name,
        auto_recurring: {
          frequency: freq.frequency,
          frequency_type: freq.frequency_type,
          transaction_amount: plan.price,
          currency_id: "BRL",
        },
        back_url: `${req.headers.get("origin")}/subscription/callback`,
      };

      console.log("Creating MP plan:", JSON.stringify(mpPlanData));
      const response = await callMercadoPago("/preapproval_plan", "POST", mpToken, mpPlanData);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to create MP plan:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to create plan in Mercado Pago", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const mpPlan: MercadoPagoPlanResponse = await response.json();
      console.log("MP plan created:", JSON.stringify(mpPlan));

      // Update plan with mp_plan_id
      const { error: updateError } = await serviceClient
        .from("subscription_plans")
        .update({ mp_plan_id: mpPlan.id })
        .eq("id", planId);

      if (updateError) {
        console.error("Failed to update plan:", updateError);
      }

      return new Response(
        JSON.stringify({ success: true, mpPlanId: mpPlan.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle sync plans - requires access token
    if (body.action === "sync-plans") {
      const mpToken = await requireAccessToken(serviceClient);
      
      // Get all paid plans without mp_plan_id
      const { data: plans, error: plansError } = await serviceClient
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("is_free", false)
        .gt("price", 0)
        .is("mp_plan_id", null);

      if (plansError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch plans" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      for (const plan of plans || []) {
        const freq = getCycleFrequency("monthly");
        const mpPlanData = {
          reason: plan.name,
          auto_recurring: {
            frequency: freq.frequency,
            frequency_type: freq.frequency_type,
            transaction_amount: plan.price,
            currency_id: "BRL",
          },
          back_url: `${req.headers.get("origin")}/subscription/callback`,
        };

        try {
          const response = await callMercadoPago("/preapproval_plan", "POST", mpToken, mpPlanData);
          
          if (response.ok) {
            const mpPlan: MercadoPagoPlanResponse = await response.json();
            await serviceClient
              .from("subscription_plans")
              .update({ mp_plan_id: mpPlan.id })
              .eq("id", plan.id);
            
            results.push({ planId: plan.id, planName: plan.name, success: true, mpPlanId: mpPlan.id });
          } else {
            results.push({ planId: plan.id, planName: plan.name, success: false, error: await response.text() });
          }
        } catch (err) {
          results.push({ planId: plan.id, planName: plan.name, success: false, error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle create subscription
    if (body.action === "create-subscription") {
      const { planId, backUrl, couponCode, billingCycle: requestedCycle, orgName } = body;
      let { organizationId } = body;
      const billingCycle = requestedCycle || "monthly";

      // If no organizationId, try to find or create one
      if (!organizationId) {
        // Check if user already owns an org
        const { data: existingOrg } = await serviceClient
          .from("organizations")
          .select("id")
          .eq("owner_user_id", userId)
          .limit(1)
          .maybeSingle();

        if (existingOrg) {
          organizationId = existingOrg.id;
        } else if (orgName && orgName.trim()) {
          // Create new organization on the backend
          const slug = orgName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

          const { data: newOrg, error: orgCreateError } = await serviceClient
            .from("organizations")
            .insert({
              name: orgName.trim(),
              slug: `${slug}-${Date.now()}`,
              owner_user_id: userId,
              is_active: false,
            })
            .select()
            .single();

          if (orgCreateError || !newOrg) {
            return new Response(
              JSON.stringify({ error: "Falha ao criar organização" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Add user as member
          await serviceClient.from("organization_members").insert({
            organization_id: newOrg.id,
            user_id: userId,
            role: "owner",
          });

          organizationId = newOrg.id;
        } else {
          return new Response(
            JSON.stringify({ error: "Selecione ou crie uma organização" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Verify user belongs to organization
      const { data: membership, error: membershipError } = await serviceClient
        .from("organization_members")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .single();

      if (membershipError || !membership) {
        return new Response(
          JSON.stringify({ error: "User is not a member of this organization" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch plan
      const { data: plan, error: planError } = await serviceClient
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ error: "Plano não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate plan is active and public
      if (!plan.is_active) {
        return new Response(
          JSON.stringify({ error: "Este plano não está mais disponível" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (plan.is_public === false) {
        return new Response(
          JSON.stringify({ error: "Este plano não está disponível para assinatura" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the price for the requested billing cycle
      const cyclePrice = getPriceForCycle(plan, billingCycle);

      // Validate and apply coupon if provided
      let couponData: {
        id: string;
        code: string;
        discount_type: string;
        discount_value: number;
        discountAmount: number;
        finalPrice: number;
      } | null = null;

      if (couponCode && !plan.is_free && cyclePrice > 0) {
        // Fetch and validate coupon
        const { data: coupon, error: couponError } = await serviceClient
          .from("coupons")
          .select("*")
          .eq("code", couponCode.toUpperCase().trim())
          .single();

        if (!couponError && coupon && coupon.is_active) {
          const now = new Date();
          const startsAt = coupon.starts_at ? new Date(coupon.starts_at) : null;
          const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;

          const isValidPeriod = (!startsAt || startsAt <= now) && (!expiresAt || expiresAt > now);
          const isUnderLimit = coupon.max_uses_total === null || coupon.current_uses < coupon.max_uses_total;

          // Check if applies to this plan
          let appliesToPlan = true;
          if (coupon.applies_to === "specific_plans" && coupon.applicable_plan_ids) {
            appliesToPlan = coupon.applicable_plan_ids.includes(planId);
          }

          if (isValidPeriod && isUnderLimit && appliesToPlan) {
            let discountAmount: number;
            if (coupon.discount_type === "percentage") {
              discountAmount = (cyclePrice * coupon.discount_value) / 100;
            } else {
              discountAmount = coupon.discount_value;
            }
            discountAmount = Math.min(discountAmount, cyclePrice);

            couponData = {
              id: coupon.id,
              code: coupon.code,
              discount_type: coupon.discount_type,
              discount_value: coupon.discount_value,
              discountAmount,
              finalPrice: Math.max(cyclePrice - discountAmount, 0),
            };

            console.log("Coupon applied:", couponData);
          }
        }
      }

      // For free plans or 100% discount, just create subscription directly
      if (plan.is_free || cyclePrice === 0 || (couponData && couponData.finalPrice === 0)) {
        // Check if subscription exists
        const { data: existingSub } = await serviceClient
          .from("subscriptions")
          .select("*")
          .eq("organization_id", organizationId)
          .single();

        let subscriptionId: string;

        // Calculate trial/period dates for free plans so they actually expire.
        // We use plan.trial_days (default 7) as the duration.
        const trialDays = (typeof plan.trial_days === "number" && plan.trial_days > 0) ? plan.trial_days : 7;
        const periodStart = new Date();
        const periodEnd = new Date(periodStart.getTime() + trialDays * 24 * 60 * 60 * 1000);

        if (existingSub) {
          subscriptionId = existingSub.id;
          // Update existing — only reset dates when (re)activating a free plan
          await serviceClient
            .from("subscriptions")
            .update({
              plan_id: planId,
              billing_cycle: billingCycle,
              status: "active",
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              trial_end: periodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSub.id);
        } else {
          // Create new
          const { data: newSub } = await serviceClient
            .from("subscriptions")
            .insert({
              organization_id: organizationId,
              plan_id: planId,
              billing_cycle: billingCycle,
              status: "active",
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              trial_end: periodEnd.toISOString(),
            })
            .select()
            .single();
          
          subscriptionId = newSub?.id;
        }

        // Record coupon redemption if applicable
        if (couponData) {
          await serviceClient.from("coupon_redemptions").insert({
            coupon_id: couponData.id,
            organization_id: organizationId,
            subscription_id: subscriptionId,
            user_id: userId,
            original_price: cyclePrice,
            discount_applied: couponData.discountAmount,
            final_price: couponData.finalPrice,
          });

          // Increment coupon use count
          await serviceClient
            .from("coupons")
            .update({ current_uses: (await serviceClient.from("coupons").select("current_uses").eq("id", couponData.id).single()).data?.current_uses + 1 || 1 })
            .eq("id", couponData.id);
        }

        // Activate organization
        await serviceClient
          .from("organizations")
          .update({ is_active: true, blocked_at: null, block_reason: null })
          .eq("id", organizationId);

        return new Response(
          JSON.stringify({ success: true, free: true, redirect: backUrl || "/" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For paid plans, create MP plan with the correct cycle frequency and price
      const mpToken = await requireAccessToken(serviceClient);
      const freq = getCycleFrequency(billingCycle);
      
      // Always create a new MP plan for the specific cycle (MP plans are tied to frequency+amount)
      const mpPlanData = {
        reason: `${plan.name} - ${billingCycle === "monthly" ? "Mensal" : billingCycle === "quarterly" ? "Trimestral" : billingCycle === "semiannual" ? "Semestral" : "Anual"}`,
        auto_recurring: {
          frequency: freq.frequency,
          frequency_type: freq.frequency_type,
          transaction_amount: cyclePrice,
          currency_id: "BRL",
        },
        back_url: backUrl || `${req.headers.get("origin")}/subscription/callback`,
      };

      console.log("Creating MP plan for cycle:", billingCycle, JSON.stringify(mpPlanData));
      const createPlanResponse = await callMercadoPago("/preapproval_plan", "POST", mpToken, mpPlanData);
      
      if (!createPlanResponse.ok) {
        const errorText = await createPlanResponse.text();
        console.error("Failed to create MP plan:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to create plan in Mercado Pago", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const mpPlan = await createPlanResponse.json();
      console.log("MP plan created:", JSON.stringify(mpPlan));
      const mpPlanId = mpPlan.id;
      const planInitPoint = mpPlan.init_point;

      // Check if subscription exists
      const { data: existingSub } = await serviceClient
        .from("subscriptions")
        .select("*")
        .eq("organization_id", organizationId)
        .single();

      let subscriptionId: string;

      if (existingSub) {
        subscriptionId = existingSub.id;
        // Update plan
        await serviceClient
          .from("subscriptions")
          .update({
            plan_id: planId,
            billing_cycle: billingCycle,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSub.id);
      } else {
        // Create subscription record
        const { data: newSub, error: subError } = await serviceClient
          .from("subscriptions")
          .insert({
            organization_id: organizationId,
            plan_id: planId,
            billing_cycle: billingCycle,
            status: "pending",
          })
          .select()
          .single();

        if (subError || !newSub) {
          return new Response(
            JSON.stringify({ error: "Failed to create subscription record" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        subscriptionId = newSub.id;
      }

      // Record coupon redemption for paid plans (will be confirmed after payment)
      if (couponData) {
        await serviceClient.from("coupon_redemptions").insert({
          coupon_id: couponData.id,
          organization_id: organizationId,
          subscription_id: subscriptionId,
          user_id: userId,
          original_price: cyclePrice,
          discount_applied: couponData.discountAmount,
          final_price: couponData.finalPrice,
        });

        // Increment coupon use count
        const { data: currentCoupon } = await serviceClient
          .from("coupons")
          .select("current_uses")
          .eq("id", couponData.id)
          .single();
        
        await serviceClient
          .from("coupons")
          .update({ current_uses: (currentCoupon?.current_uses || 0) + 1 })
          .eq("id", couponData.id);
      }

      // Create a preapproval (subscription) with external_reference so webhook can find us
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const payerEmail = authUser?.email || "";

      const preapprovalBody: Record<string, unknown> = {
        preapproval_plan_id: mpPlanId,
        external_reference: subscriptionId,
        back_url: backUrl || `${req.headers.get("origin")}/subscription/callback`,
      };
      if (payerEmail) {
        preapprovalBody.payer_email = payerEmail;
      }

      console.log("Creating MP preapproval with external_reference:", JSON.stringify(preapprovalBody));
      const preapprovalResp = await callMercadoPago("/preapproval", "POST", mpToken, preapprovalBody);

      if (preapprovalResp.ok) {
        const preapproval = await preapprovalResp.json();
        console.log("MP preapproval created:", preapproval.id, "init_point:", preapproval.init_point);

        // Save mp_subscription_id immediately
        await serviceClient
          .from("subscriptions")
          .update({ mp_subscription_id: preapproval.id })
          .eq("id", subscriptionId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            initPoint: preapproval.init_point,
            subscriptionId,
            couponApplied: couponData ? {
              code: couponData.code,
              discount: couponData.discountAmount,
            } : null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // FAIL: preapproval creation failed — do NOT fallback to plan link
      // because it won't have external_reference and webhook can't link payment
      const preapprovalError = await preapprovalResp.text();
      console.error("Failed to create preapproval (NO FALLBACK):", preapprovalError);

      return new Response(
        JSON.stringify({ 
          error: "Falha ao criar assinatura no MercadoPago. Tente novamente.",
          details: preapprovalError,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle cancel subscription
    if (body.action === "cancel-subscription") {
      const { subscriptionId } = body;

      // Fetch subscription
      const { data: subscription, error: subError } = await serviceClient
        .from("subscriptions")
        .select("*, organizations(*)")
        .eq("id", subscriptionId)
        .single();

      if (subError || !subscription) {
        return new Response(
          JSON.stringify({ error: "Subscription not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user owns the organization
      const { data: membership } = await serviceClient
        .from("organization_members")
        .select("*")
        .eq("organization_id", subscription.organization_id)
        .eq("user_id", userId)
        .single();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Not authorized to cancel this subscription" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cancel in Mercado Pago if has mp_subscription_id
      if (subscription.mp_subscription_id && accessToken) {
        const response = await callMercadoPago(
          `/preapproval/${subscription.mp_subscription_id}`,
          "PUT",
          accessToken,
          { status: "cancelled" }
        );

        if (!response.ok) {
          console.error("Failed to cancel in MP:", await response.text());
        }
      }

      // Update local subscription
      await serviceClient
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle change plan — orchestrates cancel current + create new
    if (body.action === "change-plan") {
      const { newPlanId, billingCycle: requestedCycle, couponCode, backUrl } = body as ChangePlanRequest;
      const billingCycle = requestedCycle || "monthly";

      // Find user's organization
      const { data: membership } = await serviceClient
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Você não pertence a nenhuma organização" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (membership.role !== "owner") {
        return new Response(
          JSON.stringify({ error: "Apenas o proprietário da organização pode trocar de plano" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const organizationId = membership.organization_id;

      // Fetch current subscription
      const { data: currentSub } = await serviceClient
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("organization_id", organizationId)
        .maybeSingle();

      // Fetch new plan
      const { data: newPlan, error: newPlanError } = await serviceClient
        .from("subscription_plans")
        .select("*")
        .eq("id", newPlanId)
        .eq("is_active", true)
        .single();

      if (newPlanError || !newPlan) {
        return new Response(
          JSON.stringify({ error: "Plano não encontrado ou indisponível" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Block downgrade to free if currently on paid plan (use cancel-subscription instead)
      const currentPlan = (currentSub as any)?.subscription_plans;
      if (currentPlan && !currentPlan.is_free && (newPlan.is_free || newPlan.price === 0)) {
        return new Response(
          JSON.stringify({ error: "Para fazer downgrade ao plano gratuito, cancele sua assinatura atual primeiro" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cancel existing MP preapproval if any (best effort)
      if (currentSub?.mp_subscription_id) {
        const mpToken = await resolveAccessToken(serviceClient);
        if (mpToken) {
          try {
            await callMercadoPago(
              `/preapproval/${currentSub.mp_subscription_id}`,
              "PUT",
              mpToken,
              { status: "cancelled" }
            );
            console.log("Cancelled previous MP preapproval:", currentSub.mp_subscription_id);
          } catch (e) {
            console.warn("Failed to cancel previous MP preapproval (continuing):", e);
          }
        }
      }

      // Log the plan change
      await serviceClient.from("plan_change_log").insert({
        organization_id: organizationId,
        from_plan_id: currentSub?.plan_id || null,
        to_plan_id: newPlanId,
        from_billing_cycle: currentSub?.billing_cycle || null,
        to_billing_cycle: billingCycle,
        changed_by_user_id: userId,
        change_source: "user",
        reason: "self_service_change",
        metadata: {
          previous_status: currentSub?.status || null,
          had_mp_subscription: !!currentSub?.mp_subscription_id,
        },
      });

      // Fire admin notification (non-blocking)
      try {
        const { data: orgInfo } = await serviceClient.from("organizations").select("name").eq("id", organizationId).single();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        await serviceClient.functions.invoke("admin-notify", {
          body: {
            event_type: "plan_change",
            variables: {
              user_name: orgInfo?.name || "",
              user_email: authUser?.email || "",
              old_plan: currentPlan?.name || "Sem plano",
              new_plan: newPlan.name,
              date: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
            },
          },
        });
      } catch (e) {
        console.warn("admin-notify plan_change failed (non-blocking):", e);
      }

      // Now delegate: re-invoke create-subscription logic by direct call
      // Reuse same pattern: free → activate; paid → MP preapproval
      const cyclePrice = getPriceForCycle(newPlan as Record<string, unknown>, billingCycle);

      // FREE / 100% off path
      if (newPlan.is_free || cyclePrice === 0) {
        if (currentSub) {
          await serviceClient.from("subscriptions").update({
            plan_id: newPlanId,
            billing_cycle: billingCycle,
            status: "active",
            mp_subscription_id: null,
            updated_at: new Date().toISOString(),
          }).eq("id", currentSub.id);
        } else {
          await serviceClient.from("subscriptions").insert({
            organization_id: organizationId,
            plan_id: newPlanId,
            billing_cycle: billingCycle,
            status: "active",
          });
        }
        await serviceClient.from("organizations").update({ is_active: true, blocked_at: null, block_reason: null }).eq("id", organizationId);
        return new Response(
          JSON.stringify({ success: true, free: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // PAID path: create MP plan + preapproval
      const mpToken = await requireAccessToken(serviceClient);
      const freq = getCycleFrequency(billingCycle);
      const mpPlanData = {
        reason: `${newPlan.name} - ${billingCycle === "monthly" ? "Mensal" : billingCycle === "quarterly" ? "Trimestral" : billingCycle === "semiannual" ? "Semestral" : "Anual"}`,
        auto_recurring: {
          frequency: freq.frequency,
          frequency_type: freq.frequency_type,
          transaction_amount: cyclePrice,
          currency_id: "BRL",
        },
        back_url: backUrl || `${req.headers.get("origin")}/subscription/callback`,
      };

      const createPlanResp = await callMercadoPago("/preapproval_plan", "POST", mpToken, mpPlanData);
      if (!createPlanResp.ok) {
        const errText = await createPlanResp.text();
        return new Response(
          JSON.stringify({ error: "Falha ao criar plano no Mercado Pago", details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const mpPlan = await createPlanResp.json();

      // Update or create subscription record (status pending until paid)
      let subscriptionId: string;
      if (currentSub) {
        subscriptionId = currentSub.id;
        await serviceClient.from("subscriptions").update({
          plan_id: newPlanId,
          billing_cycle: billingCycle,
          status: "pending",
          mp_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("id", currentSub.id);
      } else {
        const { data: newSub } = await serviceClient.from("subscriptions").insert({
          organization_id: organizationId,
          plan_id: newPlanId,
          billing_cycle: billingCycle,
          status: "pending",
        }).select().single();
        subscriptionId = newSub?.id;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const preapprovalBody: Record<string, unknown> = {
        preapproval_plan_id: mpPlan.id,
        external_reference: subscriptionId,
        back_url: backUrl || `${req.headers.get("origin")}/subscription/callback`,
      };
      if (authUser?.email) preapprovalBody.payer_email = authUser.email;

      const preapprovalResp = await callMercadoPago("/preapproval", "POST", mpToken, preapprovalBody);
      if (!preapprovalResp.ok) {
        const errText = await preapprovalResp.text();
        return new Response(
          JSON.stringify({ error: "Falha ao criar assinatura no Mercado Pago", details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const preapproval = await preapprovalResp.json();

      await serviceClient.from("subscriptions").update({ mp_subscription_id: preapproval.id }).eq("id", subscriptionId);

      return new Response(
        JSON.stringify({ success: true, initPoint: preapproval.init_point, subscriptionId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle get subscription
    if (body.action === "get-subscription") {
      const { subscriptionId } = body;

      const { data: subscription, error: subError } = await serviceClient
        .from("subscriptions")
        .select("*, subscription_plans(*), organizations(*)")
        .eq("id", subscriptionId)
        .single();

      if (subError || !subscription) {
        return new Response(
          JSON.stringify({ error: "Subscription not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If has MP subscription, fetch latest status
      if (subscription.mp_subscription_id && accessToken) {
        const response = await callMercadoPago(`/preapproval/${subscription.mp_subscription_id}`, "GET", accessToken);
        
        if (response.ok) {
          const mpData = await response.json();
          subscription.mp_status = mpData.status;
          subscription.mp_next_payment = mpData.next_payment_date;
        }
      }

      return new Response(
        JSON.stringify({ success: true, subscription }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle retry-checkout — generate fresh init_point for pending subscription
    if (body.action === "retry-checkout") {
      const mpToken = await requireAccessToken(serviceClient);
      const backUrl = (body as RetryCheckoutRequest).backUrl || `${req.headers.get("origin")}/subscription/callback`;

      // Find user's org
      const { data: membership } = await serviceClient
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "No organization found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find pending subscription
      const { data: sub } = await serviceClient
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("organization_id", membership.organization_id)
        .eq("status", "pending")
        .maybeSingle();

      if (!sub || !sub.subscription_plans) {
        return new Response(
          JSON.stringify({ error: "No pending subscription found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const plan = sub.subscription_plans as Record<string, unknown>;
      const billingCycle = sub.billing_cycle || "monthly";
      const cyclePrice = getPriceForCycle(plan, billingCycle);

      if (!cyclePrice || cyclePrice <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid plan price" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create a fresh MP preapproval plan
      const freq = getCycleFrequency(billingCycle);
      const mpPlanData = {
        reason: `${plan.name} - ${billingCycle === "monthly" ? "Mensal" : billingCycle === "quarterly" ? "Trimestral" : billingCycle === "semiannual" ? "Semestral" : "Anual"}`,
        auto_recurring: {
          frequency: freq.frequency,
          frequency_type: freq.frequency_type,
          transaction_amount: cyclePrice,
          currency_id: "BRL",
        },
        back_url: backUrl,
      };

      console.log("Retry checkout — creating fresh MP plan:", JSON.stringify(mpPlanData));
      const response = await callMercadoPago("/preapproval_plan", "POST", mpToken, mpPlanData);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to create retry MP plan:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to create checkout link", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const mpPlan = await response.json();

      // Create a preapproval with external_reference so webhook can match
      const { data: { user: retryUser } } = await supabase.auth.getUser();
      const retryPayerEmail = retryUser?.email || "";

      const retryPreapprovalBody: Record<string, unknown> = {
        preapproval_plan_id: mpPlan.id,
        external_reference: sub.id,
        back_url: backUrl,
      };
      if (retryPayerEmail) {
        retryPreapprovalBody.payer_email = retryPayerEmail;
      }

      console.log("Retry — creating MP preapproval:", JSON.stringify(retryPreapprovalBody));
      const retryPreapprovalResp = await callMercadoPago("/preapproval", "POST", mpToken, retryPreapprovalBody);

      let initPoint: string;
      if (retryPreapprovalResp.ok) {
        const retryPreapproval = await retryPreapprovalResp.json();
        console.log("Retry preapproval created:", retryPreapproval.id);
        initPoint = retryPreapproval.init_point;

        // Save mp_subscription_id
        await serviceClient
          .from("subscriptions")
          .update({ mp_subscription_id: retryPreapproval.id })
          .eq("id", sub.id);
      } else {
        console.warn("Retry preapproval failed, using plan init_point:", await retryPreapprovalResp.text());
        initPoint = mpPlan.init_point || `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${mpPlan.id}`;
      }

      console.log("Retry checkout init_point:", initPoint);

      return new Response(
        JSON.stringify({ success: true, initPoint, planName: plan.name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle refund-payment — admin only
    if (body.action === "refund-payment") {
      const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: userId, _role: "admin_master" });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: admin_master required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { paymentId, amount } = body as RefundPaymentRequest;
      const mpToken = await requireAccessToken(serviceClient);

      // Find payment in our DB
      const { data: paymentRecord, error: payErr } = await serviceClient
        .from("subscription_payments")
        .select("*, subscriptions(*, organizations(*))")
        .eq("mp_payment_id", paymentId)
        .single();

      if (payErr || !paymentRecord) {
        return new Response(
          JSON.stringify({ error: "Pagamento não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Call MP refund API
      const refundBody: Record<string, unknown> = {};
      if (amount && amount > 0) {
        refundBody.amount = amount;
      }

      console.log(`Refunding payment ${paymentId}, amount: ${amount || "full"}`);
      const refundResp = await callMercadoPago(`/v1/payments/${paymentId}/refunds`, "POST", mpToken, refundBody);

      if (!refundResp.ok) {
        const errText = await refundResp.text();
        console.error("MP refund failed:", errText);
        return new Response(
          JSON.stringify({ error: "Falha ao processar reembolso no MercadoPago", details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refundData = await refundResp.json();
      console.log("Refund success:", JSON.stringify(refundData));

      const refundedAmount = amount || paymentRecord.amount;

      // Update payment status
      await serviceClient
        .from("subscription_payments")
        .update({ 
          status: "refunded",
          refunded_amount: refundedAmount,
        })
        .eq("mp_payment_id", paymentId);

      // Update subscription totals
      const sub = paymentRecord.subscriptions as any;
      if (sub) {
        await serviceClient
          .from("subscriptions")
          .update({ 
            status: "refunded",
            total_refunded: (sub.total_refunded || 0) + refundedAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        // Deactivate organization
        await serviceClient
          .from("organizations")
          .update({ is_active: false, block_reason: "Reembolso processado" })
          .eq("id", sub.organization_id);
      }

      return new Response(
        JSON.stringify({ success: true, refundId: refundData.id, amount: refundedAmount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Subscription error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
