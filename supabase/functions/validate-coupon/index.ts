import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface ValidateCouponRequest {
  code: string;
  planId: string;
}

interface CouponData {
  id: string;
  code: string;
  name: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  applies_to: "all_plans" | "specific_plans";
  applicable_plan_ids: string[] | null;
  min_plan_price: number | null;
  max_uses_total: number | null;
  max_uses_per_user: number | null;
  current_uses: number;
  is_active: boolean;
  is_first_purchase: boolean;
  starts_at: string | null;
  expires_at: string | null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authentication is REQUIRED for coupon validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ valid: false, error: "Autenticação obrigatória para validar cupons" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId: string = claimsData.claims.sub as string;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Rate limiting: 5 req/min per user ──
    const windowStart = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: rlCount } = await serviceClient
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", userId)
      .eq("endpoint", "validate-coupon")
      .gte("window_start", windowStart);

    if ((rlCount || 0) >= 5) {
      return new Response(
        JSON.stringify({ valid: false, error: "Muitas tentativas. Aguarde um minuto." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    await serviceClient.from("rate_limits").insert({
      identifier: userId,
      endpoint: "validate-coupon",
      window_start: new Date().toISOString(),
    });

    const body: ValidateCouponRequest = await req.json();
    
    console.log("Validating coupon:", body.code, "for plan:", body.planId);

    const { code, planId } = body;

    if (!code || !planId) {
      return new Response(
        JSON.stringify({ valid: false, error: "Código do cupom e plano são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch coupon by code
    const { data: coupon, error: couponError } = await serviceClient
      .from("coupons")
      .select("*")
      .eq("code", code.toUpperCase().trim())
      .single();

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ valid: false, error: "Cupom não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const couponData = coupon as CouponData;
    const now = new Date();

    // Check if active
    if (!couponData.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: "Cupom inativo" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check start date
    if (couponData.starts_at && new Date(couponData.starts_at) > now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Cupom ainda não está válido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (couponData.expires_at && new Date(couponData.expires_at) < now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Cupom expirado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses total
    if (couponData.max_uses_total !== null && couponData.current_uses >= couponData.max_uses_total) {
      return new Response(
        JSON.stringify({ valid: false, error: "Cupom atingiu limite de uso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses per user
    if (couponData.max_uses_per_user !== null) {
      const { count } = await serviceClient
        .from("coupon_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("coupon_id", couponData.id)
        .eq("user_id", userId);

      if (count !== null && count >= couponData.max_uses_per_user) {
        return new Response(
          JSON.stringify({ valid: false, error: "Você já usou este cupom o máximo de vezes permitido" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check first purchase only
    if (couponData.is_first_purchase) {
      const { count } = await serviceClient
        .from("coupon_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (count !== null && count > 0) {
        return new Response(
          JSON.stringify({ valid: false, error: "Cupom válido apenas para primeira compra" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch plan
    const { data: plan, error: planError } = await serviceClient
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ valid: false, error: "Plano não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if coupon applies to this plan
    if (couponData.applies_to === "specific_plans") {
      const applicablePlans = couponData.applicable_plan_ids || [];
      if (!applicablePlans.includes(planId)) {
        return new Response(
          JSON.stringify({ valid: false, error: "Cupom não aplicável a este plano" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check min plan price
    if (couponData.min_plan_price !== null && plan.price < couponData.min_plan_price) {
      return new Response(
        JSON.stringify({ valid: false, error: `Cupom válido apenas para planos acima de R$ ${couponData.min_plan_price.toFixed(2)}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate discount
    const originalPrice = plan.price;
    let discountAmount: number;

    if (couponData.discount_type === "percentage") {
      discountAmount = (originalPrice * couponData.discount_value) / 100;
    } else {
      discountAmount = couponData.discount_value;
    }

    // Ensure discount doesn't exceed price
    discountAmount = Math.min(discountAmount, originalPrice);
    const finalPrice = Math.max(originalPrice - discountAmount, 0);

    console.log("Coupon valid. Discount:", discountAmount, "Final price:", finalPrice);

    return new Response(
      JSON.stringify({
        valid: true,
        coupon: {
          id: couponData.id,
          code: couponData.code,
          name: couponData.name,
          discount_type: couponData.discount_type,
          discount_value: couponData.discount_value,
        },
        originalPrice,
        discountAmount,
        finalPrice,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Validate coupon error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erro ao validar cupom" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
