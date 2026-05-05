import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Manually trigger a flow for an existing conversation.
 * Strategy: insert a synthetic event mimicking an inbound message,
 * which the openbot-webhook engine consumes to start the chosen flow.
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { flow_id, conversation_id } = body || {};

    if (!flow_id || !conversation_id) {
      return new Response(
        JSON.stringify({ error: "flow_id and conversation_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate conversation + load context
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, instance_id, contact_id, contacts(name, phone, organization_id)")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contact = (conv as any).contacts;

    // Validate flow ownership / activity
    const { data: flow, error: flowErr } = await admin
      .from("flows")
      .select("id, name, user_id, is_active")
      .eq("id", flow_id)
      .single();

    if (flowErr || !flow) {
      return new Response(JSON.stringify({ error: "Flow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!flow.is_active) {
      return new Response(JSON.stringify({ error: "Flow is inactive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Close ANY active session matching the unique constraint (flow_id, chat_id, instance_id)
    // to avoid 23505 duplicate key violations when re-triggering a flow.
    const chatId = contact?.phone || conv.contact_id;
    await admin
      .from("flow_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("chat_id", chatId)
      .eq("instance_id", conv.instance_id)
      .eq("status", "active");

    // Also close any active session for the target flow_id specifically (covers any stale rows)
    await admin
      .from("flow_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("flow_id", flow_id)
      .eq("chat_id", chatId)
      .eq("status", "active");

    // Create a new flow session immediately, pointing to the requested flow
    const { data: firstStep } = await admin
      .from("flow_steps")
      .select("id")
      .eq("flow_id", flow_id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: session, error: sessionErr } = await admin
      .from("flow_sessions")
      .insert({
        user_id: flow.user_id,
        flow_id: flow_id,
        chat_id: chatId,
        instance_id: conv.instance_id,
        push_name: contact?.name || null,
        current_step_id: firstStep?.id || null,
        current_step_index: 0,
        status: "active",
        collected_data: { manual_trigger: true, triggered_by: user.id },
      })
      .select()
      .single();

    if (sessionErr) {
      console.error("[trigger-flow-manual] session error:", sessionErr);
      return new Response(JSON.stringify({ error: "Failed to start flow session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log an event for traceability
    await admin.from("events").insert({
      user_id: flow.user_id,
      chat_id: chatId,
      instance_id: conv.instance_id || "manual",
      message_id: `manual-${crypto.randomUUID()}`,
      message_text: "[Disparo manual de fluxo]",
      push_name: contact?.name || null,
      received_payload_json: { manual_trigger: true, conversation_id, flow_id, triggered_by: user.id },
      chosen_flow_id: flow_id,
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        flow_name: flow.name,
        session_id: session.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[trigger-flow-manual] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
