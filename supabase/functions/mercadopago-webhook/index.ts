import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.4/mod.ts";
import { publicCorsHeaders, securityHeaders } from "../_shared/cors.ts";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";
import { getErrorMessage } from "../_shared/getErrorMessage.ts";

const corsHeaders = {
  ...publicCorsHeaders,
  ...securityHeaders,
};

const NotificationSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    type: z.string().min(1).max(100),
    action: z.string().max(100).optional(),
    data: z.object({
      id: z.union([z.string(), z.number()]).transform((v) => String(v)),
    }),
    live_mode: z.boolean().optional(),
    date_created: z.string().optional(),
    user_id: z.union([z.string(), z.number()]).optional(),
    api_version: z.string().optional(),
  })
  .passthrough();

interface MercadoPagoNotification {
  id: string;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: string;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

interface PreapprovalData {
  id: string;
  payer_id: number;
  payer_email: string;
  back_url: string;
  collector_id: number;
  application_id: number;
  status: string;
  reason: string;
  external_reference: string;
  date_created: string;
  last_modified: string;
  init_point: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
  summarized: {
    quotas: number;
    charged_quantity: number;
    pending_charge_quantity: number;
    charged_amount: number;
    pending_charge_amount: number;
    semaphore: string;
    last_charged_date: string;
    last_charged_amount: number;
  };
  next_payment_date: string;
  payment_method_id: string;
  first_invoice_offset: number;
}

interface PaymentData {
  id: number;
  date_created: string;
  date_approved: string;
  date_last_updated: string;
  money_release_date: string;
  payment_method_id: string;
  payment_type_id: string;
  status: string;
  status_detail: string;
  currency_id: string;
  description: string;
  collector_id: number;
  payer: {
    id: number;
    email: string;
    type: string;
  };
  transaction_amount: number;
  transaction_amount_refunded: number;
  external_reference: string;
  metadata: Record<string, unknown>;
}

// Status detail translations (PT-BR)
const STATUS_DETAIL_MAP: Record<string, string> = {
  accredited: "Pagamento aprovado",
  pending_contingency: "Pendente de processamento",
  pending_review_manual: "Pendente de revisão manual",
  cc_rejected_insufficient_amount: "Saldo insuficiente",
  cc_rejected_bad_filled_card_number: "Número do cartão incorreto",
  cc_rejected_bad_filled_date: "Data de validade incorreta",
  cc_rejected_bad_filled_security_code: "CVV incorreto",
  cc_rejected_bad_filled_other: "Dados do cartão incorretos",
  cc_rejected_blacklist: "Cartão na lista negra",
  cc_rejected_call_for_authorize: "Necessário autorizar com o banco",
  cc_rejected_card_disabled: "Cartão desabilitado",
  cc_rejected_card_error: "Erro no cartão",
  cc_rejected_duplicated_payment: "Pagamento duplicado",
  cc_rejected_high_risk: "Pagamento rejeitado por risco",
  cc_rejected_max_attempts: "Máximo de tentativas excedido",
  cc_rejected_other_reason: "Recusado por outro motivo",
  rejected_by_bank: "Rejeitado pelo banco",
  rejected_by_regulations: "Rejeitado por regulamentações",
  pending_waiting_payment: "Aguardando pagamento",
  pending_waiting_transfer: "Aguardando transferência",
};

function translateStatusDetail(detail: string | undefined): string | null {
  if (!detail) return null;
  return STATUS_DETAIL_MAP[detail] || null;
}

// Validate webhook signature using HMAC-SHA256
async function validateSignature(
  req: Request, 
  body: string, 
  secret: string
): Promise<boolean> {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  
  if (!xSignature || !xRequestId) {
    console.log("Missing signature headers");
    return false;
  }

  const parts = xSignature.split(",");
  const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1];
  const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];

  if (!ts || !v1) return false;

  const notification = JSON.parse(body);
  const dataId = notification.data?.id || "";
  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(template));
  const computedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHash === v1;
}

function mapSubscriptionStatus(mpStatus: string): string {
  const statusMap: Record<string, string> = {
    authorized: "active",
    pending: "pending",
    paused: "paused",
    cancelled: "cancelled",
  };
  return statusMap[mpStatus] || mpStatus;
}

function mapPaymentStatus(mpStatus: string): string {
  const statusMap: Record<string, string> = {
    approved: "approved",
    pending: "pending",
    authorized: "authorized",
    in_process: "pending",
    in_mediation: "pending",
    rejected: "rejected",
    cancelled: "cancelled",
    refunded: "refunded",
    charged_back: "charged_back",
  };
  return statusMap[mpStatus] || mpStatus;
}

