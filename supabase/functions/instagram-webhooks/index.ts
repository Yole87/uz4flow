/**
 * Instagram Webhooks Edge Function
 * 
 * Receives webhooks from Meta (Instagram Messaging + Feed):
 *   - GET: Responds to verification challenge
 *   - POST: Receives events, validates HMAC, persists, triggers processing
 * 
 * Supported event types:
 *   - dm (messages)
 *   - comment (feed/reels comments)
 *   - reaction (message_reactions)
 *   - postback (messaging_postbacks)
 *   - referral (messaging_referral)
 *   - seen (messaging_seen)
 *   - message_edit (message_edit)
 *   - live_comment (live_comments)
 *   - optin (messaging_optins)
 *   - handover (messaging_handover)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { decrypt } from "../_shared/encryption.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate SHA-256 hash for idempotency
async function hashEvent(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Verify HMAC-SHA256 signature from Meta
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expected = `sha256=${hmac.digest("hex")}`;
    return signature === expected;
  } catch {
    return false;
  }
}

// Classify a messaging event by its payload fields
function classifyMessagingEvent(msgEvent: Record<string, unknown>): { eventType: string; eventId: string } {
  // Reaction
  if (msgEvent.reaction) {
    const reaction = msgEvent.reaction as Record<string, unknown>;
    const mid = String(reaction.mid || `reaction_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    return { eventType: "reaction", eventId: mid };
  }

  // Postback (button click)
  if (msgEvent.postback) {
    const postback = msgEvent.postback as Record<string, unknown>;
    const mid = String(postback.mid || `postback_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    return { eventType: "postback", eventId: mid };
  }

  // Referral (from ads or ig.me links)
  if (msgEvent.referral) {
    const referral = msgEvent.referral as Record<string, unknown>;
    const ref = String(referral.ref || `referral_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    return { eventType: "referral", eventId: ref };
  }

  // Seen / Read receipt
  if (msgEvent.read) {
    const read = msgEvent.read as Record<string, unknown>;
    const watermark = String(read.watermark || Date.now());
    return { eventType: "seen", eventId: `seen_${watermark}` };
  }

  // Opt-in (recurring notifications)
  if (msgEvent.optin) {
    const optin = msgEvent.optin as Record<string, unknown>;
    const payload = String(optin.payload || `optin_${Date.now()}`);
    return { eventType: "optin", eventId: payload };
  }

  // Handover (pass_thread_control / take_thread_control)
  if (msgEvent.pass_thread_control || msgEvent.take_thread_control) {
    return { eventType: "handover", eventId: `handover_${Date.now()}_${Math.random().toString(36).slice(2)}` };
  }

  // Message (DM) — check for edit
  const message = msgEvent.message as Record<string, unknown> | undefined;
  if (message) {
    // Skip echo messages at webhook level
    if (message.is_echo === true) {
      return { eventType: "_echo", eventId: String(message.mid || "") };
    }
    // Edited message
    if (message.is_edit === true) {
      const mid = String(message.mid || `edit_${Date.now()}`);
      return { eventType: "message_edit", eventId: mid };
    }
    // Regular DM
    const mid = String(message.mid || `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    return { eventType: "dm", eventId: mid };
  }

  // Unknown messaging event
  return { eventType: "unknown", eventId: `unknown_${Date.now()}_${Math.random().toString(36).slice(2)}` };
}

// Classify a changes entry by its field
function classifyChangeEvent(change: Record<string, unknown>): { eventType: string; eventId: string } {
  const field = String(change.field || "");
  const value = (change.value as Record<string, unknown>) || {};

  if (field === "live_comments") {
    const commentId = String(value.comment_id || value.id || `live_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    return { eventType: "live_comment", eventId: commentId };
  }

  // Regular comments (feed/reels)
  const commentId = (value.comment_id as string) || (value.id as string) ||
    `change_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return { eventType: "comment", eventId: commentId };
}

async function persistAndProcess(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  account: { id: string; organization_id: string },
  igUserId: string,
  eventType: string,
  eventId: string,
  payload: Record<string, unknown>,
): Promise<Promise<void> | null> {
  const eventHash = await hashEvent(`${eventType}_${igUserId}_${eventId}`);

  const { data: upserted } = await supabase
    .from("instagram_events")
    .upsert({
      organization_id: account.organization_id,
      account_id: account.id,
      event_type: eventType,
      event_hash: eventHash,
      payload_json: payload,
      status: "received",
    }, { onConflict: "event_hash", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (!upserted) {
    console.log(`[IG-Webhooks] Duplicate ${eventType} event skipped:`, eventHash);
    return null;
  }

  // Analytics-only events don't need processing
  if (eventType === "seen") {
    return null;
  }

  const processUrl = `${supabaseUrl}/functions/v1/instagram-process-event`;
  return fetch(processUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ event_id: upserted.id }),
  }).then(r => {
    if (!r.ok) console.error(`[IG-Webhooks] Process ${eventType} event call failed:`, r.status);
  }).catch(e => console.error(`[IG-Webhooks] Process ${eventType} event call error:`, e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ─── GET: Webhook Verification Challenge ───────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !challenge || !token) {
      console.error("[IG-Webhooks] Verification failed - missing params");
      return new Response("Forbidden", { status: 403 });
    }

    // 1. Try global token first
    const globalToken = Deno.env.get("INSTAGRAM_WEBHOOK_VERIFY_TOKEN");
    if (token === globalToken) {
      console.log("[IG-Webhooks] Verification accepted (global token)");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // 2. Try per-org tokens from database
    const supabaseVerify = createClient(supabaseUrl, serviceRoleKey);
    const { data: configs } = await supabaseVerify
      .from("instagram_app_config")
      .select("webhook_verify_token")
      .not("webhook_verify_token", "is", null);

    const matched = configs?.some((c: { webhook_verify_token: string }) => c.webhook_verify_token === token);
    if (matched) {
      console.log("[IG-Webhooks] Verification accepted (per-org token)");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    console.error("[IG-Webhooks] Verification failed - no matching token");
    return new Response("Forbidden", { status: 403 });
  }

  // ─── POST: Receive Events ─────────────────────────────────
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // 1. Validate HMAC signature
  const signature = req.headers.get("x-hub-signature-256") || "";
  const globalAppSecret = Deno.env.get("INSTAGRAM_APP_SECRET");

  let hmacValidated = false;
  if (globalAppSecret && signature) {
    hmacValidated = verifySignature(rawBody, signature, globalAppSecret);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log("[IG-Webhooks] Received webhook:", JSON.stringify(body).substring(0, 500));

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const entries = (body.entry as Array<Record<string, unknown>>) || [];
  const processPromises: Promise<void>[] = [];

  for (const entry of entries) {
    const igUserId = String(entry.id || "");

    // Resolve account
    const { data: account } = await supabase
      .from("instagram_accounts")
      .select("id, organization_id")
      .eq("ig_user_id", igUserId)
      .eq("token_status", "active")
      .maybeSingle();

    if (!account) {
      console.warn("[IG-Webhooks] No active account for ig_user_id:", igUserId);
      continue;
    }

    // Try per-org HMAC validation if global didn't pass
    if (!hmacValidated && signature) {
      try {
        const { data: orgConfig } = await supabase
          .from("instagram_app_config")
          .select("app_secret_encrypted")
          .eq("organization_id", account.organization_id)
          .maybeSingle();

        if (orgConfig?.app_secret_encrypted) {
          const orgSecret = await decrypt(orgConfig.app_secret_encrypted);
          if (verifySignature(rawBody, signature, orgSecret)) {
            hmacValidated = true;
          }
        }
      } catch (e) {
        console.warn("[IG-Webhooks] Failed to validate per-org HMAC:", e);
      }

      if (!hmacValidated) {
        console.error("[IG-Webhooks] Invalid HMAC signature for org:", account.organization_id);
        continue;
      }
    }

    // ── Process messaging events (DMs, reactions, postbacks, referrals, etc.) ──
    const messagingEvents = (entry.messaging as Array<Record<string, unknown>>) || [];
    for (const msgEvent of messagingEvents) {
      const { eventType, eventId } = classifyMessagingEvent(msgEvent);

      // Skip echoes
      if (eventType === "_echo") {
        console.log("[IG-Webhooks] Skipping echo DM at webhook level");
        continue;
      }

      // Skip unknown events
      if (eventType === "unknown") {
        console.log("[IG-Webhooks] Skipping unknown messaging event");
        continue;
      }

      // Skip self-comments for DMs (page sending to itself)
      if (eventType === "dm") {
        const sender = msgEvent.sender as Record<string, unknown> | undefined;
        if (sender && String(sender.id) === igUserId) {
          console.log("[IG-Webhooks] Skipping self-DM at webhook level");
          continue;
        }
      }

      const promise = persistAndProcess(
        supabase, supabaseUrl, serviceRoleKey,
        account, igUserId, eventType, eventId, msgEvent,
      );
      if (promise) processPromises.push(promise);
    }

    // ── Process feed changes (comments + live_comments) ──
    const changes = (entry.changes as Array<Record<string, unknown>>) || [];
    for (const change of changes) {
      const { eventType, eventId } = classifyChangeEvent(change);
      const value = (change.value as Record<string, unknown>) || {};

      // Skip self-comments
      const fromObj = value.from as Record<string, unknown> | undefined;
      const fromId = fromObj?.id;
      if (fromId && String(fromId) === igUserId) {
        console.log(`[IG-Webhooks] Skipping self-${eventType} from page`);
        continue;
      }

      const promise = persistAndProcess(
        supabase, supabaseUrl, serviceRoleKey,
        account, igUserId, eventType, eventId, change,
      );
      if (promise) processPromises.push(promise);
    }

    // ── Standby events (passive listening) ──
    const standbyEvents = (entry.standby as Array<Record<string, unknown>>) || [];
    for (const standbyEvent of standbyEvents) {
      const standbyId = `standby_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const promise = persistAndProcess(
        supabase, supabaseUrl, serviceRoleKey,
        account, igUserId, "standby", standbyId, standbyEvent,
      );
      if (promise) processPromises.push(promise);
    }
  }

  // Wait for all process calls in the background
  if (processPromises.length > 0) {
    try {
      EdgeRuntime.waitUntil(Promise.allSettled(processPromises));
    } catch {
      await Promise.allSettled(processPromises);
    }
  }

  // Return 200 immediately (Meta requirement)
  return new Response("OK", { status: 200 });
});
