import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Resumes a paused flow_session after a Voice AI call completed.
 * - Hydrates {{voice.*}} variables into collected_data
 * - Finds the next step via flow_connections matching handle voice-${outcome}
 * - Updates flow_sessions.current_step_id to the next step
 *
 * The actual sending of the next node's content will happen on the next inbound
 * webhook OR via the existing manual trigger. To keep this MVP simple and
 * deterministic, we just write the new current_step_id and let the flow engine
 * pick up from there.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isAuthorized = auth.endsWith(cronSecret) || auth.endsWith(serviceKey);
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  try {
    const { flow_session_id, voice_call_id, outcome } = await req.json();
    if (!flow_session_id || !voice_call_id || !outcome) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the voice_call to hydrate variables
    const { data: voiceCall } = await supabase
      .from("voice_calls")
      .select("transcript, summary, duration_seconds, ended_reason, flow_step_id")
      .eq("id", voice_call_id)
      .single();

    // Fetch session
    const { data: session } = await supabase
      .from("flow_sessions")
      .select("id, flow_id, collected_data, current_step_id")
      .eq("id", flow_session_id)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ ok: true, skipped: "session-not-found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse transcript text for variable
    let transcriptText = "";
    if (voiceCall?.transcript) {
      try {
        const parsed = JSON.parse(voiceCall.transcript);
        if (Array.isArray(parsed)) {
          transcriptText = parsed.map((m: any) => `${m.role === "ai" ? "Assistente" : "Cliente"}: ${m.content}`).join("\n");
        } else {
          transcriptText = String(voiceCall.transcript);
        }
      } catch {
        transcriptText = String(voiceCall.transcript);
      }
    }

    const newCollected = {
      ...(session.collected_data as any || {}),
      voice: {
        outcome,
        transcript: transcriptText,
        summary: voiceCall?.summary || "",
        duration: voiceCall?.duration_seconds || 0,
        ended_reason: voiceCall?.ended_reason || "",
      },
    };

    // Find next step via flow_connections handle voice-${outcome}
    const sourceStepId = voiceCall?.flow_step_id || session.current_step_id;
    let nextStepId: string | null = null;
    if (sourceStepId) {
      const { data: conn } = await supabase
        .from("flow_connections")
        .select("target_step_id")
        .eq("flow_id", session.flow_id)
        .eq("source_step_id", sourceStepId)
        .eq("source_handle", `voice-${outcome}`)
        .limit(1)
        .maybeSingle();
      nextStepId = conn?.target_step_id || null;
    }

    await supabase
      .from("flow_sessions")
      .update({
        collected_data: newCollected,
        current_step_id: nextStepId,
        last_activity_at: new Date().toISOString(),
        status: nextStepId ? "active" : "completed",
        completed_at: nextStepId ? null : new Date().toISOString(),
      })
      .eq("id", flow_session_id);

    return new Response(JSON.stringify({ ok: true, next_step_id: nextStepId, outcome }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[resume-flow-after-voice] error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