// Helper to trigger billing notification (fire-and-forget)
async function triggerBillingNotify(
  supabaseUrl: string,
  serviceKey: string,
  event_type: string,
  organization_id: string,
  metadata: Record<string, any>
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/billing-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        ...(Deno.env.get("CRON_SECRET")
          ? { "x-cron-secret": Deno.env.get("CRON_SECRET")! }
          : {}),
      },
      body: JSON.stringify({ event_type, organization_id, metadata }),
    });
    console.log(`[billing-notify] Triggered ${event_type} for org ${organization_id}`);
  } catch (e) {
    console.warn(`[billing-notify] Failed to trigger ${event_type}:`, e);
  }
}

// Helper to trigger admin notification (fire-and-forget)
async function triggerAdminNotify(
  supabaseUrl: string,
  serviceKey: string,
  event_type: string,
  variables: Record<string, any>
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/admin-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ event_type, variables }),
    });
    console.log(`[admin-notify] Triggered ${event_type}`);
  } catch (e) {
    console.warn(`[admin-notify] Failed ${event_type}:`, e);
  }
}

// Helper to process affiliate commission (fire-and-forget)
async function processAffiliateCommission(
  supabase: ReturnType<typeof createClient>,
  ownerUserId: string | null | undefined,
  subscriptionId: string,
  paymentId: string,
  amount: number,
  status: string,
) {
  if (!ownerUserId) return;
  try {
    const { data, error } = await supabase.rpc("process_affiliate_payment", {
      p_user_id: ownerUserId,
      p_subscription_id: subscriptionId,
      p_payment_id: paymentId,
      p_gross_amount: amount,
      p_payment_status: status,
    });
    if (error) console.warn("[affiliate] RPC error:", error.message);
    else console.log("[affiliate] result:", data);
  } catch (e) {
    console.warn("[affiliate] failed:", e);
  }
}

