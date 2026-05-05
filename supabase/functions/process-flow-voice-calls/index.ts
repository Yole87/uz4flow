import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AllowedHours { start: string; end: string; tz: string }

/** Returns next ISO timestamp inside the allowed window for the configured timezone, or now() if currently inside. */
function nextAllowedTime(allowed: AllowedHours | undefined): Date {
  const now = new Date();
  if (!allowed?.start || !allowed?.end) return now;
  try {
    const tz = allowed.tz || "America/Sao_Paulo";
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const hh = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
    const mm = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
    const cur = hh * 60 + mm;
    const [sH, sM] = allowed.start.split(":").map(Number);
    const [eH, eM] = allowed.end.split(":").map(Number);
    const start = sH * 60 + sM;
    const end = eH * 60 + eM;
    if (cur >= start && cur < end) return now;
    // Need to schedule for next start window — compute delta in minutes
    let deltaMin: number;
    if (cur < start) deltaMin = start - cur;
    else deltaMin = (24 * 60 - cur) + start;
    const next = new Date(now.getTime() + deltaMin * 60_000);
    return next;
  } catch {
    return now;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require CRON_SECRET bearer
  const auth = req.headers.get("Authorization") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret || !auth.endsWith(cronSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: pending, error } = await supabase
      .from("flow_voice_pending")
      .select("id, flow_session_id, flow_step_id, contact_id, organization_id, attempt_number, config")
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .limit(10);

    if (error) {
      console.error("[process-flow-voice-calls] fetch error:", error);
      return new Response(JSON.stringify({ ok: false }), { headers: corsHeaders });
    }

    const results: any[] = [];

    for (const item of pending || []) {
      const cfg = (item.config || {}) as any;
      const allowed = cfg.allowed_hours as AllowedHours | undefined;
      const next = nextAllowedTime(allowed);

      // If outside allowed window — reschedule
      if (next.getTime() > Date.now() + 60_000) {
        await supabase.from("flow_voice_pending")
          .update({ scheduled_for: next.toISOString() })
          .eq("id", item.id);
        results.push({ id: item.id, action: "rescheduled", scheduled_for: next });
        continue;
      }

      // Fetch contact + Vapi config
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, phone, name, organization_id")
        .eq("id", item.contact_id)
        .single();

      if (!contact?.phone) {
        await supabase.from("flow_voice_pending")
          .update({ status: "cancelled", last_error: "Contact has no phone", completed_at: new Date().toISOString() })
          .eq("id", item.id);
        results.push({ id: item.id, action: "cancelled_no_phone" });
        continue;
      }

      const { data: vapiConfig } = await supabase
        .from("crm_openbot_config")
        .select("vapi_api_key_encrypted, vapi_phone_number_id, vapi_default_voice")
        .eq("organization_id", item.organization_id)
        .single();

      if (!vapiConfig?.vapi_api_key_encrypted || !vapiConfig?.vapi_phone_number_id) {
        await supabase.from("flow_voice_pending")
          .update({ status: "cancelled", last_error: "Vapi não configurado", completed_at: new Date().toISOString() })
          .eq("id", item.id);
        await supabase.from("voice_calls").insert({
          organization_id: item.organization_id,
          contact_id: contact.id,
          flow_session_id: item.flow_session_id,
          flow_step_id: item.flow_step_id,
          flow_attempt_number: item.attempt_number,
          flow_outcome: "failed",
          status: "failed",
          ended_reason: "vapi-not-configured",
        });
        results.push({ id: item.id, action: "cancelled_no_vapi" });
        continue;
      }

      const { decrypt } = await import("../_shared/encryption.ts");
      const vapiApiKey = (await decrypt(vapiConfig.vapi_api_key_encrypted)).trim();

      // Fetch org info for variable replacement
      const { data: orgInfo } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", item.organization_id)
        .single();

      // Variable interpolation in script
      let script: string = String(cfg.script || "");
      script = script
        .replace(/\{\{contact\.name\}\}/g, contact.name || "")
        .replace(/\{\{contact\.phone\}\}/g, contact.phone || "")
        .replace(/\{\{org\.name\}\}/g, orgInfo?.name || "");

      // Format phone for Vapi
      let phone = contact.phone.replace(/\D/g, "");
      if (phone.startsWith("0")) phone = phone.substring(1);
      if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55")) phone = "+55" + phone;
      else if (!phone.startsWith("+")) phone = "+" + phone;

      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook`;
      const voiceId = cfg.voice_id || vapiConfig.vapi_default_voice || "pFZP5JQG7iQjIQuC4Bku";
      const maxDur = Math.min(cfg.max_duration_seconds || 120, 600);

      const vapiPayload: Record<string, unknown> = {
        type: "outboundPhoneCall",
        name: `Flow-${item.flow_step_id.slice(0, 6)}`.substring(0, 40),
        customer: { number: phone },
        phoneNumberId: vapiConfig.vapi_phone_number_id.trim(),
        assistant: {
          firstMessage: script.split("\n")[0] || "Olá!",
          language: "pt-BR",
          transcriber: { provider: "deepgram", language: "pt-BR" },
          voice: { provider: "11labs", voiceId },
          serverUrl: webhookUrl,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: script }],
          },
          maxDurationSeconds: maxDur,
          voicemailDetection: {
            provider: "twilio",
            enabled: true,
            voicemailDetectionTypes: ["machine_end_beep", "machine_end_silence"],
            machineDetectionTimeout: 30,
          },
          serverMessages: ["end-of-call-report", "status-update"],
        },
      };

      // Get/create conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Create voice_call record
      const { data: voiceCall, error: vcErr } = await supabase
        .from("voice_calls")
        .insert({
          organization_id: item.organization_id,
          contact_id: contact.id,
          conversation_id: existingConv?.id || null,
          call_type: "conversational",
          status: "pending",
          assistant_config: vapiPayload.assistant,
          flow_session_id: item.flow_session_id,
          flow_step_id: item.flow_step_id,
          flow_attempt_number: item.attempt_number,
        })
        .select("id")
        .single();

      if (vcErr) {
        console.error("[process-flow-voice-calls] insert voice_call error:", vcErr);
        await supabase.from("flow_voice_pending")
          .update({ status: "queued", scheduled_for: new Date(Date.now() + 5 * 60_000).toISOString(), last_error: vcErr.message })
          .eq("id", item.id);
        continue;
      }

      // Dispatch to Vapi
      const vapiRes = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { Authorization: `Bearer ${vapiApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(vapiPayload),
      });
      const vapiResult = await vapiRes.json();

      if (!vapiRes.ok) {
        console.error("[process-flow-voice-calls] Vapi error:", vapiResult);
        await supabase.from("voice_calls")
          .update({ status: "failed", flow_outcome: "failed", ended_reason: vapiResult.message || "vapi-error" })
          .eq("id", voiceCall.id);
        await supabase.from("flow_voice_pending")
          .update({ status: "completed", last_error: JSON.stringify(vapiResult).slice(0, 500), completed_at: new Date().toISOString() })
          .eq("id", item.id);
        results.push({ id: item.id, action: "vapi_error" });
        continue;
      }

      await supabase.from("voice_calls")
        .update({ vapi_call_id: vapiResult.id, status: "ringing" })
        .eq("id", voiceCall.id);

      await supabase.from("flow_voice_pending")
        .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
        .eq("id", item.id);

      results.push({ id: item.id, action: "dispatched", voice_call_id: voiceCall.id });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[process-flow-voice-calls] fatal:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
