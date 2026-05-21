/**
 * Instagram Process Event Edge Function
 * 
 * Main processing pipeline for Instagram events.
 * Receives event_id, resolves automations, executes steps sequentially.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

type MetaErrorInfo = {
  raw: string;
  status: number;
  code: number | null;
  subcode: number | null;
  type: string | null;
  message: string;
  isMessagingWindowClosed: boolean;
  isInvalidToken: boolean;
  isUnsupportedOperation: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || res.status < 500 || attempt === maxRetries) return res;
      console.warn(`[IG-Process] Attempt ${attempt} failed: ${res.status}`);
      await sleep(1000 * Math.pow(2, attempt - 1));
    } catch (e) {
      if (attempt === maxRetries) throw e;
      console.warn(`[IG-Process] Attempt ${attempt} error:`, e);
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
  throw new Error("Max retries exceeded");
}

async function validateOpenBotResponse(response: Response): Promise<{
  ok: boolean;
  error?: string;
  contentType: string;
  parsedBody: Record<string, unknown> | null;
  rawBodyPreview: string;
}> {
  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();
  const rawBodyPreview = rawBody.substring(0, 500);

  if (!response.ok) {
    return {
      ok: false,
      error: `HTTP ${response.status}: ${rawBody.substring(0, 200)}`,
      contentType,
      parsedBody: null,
      rawBodyPreview,
    };
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    const lowerBody = rawBody.toLowerCase();
    const isHtml = rawBody.trim().startsWith("<!") || lowerBody.includes("<html") || lowerBody.includes("<body");
    return {
      ok: false,
      error: isHtml
        ? `OpenBot retornou HTML em vez de JSON (status ${response.status})`
        : `Formato inesperado de resposta do OpenBot: ${contentType || "desconhecido"}`,
      contentType,
      parsedBody: null,
      rawBodyPreview,
    };
  }

  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: "OpenBot retornou JSON inválido",
      contentType,
      parsedBody: null,
      rawBodyPreview,
    };
  }

  if (parsedBody.success === false) {
    return {
      ok: false,
      error: `OpenBot retornou success:false - ${JSON.stringify(parsedBody).substring(0, 200)}`,
      contentType,
      parsedBody,
      rawBodyPreview,
    };
  }

  if (parsedBody.error) {
    return {
      ok: false,
      error: `OpenBot retornou erro: ${JSON.stringify(parsedBody.error).substring(0, 200)}`,
      contentType,
      parsedBody,
      rawBodyPreview,
    };
  }

  return {
    ok: true,
    contentType,
    parsedBody,
    rawBodyPreview,
  };
}

function parseMetaError(raw: string, status: number): MetaErrorInfo {
  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  const errorObj = (parsed?.error as Record<string, unknown> | undefined) || parsed;
  const code = typeof errorObj?.code === "number" ? errorObj.code : Number(errorObj?.code ?? NaN);
  const subcode = typeof errorObj?.error_subcode === "number"
    ? errorObj.error_subcode
    : Number(errorObj?.error_subcode ?? NaN);
  const type = errorObj?.type ? String(errorObj.type) : null;
  const message = String(
    errorObj?.message || raw || `A Meta retornou HTTP ${status}`,
  );
  const normalized = `${raw} ${message}`.toLowerCase();

  return {
    raw,
    status,
    code: Number.isFinite(code) ? code : null,
    subcode: Number.isFinite(subcode) ? subcode : null,
    type,
    message,
    isMessagingWindowClosed:
      status === 403 && (
        normalized.includes("2534022") ||
        normalized.includes("haven't opened") ||
        normalized.includes("has not opened") ||
        normalized.includes("outside the allowed window") ||
        normalized.includes("outside allowed window") ||
        normalized.includes("can't be messaged")
      ),
    isInvalidToken: Number.isFinite(code) && code === 190,
    isUnsupportedOperation: Number.isFinite(code) && code === 100,
  };
}

function describeSendDmFailure(method: string, metaError: MetaErrorInfo): string {
  if (metaError.isMessagingWindowClosed) {
    return "O Instagram só libera a próxima DM depois que o cliente responder ou clicar em um botão da conversa.";
  }

  if (metaError.isInvalidToken) {
    return "A conta do Instagram perdeu a autorização. Reconecte a conta para voltar a enviar mensagens.";
  }

  return `Falha ao enviar mensagem (${method}): ${metaError.message}`;
}

function describeLikeFailure(metaError: MetaErrorInfo): string {
  if (metaError.isInvalidToken) {
    return "Não foi possível curtir porque a conta do Instagram precisa ser reconectada.";
  }

  if (metaError.isUnsupportedOperation) {
    return "A Meta não permitiu curtir este comentário com a configuração atual da conta/app.";
  }

  return `A Meta recusou a curtida do comentário: ${metaError.message}`;
}

async function persistWaitingSession(
  supabase: ReturnType<typeof createClient>,
  params: {
    sessionId: string | null;
    organizationId: string;
    automationId: string;
    accountId: string;
    igUserScopedId: string;
    contextData: Record<string, unknown>;
    currentStepIndex: number;
  },
): Promise<string | null> {
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  if (params.sessionId) {
    await supabase.from("instagram_sessions").update({
      current_step_index: params.currentStepIndex,
      context_json: params.contextData,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", params.sessionId);

    return params.sessionId;
  }

  // Expire old sessions scoped by account_id to prevent cross-account collisions
  await supabase.from("instagram_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("organization_id", params.organizationId)
    .eq("account_id", params.accountId)
    .eq("ig_user_scoped_id", params.igUserScopedId)
    .eq("status", "active");

  const { data: newSession } = await supabase.from("instagram_sessions").insert({
    organization_id: params.organizationId,
    automation_id: params.automationId,
    account_id: params.accountId,
    ig_user_scoped_id: params.igUserScopedId,
    current_step_index: params.currentStepIndex,
    context_json: params.contextData,
    expires_at: expiresAt,
    status: "active",
  }).select("id").single();

  return newSession?.id || null;
}

// Phone validation with international DDI support
function validatePhone(text: string, defaultDdi = "55"): { valid: boolean; normalized: string | null; formatted: string | null } {
  const digits = text.replace(/[\s\-\(\)\+]/g, "");
  if (/^\d{8,15}$/.test(digits)) {
    let normalized = digits;
    if (normalized.length === 10 || normalized.length === 11) {
      normalized = defaultDdi + normalized;
    }
    const formatted = formatPhoneDisplay(normalized);
    return { valid: true, normalized, formatted };
  }
  return { valid: false, normalized: null, formatted: null };
}

// Format phone for display: +55 (19) 98322-6145
function formatPhoneDisplay(digits: string): string {
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const area = digits.slice(2, 4);
    const number = digits.slice(4);
    if (number.length === 9) {
      return `+55 (${area}) ${number.slice(0, 5)}-${number.slice(5)}`;
    }
    return `+55 (${area}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  if (digits.length >= 12) {
    const ddi = digits.slice(0, digits.length - 10);
    const area = digits.slice(digits.length - 10, digits.length - 8);
    const rest = digits.slice(digits.length - 8);
    return `+${ddi} (${area}) ${rest.slice(0, rest.length - 4)}-${rest.slice(rest.length - 4)}`;
  }
  return `+${digits}`;
}

// Evaluate keyword conditions (sync — excludes ai_intent)
function matchesCondition(
  text: string,
  condition: { match_type?: string; keywords?: string[]; media_id?: string },
  eventPayload: Record<string, unknown>
): boolean {
  // ai_intent is handled asynchronously elsewhere
  if (condition.match_type === "ai_intent") return false;

  if (!condition.keywords || condition.keywords.length === 0) return true;

  const lowerText = (text || "").toLowerCase();
  const keywords = condition.keywords.map(k => k.toLowerCase());

  switch (condition.match_type) {
    case "exact":
      return keywords.some(k => lowerText === k);
    case "regex":
      return keywords.some(k => {
        try { return new RegExp(k, "i").test(text || ""); } catch { return false; }
      });
    case "contains":
    default:
      return keywords.some(k => lowerText.includes(k));
  }
}

// Evaluate AI intent condition asynchronously
async function matchesAIIntent(
  text: string,
  intentDescription: string,
  organizationId: string,
): Promise<boolean> {
  if (!text || !intentDescription) return false;

  try {
    const { callAI } = await import("../_shared/ai-client.ts");
    const result = await callAI({
      organizationId,
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Você é um classificador de intenção. Analise a mensagem do usuário e determine se ela corresponde à intenção descrita. Responda APENAS "SIM" ou "NÃO", sem explicações.`,
        },
        {
          role: "user",
          content: `Intenção a detectar: "${intentDescription}"\n\nMensagem do usuário: "${text}"\n\nA mensagem corresponde à intenção? Responda SIM ou NÃO.`,
        },
      ],
      max_tokens: 5,
      temperature: 0,
    });

    if (!result.ok || !result.data) {
      console.warn("[IG-Process] AI intent call failed:", result.error);
      return false;
    }

    const answer = (result.data.choices?.[0]?.message?.content || "").trim().toUpperCase();
    console.log(`[IG-Process] AI intent result: "${answer}" for text: "${text.substring(0, 50)}"`);
    return answer.startsWith("SIM");
  } catch (e) {
    console.error("[IG-Process] AI intent error:", e);
    return false;
  }
}

// Check if a DM event is a "non-text" payload (template card, attachment-only) that should be skipped
function isNonTextPayload(payload: Record<string, unknown>): boolean {
  const message = payload.message as Record<string, unknown> | undefined;
  if (!message) return true;
  const text = String(message.text || "").trim();
  if (text) return false;
  const attachments = message.attachments as unknown[];
  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    return true;
  }
  return true;
}

// Default confirmation keywords
const DEFAULT_YES_KEYWORDS = ["sim", "confirmado", "ok", "correto", "yes", "confirmo", "isso", "s"];
const DEFAULT_NO_KEYWORDS = ["nao", "não", "errado", "incorreto", "no", "n", "trocar"];

function normalizeKeywordList(raw: unknown, defaults: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(k => String(k).toLowerCase().trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) return raw.split(",").map(k => k.toLowerCase().trim()).filter(Boolean);
  return defaults;
}

// ── CRM HELPER: Merge tags (never overwrite) ──
function mergeContactTags(existingTags: string[] | null, incomingTags: string[]): string[] {
  const existing = Array.isArray(existingTags) ? existingTags : [];
  return [...new Set([...existing, ...incomingTags])];
}

// ── CRM HELPER: Upsert contact by phone, merging tags ──
async function upsertCrmContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  phone: string,
  name: string | null,
  incomingTags: string[],
  instanceId?: string | null,
): Promise<string | null> {
  try {
    // First fetch existing contact to merge tags
    const { data: existing } = await supabase
      .from("contacts")
      .select("id, tags")
      .eq("organization_id", organizationId)
      .eq("phone", phone)
      .maybeSingle();

    const mergedTags = mergeContactTags(existing?.tags as string[] | null, incomingTags);

    const upsertData: Record<string, unknown> = {
      organization_id: organizationId,
      phone,
      tags: mergedTags,
      updated_at: new Date().toISOString(),
    };
    if (name) upsertData.name = name;
    if (instanceId) upsertData.instance_id = instanceId;

    const { data: contact } = await supabase
      .from("contacts")
      .upsert(upsertData, { onConflict: "organization_id,phone" })
      .select("id")
      .single();

    return contact?.id || existing?.id || null;
  } catch (err) {
    console.error("[IG-Process] upsertCrmContact error:", err);
    return null;
  }
}

// ── CRM HELPER: Ensure conversation exists ──
async function ensureConversation(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  instanceId?: string | null,
  preview?: string,
): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .limit(1)
      .maybeSingle();

    if (existing) return existing.id;

    const now = new Date().toISOString();
    const { data: newConv } = await supabase.from("conversations").insert({
      contact_id: contactId,
      instance_id: instanceId || null,
      status: "active",
      last_message_at: now,
      last_message_preview: preview || "[Instagram]",
      last_sender_type: "ia",
    }).select("id").single();

    return newConv?.id || null;
  } catch (err) {
    console.error("[IG-Process] ensureConversation error:", err);
    return null;
  }
}

// ── CRM HELPER: Append message ──
async function appendCrmMessage(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  content: string,
  direction: "inbound" | "outbound",
  senderType: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    // Map "system" to "ia" since the enum only accepts customer|ia|attendant
    const validSenderType = senderType === "system" ? "ia" : senderType;
    const senderName = senderType === "system" ? "Instagram Bot" : undefined;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      content,
      direction,
      sender_type: validSenderType,
      sender_name: senderName || null,
      content_type: "text",
      status: direction === "outbound" ? "sent" : "delivered",
      metadata: metadata || null,
    });

    // Update conversation preview
    const preview = content.substring(0, 100);
    await supabase.from("conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      last_sender_type: validSenderType as "customer" | "ia" | "attendant",
      updated_at: new Date().toISOString(),
    }).eq("id", conversationId);
  } catch (err) {
    console.error("[IG-Process] appendCrmMessage error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 0. Fetch event to get organization_id for feature check
    const { data: eventPeek } = await supabase
      .from("instagram_events")
      .select("organization_id")
      .eq("id", event_id)
      .single();

    if (eventPeek?.organization_id) {
      const { getOrgFeatures } = await import("../_shared/getOrgFeatures.ts");
      const features = await getOrgFeatures(supabase, eventPeek.organization_id);
      if (!features.includes("automations")) {
        console.log(`[IG-Process] Feature 'automations' not available for org ${eventPeek.organization_id}, skipping`);
        return new Response(JSON.stringify({ skipped: true, reason: "Feature not available in current plan" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Fetch event
    const { data: event, error: eventErr } = await supabase
      .from("instagram_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      console.error("[IG-Process] Event not found:", event_id);
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.status !== "received") {
      console.log("[IG-Process] Event already processed:", event.status);
      return new Response(JSON.stringify({ skipped: true, status: event.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Mark as processing
    await supabase.from("instagram_events").update({ status: "processing" }).eq("id", event_id);

    const payload = event.payload_json as Record<string, unknown>;
    const eventType = event.event_type;
    const organizationId = event.organization_id;
    const accountId = event.account_id;

    // Get access token for this account
    const { data: account } = await supabase
      .from("instagram_accounts")
      .select("access_token_encrypted, ig_user_id")
      .eq("id", accountId)
      .single();

    if (!account) {
      await supabase.from("instagram_events").update({
        status: "error", error_message: "Account not found", processed_at: new Date().toISOString(),
      }).eq("id", event_id);
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken: string;
    try {
      accessToken = await decrypt(account.access_token_encrypted);
    } catch (e) {
      console.error("[IG-Process] Failed to decrypt token:", e);
      await supabase.from("instagram_events").update({
        status: "error", error_message: "Token decryption failed", processed_at: new Date().toISOString(),
      }).eq("id", event_id);
      return new Response(JSON.stringify({ error: "Token decryption failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract sender info from payload based on event type
    let igUserScopedId = "";
    let messageText = "";

    if (eventType === "dm" || eventType === "message_edit") {
      const sender = payload.sender as Record<string, unknown> | undefined;
      igUserScopedId = String(sender?.id || "");
      const message = payload.message as Record<string, unknown> | undefined;
      messageText = String(message?.text || "");
    } else if (eventType === "comment" || eventType === "live_comment") {
      const value = payload.value as Record<string, unknown> | undefined;
      igUserScopedId = String((value?.from as Record<string, unknown>)?.id || "");
      messageText = String(value?.text || "");
    } else if (eventType === "reaction") {
      const sender = payload.sender as Record<string, unknown> | undefined;
      igUserScopedId = String(sender?.id || "");
      const reaction = payload.reaction as Record<string, unknown> | undefined;
      messageText = String(reaction?.reaction || reaction?.emoji || "");
    } else if (eventType === "postback") {
      const sender = payload.sender as Record<string, unknown> | undefined;
      igUserScopedId = String(sender?.id || "");
      const postback = payload.postback as Record<string, unknown> | undefined;
      messageText = String(postback?.payload || postback?.title || "");
    } else if (eventType === "referral") {
      const sender = payload.sender as Record<string, unknown> | undefined;
      igUserScopedId = String(sender?.id || "");
      const referral = payload.referral as Record<string, unknown> | undefined;
      messageText = String(referral?.ref || "");
    } else if (eventType === "seen") {
      const sender = payload.sender as Record<string, unknown> | undefined;
      igUserScopedId = String(sender?.id || "");
    } else if (eventType === "optin") {
      const sender = payload.sender as Record<string, unknown> | undefined;
      igUserScopedId = String(sender?.id || "");
      const optin = payload.optin as Record<string, unknown> | undefined;
      messageText = String(optin?.payload || "");
    } else if (eventType === "handover") {
      const sender = payload.sender as Record<string, unknown> | undefined;
      igUserScopedId = String(sender?.id || "")
    }

    // Skip echo messages (messages sent by the page itself)
    if (eventType === "dm") {
      const message = payload.message as Record<string, unknown> | undefined;
      if (message?.is_echo === true) {
        console.log("[IG-Process] Skipping echo DM (defense-in-depth), event:", event_id);
        await supabase.from("instagram_events").update({
          status: "skipped", processed_at: new Date().toISOString(),
        }).eq("id", event_id);
        return new Response(JSON.stringify({ skipped: true, reason: "echo" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Defense-in-depth: skip if DM sender is the page itself
      if (igUserScopedId && igUserScopedId === account.ig_user_id) {
        console.log("[IG-Process] Skipping self-DM (sender matches page ig_user_id), event:", event_id);
        await supabase.from("instagram_events").update({
          status: "skipped", processed_at: new Date().toISOString(),
        }).eq("id", event_id);
        return new Response(JSON.stringify({ skipped: true, reason: "self_dm" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Defense-in-depth: skip self-comments at process level
    if (eventType === "comment" || eventType === "live_comment") {
      const value = payload.value as Record<string, unknown> | undefined;
      const commentFromId = String((value?.from as Record<string, unknown>)?.id || "");
      if (commentFromId && commentFromId === account.ig_user_id) {
        console.log(`[IG-Process] Skipping self-${eventType} (defense-in-depth), event:`, event_id);
        await supabase.from("instagram_events").update({
          status: "skipped", processed_at: new Date().toISOString(),
        }).eq("id", event_id);
        return new Response(JSON.stringify({ skipped: true, reason: `self_${eventType}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Analytics-only events: persist and return ──
    if (eventType === "seen") {
      console.log("[IG-Process] Persisting 'seen' event for analytics:", event_id);
      await supabase.from("instagram_events").update({
        status: "processed", processed_at: new Date().toISOString(),
      }).eq("id", event_id);
      return new Response(JSON.stringify({ processed: true, analytics_only: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Handover: mark as processed (no automation trigger) ──
    if (eventType === "handover") {
      console.log("[IG-Process] Handover event received:", event_id);
      await supabase.from("instagram_events").update({
        status: "processed", processed_at: new Date().toISOString(),
      }).eq("id", event_id);
      await logAction(supabase, {
        organizationId, eventId: event_id, automationId: "",
        sessionId: null, actionType: "handover", actionIndex: -1,
        status: "success",
        humanSummary: "Evento de transferência de atendimento recebido",
      });
      return new Response(JSON.stringify({ processed: true, event_type: "handover" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Optin: register recurring notification permission ──
    if (eventType === "optin" && igUserScopedId) {
      const optin = payload.optin as Record<string, unknown> | undefined;
      const optinPayload = String(optin?.payload || "");
      const optinType = String(optin?.type || "");
      const optinToken = optin?.one_time_notif_token as string || optin?.notification_messages_token as string || null;

      // Update lead with optin info
      if (optinToken) {
        await supabase.from("instagram_leads")
          .update({
            metadata: { optin_token: optinToken, optin_type: optinType, optin_payload: optinPayload },
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId)
          .eq("ig_user_scoped_id", igUserScopedId);
      }

      await supabase.from("instagram_events").update({
        status: "processed", processed_at: new Date().toISOString(),
      }).eq("id", event_id);

      await logAction(supabase, {
        organizationId, eventId: event_id, automationId: "",
        sessionId: null, actionType: "optin", actionIndex: -1,
        status: "success",
        humanSummary: `Permissão de notificação recorrente recebida${optinToken ? " (token salvo)" : ""}`,
      });

      return new Response(JSON.stringify({ processed: true, event_type: "optin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Message Edit: update session variable if active ──
    if (eventType === "message_edit" && igUserScopedId) {
      const message = payload.message as Record<string, unknown> | undefined;
      const editedText = String(message?.text || "");
      
      // Find active session and update the most recent variable
      const { data: activeSession } = await supabase
        .from("instagram_sessions")
        .select("id, context_json, current_step_index")
        .eq("organization_id", organizationId)
        .eq("ig_user_scoped_id", igUserScopedId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSession && editedText) {
        const ctx = (activeSession.context_json as Record<string, unknown>) || {};
        // Update the last step_* variable or well-known variable
        const stepKeys = Object.keys(ctx).filter(k => k.startsWith("step_")).sort();
        const lastKey = stepKeys[stepKeys.length - 1];
        if (lastKey) {
          ctx[lastKey] = editedText;
          await supabase.from("instagram_sessions").update({
            context_json: ctx,
            updated_at: new Date().toISOString(),
          }).eq("id", activeSession.id);
          console.log(`[IG-Process] Updated ${lastKey} from message edit`);
        }
      }

      await supabase.from("instagram_events").update({
        status: "processed", processed_at: new Date().toISOString(),
      }).eq("id", event_id);

      await logAction(supabase, {
        organizationId, eventId: event_id, automationId: "",
        sessionId: activeSession?.id || null, actionType: "message_edit", actionIndex: -1,
        status: "success",
        humanSummary: `Mensagem editada${activeSession ? " (variável atualizada na sessão)" : " (sem sessão ativa)"}`,
      });

      return new Response(JSON.stringify({ processed: true, event_type: "message_edit" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FILTER: Skip non-text DM payloads (template cards, attachment-only) ──
    if (eventType === "dm" && isNonTextPayload(payload)) {
      console.log("[IG-Process] Skipping non-text DM payload for event:", event_id);
      await supabase.from("instagram_events").update({
        status: "skipped", processed_at: new Date().toISOString(),
      }).eq("id", event_id);
      await logAction(supabase, {
        organizationId, eventId: event_id, automationId: "",
        sessionId: null, actionType: "filter_non_text", actionIndex: -1,
        status: "skipped",
        humanSummary: "Evento ignorado: payload sem texto (cartão automático ou anexo sem texto)",
      });
      return new Response(JSON.stringify({ skipped: true, reason: "non_user_text_payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Instagram profile (name/username) for this user
    let igProfileName: string | null = null;
    let igProfileHandle: string | null = null;
    let igProfilePicUrl: string | null = null;
    if (igUserScopedId) {
      try {
        const profileRes = await fetch(
          `${GRAPH_BASE}/${igUserScopedId}?fields=name,username,profile_pic`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          igProfileName = profileData.name || null;
          igProfileHandle = profileData.username || null;
          igProfilePicUrl = profileData.profile_pic || null;
          console.log(`[IG-Process] Profile fetched: ${igProfileName} (@${igProfileHandle})`);
        } else {
          console.warn(`[IG-Process] Could not fetch profile for ${igUserScopedId}: ${profileRes.status}`);
        }
      } catch (profileErr) {
        console.warn("[IG-Process] Profile fetch error:", profileErr);
      }
    }

    // ── CRM SYNC: Mirror DM into CRM tables (channel=instagram) ──
    if (eventType === "dm" && igUserScopedId) {
      try {
        // Locate or auto-create CRM instance bound to this Instagram account
        let { data: crmInstance } = await supabase
          .from("instances")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("instagram_account_id", accountId)
          .eq("channel", "instagram")
          .maybeSingle();

        if (!crmInstance) {
          const { data: created } = await supabase.from("instances").insert({
            organization_id: organizationId,
            instagram_account_id: accountId,
            channel: "instagram",
            provider: "instagram_dm",
            name: account.username ? `@${account.username}` : `Instagram ${accountId.slice(0, 8)}`,
            status: "connected",
          }).select("id").single();
          crmInstance = created;
        }

        if (crmInstance) {
          const displayName = igProfileName || (igProfileHandle ? `@${igProfileHandle}` : null);

          // Upsert contact by (organization_id, channel='instagram', ig_user_scoped_id)
          let { data: existingContact } = await supabase
            .from("contacts")
            .select("id, tags, name, avatar_url")
            .eq("organization_id", organizationId)
            .eq("channel", "instagram")
            .eq("ig_user_scoped_id", igUserScopedId)
            .maybeSingle();

          let crmContactId: string | null = existingContact?.id || null;
          const isNewContact = !crmContactId;

          if (!crmContactId) {
            // Resolve default pipeline stage for new IG contact (parity with WhatsApp)
            let defaultStageId: string | null = null;
            try {
              const { data: defaultPipeline } = await supabase
                .from("pipelines")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("is_default", true)
                .maybeSingle();
              if (defaultPipeline) {
                const { data: firstStage } = await supabase
                  .from("stages")
                  .select("id")
                  .eq("pipeline_id", defaultPipeline.id)
                  .order("order_index")
                  .limit(1)
                  .maybeSingle();
                defaultStageId = firstStage?.id || null;
              }
            } catch (e) {
              console.warn("[instagram-process-event] default stage lookup failed:", e);
            }

            const { data: inserted } = await supabase.from("contacts").insert({
              organization_id: organizationId,
              channel: "instagram",
              ig_user_scoped_id: igUserScopedId,
              instance_id: crmInstance.id,
              name: displayName,
              avatar_url: igProfilePicUrl,
              tags: ["instagram"],
              pipeline_stage_id: defaultStageId,
              last_interaction_at: new Date().toISOString(),
            }).select("id").single();
            crmContactId = inserted?.id || null;

            // Lead rotation (parity with WhatsApp crm-openbot-inbound)
            if (crmContactId) {
              try {
                const { data: rotationConfigs } = await supabase
                  .from("lead_rotation_config")
                  .select("id, team_profile_id, keyword_filter, last_assigned_member_id")
                  .eq("organization_id", organizationId)
                  .eq("is_enabled", true);

                if (rotationConfigs && rotationConfigs.length > 0) {
                  // Match keyword against the inbound message text (parity with WhatsApp).
                  // Falls back to profile name/handle if message text is empty (e.g. media-only DMs).
                  const contentLower = (messageText || igProfileName || igProfileHandle || "").toLowerCase();
                  for (const config of rotationConfigs) {
                    if (config.keyword_filter && !contentLower.includes(String(config.keyword_filter).toLowerCase())) {
                      continue;
                    }
                    const { data: activeMembers } = await supabase
                      .from("team_members")
                      .select("id, user_id")
                      .eq("organization_id", organizationId)
                      .eq("team_profile_id", config.team_profile_id)
                      .eq("is_active", true)
                      .order("created_at");

                    if (!activeMembers || activeMembers.length === 0) continue;

                    let nextIndex = 0;
                    if (config.last_assigned_member_id) {
                      const lastIdx = activeMembers.findIndex((m: { id: string }) => m.id === config.last_assigned_member_id);
                      nextIndex = lastIdx >= 0 ? (lastIdx + 1) % activeMembers.length : 0;
                    }
                    const assignedMember = activeMembers[nextIndex];

                    await supabase
                      .from("contacts")
                      .update({ assigned_to_member_id: assignedMember.id })
                      .eq("id", crmContactId);

                    await supabase
                      .from("lead_rotation_config")
                      .update({ last_assigned_member_id: assignedMember.id })
                      .eq("id", config.id);

                    // Also assign the conversation (when it already exists) so the
                    // member sees it under "Minhas conversas" in the CRM (parity with WhatsApp).
                    const { data: existingConvForAssign } = await supabase
                      .from("conversations")
                      .select("id")
                      .eq("contact_id", crmContactId)
                      .eq("instance_id", crmInstance.id)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    if (existingConvForAssign) {
                      await supabase
                        .from("conversations")
                        .update({ assigned_to: assignedMember.user_id })
                        .eq("id", existingConvForAssign.id);
                    }

                    console.log("[instagram-process-event] Lead rotation assigned:", assignedMember.id);
                    break; // first matching rotation config wins
                  }
                }
              } catch (e) {
                console.warn("[instagram-process-event] lead rotation failed:", e);
              }
            }
          } else {
            const updates: Record<string, unknown> = {
              last_interaction_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              instance_id: crmInstance.id,
            };
            if (!existingContact?.name && displayName) updates.name = displayName;
            if (!existingContact?.avatar_url && igProfilePicUrl) updates.avatar_url = igProfilePicUrl;
            await supabase.from("contacts").update(updates).eq("id", crmContactId);
          }

          if (crmContactId) {
            // Locate active conversation for this contact + IG instance
            let { data: conv } = await supabase
              .from("conversations")
              .select("id, unread_count")
              .eq("contact_id", crmContactId)
              .eq("instance_id", crmInstance.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const dmWindowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const messageObj = (payload.message as Record<string, unknown> | undefined) || {};
            const inboundText = String(messageObj.text || "").trim();
            const attachments = (messageObj.attachments as Array<Record<string, unknown>> | undefined) || [];
            const firstAttachment = attachments[0];
            const attachType = firstAttachment ? String(firstAttachment.type || "") : "";
            const attachUrl = firstAttachment
              ? String((firstAttachment.payload as Record<string, unknown> | undefined)?.url || "")
              : "";

            let crmContent = inboundText;
            let crmContentType: "text" | "image" | "video" | "audio" | "document" = "text";
            if (!inboundText && firstAttachment) {
              if (attachType === "image") { crmContentType = "image"; crmContent = "📷 Imagem"; }
              else if (attachType === "video") { crmContentType = "video"; crmContent = "🎥 Vídeo"; }
              else if (attachType === "audio") { crmContentType = "audio"; crmContent = "🎵 Áudio"; }
              else if (attachType === "story_mention") { crmContent = "📖 Mencionou em um story"; }
              else if (attachType === "share") { crmContent = "🔗 Compartilhou"; }
              else { crmContent = `[${attachType || "anexo"}]`; }
            }

            const preview = (crmContent || "[Instagram]").substring(0, 100);

            if (!conv) {
              const { data: newConv } = await supabase.from("conversations").insert({
                contact_id: crmContactId,
                instance_id: crmInstance.id,
                channel: "instagram",
                status: "active",
                last_message_at: new Date().toISOString(),
                last_message_preview: preview,
                last_sender_type: "customer",
                unread_count: 1,
                dm_window_expires_at: dmWindowExpires,
              }).select("id, unread_count").single();
              conv = newConv;
            } else {
              await supabase.from("conversations").update({
                last_message_at: new Date().toISOString(),
                last_message_preview: preview,
                last_sender_type: "customer",
                unread_count: (conv.unread_count || 0) + 1,
                dm_window_expires_at: dmWindowExpires,
                channel: "instagram",
                updated_at: new Date().toISOString(),
              }).eq("id", conv.id);
            }

            if (conv) {
              const messageId = String(messageObj.mid || "");
              await supabase.from("messages").insert({
                conversation_id: conv.id,
                organization_id: organizationId,
                content: crmContent || "[Instagram DM]",
                content_type: crmContentType,
                direction: "inbound",
                sender_type: "customer",
                sender_name: displayName,
                status: "delivered",
                timestamp: new Date().toISOString(),
                openbot_message_id: messageId || null,
                media_url: attachUrl || null,
                metadata: { source: "instagram_dm", ig_attachment_type: attachType || null },
              });
              console.log("[IG-Process] CRM mirror: DM persisted into conversation", conv.id);
            }
          }
        }
      } catch (crmErr) {
        // Never block automation processing on CRM mirroring failures
        console.error("[IG-Process] CRM mirror error (non-fatal):", crmErr);
      }
    }


    // ── HUMAN HANDOVER: Check if CRM contact has 'human' tag → pause automations ──
    // When a contact is tagged "human" in the CRM, all Instagram automations
    // must NOT respond. The DM/comment is still mirrored to CRM (handled above)
    // for manual reply, but no automation step is executed.
    if (eventType === "dm" && igUserScopedId) {
      try {
        const { data: humanContact } = await supabase
          .from("contacts")
          .select("id, tags")
          .eq("organization_id", organizationId)
          .eq("channel", "instagram")
          .eq("ig_user_scoped_id", igUserScopedId)
          .maybeSingle();

        const humanTags = (humanContact?.tags as string[] | null) || [];
        const hasHumanTag = humanTags.some(
          (t) => typeof t === "string" && t.toLowerCase().trim() === "human"
        );

        if (hasHumanTag) {
          console.log(`[IG-Process] HUMAN HANDOVER: contact ${humanContact?.id} has 'human' tag → skipping automation`);
          await logExecution({
            organizationId, eventId: event_id, automationId: "",
            sessionId: null, actionType: "human_handover", actionIndex: -1,
            status: "skipped",
            humanSummary: "Automação pausada: contato marcado como 'human' (atendimento humano).",
          });
          await supabase.from("instagram_events").update({
            status: "skipped",
            processed_at: new Date().toISOString(),
          }).eq("id", event_id);

          return new Response(
            JSON.stringify({ skipped: true, reason: "human_handover", contact_id: humanContact?.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (humanErr) {
        // Never block automation on this safety check failing
        console.warn("[IG-Process] human-tag check failed (non-fatal):", humanErr);
      }
    }


    // 3. Check for active session (DMs only)
    let automation: Record<string, unknown> | null = null;
    let definition: Record<string, unknown> | null = null;
    let sessionId: string | null = null;
    let currentStepIndex = 0;
    let contextData: Record<string, unknown> = {};

    if ((eventType === "dm" || eventType === "reaction" || eventType === "postback" || eventType === "referral") && igUserScopedId) {
      // Primary lookup: by ig_user_scoped_id + account_id (prevents cross-account collisions)
      let activeSession: Record<string, unknown> | null = null;
      const { data: primarySession } = await supabase
        .from("instagram_sessions")
        .select("*")
        .eq("ig_user_scoped_id", igUserScopedId)
        .eq("organization_id", organizationId)
        .eq("account_id", accountId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      activeSession = primarySession;

      // Fallback 0: If DM scoped ID differs from comment scoped ID, check if a lead maps this DM ID to a different IGSID
      if (!activeSession && eventType === "dm") {
        const { data: leadByDm } = await supabase
          .from("instagram_leads")
          .select("ig_user_scoped_id")
          .eq("organization_id", organizationId)
          .filter("metadata->>dm_scoped_id", "eq", igUserScopedId)
          .limit(1)
          .maybeSingle();

        if (leadByDm && leadByDm.ig_user_scoped_id !== igUserScopedId) {
          const { data: mappedSession } = await supabase
            .from("instagram_sessions")
            .select("*")
            .eq("ig_user_scoped_id", leadByDm.ig_user_scoped_id)
            .eq("organization_id", organizationId)
            .eq("account_id", accountId)
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (mappedSession) {
            console.log(`[IG-Process] Found session ${mappedSession.id} via lead dm_scoped_id mapping (dm=${igUserScopedId} → comment=${leadByDm.ig_user_scoped_id})`);
            activeSession = mappedSession;
            await supabase.from("instagram_sessions").update({
              ig_user_scoped_id: igUserScopedId,
              updated_at: new Date().toISOString(),
            }).eq("id", mappedSession.id);
          }
        }
      }

      // Fallback lookup: session created from a comment may have a different IGUID.
      // When we sent the Private Reply, we saved the IGSID as _ig_dm_recipient_id in context_json.
      if (!activeSession) {
        console.log(`[IG-Process] No session by ig_user_scoped_id=${igUserScopedId}, trying fallback by _ig_dm_recipient_id (account=${accountId})`);
        const { data: fallbackSession } = await supabase
          .from("instagram_sessions")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("account_id", accountId)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .filter("context_json->>_ig_dm_recipient_id", "eq", igUserScopedId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackSession) {
          console.log(`[IG-Process] Found session ${fallbackSession.id} via _ig_dm_recipient_id fallback. Updating ig_user_scoped_id.`);
          activeSession = fallbackSession;
          await supabase.from("instagram_sessions").update({
            ig_user_scoped_id: igUserScopedId,
            updated_at: new Date().toISOString(),
          }).eq("id", fallbackSession.id);
        }
      }

      // Fallback 3: Instagram may assign different scoped IDs for comments vs DMs.
      // When a user comments (IGSID-A) and we send a Private Reply, they may respond
      // via DM with a completely different IGSID-B. Neither primary nor _ig_dm_recipient_id
      // fallback will match. Search for sessions awaiting an inbound DM.
      if (!activeSession && eventType === "dm") {
        console.log(`[IG-Process] Trying fallback 3: awaiting_inbound_dm sessions for account ${accountId}`);
        const { data: awaitingSessions } = await supabase
          .from("instagram_sessions")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("account_id", accountId)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .filter("context_json->>_awaiting_inbound_dm", "eq", "true")
          .order("updated_at", { ascending: false })
          .limit(10);

        if (awaitingSessions && awaitingSessions.length > 0) {
          // If only one session is awaiting, it's the match
          let matched = awaitingSessions.length === 1 ? awaitingSessions[0] : null;

          // If multiple, try to narrow by checking the lead table for a known mapping
          if (!matched && awaitingSessions.length > 1) {
            const { data: lead } = await supabase
              .from("instagram_leads")
              .select("ig_user_scoped_id, metadata")
              .eq("organization_id", organizationId)
              .filter("metadata->>dm_scoped_id", "eq", igUserScopedId)
              .limit(1)
              .maybeSingle();

            if (lead) {
              matched = awaitingSessions.find(
                (s: Record<string, unknown>) => s.ig_user_scoped_id === lead.ig_user_scoped_id
              ) || null;
            }
          }

          if (matched) {
            console.log(`[IG-Process] Found session ${matched.id} via awaiting_inbound_dm fallback (IGSID mismatch: comment=${matched.ig_user_scoped_id}, dm=${igUserScopedId})`);
            activeSession = matched;
            // Normalize the session for future lookups
            await supabase.from("instagram_sessions").update({
              ig_user_scoped_id: igUserScopedId,
              updated_at: new Date().toISOString(),
            }).eq("id", matched.id);

            // Save DM scoped ID mapping in the lead for future reference
            const commentIgsid = matched.ig_user_scoped_id as string;
            const { data: existingLead } = await supabase
              .from("instagram_leads")
              .select("metadata")
              .eq("organization_id", organizationId)
              .eq("ig_user_scoped_id", commentIgsid)
              .maybeSingle();

            if (existingLead) {
              const updatedMeta = { ...(existingLead.metadata as Record<string, unknown> || {}), dm_scoped_id: igUserScopedId };
              await supabase.from("instagram_leads")
                .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
                .eq("organization_id", organizationId)
                .eq("ig_user_scoped_id", commentIgsid);
              console.log(`[IG-Process] Saved dm_scoped_id=${igUserScopedId} in lead for comment IGSID ${commentIgsid}`);
            }
          }
        }
      }

      if (activeSession) {
        sessionId = activeSession.id;
        currentStepIndex = activeSession.current_step_index;
        contextData = (activeSession.context_json as Record<string, unknown>) || {};
        console.log(`[IG-Process] Resuming session ${sessionId}, stepIndex=${currentStepIndex}, contextKeys=${Object.keys(contextData).join(",")}`);


        if (activeSession.automation_id) {
          const { data: automationData } = await supabase
            .from("instagram_automations")
            .select("*")
            .eq("id", activeSession.automation_id)
            .single();
          if (automationData) {
            automation = automationData;
            definition = automationData.definition_json as Record<string, unknown>;
          }
        }
      }
    }

    // 4. If no active session, find matching automation
    if (!automation) {
      // Build trigger type map for matching automations
      const triggerTypeMap: Record<string, string[]> = {
        dm: ["dm", "dm_received"],
        comment: ["comment", "comment_received"],
        live_comment: ["live_comment", "comment", "comment_received"],
        reaction: ["reaction"],
        postback: ["postback"],
        referral: ["referral"],
      };
      const triggerTypes = triggerTypeMap[eventType] || [eventType];
      const { data: automations } = await supabase
        .from("instagram_automations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_enabled", true)
        .in("trigger_type", triggerTypes)
        .order("created_at", { ascending: true });

      if (automations && automations.length > 0) {
        // Filter automations: only match those scoped to this account or with no account_id (global)
        const applicableAutomations = automations.filter((auto: Record<string, unknown>) => 
          !auto.account_id || auto.account_id === accountId
        );

        for (const auto of applicableAutomations) {
          const def = auto.definition_json as Record<string, unknown>;
          const rawConditions = def.conditions;
          const conditionsArray = Array.isArray(rawConditions) ? rawConditions : (rawConditions ? [rawConditions] : []);
          
          // No conditions = match all
          if (conditionsArray.length === 0) {
            automation = auto;
            definition = def;
            break;
          }

          // Check each condition — ai_intent requires async call
          let matched = false;
          for (const c of conditionsArray) {
            const cond = c as Record<string, unknown>;
            const matchType = (cond.match_type || cond.match_mode) as string;
            if (matchType === "ai_intent") {
              const intentDesc = cond.ai_intent_description as string;
              if (intentDesc && await matchesAIIntent(messageText, intentDesc, organizationId)) {
                matched = true;
                break;
              }
            } else {
              if (matchesCondition(messageText, { ...cond, match_type: matchType } as any, payload)) {
                matched = true;
                break;
              }
            }
          }

          if (matched) {
            automation = auto;
            definition = def;
            break;
          }
        }
      }
    }

    if (!automation || !definition) {
      await supabase.from("instagram_events").update({
        status: "no_match", processed_at: new Date().toISOString(),
      }).eq("id", event_id);
      return new Response(JSON.stringify({ processed: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FEATURE A: Persist comment/live_comment origin in session context ──
    if ((eventType === "comment" || eventType === "live_comment") && !sessionId) {
      const value = payload.value as Record<string, unknown> | undefined;
      const originCommentId = String(value?.id || "");
      const originMediaId = String(value?.media_id || (value?.media as any)?.id || "");
      if (originCommentId) {
        contextData._origin_comment_id = originCommentId;
        contextData._origin_media_id = originMediaId;
        contextData._origin_event_type = eventType;
        console.log(`[IG-Process] Persisted ${eventType} origin: commentId=${originCommentId}, mediaId=${originMediaId}`);
      }
    }

    const interactionOpenedDmWindow = eventType === "dm" || eventType === "postback" || eventType === "reaction";
    if (interactionOpenedDmWindow && igUserScopedId) {
      contextData._dm_window_open = true;
      delete contextData._awaiting_inbound_dm;
      delete contextData._private_reply_exhausted;
    }

    // ── FEATURE B: Persist referral source in session context ──
    if (eventType === "referral" && !sessionId) {
      const referral = payload.referral as Record<string, unknown> | undefined;
      if (referral) {
        contextData._referral_ref = String(referral.ref || "");
        contextData._referral_source = String(referral.source || "");
        contextData._referral_type = String(referral.type || "");
        contextData._referral_ad_id = String(referral.ad_id || "");
        contextData._origin_event_type = "referral";
        console.log(`[IG-Process] Persisted referral origin: ref=${contextData._referral_ref}, source=${contextData._referral_source}`);
      }
    }

    // ── FEATURE C: Persist reaction info in session context ──
    if (eventType === "reaction" && !sessionId) {
      const reaction = payload.reaction as Record<string, unknown> | undefined;
      if (reaction) {
        contextData._reaction_emoji = String(reaction.reaction || reaction.emoji || "");
        contextData._reaction_action = String(reaction.action || "react");
        contextData._origin_event_type = "reaction";
      }
    }

    // ── FEATURE D: Persist postback payload in context ──
    if (eventType === "postback" && !sessionId) {
      const postback = payload.postback as Record<string, unknown> | undefined;
      if (postback) {
        contextData._postback_payload = String(postback.payload || "");
        contextData._postback_title = String(postback.title || "");
        contextData._origin_event_type = "postback";
      }
    }

    // 5. Execute steps
    const steps = (definition.steps as Array<Record<string, unknown>>) || [];
    let hasError = false;
    let errorMessage = "";

    // ── Handle awaiting_phone_confirmation state BEFORE normal step processing ──
    if (sessionId && contextData.awaiting_phone_confirmation === true) {
      const awaitingStepIndex = typeof contextData._phone_confirm_step_index === "number"
        ? contextData._phone_confirm_step_index as number
        : currentStepIndex;
      const confirmStep = steps[awaitingStepIndex];
      const phoneConfig = (confirmStep?.config as Record<string, unknown>) || {};
      const yesKeywords = normalizeKeywordList(phoneConfig.confirmation_keywords_yes, DEFAULT_YES_KEYWORDS);
      const noKeywords = normalizeKeywordList(phoneConfig.confirmation_keywords_no, DEFAULT_NO_KEYWORDS);
      const lowerMsg = messageText.toLowerCase().trim();

      if (yesKeywords.includes(lowerMsg)) {
        contextData.phone = contextData.pending_phone;
        contextData.phone_formatted = contextData.pending_phone_formatted;
        delete contextData.pending_phone;
        delete contextData.pending_phone_formatted;
        delete contextData.awaiting_phone_confirmation;
        delete contextData._phone_confirm_step_index;
        currentStepIndex = awaitingStepIndex + 1;
        await supabase.from("instagram_sessions").update({
          context_json: contextData,
          current_step_index: currentStepIndex,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);

        await logAction(supabase, {
          organizationId, eventId: event_id, automationId: automation.id as string,
          sessionId, actionType: "phone_confirmation", actionIndex: awaitingStepIndex,
          status: "success",
          humanSummary: `Telefone confirmado pelo usuário: ${contextData.phone_formatted || contextData.phone}`,
        });
      } else if (noKeywords.includes(lowerMsg)) {
        delete contextData.pending_phone;
        delete contextData.pending_phone_formatted;
        delete contextData.awaiting_phone_confirmation;
        delete contextData._phone_confirm_step_index;

        const retryStepIndex = Math.max(0, awaitingStepIndex - 1);
        await supabase.from("instagram_sessions").update({
          context_json: contextData,
          current_step_index: retryStepIndex,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);

        const retryMsg = String(phoneConfig.retry_message || "Ok, por favor envie o número correto.");
        await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: JSON.stringify({
            recipient: { id: (contextData._ig_dm_recipient_id as string) || igUserScopedId },
            message: { text: retryMsg },
          }),
        });

        await logAction(supabase, {
          organizationId, eventId: event_id, automationId: automation.id as string,
          sessionId, actionType: "phone_confirmation", actionIndex: awaitingStepIndex,
          status: "success",
          humanSummary: "Usuário rejeitou o telefone, pedindo novo número",
        });

        await supabase.from("instagram_events").update({
          status: "processed", processed_at: new Date().toISOString(),
        }).eq("id", event_id);
        return new Response(JSON.stringify({ processed: true, waiting: true, reason: "phone_rejected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const ambiguousMsg = "Responda *SIM* para confirmar ou *NÃO* para corrigir o número.";
        await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: JSON.stringify({
            recipient: { id: (contextData._ig_dm_recipient_id as string) || igUserScopedId },
            message: { text: ambiguousMsg },
          }),
        });

        await logAction(supabase, {
          organizationId, eventId: event_id, automationId: automation.id as string,
          sessionId, actionType: "phone_confirmation", actionIndex: awaitingStepIndex,
          status: "success",
          humanSummary: `Resposta ambígua do usuário: "${messageText}". Pedindo SIM/NÃO.`,
        });

        await supabase.from("instagram_events").update({
          status: "processed", processed_at: new Date().toISOString(),
        }).eq("id", event_id);
        return new Response(JSON.stringify({ processed: true, waiting: true, reason: "ambiguous_confirmation" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For existing sessions, we process the user's response for the current step
    if (sessionId && currentStepIndex > 0) {
      const currentStep = steps[currentStepIndex - 1];
      if (currentStep?.type === "ask_and_wait") {
        if (!messageText.trim()) {
          console.log("[IG-Process] Skipping ask_and_wait response: empty text");
          await supabase.from("instagram_events").update({
            status: "processed", processed_at: new Date().toISOString(),
          }).eq("id", event_id);
          return new Response(JSON.stringify({ processed: true, skipped: true, reason: "empty_response" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const stepConfig = currentStep.config as Record<string, unknown> || {};
        const varName = String(stepConfig.variable || currentStep.variable_name || `step_${currentStepIndex}`);

        if (currentStep.validation === "phone") {
          const { valid, normalized } = validatePhone(messageText);
          if (!valid) {
            const invalidMsg = String(currentStep.invalid_message || "Por favor, envie um telefone válido.");
            await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
              body: JSON.stringify({
                recipient: { id: igUserScopedId },
                message: { text: invalidMsg },
              }),
            });

            await logAction(supabase, {
              organizationId, eventId: event_id, automationId: automation.id as string,
              sessionId, actionType: "validate_phone", actionIndex: currentStepIndex - 1,
              status: "validation_failed", humanSummary: `Telefone inválido: ${messageText}`,
            });

            await supabase.from("instagram_events").update({
              status: "processed", processed_at: new Date().toISOString(),
            }).eq("id", event_id);
            return new Response(JSON.stringify({ processed: true, waiting: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          contextData[varName] = normalized;
        } else {
          contextData[varName] = messageText;
        }

        // ── CRM SYNC: Register inbound user response in CRM ──
        const phoneInContext = contextData.phone as string || contextData.telefone as string || "";
        if (phoneInContext) {
          try {
            const contactId = await upsertCrmContact(supabase, organizationId, phoneInContext, igProfileName, ["instagram"]);
            if (contactId) {
              const convId = await ensureConversation(supabase, contactId);
              if (convId) {
                await appendCrmMessage(supabase, convId, messageText, "inbound", "customer", {
                  channel: "instagram", automation_id: automation.id, event_id,
                });
              }
            }
          } catch (crmErr) {
            console.error("[IG-Process] CRM sync error in ask_and_wait response:", crmErr);
          }
        }

        await supabase.from("instagram_sessions").update({
          context_json: contextData,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
      }
    }

    // Execute remaining steps starting from currentStepIndex
    for (let i = currentStepIndex; i < steps.length; i++) {
      const step = steps[i] as Record<string, unknown>;
      const stepType = String(step.type || "");
      const startMs = Date.now();

      try {
        switch (stepType) {
        case "send_dm": {
            const stepConfig = step.config as Record<string, unknown> || {};
            let text = replaceVars(String(stepConfig.message || step.text || ""), contextData);

            // ── AI MODE: generate response dynamically using LLM ──
            const sendMode = String(stepConfig.mode || "text");
            if (sendMode === "ai_prompt") {
              const systemPrompt = replaceVars(String(stepConfig.system_prompt || stepConfig.ai_prompt || ""), contextData);
              const aiModel = String(stepConfig.ai_model || "google/gemini-2.5-flash");
              const userMsg = String(messageText || "").trim() || "(mensagem vazia)";
              if (!systemPrompt) {
                console.warn("[IG-Process] send_dm ai_prompt: system_prompt vazio, usando texto fallback");
              } else {
                try {
                  const { callAI } = await import("../_shared/ai-client.ts");
                  const aiResult = await callAI({
                    organizationId,
                    model: aiModel,
                    messages: [
                      { role: "system", content: systemPrompt },
                      { role: "user", content: userMsg },
                    ],
                    max_tokens: Number(stepConfig.ai_max_tokens) || 400,
                    temperature: Number(stepConfig.ai_temperature) || 0.7,
                  });
                  if (aiResult.ok && aiResult.data) {
                    const generated = (aiResult.data.choices?.[0]?.message?.content || "").trim();
                    if (generated) {
                      text = generated;
                      console.log(`[IG-Process] send_dm ai_prompt: generated ${text.length} chars via ${aiResult.provider}`);
                    } else {
                      console.warn("[IG-Process] send_dm ai_prompt: IA retornou vazio, usando fallback");
                    }
                  } else {
                    console.error("[IG-Process] send_dm ai_prompt: IA falhou:", aiResult.error);
                  }
                } catch (aiErr) {
                  console.error("[IG-Process] send_dm ai_prompt: exceção", aiErr);
                }
              }
            }

            // Build message payload with optional quick_replies
            const msgPayload: Record<string, unknown> = { text };
            const quickReplies = stepConfig.quick_replies as Array<{ title: string; payload: string }> | undefined;
            if (Array.isArray(quickReplies) && quickReplies.length > 0) {
              msgPayload.quick_replies = quickReplies
                .filter(qr => qr.title && qr.payload)
                .map(qr => ({ content_type: "text", title: qr.title.substring(0, 20), payload: qr.payload }));
            }

            // Check if we have an open messaging window (DM trigger) or need Private Reply (comment trigger)
            // Private Reply can only be used ONCE per comment. If reply_comment already used it, skip.
            const originEventType = contextData._origin_event_type as string || eventType;
            const originCommentId = contextData._origin_comment_id as string || "";
            const privateReplyAlreadyUsed = contextData._private_reply_used === true;
            const hasOpenDmWindow = contextData._dm_window_open === true;
            const needsPrivateReply = originEventType === "comment" && !!originCommentId && !hasOpenDmWindow && !privateReplyAlreadyUsed;
            const mustWaitForInboundDm = originEventType === "comment" && !!originCommentId && !hasOpenDmWindow && privateReplyAlreadyUsed;

            // ── BATCHING: When using private reply (1 chance only), look ahead and merge
            // consecutive send_dm steps AND a trailing ask_and_wait into the SAME single message.
            // Meta only allows 1 Private Reply per comment, so if an ask_and_wait follows the
            // send_dm we must include its question text now — otherwise it would only fire after
            // the user sent an inbound DM (which never happens because the user has nothing to reply to).
            let batchedStepCount = 0;
            let batchedAskStep = false;
            if (needsPrivateReply) {
              const batchedTexts = [text];
              let lastQuickReplies = quickReplies;
              for (let j = i + 1; j < steps.length; j++) {
                const nextStep = steps[j] as Record<string, unknown>;
                const nextType = String(nextStep.type || "");
                if (nextType === "send_dm") {
                  const nextConfig = nextStep.config as Record<string, unknown> || {};
                  const nextText = replaceVars(String(nextConfig.message || nextStep.text || ""), contextData);
                  if (nextText) batchedTexts.push(nextText);
                  const nextQr = nextConfig.quick_replies as Array<{ title: string; payload: string }> | undefined;
                  if (Array.isArray(nextQr) && nextQr.length > 0) lastQuickReplies = nextQr;
                  batchedStepCount++;
                } else if (nextType === "ask_and_wait") {
                  // Inline the question text into the same private reply, then stop batching.
                  const nextConfig = nextStep.config as Record<string, unknown> || {};
                  const askText = replaceVars(String(nextConfig.message || nextStep.message || nextStep.text || ""), contextData);
                  if (askText) batchedTexts.push(askText);
                  batchedStepCount++;
                  batchedAskStep = true;
                  break;
                } else {
                  break;
                }
              }
              if (batchedStepCount > 0) {
                text = batchedTexts.join("\n\n");
                msgPayload.text = text;
                if (Array.isArray(lastQuickReplies) && lastQuickReplies.length > 0) {
                  msgPayload.quick_replies = lastQuickReplies
                    .filter(qr => qr.title && qr.payload)
                    .map(qr => ({ content_type: "text", title: qr.title.substring(0, 20), payload: qr.payload }));
                }
                console.log(`[IG-Process] send_dm: batched ${batchedStepCount + 1} steps into single private reply${batchedAskStep ? " (inc. ask_and_wait)" : ""}`);
              }
            }

            if (mustWaitForInboundDm) {
              contextData._awaiting_inbound_dm = true;
              sessionId = await persistWaitingSession(supabase, {
                sessionId,
                organizationId,
                automationId: automation.id as string,
                accountId,
                igUserScopedId,
                contextData,
                currentStepIndex: i,
              });

              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "send_dm", actionIndex: i,
                status: "pending", latencyMs: Date.now() - startMs,
                humanSummary: "Aguardando o cliente responder na DM para liberar a próxima mensagem da automação.",
                requestJson: { recipient: igUserScopedId, text: text.substring(0, 200), method: "await_inbound_dm" },
              });

              await supabase.from("instagram_events").update({
                status: "processed", processed_at: new Date().toISOString(),
              }).eq("id", event_id);

              await supabase.from("instagram_automations").update({
                execution_count: (automation.execution_count as number || 0) + 1,
                last_executed_at: new Date().toISOString(),
              }).eq("id", automation.id);

              return new Response(JSON.stringify({ processed: true, waiting: true, deferred: true, reason: "awaiting_inbound_dm" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            let res: Response;
            let method: "private_reply" | "direct_dm" = "direct_dm";

            if (needsPrivateReply) {
              method = "private_reply";
              console.log(`[IG-Process] send_dm: using /me/messages with comment_id ${originCommentId} (no DM window)${batchedStepCount > 0 ? ` [batched ${batchedStepCount + 1} steps]` : ""}`);
              res = await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({ recipient: { comment_id: originCommentId }, message: msgPayload }),
              });

              if (res.ok) {
                contextData._dm_window_open = false;
                contextData._awaiting_inbound_dm = true;
                contextData._private_reply_used = true;
                try {
                  const resJson = await res.clone().json();
                  if (resJson.recipient_id) {
                    contextData._ig_dm_recipient_id = resJson.recipient_id;
                    console.log(`[IG-Process] send_dm: saved _ig_dm_recipient_id=${resJson.recipient_id}`);
                  }
                } catch (_) { /* ignore parse errors */ }

                // Persist waiting session at the NEXT step after the batched send_dm group.
                // Meta does NOT open the messaging window after a private_reply — we MUST pause
                // and resume only when the user replies with an inbound DM. Otherwise the
                // remaining steps (ask_and_wait, check_follower, tag_lead, save_lead, etc.)
                // would execute in the wrong order or fail with "messaging window closed".
                const nextStepIndex = i + batchedStepCount + 1;
                sessionId = await persistWaitingSession(supabase, {
                  sessionId,
                  organizationId,
                  automationId: automation.id as string,
                  accountId,
                  igUserScopedId,
                  contextData,
                  currentStepIndex: nextStepIndex,
                });

                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "send_dm", actionIndex: i,
                  status: "success", latencyMs: Date.now() - startMs,
                  humanSummary: `Resposta privada enviada: "${text.substring(0, 80)}"${batchedStepCount > 0 ? ` [batched ${batchedStepCount + 1} steps]` : ""}`,
                  requestJson: { recipient: igUserScopedId, text: text.substring(0, 200), method: "private_reply" },
                });
                if (batchedStepCount > 0) {
                  for (let b = 1; b <= batchedStepCount; b++) {
                    await logAction(supabase, {
                      organizationId, eventId: event_id, automationId: automation.id as string,
                      sessionId, actionType: "send_dm", actionIndex: i + b,
                      status: "success", latencyMs: 0,
                      humanSummary: `Mensagem incluída no batching da private reply (step ${i})`,
                    });
                  }
                }

                await supabase.from("instagram_events").update({
                  status: "processed", processed_at: new Date().toISOString(),
                }).eq("id", event_id);

                await supabase.from("instagram_automations").update({
                  execution_count: (automation.execution_count as number || 0) + 1,
                  last_executed_at: new Date().toISOString(),
                }).eq("id", automation.id);

                console.log(`[IG-Process] send_dm private_reply: paused at stepIndex=${nextStepIndex}, awaiting inbound DM to resume`);
                return new Response(JSON.stringify({ processed: true, waiting: true, deferred: true, reason: "awaiting_inbound_dm" }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            } else {
              method = "direct_dm";
              res = await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({
                  recipient: { id: (contextData._ig_dm_recipient_id as string) || igUserScopedId },
                  message: msgPayload,
                }),
              });
            }
            const sendDmErrorText = !res.ok ? await res.clone().text().catch(() => "") : "";
            const sendDmMetaError = sendDmErrorText ? parseMetaError(sendDmErrorText, res.status) : null;
            const shouldDeferDirectDm = !res.ok && !!sendDmMetaError?.isMessagingWindowClosed;

            if (shouldDeferDirectDm) {
              contextData._dm_window_open = false;
              contextData._awaiting_inbound_dm = true;
              sessionId = await persistWaitingSession(supabase, {
                sessionId,
                organizationId,
                automationId: automation.id as string,
                accountId,
                igUserScopedId,
                contextData,
                currentStepIndex: i,
              });

              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "send_dm", actionIndex: i,
                status: "pending", latencyMs: Date.now() - startMs,
                humanSummary: describeSendDmFailure(method, sendDmMetaError),
                errorMessage: sendDmMetaError.message,
                requestJson: { recipient: igUserScopedId, text: text.substring(0, 200), method },
              });

              await supabase.from("instagram_events").update({
                status: "processed", processed_at: new Date().toISOString(),
              }).eq("id", event_id);

              await supabase.from("instagram_automations").update({
                execution_count: (automation.execution_count as number || 0) + 1,
                last_executed_at: new Date().toISOString(),
              }).eq("id", automation.id);

              return new Response(JSON.stringify({ processed: true, waiting: true, deferred: true, reason: "awaiting_inbound_dm" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            if (res.ok) {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "send_dm", actionIndex: i,
                status: "success", latencyMs: Date.now() - startMs,
                humanSummary: method === "private_reply"
                  ? `Resposta privada enviada: "${text.substring(0, 80)}"`
                  : `DM enviada (${method}): "${text.substring(0, 80)}"`,
                requestJson: { recipient: igUserScopedId, text: text.substring(0, 200), method },
              });
            } else {
              throw new Error(describeSendDmFailure(method, sendDmMetaError || parseMetaError("", res.status)));
            }
            break;
          }

          case "ask_and_wait": {
            const askConfig = step.config as Record<string, unknown> || {};
            const text = replaceVars(String(askConfig.message || step.text || ""), contextData);

            // Build message payload with optional quick_replies
            const askMsgPayload: Record<string, unknown> = { text };
            const askQuickReplies = askConfig.quick_replies as Array<{ title: string; payload: string }> | undefined;
            if (Array.isArray(askQuickReplies) && askQuickReplies.length > 0) {
              askMsgPayload.quick_replies = askQuickReplies
                .filter(qr => qr.title && qr.payload)
                .map(qr => ({ content_type: "text", title: qr.title.substring(0, 20), payload: qr.payload }));
            }

            // Same Private Reply logic as send_dm for comment-originated flows
            const askOriginEventType = contextData._origin_event_type as string || eventType;
            const askOriginCommentId = contextData._origin_comment_id as string || "";
            const privateReplyExhausted = contextData._private_reply_exhausted === true;
            const askHasOpenDmWindow = contextData._dm_window_open === true;
            const askNeedsPrivateReply = askOriginEventType === "comment" && !!askOriginCommentId && !askHasOpenDmWindow && !privateReplyExhausted && contextData._private_reply_used !== true;
            const shouldPauseAskBeforeSend = askOriginEventType === "comment" && !!askOriginCommentId && !askHasOpenDmWindow && (privateReplyExhausted || contextData._private_reply_used === true);

            if (shouldPauseAskBeforeSend) {
              contextData._awaiting_inbound_dm = true;
              sessionId = await persistWaitingSession(supabase, {
                sessionId,
                organizationId,
                automationId: automation.id as string,
                accountId,
                igUserScopedId,
                contextData,
                currentStepIndex: i,
              });

              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "ask_and_wait", actionIndex: i,
                status: "pending", latencyMs: Date.now() - startMs,
                humanSummary: "A pergunta será enviada quando o cliente responder na DM e abrir a conversa.",
                requestJson: { recipient: igUserScopedId, text: text.substring(0, 200), method: "await_inbound_dm" },
              });

              await supabase.from("instagram_events").update({
                status: "processed", processed_at: new Date().toISOString(),
              }).eq("id", event_id);

              await supabase.from("instagram_automations").update({
                execution_count: (automation.execution_count as number || 0) + 1,
                last_executed_at: new Date().toISOString(),
              }).eq("id", automation.id);

              return new Response(JSON.stringify({ processed: true, waiting: true, deferred: true, reason: "awaiting_inbound_dm" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            let res: Response;
            let askMethod: "private_reply" | "direct_dm" = "direct_dm";

            if (askNeedsPrivateReply) {
              askMethod = "private_reply";
              console.log(`[IG-Process] ask_and_wait: using /me/messages with comment_id ${askOriginCommentId}`);
              res = await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({ recipient: { comment_id: askOriginCommentId }, message: askMsgPayload }),
              });
              if (res.ok) {
                contextData._dm_window_open = false;
                contextData._awaiting_inbound_dm = true;
                contextData._private_reply_used = true;
                try {
                  const resJson = await res.clone().json();
                  if (resJson.recipient_id) {
                    contextData._ig_dm_recipient_id = resJson.recipient_id;
                    console.log(`[IG-Process] ask_and_wait: saved _ig_dm_recipient_id=${resJson.recipient_id}`);
                  }
                } catch (_) { /* ignore parse errors */ }
              }
            } else {
              askMethod = "direct_dm";
              res = await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({
                  recipient: { id: (contextData._ig_dm_recipient_id as string) || igUserScopedId },
                  message: askMsgPayload,
                }),
              });
            }

            const askErrorText = !res.ok ? await res.clone().text() : null;
            const askMetaError = askErrorText ? parseMetaError(askErrorText, res.status) : null;
            const isOutsideAllowedWindow = askMetaError?.isMessagingWindowClosed === true;
            const shouldDeferAskUntilInbound = askNeedsPrivateReply && isOutsideAllowedWindow;

            if (shouldDeferAskUntilInbound) {
              contextData._dm_window_open = false;
              contextData._private_reply_exhausted = true;
              console.warn("[IG-Process] ask_and_wait deferred: outside allowed window after comment trigger; waiting inbound DM to reopen window");
            }

            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

            if (sessionId) {
              await supabase.from("instagram_sessions").update({
                current_step_index: shouldDeferAskUntilInbound ? i : i + 1,
                context_json: contextData,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
              }).eq("id", sessionId);
            } else {
              // Expire old active sessions for this user before creating new one
              await supabase.from("instagram_sessions")
                .update({ status: "expired", updated_at: new Date().toISOString() })
                .eq("organization_id", organizationId)
                .eq("account_id", accountId)
                .eq("ig_user_scoped_id", igUserScopedId)
                .eq("status", "active");

              const { data: newSession } = await supabase.from("instagram_sessions").insert({
                organization_id: organizationId,
                automation_id: automation.id as string,
                account_id: accountId,
                ig_user_scoped_id: igUserScopedId,
                current_step_index: shouldDeferAskUntilInbound ? i : i + 1,
                context_json: contextData,
                expires_at: expiresAt,
                status: "active",
              }).select("id").single();
              sessionId = newSession?.id || null;
            }

            await logAction(supabase, {
              organizationId, eventId: event_id, automationId: automation.id as string,
              sessionId, actionType: "ask_and_wait", actionIndex: i,
              status: shouldDeferAskUntilInbound ? "pending" : (res.ok ? "success" : "error"), latencyMs: Date.now() - startMs,
              humanSummary: shouldDeferAskUntilInbound
                ? describeSendDmFailure(askMethod, askMetaError!)
                : (res.ok
                  ? `Pergunta enviada, aguardando resposta: "${text.substring(0, 80)}"`
                  : describeSendDmFailure(askMethod, askMetaError || parseMetaError("", res.status))),
              errorMessage: !res.ok && !shouldDeferAskUntilInbound ? (askErrorText || "Falha no ask_and_wait") : undefined,
              requestJson: { recipient: (contextData._ig_dm_recipient_id as string) || igUserScopedId, text: text.substring(0, 200), method: askMethod },
            });

            if (!res.ok && !shouldDeferAskUntilInbound) {
              throw new Error(`ask_and_wait failed (${askMethod}): ${res.status} - ${askErrorText}`);
            }

            await supabase.from("instagram_events").update({
              status: "processed", processed_at: new Date().toISOString(),
            }).eq("id", event_id);

            await supabase.from("instagram_automations").update({
              execution_count: (automation.execution_count as number || 0) + 1,
              last_executed_at: new Date().toISOString(),
            }).eq("id", automation.id);

            return new Response(JSON.stringify({ processed: true, waiting: true, deferred: shouldDeferAskUntilInbound }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          case "save_lead": {
            const leadData: Record<string, unknown> = {
              organization_id: organizationId,
              ig_user_scoped_id: igUserScopedId,
              automation_id: automation.id as string,
              phone_normalized: contextData.phone as string || contextData.telefone as string || null,
              email: contextData.email as string || null,
              ig_name: igProfileName || contextData.nome as string || contextData.name as string || null,
              ig_handle: igProfileHandle || null,
              origin: eventType,
              status: "new",
              metadata: contextData,
              updated_at: new Date().toISOString(),
            };

            const { error: leadErr } = await supabase
              .from("instagram_leads")
              .upsert(leadData, { onConflict: "organization_id,ig_user_scoped_id" });

            if (leadErr) {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "save_lead", actionIndex: i,
                status: "error", latencyMs: Date.now() - startMs,
                humanSummary: `Erro ao salvar lead: ${leadErr.message}`,
                errorMessage: leadErr.message,
              });
              throw new Error(`save_lead failed: ${leadErr.message}`);
            }

            // ── CRM SYNC: Create/update contact in CRM if phone exists (with tag merge) ──
            const leadPhone = leadData.phone_normalized as string;
            if (leadPhone) {
              try {
                const leadName = leadData.ig_name as string || leadData.ig_handle as string || null;
                const contactId = await upsertCrmContact(supabase, organizationId, leadPhone, leadName, ["instagram"]);
                if (contactId) {
                  await ensureConversation(supabase, contactId, null, "[Lead capturado via Instagram]");
                }
                console.log(`[IG-Process] CRM contact synced for lead: ${leadPhone}`);
              } catch (crmErr) {
                console.error("[IG-Process] CRM sync error in save_lead:", crmErr);
              }
            }

            await logAction(supabase, {
              organizationId, eventId: event_id, automationId: automation.id as string,
              sessionId, actionType: "save_lead", actionIndex: i,
              status: "success", latencyMs: Date.now() - startMs,
              humanSummary: `Lead salvo${leadPhone ? " + sincronizado com CRM" : ""}`,
            });
            break;
          }

          case "tag_lead": {
            const tagConfig = step.config as Record<string, unknown> || {};
            let tags: string[] = [];
            const rawTags = tagConfig.tags || step.tags;
            if (Array.isArray(rawTags)) {
              tags = rawTags;
            } else if (typeof rawTags === "string") {
              tags = rawTags.split(",").map((t: string) => t.trim()).filter(Boolean);
            }
            if (tags.length > 0) {
              // Merge tags in instagram_leads
              const { data: existingLead } = await supabase
                .from("instagram_leads")
                .select("tags")
                .eq("organization_id", organizationId)
                .eq("ig_user_scoped_id", igUserScopedId)
                .maybeSingle();

              const existingTags = (existingLead?.tags as string[]) || [];
              const mergedTags = [...new Set([...existingTags, ...tags])];

              await supabase.from("instagram_leads")
                .update({ tags: mergedTags, updated_at: new Date().toISOString() })
                .eq("organization_id", organizationId)
                .eq("ig_user_scoped_id", igUserScopedId);

              // ── CRM SYNC: Also merge tags into CRM contact ──
              const phoneInCtx = contextData.phone as string || contextData.telefone as string || "";
              if (phoneInCtx) {
                try {
                  await upsertCrmContact(supabase, organizationId, phoneInCtx, null, tags);
                  console.log(`[IG-Process] CRM tags synced: ${tags.join(", ")}`);
                } catch (crmErr) {
                  console.error("[IG-Process] CRM tag sync error:", crmErr);
                }
              }

              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "tag_lead", actionIndex: i,
                status: "success", latencyMs: Date.now() - startMs,
                humanSummary: `Tags adicionadas: ${tags.join(", ")}${phoneInCtx ? " (CRM sincronizado)" : ""}`,
              });
            }
            break;
          }

          case "reply_comment": {
            const replyConfig = step.config as Record<string, unknown> || {};
            // Support message rotation: config.messages (array) or config.message (string)
            let replyText: string;
            const messagesArray = replyConfig.messages as string[] | undefined;
            if (Array.isArray(messagesArray) && messagesArray.length > 0) {
              const randomMsg = messagesArray[Math.floor(Math.random() * messagesArray.length)];
              replyText = replaceVars(String(randomMsg || ""), contextData);
            } else {
              replyText = replaceVars(String(replyConfig.message || step.text || ""), contextData);
            }
            const replyMode = String(replyConfig.reply_mode || "public");

            // ── FEATURE A: Resolve comment_id/media_id from payload OR session context ──
            const value = payload.value as Record<string, unknown> | undefined;
            let commentId = value?.comment_id as string || value?.id as string || "";
            let mediaId = String(value?.media_id || (value?.media as any)?.id || "");

            // Fallback to session context (when running in a DM event after comment trigger)
            if (!commentId && contextData._origin_comment_id) {
              commentId = String(contextData._origin_comment_id);
              console.log(`[IG-Process] reply_comment: using comment_id from session context: ${commentId}`);
            }
            if (!mediaId && contextData._origin_media_id) {
              mediaId = String(contextData._origin_media_id);
              console.log(`[IG-Process] reply_comment: using media_id from session context: ${mediaId}`);
            }

            if (!commentId) {
              const reason = eventType === "dm"
                ? "Step executado em evento DM sem contexto de comentário na sessão. Verifique se a automação inicia com trigger 'comment_received'."
                : "commentId não encontrado no payload do evento";
              console.error(`[IG-Process] reply_comment: ${reason}`);
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "reply_comment", actionIndex: i,
                status: "error", latencyMs: Date.now() - startMs,
                humanSummary: reason,
                errorMessage: "Missing comment_id: " + reason,
              });
              break;
            }

            if (replyMode === "private") {
              const res = await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: replyText } }),
              });

              // Private reply does NOT open the DM window by itself.
              if (res.ok) {
                contextData._dm_window_open = false;
                contextData._awaiting_inbound_dm = true;
                contextData._private_reply_used = true;
                try {
                  const resJson = await res.clone().json();
                  if (resJson.recipient_id) {
                    contextData._ig_dm_recipient_id = resJson.recipient_id;
                    console.log(`[IG-Process] reply_comment_private: saved _ig_dm_recipient_id=${resJson.recipient_id}, waiting inbound interaction`);
                  }
                } catch (_) { /* ignore parse errors */ }
                if (sessionId) {
                  await supabase.from("instagram_sessions").update({
                    context_json: contextData,
                    updated_at: new Date().toISOString(),
                  }).eq("id", sessionId);
                }
              }

              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "reply_comment_private", actionIndex: i,
                status: res.ok ? "success" : "error", latencyMs: Date.now() - startMs,
                humanSummary: res.ok
                  ? `Resposta privada enviada: "${replyText.substring(0, 80)}"`
                  : `Falha ao enviar resposta privada`,
              });
              if (!res.ok) {
                const errText = await res.text();
                throw new Error(`reply_comment private failed: ${res.status} - ${errText}`);
              }
            } else {
              // Public reply — use POST /{commentId}/replies (correct endpoint)
              if (commentId) {
                const res = await fetchWithRetry(`${GRAPH_BASE}/${commentId}/replies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                  body: JSON.stringify({ message: replyText }),
                });
                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "reply_comment_public", actionIndex: i,
                  status: res.ok ? "success" : "error", latencyMs: Date.now() - startMs,
                  humanSummary: res.ok
                    ? `Resposta pública ao comentário: "${replyText.substring(0, 80)}"`
                    : `Falha ao responder comentário público`,
                  requestJson: { commentId, replyText: replyText.substring(0, 200) },
                });
                if (!res.ok) {
                  const errText = await res.text();
                  throw new Error(`reply_comment public failed: ${res.status} - ${errText}`);
                }
              } else {
                console.error("[IG-Process] reply_comment: no commentId available for public reply");
                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "reply_comment_public", actionIndex: i,
                  status: "error", latencyMs: Date.now() - startMs,
                  humanSummary: "commentId não encontrado para resposta pública ao comentário",
                  errorMessage: "Missing comment_id for public reply",
                });
              }
            }
            break;
          }

          case "openbot_start_whatsapp": {
            const phone = contextData.phone as string || contextData.telefone as string || "";
            const normalizedPhone = phone.replace(/\D/g, "");
            const wppConfig = step.config as Record<string, unknown> || {};
            const message = replaceVars(String(wppConfig.message || step.message || step.text || ""), contextData);

            if (!normalizedPhone) {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "openbot_start_whatsapp", actionIndex: i,
                status: "error", latencyMs: Date.now() - startMs,
                humanSummary: "Telefone não encontrado no contexto",
                errorMessage: "No phone in context",
              });
              break;
            }

            // ── GUARD RAIL: Prevent duplicate OpenBot sends per session ──
            if (sessionId && contextData.openbot_sent_at) {
              const sentPhone = contextData.openbot_sent_phone as string || "";
              if (sentPhone === normalizedPhone) {
                console.log(`[IG-Process] OpenBot already sent for session ${sessionId}, phone ${normalizedPhone}. Skipping.`);
                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "openbot_start_whatsapp", actionIndex: i,
                  status: "skipped", latencyMs: Date.now() - startMs,
                  humanSummary: `WhatsApp já enviado para ${normalizedPhone.substring(0, 6)}**** nesta sessão. Duplicata ignorada.`,
                });
                break;
              }
            }

            // Get OpenBot config for org — respect instance_id from step config
            let openbotApiKeyEncrypted: string | null = null;
            let openbotSendUrl: string = OPENBOT_SEND_URL;
            let resolvedInstanceId: string | null = null;
            let resolvedOpenbotInstanceId: string | null = null;
            const configuredInstanceId = wppConfig.instance_id as string || null;

            if (configuredInstanceId) {
              const { data: selectedInstance } = await supabase
                .from("instances")
                .select("id, openbot_instance_id, openbot_api_key_encrypted")
                .eq("id", configuredInstanceId)
                .eq("organization_id", organizationId)
                .maybeSingle();

              if (selectedInstance?.openbot_api_key_encrypted) {
                openbotApiKeyEncrypted = selectedInstance.openbot_api_key_encrypted;
                resolvedInstanceId = selectedInstance.id;
                resolvedOpenbotInstanceId = selectedInstance.openbot_instance_id || null;
                console.log(`[IG-Process] Using configured instance: ${configuredInstanceId} (openbot_instance_id=${resolvedOpenbotInstanceId || "n/a"})`);
              } else {
                console.warn(`[IG-Process] Configured instance ${configuredInstanceId} not found or has no API key, falling back`);
              }
            }

            if (!openbotApiKeyEncrypted) {
              const { data: openbotConfig } = await supabase
                .from("crm_openbot_config")
                .select("openbot_api_key_encrypted, openbot_send_url")
                .eq("organization_id", organizationId)
                .maybeSingle();

              if (openbotConfig?.openbot_api_key_encrypted) {
                openbotApiKeyEncrypted = openbotConfig.openbot_api_key_encrypted;
                // Always use hardcoded OPENBOT_SEND_URL (openbotConfig.openbot_send_url may point to non-delivering endpoint)
              } else {
                const { data: instanceWithKey } = await supabase
                  .from("instances")
                  .select("id, openbot_instance_id, openbot_api_key_encrypted")
                  .eq("organization_id", organizationId)
                  .not("openbot_api_key_encrypted", "is", null)
                  .limit(1)
                  .maybeSingle();

                if (instanceWithKey?.openbot_api_key_encrypted) {
                  openbotApiKeyEncrypted = instanceWithKey.openbot_api_key_encrypted;
                  resolvedInstanceId = instanceWithKey.id;
                  resolvedOpenbotInstanceId = instanceWithKey.openbot_instance_id || null;
                  console.log("[IG-Process] Using OpenBot config from instances table");
                }
              }
            }

            if (!openbotApiKeyEncrypted) {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "openbot_start_whatsapp", actionIndex: i,
                status: "error", latencyMs: Date.now() - startMs,
                humanSummary: "Configuração OpenBot não encontrada",
                errorMessage: "No openbot config in any source",
              });
              break;
            }

            const apiKey = await decrypt(openbotApiKeyEncrypted);
            const sendUrl = openbotSendUrl;

            // Build payload with optional file attachment
            const sendPayload: Record<string, unknown> = {
              apiKey,
              phone: normalizedPhone,
              message,
              desativarFluxo: true,
            };

            if (resolvedOpenbotInstanceId) {
              sendPayload.instanceId = resolvedOpenbotInstanceId;
            }

            const fileStoragePath = wppConfig.file_storage_path as string;
            const fileName = wppConfig.file_name as string | undefined;
            if (fileStoragePath) {
              try {
                const { data: fileData, error: dlErr } = await supabase.storage
                  .from("message-media")
                  .download(fileStoragePath);
                if (dlErr || !fileData) {
                  console.error("[IG-Process] File download failed:", dlErr?.message);
                } else {
                  const arrayBuffer = await fileData.arrayBuffer();
                  const bytes = new Uint8Array(arrayBuffer);
                  // Chunked base64 conversion (safer for larger files like PDFs)
                  const chunkSize = 8192;
                  let binary = "";
                  for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
                    binary += String.fromCharCode.apply(null, Array.from(chunk));
                  }
                  const base64 = btoa(binary);
                  const mimeType = (wppConfig.file_type as string) || "application/octet-stream";
                  sendPayload.arquivo = `data:${mimeType};base64,${base64}`;
                  sendPayload.mimetype = mimeType;
                  if (fileName) sendPayload.fileName = fileName;
                  console.log(`[IG-Process] File attached: ${wppConfig.file_name}, ${mimeType}, ${(bytes.length / 1024).toFixed(1)}KB`);
                }
              } catch (fileErr) {
                console.error("[IG-Process] File processing error:", fileErr);
              }
            }

            const res = await fetchWithRetry(sendUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sendPayload),
            });

            const openbotValidation = await validateOpenBotResponse(res);

            if (!openbotValidation.ok) {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "openbot_start_whatsapp", actionIndex: i,
                status: "error", latencyMs: Date.now() - startMs,
                humanSummary: `Falha ao enviar WhatsApp para ${normalizedPhone.substring(0, 6)}****`,
                errorMessage: openbotValidation.error,
                requestJson: {
                  sendUrl,
                  instanceId: resolvedOpenbotInstanceId,
                  phoneMasked: `${normalizedPhone.substring(0, 6)}****`,
                  messagePreview: message.substring(0, 120),
                  hasFile: !!fileStoragePath,
                  fileName: fileName || null,
                  desativarFluxo: true,
                },
                responseJson: {
                  status: res.status,
                  contentType: openbotValidation.contentType,
                  body: openbotValidation.parsedBody,
                  rawBodyPreview: openbotValidation.rawBodyPreview,
                },
              });
              throw new Error(openbotValidation.error || "OpenBot rejeitou o envio");
            }

            // ── Persist openbot_sent_at guard ──
            if (sessionId) {
              contextData.openbot_sent_at = new Date().toISOString();
              contextData.openbot_sent_phone = normalizedPhone;
              await supabase.from("instagram_sessions").update({
                context_json: contextData,
                updated_at: new Date().toISOString(),
              }).eq("id", sessionId);
            }

            // ── CRM SYNC: Create contact + conversation + outbound message (with tag merge) ──
            try {
              const contactName = igProfileName || contextData.nome as string || contextData.name as string || null;
              const contactId = await upsertCrmContact(supabase, organizationId, normalizedPhone, contactName, ["instagram"], resolvedInstanceId);

              if (contactId) {
                const convId = await ensureConversation(supabase, contactId, resolvedInstanceId, message.substring(0, 100));
                if (convId) {
                  await appendCrmMessage(supabase, convId, message, "outbound", "system", {
                    channel: "instagram", automation_id: automation.id, event_id, source: "openbot_start_whatsapp",
                  });
                }
                console.log(`[IG-Process] CRM synced: contact=${contactId}`);
              }
            } catch (crmErr) {
              console.error("[IG-Process] CRM sync error in openbot_start_whatsapp:", crmErr);
            }

            await logAction(supabase, {
              organizationId, eventId: event_id, automationId: automation.id as string,
              sessionId, actionType: "openbot_start_whatsapp", actionIndex: i,
              status: "success", latencyMs: Date.now() - startMs,
              humanSummary: `WhatsApp enviado para ${normalizedPhone.substring(0, 6)}****${fileStoragePath ? " (com arquivo)" : ""} + CRM sincronizado`,
              requestJson: {
                sendUrl,
                instanceId: resolvedOpenbotInstanceId,
                phoneMasked: `${normalizedPhone.substring(0, 6)}****`,
                messagePreview: message.substring(0, 120),
                hasFile: !!fileStoragePath,
                fileName: fileName || null,
                desativarFluxo: true,
              },
              responseJson: {
                status: res.status,
                contentType: openbotValidation.contentType,
                body: openbotValidation.parsedBody,
                rawBodyPreview: openbotValidation.rawBodyPreview,
              },
            });
            break;
          }

          case "validate_phone": {
            const phoneConfig = step.config as Record<string, unknown> || {};
            const defaultDdi = String(phoneConfig.default_ddi || "55");
            const requireConfirmation = phoneConfig.require_confirmation === true;

            let rawPhone = "";

            // Level 0: Explicit source_variable from config
            const sourceVar = phoneConfig.source_variable as string | undefined;
            if (sourceVar && contextData[sourceVar]) {
              rawPhone = String(contextData[sourceVar]);
            }

            // Level 1: Well-known keys
            if (!rawPhone) {
              for (const key of ["telefone", "phone", "celular", "whatsapp", "numero", "numero_whatsapp", "contato"]) {
                if (contextData[key]) { rawPhone = String(contextData[key]); break; }
              }
            }

            // Level 2: step_* keys
            if (!rawPhone) {
              for (const [k, v] of Object.entries(contextData)) {
                if (k.startsWith("step_") && typeof v === "string" && /\d{8,}/.test(v.replace(/\D/g, ""))) {
                  rawPhone = v; break;
                }
              }
            }

            // Level 3: Scan ALL non-internal string values for phone pattern (last entry wins = most recent)
            if (!rawPhone) {
              let lastCandidate = "";
              for (const [k, v] of Object.entries(contextData)) {
                if (k.startsWith("_")) continue; // skip internal keys
                if (typeof v === "string" && /\d{8,}/.test(v.replace(/\D/g, ""))) {
                  lastCandidate = v;
                }
              }
              rawPhone = lastCandidate;
            }

            if (!rawPhone) {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "validate_phone", actionIndex: i,
                status: "error", latencyMs: Date.now() - startMs,
                humanSummary: "Nenhum telefone encontrado no contexto para validar",
              });
              break;
            }

            const { valid, normalized, formatted } = validatePhone(rawPhone, defaultDdi);
            if (valid && normalized) {
              if (requireConfirmation) {
                contextData.pending_phone = normalized;
                contextData.pending_phone_formatted = formatted || normalized;
                contextData.awaiting_phone_confirmation = true;
                contextData._phone_confirm_step_index = i;

                const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
                if (sessionId) {
                  await supabase.from("instagram_sessions").update({
                    context_json: contextData,
                    current_step_index: i,
                    expires_at: expiresAt,
                    updated_at: new Date().toISOString(),
                  }).eq("id", sessionId);
                } else {
                  // Expire old active sessions for this user before creating new one
                  await supabase.from("instagram_sessions")
                    .update({ status: "expired", updated_at: new Date().toISOString() })
                    .eq("organization_id", organizationId)
                    .eq("account_id", accountId)
                    .eq("ig_user_scoped_id", igUserScopedId)
                    .eq("status", "active");

                  const { data: newSession } = await supabase.from("instagram_sessions").insert({
                    organization_id: organizationId,
                    automation_id: automation.id as string,
                    account_id: accountId,
                    ig_user_scoped_id: igUserScopedId,
                    current_step_index: i,
                    context_json: contextData,
                    expires_at: expiresAt,
                    status: "active",
                  }).select("id").single();
                  sessionId = newSession?.id || null;
                }

                const sendConfirmation = phoneConfig.send_confirmation !== false;
                if (sendConfirmation && igUserScopedId) {
                  const confirmTemplate = String(
                    phoneConfig.confirmation_message ||
                    "O número *{phone_formatted}* está correto? Responda *SIM* para confirmar ou *NÃO* para corrigir."
                  );
                  const confirmText = confirmTemplate
                    .replace(/\{phone_formatted\}/g, formatted || normalized)
                    .replace(/\{phone\}/g, normalized);

                  await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                    body: JSON.stringify({
                      recipient: { id: (contextData._ig_dm_recipient_id as string) || igUserScopedId },
                      message: { text: confirmText },
                    }),
                  });
                }

                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "validate_phone", actionIndex: i,
                  status: "success", latencyMs: Date.now() - startMs,
                  humanSummary: `Telefone ${formatted || normalized} aguardando confirmação do usuário`,
                });

                await supabase.from("instagram_events").update({
                  status: "processed", processed_at: new Date().toISOString(),
                }).eq("id", event_id);

                await supabase.from("instagram_automations").update({
                  execution_count: (automation.execution_count as number || 0) + 1,
                  last_executed_at: new Date().toISOString(),
                }).eq("id", automation.id);

                return new Response(JSON.stringify({ processed: true, waiting: true, reason: "awaiting_phone_confirmation" }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              } else {
                contextData.phone = normalized;
                contextData.phone_formatted = formatted || normalized;
                if (sessionId) {
                  await supabase.from("instagram_sessions").update({
                    context_json: contextData, updated_at: new Date().toISOString(),
                  }).eq("id", sessionId);
                }

                const sendConfirmation = phoneConfig.send_confirmation === true;
                if (sendConfirmation && igUserScopedId) {
                  const confirmTemplate = String(
                    phoneConfig.confirmation_message ||
                    "Pode confirmar se o telefone está correto? {phone_formatted}"
                  );
                  const confirmText = confirmTemplate
                    .replace(/\{phone_formatted\}/g, formatted || normalized)
                    .replace(/\{phone\}/g, normalized);

                  await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                    body: JSON.stringify({
                      recipient: { id: (contextData._ig_dm_recipient_id as string) || igUserScopedId },
                      message: { text: confirmText },
                    }),
                  });
                }

                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "validate_phone", actionIndex: i,
                  status: "success", latencyMs: Date.now() - startMs,
                  humanSummary: `Telefone validado: ${formatted || normalized.substring(0, 6) + "****"}`,
                });
              }
            } else {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "validate_phone", actionIndex: i,
                status: "error", latencyMs: Date.now() - startMs,
                humanSummary: `Telefone inválido: ${rawPhone}`,
                errorMessage: "Invalid phone number",
              });
            }
            break;
          }

          case "like_comment": {
            // Like a comment using Instagram Graph API: POST /{ig-comment-id}/likes
            // FIX: Instagram User Tokens are not valid on graph.facebook.com (OAuthException 190).
            // Must use graph.instagram.com with the IG comment ID and Instagram User Token.
            // NON-BLOCKING: failures are logged but do NOT stop the automation flow
            const likeCommentId = contextData._origin_comment_id as string || "";
            if (likeCommentId) {
              try {
                const IG_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
                const res = await fetchWithRetry(`${IG_GRAPH_BASE}/${likeCommentId}/likes`, {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${accessToken}` },
                }, 1); // single attempt, no retries for likes
                if (res.ok) {
                  await logAction(supabase, {
                    organizationId, eventId: event_id, automationId: automation.id as string,
                    sessionId, actionType: "like_comment", actionIndex: i,
                    status: "success", latencyMs: Date.now() - startMs,
                    humanSummary: `Comentário curtido: ${likeCommentId}`,
                  });
                } else {
                  const errText = await res.text();
                  const metaError = parseMetaError(errText, res.status);
                  console.warn(`[IG-Process] like_comment failed (non-blocking): ${res.status} - ${errText.substring(0, 200)}`);
                  await logAction(supabase, {
                    organizationId, eventId: event_id, automationId: automation.id as string,
                    sessionId, actionType: "like_comment", actionIndex: i,
                    status: "error", latencyMs: Date.now() - startMs,
                    humanSummary: `${describeLikeFailure(metaError)} O fluxo continuou.`,
                    errorMessage: errText.substring(0, 500),
                  });
                }
              } catch (likeErr) {
                console.warn(`[IG-Process] like_comment exception (non-blocking):`, likeErr);
                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "like_comment", actionIndex: i,
                  status: "error", latencyMs: Date.now() - startMs,
                  humanSummary: "Erro ao curtir comentário (fluxo continua)",
                  errorMessage: String(likeErr).substring(0, 500),
                });
              }
            } else {
              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "like_comment", actionIndex: i,
                status: "skipped", latencyMs: Date.now() - startMs,
                humanSummary: "Nenhum comment_id disponível para curtir",
              });
            }
            break;
          }

          case "check_follower": {
            // Real follower verification via Graph API is_user_follow_business + button template fallback
            const cfConfig = step.config as Record<string, unknown> || {};
            const question = replaceVars(String(cfConfig.question || "Você já me segue aqui? O sistema só libera enviar para quem é seguidor..."), contextData);
            const buttonTitle = String(cfConfig.button_title || "Seguindo").substring(0, 20);
            const rejectMessage = replaceVars(String(cfConfig.reject_message || "Para receber o conteúdo, você precisa me seguir primeiro! 😊\nDepois de seguir, clique no botão abaixo."), contextData);
            const varName = String(cfConfig.variable || "follower_status");
            const rememberFollower = cfConfig.remember_follower !== false;

            // ── FOLLOWER CACHE: Check if user already confirmed ──
            if (rememberFollower && igUserScopedId && !contextData._awaiting_follower_check) {
              const { data: existingLead } = await supabase
                .from("instagram_leads")
                .select("metadata")
                .eq("organization_id", organizationId)
                .eq("ig_user_scoped_id", igUserScopedId)
                .maybeSingle();

              const leadMeta = (existingLead?.metadata as Record<string, unknown>) || {};
              if (leadMeta.follower_confirmed === true) {
                console.log(`[IG-Process] check_follower: user ${igUserScopedId} already confirmed as follower (cache), skipping`);
                contextData[varName] = "SEGUINDO";
                if (sessionId) {
                  await supabase.from("instagram_sessions").update({
                    context_json: contextData,
                    updated_at: new Date().toISOString(),
                  }).eq("id", sessionId);
                }
                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "check_follower", actionIndex: i,
                  status: "success", latencyMs: Date.now() - startMs,
                  humanSummary: "Seguidor já confirmado anteriormente (cache). Step pulado.",
                });
                break; // Continue to next step
              }
            }

            // ── Helper: Check is_user_follow_business via Graph API ──
            async function checkFollowerApi(): Promise<{ follows: boolean; apiError: boolean }> {
              try {
                const checkRes = await fetch(
                  `${GRAPH_BASE}/${igUserScopedId}?fields=is_user_follow_business&access_token=${accessToken}`,
                  { headers: { "Content-Type": "application/json" } }
                );
                if (checkRes.ok) {
                  const checkData = await checkRes.json();
                  console.log(`[IG-Process] check_follower API response:`, JSON.stringify(checkData));
                  return { follows: checkData.is_user_follow_business === true, apiError: false };
                }
                console.warn(`[IG-Process] check_follower API failed: ${checkRes.status}`);
                return { follows: false, apiError: true };
              } catch (apiErr) {
                console.warn("[IG-Process] check_follower API error:", apiErr);
                return { follows: false, apiError: true };
              }
            }

            // ── Helper: Save follower confirmed in lead metadata ──
            async function saveFollowerCache() {
              if (!rememberFollower || !igUserScopedId) return;
              const { data: leadForCache } = await supabase
                .from("instagram_leads")
                .select("metadata")
                .eq("organization_id", organizationId)
                .eq("ig_user_scoped_id", igUserScopedId)
                .maybeSingle();

              const existingMeta = (leadForCache?.metadata as Record<string, unknown>) || {};
              await supabase.from("instagram_leads")
                .upsert({
                  organization_id: organizationId,
                  ig_user_scoped_id: igUserScopedId,
                  metadata: { ...existingMeta, follower_confirmed: true, follower_confirmed_at: new Date().toISOString() },
                  updated_at: new Date().toISOString(),
                }, { onConflict: "organization_id,ig_user_scoped_id" });
            }

            // ── Helper: Send button template message ──
            async function sendFollowerButtonTemplate(text: string): Promise<Response> {
              const recipientId = (contextData._ig_dm_recipient_id as string) || igUserScopedId;
              return fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({
                  recipient: { id: recipientId },
                  message: {
                    attachment: {
                      type: "template",
                      payload: {
                        template_type: "button",
                        text,
                        buttons: [
                          { type: "postback", title: buttonTitle, payload: "CHECK_FOLLOW_STATUS" },
                        ],
                      },
                    },
                  },
                }),
              });
            }

            // ── RESUME: User clicked the postback button ──
            if (sessionId && contextData._awaiting_follower_check === true) {
              // Check if this is the CHECK_FOLLOW_STATUS postback
              const postbackPayload = (payload.postback as Record<string, unknown>)?.payload as string || messageText.trim();
              const isFollowerPostback = postbackPayload === "CHECK_FOLLOW_STATUS";

              if (isFollowerPostback) {
                // Re-verify via API
                const { follows, apiError } = await checkFollowerApi();

                if (follows) {
                  contextData[varName] = "SEGUINDO";
                  delete contextData._awaiting_follower_check;
                  await supabase.from("instagram_sessions").update({
                    context_json: contextData,
                    updated_at: new Date().toISOString(),
                  }).eq("id", sessionId);

                  await saveFollowerCache();

                  await logAction(supabase, {
                    organizationId, eventId: event_id, automationId: automation.id as string,
                    sessionId, actionType: "check_follower", actionIndex: i,
                    status: "success", latencyMs: Date.now() - startMs,
                    humanSummary: "Usuário verificado como seguidor via API (is_user_follow_business=true). Fluxo continua.",
                  });
                  break; // Continue to next step
                } else {
                  // Not following — send reinforcement message + re-send button
                  await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                    body: JSON.stringify({
                      recipient: { id: (contextData._ig_dm_recipient_id as string) || igUserScopedId },
                      message: { text: rejectMessage },
                    }),
                  });

                  // Re-send the button template
                  await sendFollowerButtonTemplate(question);

                  await logAction(supabase, {
                    organizationId, eventId: event_id, automationId: automation.id as string,
                    sessionId, actionType: "check_follower", actionIndex: i,
                    status: "success", latencyMs: Date.now() - startMs,
                    humanSummary: apiError
                      ? "API indisponível. Mensagem de reforço + botão reenviados."
                      : "Usuário NÃO segue (is_user_follow_business=false). Mensagem de reforço + botão reenviados.",
                  });

                  await supabase.from("instagram_events").update({
                    status: "processed", processed_at: new Date().toISOString(),
                  }).eq("id", event_id);

                  return new Response(JSON.stringify({ processed: true, waiting: true, reason: "follower_not_confirmed_retry" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              } else {
                // Non-postback message while awaiting — re-send button
                await sendFollowerButtonTemplate("Por favor, clique no botão abaixo para verificar:");

                await logAction(supabase, {
                  organizationId, eventId: event_id, automationId: automation.id as string,
                  sessionId, actionType: "check_follower", actionIndex: i,
                  status: "success", latencyMs: Date.now() - startMs,
                  humanSummary: `Resposta inesperada: "${messageText}". Reenviando botão de verificação.`,
                });

                await supabase.from("instagram_events").update({
                  status: "processed", processed_at: new Date().toISOString(),
                }).eq("id", event_id);

                return new Response(JSON.stringify({ processed: true, waiting: true, reason: "ambiguous_follower_check" }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }

            // ── FIRST TIME: Check via API first ──
            const { follows: isFollower, apiError: followerApiError } = await checkFollowerApi();

            if (isFollower) {
              // Already following — skip silently
              contextData[varName] = "SEGUINDO";
              if (sessionId) {
                await supabase.from("instagram_sessions").update({
                  context_json: contextData,
                  updated_at: new Date().toISOString(),
                }).eq("id", sessionId);
              }

              await saveFollowerCache();

              await logAction(supabase, {
                organizationId, eventId: event_id, automationId: automation.id as string,
                sessionId, actionType: "check_follower", actionIndex: i,
                status: "success", latencyMs: Date.now() - startMs,
                humanSummary: "Usuário já segue a conta (is_user_follow_business=true). Step pulado silenciosamente.",
              });
              break; // Continue to next step
            }

            // Not following (or API error) — send button template
            let cfRes: Response;
            const cfOriginEventType = contextData._origin_event_type as string || eventType;
            const cfOriginCommentId = contextData._origin_comment_id as string || "";
            const cfNeedsPrivateReply = cfOriginEventType === "comment" && !!cfOriginCommentId && !contextData._dm_window_open;

            if (cfNeedsPrivateReply) {
              // For comment-originated flows, try private reply first
              cfRes = await fetchWithRetry(`${GRAPH_BASE}/me/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({
                  recipient: { comment_id: cfOriginCommentId },
                  message: {
                    attachment: {
                      type: "template",
                      payload: {
                        template_type: "button",
                        text: question,
                        buttons: [
                          { type: "postback", title: buttonTitle, payload: "CHECK_FOLLOW_STATUS" },
                        ],
                      },
                    },
                  },
                }),
              });
              if (cfRes.ok) {
                contextData._dm_window_open = false;
                contextData._awaiting_inbound_dm = true;
                contextData._private_reply_used = true;
                try {
                  const resJson = await cfRes.clone().json();
                  if (resJson.recipient_id) contextData._ig_dm_recipient_id = resJson.recipient_id;
                } catch (_) {}
              }
            } else {
              cfRes = await sendFollowerButtonTemplate(question);
            }

            // Save session waiting for follower postback
            contextData._awaiting_follower_check = true;
            const cfExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

            if (sessionId) {
              await supabase.from("instagram_sessions").update({
                current_step_index: i,
                context_json: contextData,
                expires_at: cfExpiresAt,
                updated_at: new Date().toISOString(),
              }).eq("id", sessionId);
            } else {
              await supabase.from("instagram_sessions")
                .update({ status: "expired", updated_at: new Date().toISOString() })
                .eq("organization_id", organizationId)
                .eq("account_id", accountId)
                .eq("ig_user_scoped_id", igUserScopedId)
                .eq("status", "active");

              const { data: newSession } = await supabase.from("instagram_sessions").insert({
                organization_id: organizationId,
                automation_id: automation.id as string,
                account_id: accountId,
                ig_user_scoped_id: igUserScopedId,
                current_step_index: i,
                context_json: contextData,
                expires_at: cfExpiresAt,
                status: "active",
              }).select("id").single();
              sessionId = newSession?.id || null;
            }

            await logAction(supabase, {
              organizationId, eventId: event_id, automationId: automation.id as string,
              sessionId, actionType: "check_follower", actionIndex: i,
              status: cfRes.ok ? "success" : "error", latencyMs: Date.now() - startMs,
              humanSummary: cfRes.ok
                ? `Verificação via API: ${followerApiError ? "indisponível" : "não segue"}. Botão template enviado [${buttonTitle}]`
                : "Falha ao enviar botão de verificação de seguidor",
            });

            if (!cfRes.ok) {
              const errText = await cfRes.text();
              throw new Error(`check_follower failed: ${cfRes.status} - ${errText}`);
            }

            await supabase.from("instagram_events").update({
              status: "processed", processed_at: new Date().toISOString(),
            }).eq("id", event_id);

            await supabase.from("instagram_automations").update({
              execution_count: (automation.execution_count as number || 0) + 1,
              last_executed_at: new Date().toISOString(),
            }).eq("id", automation.id);

            return new Response(JSON.stringify({ processed: true, waiting: true, reason: "awaiting_follower_check" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          default:
            console.warn("[IG-Process] Unknown step type:", stepType);
            await logAction(supabase, {
              organizationId, eventId: event_id, automationId: automation.id as string,
              sessionId, actionType: stepType, actionIndex: i,
              status: "skipped", latencyMs: Date.now() - startMs,
              humanSummary: `Tipo de step desconhecido: ${stepType}`,
            });
        }
      } catch (stepErr) {
        hasError = true;
        errorMessage = stepErr instanceof Error ? stepErr.message : String(stepErr);
        console.error(`[IG-Process] Step ${i} (${stepType}) failed:`, stepErr);

        await logAction(supabase, {
          organizationId, eventId: event_id, automationId: automation.id as string,
          sessionId, actionType: stepType, actionIndex: i,
          status: "error", latencyMs: Date.now() - startMs,
          humanSummary: `Erro no step ${stepType}: ${errorMessage.substring(0, 100)}`,
          errorMessage,
        });
        break;
      }
    }

    // Close session if all steps completed
    if (sessionId && !hasError) {
      await supabase.from("instagram_sessions").update({
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }

    // Update automation stats
    await supabase.from("instagram_automations").update({
      execution_count: (automation.execution_count as number || 0) + 1,
      last_executed_at: new Date().toISOString(),
    }).eq("id", automation.id);

    // Mark event as processed/error
    await supabase.from("instagram_events").update({
      status: hasError ? "error" : "processed",
      error_message: hasError ? errorMessage : null,
      processed_at: new Date().toISOString(),
    }).eq("id", event_id);

    return new Response(JSON.stringify({ processed: true, error: hasError ? errorMessage : null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[IG-Process] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Replace {{variable}} placeholders
function replaceVars(text: string, context: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(context[key] || ""));
}

// Log action helper
async function logAction(
  supabase: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    eventId: string;
    automationId: string;
    sessionId: string | null;
    actionType: string;
    actionIndex: number;
    status: string;
    latencyMs?: number;
    humanSummary?: string;
    errorMessage?: string;
    requestJson?: Record<string, unknown>;
    responseJson?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("instagram_action_logs").insert({
      organization_id: params.organizationId,
      event_id: params.eventId,
      automation_id: params.automationId || null,
      session_id: params.sessionId,
      action_type: params.actionType,
      action_index: params.actionIndex,
      status: params.status,
      latency_ms: params.latencyMs ?? null,
      human_summary: params.humanSummary ?? null,
      error_message: params.errorMessage ?? null,
      request_json: params.requestJson ?? null,
      response_json: params.responseJson ?? null,
    });
  } catch (logErr) {
    console.error("[IG-Process] Failed to log action:", logErr);
  }
}
