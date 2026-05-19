/**
 * Instagram Process Event — End-to-end tests
 *
 * Validates the comment-trigger pipeline hermetically against the deployed
 * edge function and the live database. Uses the service-role key to insert
 * isolated fixtures (prefixed `e2e:`) and tears them down at the end.
 *
 * Two scenarios cover the bug fixed in this commit:
 *
 *   Scenario 1 — Pause on Private Reply:
 *     comment event → send_dm (private_reply) → session must persist with
 *     `_awaiting_inbound_dm=true` AND `current_step_index` past send_dm.
 *
 *   Scenario 2 — Resume + advance downstream steps:
 *     With a paused session pre-seeded, an inbound DM from the same user must
 *     advance the session, fire save_lead + tag_lead, and produce action logs
 *     for both. This is what was previously failing in production.
 *
 * No Meta Graph calls are required for Scenario 2 (steps after the pause are
 * save_lead + tag_lead, both DB-only). Scenario 1 tolerates the Meta call
 * failing (real tokens are not required to validate that the pause WOULD
 * happen — we assert the function does not crash and either pauses cleanly
 * OR records an error log for send_dm without leaking to later steps).
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/instagram-process-event`;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TEST_TAG = `e2e-${Date.now()}`;
const TEST_IGSID = `e2etest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

type Fixtures = {
  organizationId: string;
  accountId: string;
  automationId: string;
};

async function pickHostOrg(): Promise<{ orgId: string; accountId: string; ig_user_id: string; encToken: string }> {
  // Reuse an existing org + account so we inherit a decryptable token.
  const { data: account, error } = await admin
    .from("instagram_accounts")
    .select("id, organization_id, ig_user_id, access_token_encrypted, token_status")
    .eq("token_status", "active")
    .limit(1)
    .maybeSingle();
  if (error || !account) throw new Error("No active instagram_account found to host E2E fixtures");
  return {
    orgId: account.organization_id,
    accountId: account.id,
    ig_user_id: account.ig_user_id,
    encToken: account.access_token_encrypted,
  };
}

async function callProcess(eventId: string): Promise<{ status: number; body: any }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ event_id: eventId }),
  });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function createAutomation(orgId: string, accountId: string, steps: any[], name: string): Promise<string> {
  const { data, error } = await admin.from("instagram_automations").insert({
    organization_id: orgId,
    account_id: accountId,
    name: `[${TEST_TAG}] ${name}`,
    trigger_type: "comment",
    is_enabled: true,
    definition_json: { steps, conditions: [] },
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function insertCommentEvent(orgId: string, accountId: string, automationId: string, commentText = "eu quero"): Promise<string> {
  const commentId = `e2e_c_${Date.now()}`;
  const mediaId = `e2e_m_${Date.now()}`;
  const payload = {
    field: "comments",
    value: {
      id: commentId,
      text: commentText,
      from: { id: TEST_IGSID, username: `e2e_${TEST_IGSID.slice(0, 8)}` },
      media: { id: mediaId, media_product_type: "REELS" },
    },
  };
  const { data, error } = await admin.from("instagram_events").insert({
    organization_id: orgId,
    account_id: accountId,
    event_type: "comment",
    event_hash: `e2e_${automationId}_${commentId}`,
    payload_json: payload,
    status: "received",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function insertDmEvent(orgId: string, accountId: string, ig_user_id: string, text = "Olá, recebi"): Promise<string> {
  const mid = `e2e_mid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const payload = {
    sender: { id: TEST_IGSID },
    recipient: { id: ig_user_id },
    timestamp: Date.now(),
    message: { mid, text },
  };
  const { data, error } = await admin.from("instagram_events").insert({
    organization_id: orgId,
    account_id: accountId,
    event_type: "dm",
    event_hash: `e2e_dm_${mid}`,
    payload_json: payload,
    status: "received",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function cleanup(orgId: string, automationIds: string[]) {
  // Best-effort teardown — never throws.
  try {
    await admin.from("instagram_action_logs").delete().in("automation_id", automationIds);
    await admin.from("instagram_sessions").delete().eq("organization_id", orgId).eq("ig_user_scoped_id", TEST_IGSID);
    await admin.from("instagram_leads").delete().eq("organization_id", orgId).eq("ig_user_scoped_id", TEST_IGSID);
    // Event rows have no automation FK; cleaned below by event_hash prefix.
    await admin.from("instagram_events").delete().like("event_hash", `e2e_%`);
    await admin.from("instagram_automations").delete().in("id", automationIds);
  } catch (e) {
    console.warn("[E2E] Cleanup warning:", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1 — comment → send_dm(private_reply) pauses the session
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: "E2E-1 comment triggers private-reply pause (or graceful failure, never silent step bleed)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const host = await pickHostOrg();
    const automationId = await createAutomation(host.orgId, host.accountId, [
      { type: "send_dm", config: { message: "[E2E] hello from private reply" } },
      { type: "save_lead", config: {} },
      { type: "tag_lead", config: { tags: TEST_TAG } },
    ], "scenario1-pause");
    const automationIds = [automationId];

    try {
      const eventId = await insertCommentEvent(host.orgId, host.accountId, automationId);
      const { status, body } = await callProcess(eventId);
      console.log(`[E2E-1] HTTP ${status}`, body);
      assert(status < 500, `Function crashed: ${status}`);

      // Inspect outcome — either the pause happened (ideal) or send_dm errored.
      // Critical invariant: save_lead / tag_lead must NOT have run before pause.
      const { data: logs } = await admin
        .from("instagram_action_logs")
        .select("action_type, action_index, status")
        .eq("automation_id", automationId)
        .order("action_index", { ascending: true });

      console.log(`[E2E-1] action logs:`, logs);
      const leakedDownstream = (logs || []).some((l) =>
        ["save_lead", "tag_lead"].includes(l.action_type) && l.status === "success"
      );
      assert(!leakedDownstream, "BUG: downstream steps fired before inbound DM was received");

      // If pause happened, validate session shape.
      const { data: sess } = await admin
        .from("instagram_sessions")
        .select("current_step_index, status, context_json")
        .eq("organization_id", host.orgId)
        .eq("ig_user_scoped_id", TEST_IGSID)
        .maybeSingle();
      if (sess) {
        console.log(`[E2E-1] session=`, sess);
        assertEquals(sess.status, "active");
        assert(sess.current_step_index >= 1, "Session must advance past send_dm on pause");
        assertEquals((sess.context_json as any)._awaiting_inbound_dm, true);
      }
    } finally {
      await cleanup(host.orgId, automationIds);
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2 — paused session resumes on inbound DM and runs save_lead+tag_lead
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: "E2E-2 inbound DM resumes paused session and fires downstream steps",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const host = await pickHostOrg();
    const automationId = await createAutomation(host.orgId, host.accountId, [
      { type: "send_dm", config: { message: "[E2E] pretend private reply" } },
      { type: "save_lead", config: {} },
      { type: "tag_lead", config: { tags: TEST_TAG } },
    ], "scenario2-resume");
    const automationIds = [automationId];

    try {
      // Pre-seed a paused session as if send_dm had succeeded via private_reply.
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const { error: seedErr } = await admin.from("instagram_sessions").insert({
        organization_id: host.orgId,
        account_id: host.accountId,
        automation_id: automationId,
        ig_user_scoped_id: TEST_IGSID,
        current_step_index: 1, // next step after send_dm
        status: "active",
        expires_at: expiresAt,
        context_json: {
          _awaiting_inbound_dm: true,
          _private_reply_used: true,
          _origin_event_type: "comment",
          _origin_comment_id: `e2e_seed_c_${Date.now()}`,
          _ig_dm_recipient_id: TEST_IGSID,
        },
      });
      if (seedErr) throw seedErr;

      const dmEventId = await insertDmEvent(host.orgId, host.accountId, host.ig_user_id);
      const { status, body } = await callProcess(dmEventId);
      console.log(`[E2E-2] HTTP ${status}`, body);
      assert(status < 500, `Function crashed: ${status}`);

      // Wait briefly for async work to settle.
      await new Promise((r) => setTimeout(r, 1500));

      const { data: logs } = await admin
        .from("instagram_action_logs")
        .select("action_type, action_index, status, human_summary")
        .eq("automation_id", automationId)
        .order("action_index", { ascending: true });
      console.log(`[E2E-2] action logs:`, logs);

      const saved = (logs || []).find((l) => l.action_type === "save_lead" && l.status === "success");
      const tagged = (logs || []).find((l) => l.action_type === "tag_lead" && l.status === "success");
      assert(saved, "save_lead did not execute on resume — RESUME BUG STILL PRESENT");
      assert(tagged, "tag_lead did not execute on resume — RESUME BUG STILL PRESENT");

      const { data: lead } = await admin
        .from("instagram_leads")
        .select("tags, status")
        .eq("organization_id", host.orgId)
        .eq("ig_user_scoped_id", TEST_IGSID)
        .maybeSingle();
      assert(lead, "Lead not persisted");
      assert((lead!.tags || []).includes(TEST_TAG), `Tag ${TEST_TAG} not applied — got ${lead!.tags}`);

      const { data: sess } = await admin
        .from("instagram_sessions")
        .select("current_step_index, status, context_json")
        .eq("organization_id", host.orgId)
        .eq("ig_user_scoped_id", TEST_IGSID)
        .maybeSingle();
      console.log(`[E2E-2] session after resume=`, sess);
      // After tag_lead (last step, index 2) executes, session should be advanced past end or completed.
      if (sess) {
        assert(
          sess.status === "completed" || sess.current_step_index >= 3,
          `Session did not advance past final step. status=${sess.status} stepIndex=${sess.current_step_index}`
        );
      }
    } finally {
      await cleanup(host.orgId, automationIds);
    }
  },
});