async function fetchFromMercadoPago(endpoint: string, accessToken: string): Promise<Response> {
  return fetchWithRetry(`https://api.mercadopago.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

// Helper: find subscription by mp_subscription_id or external_reference (guards against empty values)
async function findSubscriptionByRef(
  supabase: ReturnType<typeof createClient>,
  mpSubId: string | undefined,
  extRef: string | undefined,
): Promise<{ subscription: any; error: any }> {
  const conditions: string[] = [];
  if (mpSubId) conditions.push(`mp_subscription_id.eq.${mpSubId}`);
  if (extRef) conditions.push(`id.eq.${extRef}`);

  if (conditions.length === 0) {
    return { subscription: null, error: "No identifiers provided" };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, organizations(*)")
    .or(conditions.join(","))
    .single();

  return { subscription: data, error };
}

// Helper: find subscription by payer email using RPC
async function findSubscriptionByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<any | null> {
  if (!email) return null;

  console.log(`Trying email fallback for subscription lookup`);

  // Use RPC to find user by email (profiles table has no email column)
  const { data: userId } = await supabase
    .rpc("get_user_id_by_email", { p_email: email });

  if (!userId) {
    console.log("No user found for payer email");
    return null;
  }

  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!orgMember) {
    console.log(`No org membership found for user: ${userId}`);
    return null;
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, organizations(*)")
    .eq("organization_id", orgMember.organization_id)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sub) {
    console.log(`Email fallback found subscription ${sub.id} for org ${orgMember.organization_id}`);
  }
  return sub;
}

// Helper to insert a webhook log
async function insertLog(
  supabase: ReturnType<typeof createClient>,
  log: {
    event_type: string;
    event_action?: string;
    mp_id?: string;
    status?: string;
    status_detail?: string;
    amount?: number;
    payer_email?: string;
    organization_id?: string;
    organization_name?: string;
    subscription_id?: string;
    error_message?: string;
    raw_payload?: unknown;
    processed?: boolean;
  }
) {
  try {
    const description = translateStatusDetail(log.status_detail || undefined);
    await supabase.from("payment_webhook_logs").insert({
      event_type: log.event_type,
      event_action: log.event_action || null,
      mp_id: log.mp_id || null,
      status: log.status || null,
      status_detail: log.status_detail || null,
      status_detail_description: description,
      amount: log.amount ?? null,
      payer_email: log.payer_email || null,
      organization_id: log.organization_id || null,
      organization_name: log.organization_name || null,
      subscription_id: log.subscription_id || null,
      error_message: log.error_message || null,
      raw_payload: log.raw_payload || null,
      processed: log.processed ?? false,
    });
  } catch (e) {
    console.error("Failed to insert webhook log:", e);
  }
}

const MAX_PAYLOAD_SIZE = 100 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");

    if (!accessToken) {
      try {
        const svcClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data } = await svcClient
          .from("saas_settings")
          .select("value")
          .eq("key", "mercadopago_access_token_encrypted")
          .single();
        if (data?.value) {
          const { decrypt } = await import("../_shared/encryption.ts");
          accessToken = await decrypt(data.value as string);
        }
      } catch (e) {
        console.warn("Failed to read access token from DB:", e);
      }
    }

    if (!accessToken) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Payment provider not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    
    if (body.length > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (webhookSecret) {
      const isValid = await validateSignature(req, body, webhookSecret);
      if (!isValid) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedNotification = NotificationSchema.safeParse(parsedBody);
    if (!parsedNotification.success) {
      console.warn("[mercadopago-webhook] invalid_payload", parsedNotification.error.flatten());
      return new Response(
        JSON.stringify({ error: "invalid_payload", issues: parsedNotification.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Cast to MercadoPagoNotification shape (passthrough preserves all fields)
    const notification = parsedNotification.data as unknown as MercadoPagoNotification;

    const { type, action, data } = notification;

    // ── Idempotency check: prevent duplicate processing ──
    const idempotencyKey = `${data.id}:${action}`;
    const { data: existingLog } = await supabase
      .from("payment_webhook_logs")
      .select("id")
      .eq("mp_id", data.id)
      .eq("event_action", action)
      .eq("processed", true)
      .maybeSingle();

    if (existingLog) {
      console.log(`[mercadopago-webhook] Duplicate event skipped: ${idempotencyKey}`);
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Subscription (preapproval) notifications ──
    if (type === "subscription_preapproval" || type === "preapproval") {
      console.log(`Processing subscription: ${action} for ${data.id}`);

      const response = await fetchFromMercadoPago(`/preapproval/${data.id}`, accessToken);
      
      if (!response.ok) {
        const errText = await response.text();
        await insertLog(supabase, {
          event_type: type, event_action: action, mp_id: data.id,
          status: "error", error_message: `MP API error: ${response.status} - ${errText}`,
          raw_payload: notification, processed: false,
        });
        return new Response(
          JSON.stringify({ error: "Failed to fetch subscription data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const preapproval: PreapprovalData = await response.json();

      let subscription: any = null;
      let findError: any = null;

      // Primary search: by mp_subscription_id or external_reference (safe against empty values)
      const primaryResult = await findSubscriptionByRef(supabase, preapproval.id, preapproval.external_reference);
      subscription = primaryResult.subscription;
      findError = primaryResult.error;

      // Fallback search: by payer_email using RPC
      if (!subscription && preapproval.payer_email) {
        subscription = await findSubscriptionByEmail(supabase, preapproval.payer_email);
        if (subscription) findError = null;
      }

      if (findError || !subscription) {
        await insertLog(supabase, {
          event_type: type, event_action: action, mp_id: data.id,
          status: mapSubscriptionStatus(preapproval.status),
          payer_email: preapproval.payer_email,
          error_message: "Assinatura não encontrada no sistema",
          raw_payload: preapproval, processed: false,
        });
        return new Response(JSON.stringify({ received: true, warning: "Subscription not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newStatus = mapSubscriptionStatus(preapproval.status);
      const updateData: Record<string, unknown> = {
        status: newStatus,
        mp_subscription_id: preapproval.id,
        mp_payer_id: String(preapproval.payer_id),
        updated_at: new Date().toISOString(),
      };

      if (preapproval.next_payment_date) {
        updateData.current_period_end = preapproval.next_payment_date;
      }
      if (preapproval.status === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("id", subscription.id);

      // Log the subscription event
      await insertLog(supabase, {
        event_type: type, event_action: action, mp_id: data.id,
        status: newStatus,
        amount: preapproval.auto_recurring?.transaction_amount,
        payer_email: preapproval.payer_email,
        organization_id: subscription.organization_id,
        organization_name: (subscription as any).organizations?.name,
        subscription_id: subscription.id,
        error_message: updateError ? `Erro ao atualizar: ${updateError.message}` : undefined,
        raw_payload: preapproval,
        processed: !updateError,
      });

      const billingMeta = {
        nome: (subscription as any).organizations?.name,
        valor: preapproval.auto_recurring?.transaction_amount,
        plano: preapproval.reason || "N/A",
      };

      if (newStatus === "active") {
        await supabase.from("organizations")
          .update({ is_active: true, blocked_at: null, block_reason: null })
          .eq("id", subscription.organization_id);
      } else if (newStatus === "cancelled") {
        await supabase.from("organizations")
          .update({ is_active: false, blocked_at: new Date().toISOString(), block_reason: "Subscription cancelled" })
          .eq("id", subscription.organization_id);
        triggerBillingNotify(supabaseUrl, supabaseServiceKey, "subscription_cancelled", subscription.organization_id, billingMeta);
      } else if (newStatus === "paused") {
        triggerBillingNotify(supabaseUrl, supabaseServiceKey, "subscription_paused", subscription.organization_id, billingMeta);
      }

      return new Response(JSON.stringify({ received: true, processed: "subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Payment notifications ──
    if (type === "payment") {
      console.log(`Processing payment: ${action} for ${data.id}`);

      const response = await fetchFromMercadoPago(`/v1/payments/${data.id}`, accessToken);
      
      if (!response.ok) {
        const errText = await response.text();
        await insertLog(supabase, {
          event_type: type, event_action: action, mp_id: data.id,
          status: "error", error_message: `MP API error: ${response.status} - ${errText}`,
          raw_payload: notification, processed: false,
        });
        return new Response(
          JSON.stringify({ error: "Failed to fetch payment data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payment: PaymentData = await response.json();

      if (!payment.external_reference) {
        console.log("Payment without external_reference, will try email fallback");
      }

      let subscription: any = null;

      if (payment.external_reference) {
        const primaryResult = await findSubscriptionByRef(supabase, payment.external_reference, payment.external_reference);
        subscription = primaryResult.subscription;
      }

      // Fallback search by payer email using RPC
      if (!subscription && payment.payer?.email) {
        subscription = await findSubscriptionByEmail(supabase, payment.payer.email);
      }

      if (!subscription) {
        await insertLog(supabase, {
          event_type: type, event_action: action, mp_id: String(payment.id),
          status: mapPaymentStatus(payment.status),
          status_detail: payment.status_detail,
          amount: payment.transaction_amount,
          payer_email: payment.payer?.email,
          error_message: "Assinatura não encontrada para este pagamento",
          raw_payload: payment, processed: false,
        });
        return new Response(JSON.stringify({ received: true, warning: "Subscription not found for payment" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentRecord = {
        subscription_id: subscription.id,
        organization_id: subscription.organization_id,
        mp_payment_id: String(payment.id),
        amount: payment.transaction_amount,
        status: mapPaymentStatus(payment.status),
        mp_payment_method: payment.payment_method_id,
        mp_payment_type: payment.payment_type_id,
        paid_at: payment.date_approved || null,
      };

      const { error: paymentError } = await supabase
        .from("subscription_payments")
        .upsert(paymentRecord, { onConflict: "mp_payment_id" });

      // Log the payment event
      await insertLog(supabase, {
        event_type: type, event_action: action, mp_id: String(payment.id),
        status: mapPaymentStatus(payment.status),
        status_detail: payment.status_detail,
        amount: payment.transaction_amount,
        payer_email: payment.payer?.email,
        organization_id: subscription.organization_id,
        organization_name: (subscription as any).organizations?.name,
        subscription_id: subscription.id,
        error_message: paymentError ? `Erro ao salvar pagamento: ${paymentError.message}` : undefined,
        raw_payload: payment,
        processed: !paymentError,
      });

      const payBillingMeta = {
        nome: (subscription as any).organizations?.name,
        valor: payment.transaction_amount,
        plano: payment.description || "N/A",
        motivo: translateStatusDetail(payment.status_detail) || payment.status_detail,
      };

      if (payment.status === "approved") {
        // Detect upgrade_free_to_paid: was the org on a free plan before this approval?
        let isFirstPaidUpgrade = false;
        try {
          const { data: prevPaidPayments } = await supabase
            .from("subscription_payments")
            .select("id")
            .eq("organization_id", subscription.organization_id)
            .eq("status", "approved")
            .gt("amount", 0)
            .neq("mp_payment_id", String(payment.id))
            .limit(1);
          isFirstPaidUpgrade = (prevPaidPayments?.length || 0) === 0 && (payment.transaction_amount || 0) > 0;
        } catch { /* ignore */ }

        await supabase.from("subscriptions")
          .update({ status: "active", overdue_since: null, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
        await supabase.from("organizations")
          .update({ is_active: true, blocked_at: null, block_reason: null })
          .eq("id", subscription.organization_id);
        triggerBillingNotify(supabaseUrl, supabaseServiceKey, "payment_approved", subscription.organization_id, payBillingMeta);
        // Affiliate commission (idempotent)
        processAffiliateCommission(supabase, subscription.organizations?.owner_user_id, subscription.id, String(payment.id), payment.transaction_amount, "approved");
        // Admin notification
        triggerAdminNotify(supabaseUrl, supabaseServiceKey, "payment_received", {
          user_name: subscription.organizations?.name,
          plan_name: payment.description || "N/A",
          amount: payment.transaction_amount?.toFixed(2),
        });
        // Admin notification: upgrade from free to paid (1st paid payment)
        if (isFirstPaidUpgrade) {
          triggerAdminNotify(supabaseUrl, supabaseServiceKey, "upgrade_free_to_paid", {
            user_name: subscription.organizations?.name,
            plan_name: payment.description || "N/A",
            amount: payment.transaction_amount?.toFixed(2),
          });
        }
      } else if (payment.status === "pending") {
        triggerBillingNotify(supabaseUrl, supabaseServiceKey, "payment_pending", subscription.organization_id, payBillingMeta);
      } else if (payment.status === "rejected") {
        // Grace period: set overdue_since if first failure, send overdue_d0 instead of generic rejected
        const currentOverdue = (subscription as any).overdue_since;
        if (!currentOverdue) {
          await supabase.from("subscriptions")
            .update({ overdue_since: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
        }
        triggerBillingNotify(supabaseUrl, supabaseServiceKey, "overdue_d0", subscription.organization_id, payBillingMeta);
      } else if (payment.status === "refunded") {
        // Refund: mark subscription as refunded, deactivate org
        const refundedAmt = payment.transaction_amount_refunded || payment.transaction_amount;
        await supabase.from("subscription_payments")
          .update({ refunded_amount: refundedAmt })
          .eq("mp_payment_id", String(payment.id));
        await supabase.from("subscriptions")
          .update({ 
            status: "refunded", 
            total_refunded: (subscription.total_refunded || 0) + refundedAmt,
            updated_at: new Date().toISOString() 
          })
          .eq("id", subscription.id);
        await supabase.from("organizations")
          .update({ is_active: false, block_reason: "Reembolso processado" })
          .eq("id", subscription.organization_id);
        // Admin notification for refund
        const refOrgName = subscription.organizations?.name || subscription.organization_id;
        await supabase.from("admin_notifications").insert({
          type: "refund",
          title: "Reembolso processado",
          message: `O cliente "${refOrgName}" teve um reembolso de R$ ${refundedAmt?.toFixed(2)}.`,
          metadata: { organization_id: subscription.organization_id, payment_id: String(payment.id), amount: refundedAmt },
        });
        triggerBillingNotify(supabaseUrl, supabaseServiceKey, "payment_refunded", subscription.organization_id, { ...payBillingMeta, valor: refundedAmt });
        // Cancel any pending affiliate commission for this payment
        processAffiliateCommission(supabase, subscription.organizations?.owner_user_id, subscription.id, String(payment.id), refundedAmt, "refunded");
        // Admin notification for cancel/refund
        triggerAdminNotify(supabaseUrl, supabaseServiceKey, "cancel_refund", {
          user_name: refOrgName,
          amount: refundedAmt?.toFixed(2),
          reason: "Reembolso processado",
        });
      } else if (payment.status === "charged_back") {
        // Chargeback: set charged_back status, block org
        await supabase.from("subscriptions")
          .update({ 
            status: "charged_back", 
            chargeback_count: (subscription.chargeback_count || 0) + 1,
            total_refunded: (subscription.total_refunded || 0) + payment.transaction_amount,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          })
          .eq("id", subscription.id);
        await supabase.from("organizations")
          .update({ 
            is_active: false, 
            blocked_at: new Date().toISOString(), 
            block_reason: "Chargeback recebido" 
          })
          .eq("id", subscription.organization_id);
        // Admin notification for chargeback
        const orgName = subscription.organizations?.name || subscription.organization_id;
        await supabase.from("admin_notifications").insert({
          type: "chargeback",
          title: "Chargeback recebido",
          message: `O cliente "${orgName}" abriu um chargeback de R$ ${payment.transaction_amount?.toFixed(2)}.`,
          metadata: { organization_id: subscription.organization_id, payment_id: String(payment.id), amount: payment.transaction_amount },
        });
        triggerBillingNotify(supabaseUrl, supabaseServiceKey, "payment_charged_back", subscription.organization_id, {
          ...payBillingMeta,
          valor: payment.transaction_amount,
          motivo: "Chargeback recebido pelo gateway de pagamento",
        });
      }

      return new Response(JSON.stringify({ received: true, processed: "payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Subscription authorized payment (recurring renewal) ──
    if (type === "subscription_authorized_payment") {
      console.log(`Processing subscription_authorized_payment: ${action} for ${data.id}`);

      const response = await fetchFromMercadoPago(`/v1/payments/${data.id}`, accessToken);
      if (response.ok) {
        const payment: PaymentData = await response.json();
        
        // Try to find subscription by external_reference
        let subscription: any = null;
        if (payment.external_reference) {
          const result = await findSubscriptionByRef(supabase, payment.external_reference, payment.external_reference);
          subscription = result.subscription;
        }

        // Fallback by payer email
        if (!subscription && payment.payer?.email) {
          subscription = await findSubscriptionByEmail(supabase, payment.payer.email);
        }

        if (!subscription) {
          await insertLog(supabase, {
            event_type: type, event_action: action, mp_id: String(payment.id),
            status: mapPaymentStatus(payment.status),
            amount: payment.transaction_amount,
            payer_email: payment.payer?.email,
            error_message: "Assinatura não encontrada para pagamento recorrente",
            raw_payload: payment, processed: false,
          });
          return new Response(JSON.stringify({ received: true, warning: "Subscription not found for recurring payment" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Upsert payment record
        await supabase.from("subscription_payments").upsert({
          subscription_id: subscription.id,
          organization_id: subscription.organization_id,
          mp_payment_id: String(payment.id),
          amount: payment.transaction_amount,
          status: mapPaymentStatus(payment.status),
          mp_payment_method: payment.payment_method_id,
          mp_payment_type: payment.payment_type_id,
          paid_at: payment.date_approved || new Date().toISOString(),
        }, { onConflict: "mp_payment_id" });

        await insertLog(supabase, {
          event_type: type, event_action: action, mp_id: String(payment.id),
          status: mapPaymentStatus(payment.status), amount: payment.transaction_amount,
          payer_email: payment.payer?.email,
          organization_id: subscription.organization_id,
          organization_name: subscription.organizations?.name,
          subscription_id: subscription.id,
          raw_payload: payment, processed: true,
        });

        if (payment.status === "approved") {
          // Reactivate + clear overdue
          await supabase.from("subscriptions")
            .update({ status: "active", overdue_since: null, updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
          await supabase.from("organizations")
            .update({ is_active: true, blocked_at: null, block_reason: null })
            .eq("id", subscription.organization_id);
          // Notify client about successful renewal payment
          triggerBillingNotify(supabaseUrl, supabaseServiceKey, "payment_approved", subscription.organization_id, {
            nome: subscription.organizations?.name,
            valor: payment.transaction_amount,
            plano: subscription.plans?.name,
          });
          // Affiliate commission on first paid renewal (idempotent via payment_id)
          processAffiliateCommission(supabase, subscription.organizations?.owner_user_id, subscription.id, String(payment.id), payment.transaction_amount, "approved");
          triggerAdminNotify(supabaseUrl, supabaseServiceKey, "payment_received", {
            user_name: subscription.organizations?.name,
            plan_name: subscription.plans?.name || "Recorrência",
            amount: payment.transaction_amount?.toFixed(2),
          });
        }
      } else {
        const errText = await response.text();
        await insertLog(supabase, {
          event_type: type, event_action: action, mp_id: data.id,
          status: "error", error_message: `MP API error: ${response.status} - ${errText}`,
          raw_payload: notification, processed: false,
        });
      }

      return new Response(JSON.stringify({ received: true, processed: "subscription_authorized_payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Unhandled notification types ──
    await insertLog(supabase, {
      event_type: type, event_action: action, mp_id: data.id,
      status: "unhandled",
      raw_payload: notification, processed: false,
    });

    return new Response(JSON.stringify({ received: true, unhandled: type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[mercadopago-webhook] error:", error, getErrorMessage(error));
    return new Response(
      JSON.stringify({ received: true, error: "internal_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
