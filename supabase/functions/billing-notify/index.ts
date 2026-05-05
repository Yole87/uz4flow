import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.4/mod.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getErrorMessage } from "../_shared/getErrorMessage.ts";
import { decrypt } from "../_shared/encryption.ts";
import { interpolateTemplate } from "../_shared/templates.ts";
import { sendOpenBotMessage } from "../_shared/openbot.ts";

const BillingNotifySchema = z.object({
  event_type: z.string().min(1).max(100),
  organization_id: z.string().uuid(),
  metadata: z
    .object({
      nome: z.string().max(200).optional(),
      valor: z.number().nonnegative().optional(),
      plano: z.string().max(100).optional(),
      vencimento: z.string().max(50).optional(),
      link_pagamento: z.string().url().max(2000).optional(),
      motivo: z.string().max(500).optional(),
      payment_id: z.string().max(100).optional(),
      payer_email: z.string().email().max(255).optional(),
    })
    .partial()
    .optional(),
});

type BillingNotifyPayload = z.infer<typeof BillingNotifySchema>;


Deno.serve(async (req) => {
  const corsHeaders = {
    ...getCorsHeaders(req),
    "Access-Control-Allow-Headers":
      (getCorsHeaders(req)["Access-Control-Allow-Headers"] || "") + ", x-cron-secret",
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret OR service-role bearer to prevent public abuse
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRoleCall = authHeader === `Bearer ${supabaseServiceKey}`;

  if (!isServiceRoleCall && (!cronSecret || providedSecret !== cronSecret)) {
    console.warn("[billing-notify] Unauthorized invocation blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const raw = await req.json().catch(() => null);
    const parsed = BillingNotifySchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("[billing-notify] invalid_payload", parsed.error.flatten());
      return new Response(
        JSON.stringify({ error: "invalid_payload", issues: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const payload: BillingNotifyPayload = parsed.data;
    const { event_type, organization_id, metadata = {} } = payload;

    console.log(`[billing-notify] Processing ${event_type} for org ${organization_id}`);

    // 1. Fetch template
    const { data: template, error: tplErr } = await supabase
      .from("billing_message_templates")
      .select("*")
      .eq("event_type", event_type)
      .eq("is_active", true)
      .single();

    if (tplErr || !template) {
      console.log(`[billing-notify] No active template for ${event_type}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "No active template" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!template.send_via_whatsapp) {
      console.log(`[billing-notify] WhatsApp disabled for ${event_type}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "WhatsApp sending disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch organization + owner phone
    const { data: org } = await supabase
      .from("organizations")
      .select("name, owner_user_id")
      .eq("id", organization_id)
      .single();

    if (!org) {
      console.error(`[billing-notify] Organization ${organization_id} not found`);
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get owner phone from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", org.owner_user_id)
      .single();

    const phone = profile?.phone;
    const ownerName = profile?.full_name || org.name || "Cliente";

    if (!phone) {
      console.warn(`[billing-notify] No phone for org ${organization_id}`);
      // Log failure
      await supabase.from("billing_notifications_log").insert({
        organization_id,
        event_type,
        phone: "N/A",
        message_sent: "",
        status: "failed",
        error_message: "Telefone do proprietário não encontrado",
        metadata: metadata as any,
      });
      // Create admin notification about missing phone
      await supabase.from("admin_notifications").insert({
        type: "billing_error",
        title: "Falha no envio de cobrança",
        message: `Não foi possível enviar notificação "${template.label}" para "${org.name}": telefone não cadastrado.`,
        metadata: { organization_id, event_type },
      });
      return new Response(
        JSON.stringify({ error: "Owner phone not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Resolve template variables
    const vars: Record<string, string> = {
      nome: metadata.nome || ownerName,
      valor: metadata.valor != null ? metadata.valor.toFixed(2) : "0.00",
      plano: metadata.plano || "N/A",
      vencimento: metadata.vencimento || "N/A",
      link_pagamento: metadata.link_pagamento || "",
      motivo: metadata.motivo || "Não especificado",
    };

    const message = interpolateTemplate(template.message_template, vars, "double_curly");

    // 4. Get OpenBot API key from saas_settings
    const { data: apiKeySetting } = await supabase
      .from("saas_settings")
      .select("value")
      .eq("key", "billing_openbot_api_key_encrypted")
      .single();

    if (!apiKeySetting?.value) {
      console.error("[billing-notify] billing_openbot_api_key_encrypted not configured");
      await supabase.from("billing_notifications_log").insert({
        organization_id,
        event_type,
        phone,
        message_sent: message,
        status: "failed",
        error_message: "API Key do OpenBot para cobranças não configurada",
        metadata: metadata as any,
      });
      return new Response(
        JSON.stringify({ error: "Billing OpenBot API key not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = await decrypt(apiKeySetting.value as string);

    // 5. Send via OpenBot
    const normalizedPhone = phone.replace(/\D/g, "");
    console.log(`[billing-notify] Sending to ${normalizedPhone.substring(0, 6)}...`);

    const sendResponse = await sendOpenBotMessage({
      apiKey,
      phone: normalizedPhone,
      message,
      desativarFluxo: true,
    });

    const sendResult = await sendResponse.text();
    const sendOk = sendResponse.ok;

    // 6. Log result
    await supabase.from("billing_notifications_log").insert({
      organization_id,
      event_type,
      phone,
      message_sent: message,
      status: sendOk ? "sent" : "failed",
      error_message: sendOk ? null : `OpenBot error: ${sendResponse.status} - ${sendResult}`,
      metadata: { ...metadata, openbot_response: sendResult } as any,
    });

    // 7. Create admin notification
    await supabase.from("admin_notifications").insert({
      type: `billing_${event_type}`,
      title: template.label,
      message: `Notificação "${template.label}" ${sendOk ? "enviada" : "FALHOU"} para "${org.name}" (${phone}).`,
      metadata: { organization_id, event_type, status: sendOk ? "sent" : "failed" },
    });

    console.log(`[billing-notify] ${event_type} → ${sendOk ? "OK" : "FAILED"}`);

    return new Response(
      JSON.stringify({ success: sendOk, event_type, phone }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[billing-notify] error:", error, getErrorMessage(error));
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
