import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"; // kept for legacy reference

/** Convert ArrayBuffer to base64 string (chunked to avoid stack overflow) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Download a file from Supabase Storage and convert to base64 Data URL with @file format for documents */
async function downloadStorageFileAsBase64(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  storagePath: string,
  fileName?: string,
  mimeType?: string,
): Promise<string | null> {
  try {
    const { data: blob, error } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (error || !blob) {
      console.error(`[vapi-webhook] Failed to download ${bucket}/${storagePath}:`, error);
      return null;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const mime = mimeType || blob.type || "application/octet-stream";

    // Apply @file format for documents (same as CRM crm-send-message)
    const isDocument = !mime.startsWith("image/") && !mime.startsWith("audio/") && !mime.startsWith("video/");
    if (isDocument && fileName) {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      return `data:@file/${safeName};base64,${base64}`;
    }

    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.error(`[vapi-webhook] downloadStorageFileAsBase64 error:`, err);
    return null;
  }
}

/** Extract bucket and path from a Supabase Storage URL */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  // Format: .../storage/v1/object/public/bucket-name/path/to/file
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
  return null;
}

async function callConsentModel(transcript: string, lovableApiKey: string, model: string, organizationId?: string): Promise<{ ok: boolean; answer: string }> {
  const aiResult = await callAI({
    organizationId,
    model,
    messages: [
      {
        role: "system",
        content: `Você é um analisador de transcrições de ligações telefônicas. 
Analise a transcrição e determine se o CLIENTE (não o assistente/IA) deu consentimento ou recusou.

Sinais de CONSENTIMENTO (responda "SIM"): "sim", "ok", "pode enviar", "pode mandar", "concordo", "tá bom", "tá certo", "quero sim", "manda sim", "pode ser", "aceito", "beleza", "claro", "com certeza", "manda lá", "tudo bem", "de acordo", etc.

Sinais de RECUSA (responda "NAO"): "não", "não quero", "recuso", "não envie", "não reconheço", "desconheço", "não aceito", "de jeito nenhum", "não concordo", "não preciso", "não me interessa", etc.

Se não houver resposta clara do cliente ou a ligação foi encerrada sem resposta, responda "NAO".

Responda APENAS com "SIM" ou "NAO".`,
      },
      {
        role: "user",
        content: `Transcrição da ligação:\n${transcript}`,
      },
    ],
    max_tokens: 10,
    temperature: 0,
  });

  if (!aiResult.ok) {
    return { ok: false, answer: `HTTP ${aiResult.status}` };
  }

  const answer = aiResult.data?.choices?.[0]?.message?.content?.trim()?.toUpperCase() || "";
  return { ok: true, answer };
}

async function detectConsentInTranscript(transcript: string, lovableApiKey: string, organizationId?: string): Promise<boolean> {
  const PRIMARY_MODEL = "google/gemini-2.5-flash";
  const FALLBACK_MODEL = "openai/gpt-5-nano";

  try {
    // Try primary model
    const primary = await callConsentModel(transcript, lovableApiKey, PRIMARY_MODEL, organizationId);
    if (primary.ok) {
      console.log(`[vapi-webhook] Consent detection (${PRIMARY_MODEL}): "${primary.answer}"`);
      return primary.answer.includes("SIM");
    }

    // Primary failed, try fallback
    console.warn(`[vapi-webhook] Primary AI model error (${primary.answer}), retrying with fallback ${FALLBACK_MODEL}`);
    const fallback = await callConsentModel(transcript, lovableApiKey, FALLBACK_MODEL, organizationId);
    if (fallback.ok) {
      console.log(`[vapi-webhook] Consent detection fallback (${FALLBACK_MODEL}): "${fallback.answer}"`);
      return fallback.answer.includes("SIM");
    }

    // Both failed
    console.error(`[vapi-webhook] CRITICAL: Both AI models failed for consent detection. Primary: ${primary.answer}, Fallback: ${fallback.answer}`);
    return false;
  } catch (err) {
    console.error("[vapi-webhook] Consent detection error:", err);
    return false;
  }
}

async function sendWhatsAppFollowup(
  supabase: ReturnType<typeof createClient>,
  voiceCallId: string,
  contactId: string,
  organizationId: string,
  followupText: string,
  followupFileUrl: string | null
) {
  try {
    // Get contact phone
    const { data: contact } = await supabase
      .from("contacts")
      .select("phone, instance_id, organization_id")
      .eq("id", contactId)
      .single();

    if (!contact?.phone) {
      console.error("[vapi-webhook] Contact has no phone for follow-up");
      return;
    }

    // Get instance-level OpenBot API key (3-layer resolution)
    const { decrypt } = await import("../_shared/encryption.ts");
    let apiKey = "";
    let resolvedSource = "";

    // Layer 1: Contact's own instance
    if (contact.instance_id) {
      const { data: instance } = await supabase
        .from("instances")
        .select("openbot_api_key_encrypted")
        .eq("id", contact.instance_id)
        .single();

      if (instance?.openbot_api_key_encrypted) {
        apiKey = (await decrypt(instance.openbot_api_key_encrypted)).trim();
        resolvedSource = "contact_instance";
      }
    }

    // Layer 2: Org-level config
    if (!apiKey) {
      const { data: orgConfig } = await supabase
        .from("crm_openbot_config")
        .select("openbot_api_key_encrypted")
        .eq("organization_id", organizationId)
        .single();

      if (orgConfig?.openbot_api_key_encrypted) {
        apiKey = (await decrypt(orgConfig.openbot_api_key_encrypted)).trim();
        resolvedSource = "org_config";
      }
    }

    // Layer 3: Fallback to first instance with valid key in the org
    if (!apiKey) {
      const { data: instanceWithKey } = await supabase
        .from("instances")
        .select("id, openbot_api_key_encrypted")
        .eq("organization_id", organizationId)
        .not("openbot_api_key_encrypted", "is", null)
        .limit(1)
        .maybeSingle();

      if (instanceWithKey?.openbot_api_key_encrypted) {
        apiKey = (await decrypt(instanceWithKey.openbot_api_key_encrypted)).trim();
        resolvedSource = `instance_fallback:${instanceWithKey.id}`;
      }
    }

    if (!apiKey) {
      console.error(`[vapi-webhook] No OpenBot API key found for follow-up. Contact: ${contactId}, Org: ${organizationId}, instance_id: ${contact.instance_id || 'none'}`);
      return;
    }

    console.log(`[vapi-webhook] Follow-up API key resolved via: ${resolvedSource}`);

    const phone = contact.phone.replace(/\D/g, "");
    const SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

    // Send text message
    if (followupText) {
      const payload: Record<string, unknown> = {
        apiKey,
        phone,
        message: followupText,
        desativarFluxo: true,
      };

      const textRes = await fetch(SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!textRes.ok) {
        console.error("[vapi-webhook] Failed to send follow-up text:", await textRes.text());
      } else {
        console.log("[vapi-webhook] Follow-up text sent successfully");
      }
    }

    // Send file if present — download from storage and convert to base64 (same as CRM)
    if (followupFileUrl) {
      const parsed = parseStorageUrl(followupFileUrl);
      let fileBase64: string | null = null;

      if (parsed) {
        // Extract file name from path
        const pathParts = parsed.path.split("/");
        const rawFileName = pathParts[pathParts.length - 1];
        // Remove UUID prefix if present (format: uuid_filename.ext)
        const fileName = rawFileName.replace(/^[a-f0-9-]+_/, "");
        fileBase64 = await downloadStorageFileAsBase64(supabase, parsed.bucket, parsed.path, fileName);
      }

      if (fileBase64) {
        const payload: Record<string, unknown> = {
          apiKey,
          phone,
          message: "",
          arquivo: fileBase64,
          desativarFluxo: true,
        };

        const mediaRes = await fetch(SEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!mediaRes.ok) {
          console.error("[vapi-webhook] Failed to send follow-up file:", await mediaRes.text());
        } else {
          console.log("[vapi-webhook] Follow-up file sent successfully");
        }
      } else {
        console.error("[vapi-webhook] Could not download follow-up file from storage:", followupFileUrl);
      }
    }

    // Mark follow-up as sent
    await supabase
      .from("voice_calls")
      .update({ whatsapp_followup_sent: true })
      .eq("id", voiceCallId);

    console.log(`[vapi-webhook] WhatsApp follow-up completed for call ${voiceCallId}`);
  } catch (err) {
    console.error("[vapi-webhook] Follow-up error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { message } = body;

    // Vapi sends different event types
    const eventType = message?.type || body?.type || "unknown";
    console.log(`[vapi-webhook] Received event: ${eventType}`);

    if (eventType === "end-of-call-report") {
      const callReport = message || body;
      const vapiCallId = callReport.call?.id;

      // Log truncated payload for debugging
      const payloadStr = JSON.stringify(callReport);
      console.log(`[vapi-webhook] end-of-call-report payload (${payloadStr.length} chars): ${payloadStr.substring(0, 1500)}...`);

      if (!vapiCallId) {
        console.error("[vapi-webhook] No call ID in end-of-call-report");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the voice_call record
      const { data: voiceCall, error: findError } = await supabase
        .from("voice_calls")
        .select("id, contact_id, conversation_id, organization_id, campaign_id, whatsapp_followup_enabled, whatsapp_followup_text, whatsapp_followup_file_url, webhook_url, flow_session_id, flow_step_id, flow_attempt_number")
        .eq("vapi_call_id", vapiCallId)
        .single();

      if (findError || !voiceCall) {
        console.error("[vapi-webhook] Voice call not found for vapi_call_id:", vapiCallId);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract data from report
      const rawTranscript = callReport.transcript || callReport.artifact?.transcript || "";
      // Parse structured messages for speaker identification
      const artifactMessages = callReport.artifact?.messages || callReport.messages || [];
      const structuredTranscript: Array<{role: string; content: string; time?: number}> = [];
      for (const msg of artifactMessages) {
        if (msg.role === "user" || msg.role === "assistant" || msg.role === "bot") {
          structuredTranscript.push({
            role: msg.role === "user" ? "customer" : "ai",
            content: msg.message || msg.content || msg.text || "",
            time: msg.secondsFromStart || msg.time || undefined,
          });
        }
      }
      const transcript = structuredTranscript.length > 0 
        ? JSON.stringify(structuredTranscript) 
        : rawTranscript;

      const summary = callReport.analysis?.summary 
        || callReport.summary 
        || callReport.artifact?.summary 
        || "Chamada finalizada";

      const recordingUrl = callReport.recordingUrl 
        || callReport.artifact?.recordingUrl 
        || null;

      const costMinutes = callReport.call?.costs?.[0]?.minutes;
      const rawDuration = callReport.durationSeconds 
        || (typeof costMinutes === "number" ? costMinutes * 60 : 0);
      const durationSeconds = Math.round(rawDuration);

      const rawCost = callReport.cost;
      const costCents = typeof rawCost === "number" ? Math.round(rawCost * 100) : 0;

      const endedReason = callReport.endedReason || callReport.call?.endedReason || "unknown";

      // Check for customer action in function calls
      let customerAction: string | null = null;
      const messages = callReport.messages || callReport.artifact?.messages || [];
      for (const msg of messages) {
        if (msg.role === "tool_calls" || msg.type === "function-call") {
          customerAction = msg.name || msg.function?.name || null;
          break;
        }
      }

      // ── FLOW VOICE: Determine outcome ──
      let flowOutcome: "answered" | "voicemail" | "no_answer" | "failed" | null = null;
      if (voiceCall.flow_session_id) {
        const lc = String(endedReason).toLowerCase();
        const voicemailDetected = !!(callReport.analysis?.voicemailDetection?.detected) || lc.includes("voicemail");
        if (voicemailDetected) {
          flowOutcome = "voicemail";
        } else if (
          (lc.includes("customer-ended") || lc.includes("assistant-ended") || lc.includes("hangup")) &&
          durationSeconds >= 5
        ) {
          flowOutcome = "answered";
        } else if (
          lc.includes("no-answer") || lc.includes("did-not-answer") || lc.includes("silence-timed-out") || lc.includes("busy") || lc.includes("declined")
        ) {
          flowOutcome = "no_answer";
        } else {
          flowOutcome = durationSeconds >= 5 ? "answered" : "no_answer";
        }
      }

      // Update voice_call record
      const { error: updateError } = await supabase
        .from("voice_calls")
        .update({
          status: "completed",
          transcript,
          summary: summary || "Chamada finalizada",
          recording_url: recordingUrl,
          duration_seconds: durationSeconds,
          cost_cents: costCents,
          ended_reason: endedReason,
          customer_action: customerAction,
          flow_outcome: flowOutcome,
        })
        .eq("id", voiceCall.id);

      if (updateError) {
        console.error("[vapi-webhook] Failed to update voice_call:", updateError);
      }

      // ── FLOW VOICE: Retry or resume flow ──
      if (voiceCall.flow_session_id && flowOutcome) {
        const attempt = voiceCall.flow_attempt_number || 1;
        const { data: stepCfg } = voiceCall.flow_step_id
          ? await supabase.from("flow_steps").select("voice_config").eq("id", voiceCall.flow_step_id).maybeSingle()
          : { data: null };
        const cfg = ((stepCfg as any)?.voice_config || {}) as any;
        const maxAttempts = Math.max(1, parseInt(String(cfg.max_attempts || 1), 10));
        const retryMin = Math.max(1, parseInt(String(cfg.retry_interval_minutes || 60), 10));

        if (flowOutcome === "no_answer" && attempt < maxAttempts) {
          const scheduledFor = new Date(Date.now() + retryMin * 60 * 1000).toISOString();
          await supabase.from("flow_voice_pending").insert({
            flow_session_id: voiceCall.flow_session_id,
            flow_step_id: voiceCall.flow_step_id,
            contact_id: voiceCall.contact_id,
            organization_id: voiceCall.organization_id,
            attempt_number: attempt + 1,
            scheduled_for: scheduledFor,
            status: "queued",
            config: cfg,
          });
          console.log(`[vapi-webhook] Retry enqueued for flow_session ${voiceCall.flow_session_id} (attempt ${attempt + 1}/${maxAttempts})`);
        } else {
          try {
            const cronSecret = Deno.env.get("CRON_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
            const resumeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/resume-flow-after-voice`;
            const resumeRes = await fetch(resumeUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${cronSecret}`,
              },
              body: JSON.stringify({
                flow_session_id: voiceCall.flow_session_id,
                voice_call_id: voiceCall.id,
                outcome: flowOutcome,
              }),
            });
            const resumeText = await resumeRes.text();
            console.log(`[vapi-webhook] resume-flow-after-voice (${resumeRes.status}): ${resumeText.substring(0, 200)}`);
          } catch (resumeErr) {
            console.error("[vapi-webhook] Failed to resume flow:", resumeErr);
          }
        }
      }

      // Insert a message in the conversation with the call summary
      if (voiceCall.conversation_id) {
        // Fetch call_reason from voice_call record
        const { data: vcDetail } = await supabase
          .from("voice_calls")
          .select("call_reason")
          .eq("id", voiceCall.id)
          .single();

        const callSummaryContent = JSON.stringify({
          type: "voice_call",
          voice_call_id: voiceCall.id,
          duration_seconds: durationSeconds,
          summary: summary || "Chamada finalizada",
          ended_reason: endedReason,
          customer_action: customerAction,
          call_reason: vcDetail?.call_reason || null,
          transcript: structuredTranscript.length > 0 ? structuredTranscript : null,
          recording_url: recordingUrl,
        });

        await supabase.from("messages").insert({
          conversation_id: voiceCall.conversation_id,
          direction: "outbound",
          content_type: "voice_call",
          content: callSummaryContent,
          sender_type: "ia",
          status: "delivered",
          organization_id: voiceCall.organization_id,
        });

        // Format duration as mm:ss for preview
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        const durationStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

        // Update conversation last_message
        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: `📞 Ligação IA (${durationStr})`,
            last_sender_type: "ia",
          })
          .eq("id", voiceCall.conversation_id);
      }

      // WhatsApp follow-up: check consent and send if enabled
      if (voiceCall.whatsapp_followup_enabled && voiceCall.whatsapp_followup_text) {
        const transcriptForAnalysis = structuredTranscript.length > 0
          ? structuredTranscript.map(t => `${t.role === "ai" ? "Assistente" : "Cliente"}: ${t.content}`).join("\n")
          : rawTranscript;

        let shouldSendFollowup = false;

        // Check if campaign has webhook_enabled — send regardless of consent
        if (voiceCall.campaign_id) {
          const { data: campaignData } = await supabase
            .from("voice_campaigns")
            .select("webhook_enabled, call_mode")
            .eq("id", voiceCall.campaign_id)
            .single();

          if (campaignData?.webhook_enabled) {
            shouldSendFollowup = true;
            console.log(`[vapi-webhook] Campaign has webhook_enabled, sending WhatsApp follow-up without consent check`);
          }

          if (campaignData?.call_mode === 'informativo') {
            shouldSendFollowup = true;
            console.log(`[vapi-webhook] Campaign is informativo mode, sending WhatsApp follow-up automatically`);
          }
        }

        // Fallback: detect consent via AI
        if (!shouldSendFollowup && transcriptForAnalysis && transcriptForAnalysis.trim().length > 0) {
          const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";
          if (lovableApiKey) {
            const hasConsent = await detectConsentInTranscript(transcriptForAnalysis, lovableApiKey);
            if (hasConsent) {
              shouldSendFollowup = true;
              console.log(`[vapi-webhook] Consent detected in transcript`);
            } else {
              console.log(`[vapi-webhook] No consent detected in transcript for call ${voiceCall.id}`);
            }
          } else {
            console.error("[vapi-webhook] LOVABLE_API_KEY not configured for consent detection");
          }
        }

        if (shouldSendFollowup) {
          console.log(`[vapi-webhook] Sending WhatsApp follow-up for call ${voiceCall.id}`);
          await sendWhatsAppFollowup(
            supabase,
            voiceCall.id,
            voiceCall.contact_id,
            voiceCall.organization_id,
            voiceCall.whatsapp_followup_text,
            voiceCall.whatsapp_followup_file_url
          );
        }
      }

      // External webhook CTA: fire POST to configured webhook_url
      if (voiceCall.webhook_url) {
        try {
          const transcriptForWebhook = structuredTranscript.length > 0
            ? structuredTranscript.map(t => `${t.role === "ai" ? "Assistente" : "Cliente"}: ${t.content}`).join("\n")
            : rawTranscript;

          let consentDetected = false;
          const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
          if (lovableKey && transcriptForWebhook?.trim()) {
            consentDetected = await detectConsentInTranscript(transcriptForWebhook, lovableKey);
          }

          // Fetch contact info for payload
          const { data: contactInfo } = await supabase
            .from("contacts")
            .select("name, phone")
            .eq("id", voiceCall.contact_id)
            .single();

          // Fetch call_reason
          const { data: callInfo } = await supabase
            .from("voice_calls")
            .select("call_reason")
            .eq("id", voiceCall.id)
            .single();

          const webhookPayload = {
            name: contactInfo?.name || "",
            phone: contactInfo?.phone || "",
            call_reason: callInfo?.call_reason || "",
            summary: summary || "",
            transcript: transcriptForWebhook || "",
            consent_detected: consentDetected,
          };

          const webhookRes = await fetch(voiceCall.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
          });

          console.log(`[vapi-webhook] External webhook POST to ${voiceCall.webhook_url}: ${webhookRes.status}`);
        } catch (webhookErr) {
          console.error("[vapi-webhook] External webhook error:", webhookErr);
        }
      }

      // Trigger automation flow: execute flow_steps directly via OpenBot API
      if (voiceCall.campaign_id) {
        try {
          const { data: campaignFlow } = await supabase
            .from("voice_campaigns")
            .select("flow_id, webhook_enabled")
            .eq("id", voiceCall.campaign_id)
            .single();

          if (campaignFlow?.webhook_enabled && campaignFlow?.flow_id) {
            console.log(`[vapi-webhook] Executing flow ${campaignFlow.flow_id} for campaign ${voiceCall.campaign_id}`);

            // Fetch flow steps
            const { data: flowSteps, error: stepsErr } = await supabase
              .from("flow_steps")
              .select("step_type, text_content, file_id, delay_ms, order_index")
              .eq("flow_id", campaignFlow.flow_id)
              .order("order_index", { ascending: true });

            if (stepsErr || !flowSteps || flowSteps.length === 0) {
              console.error(`[vapi-webhook] No flow steps found for flow ${campaignFlow.flow_id}:`, stepsErr);
            } else {
              // Get contact phone
              const { data: flowContact } = await supabase
                .from("contacts")
                .select("phone, name, instance_id")
                .eq("id", voiceCall.contact_id)
                .single();

              if (!flowContact?.phone) {
                console.error(`[vapi-webhook] Contact ${voiceCall.contact_id} has no phone for flow`);
              } else {
                // Get OpenBot API key (instance-level first, then org-level)
                const { decrypt } = await import("../_shared/encryption.ts");
                let flowApiKey = "";

                if (flowContact.instance_id) {
                  const { data: inst } = await supabase
                    .from("instances")
                    .select("openbot_api_key_encrypted")
                    .eq("id", flowContact.instance_id)
                    .single();
                  if (inst?.openbot_api_key_encrypted) {
                    flowApiKey = (await decrypt(inst.openbot_api_key_encrypted)).trim();
                  }
                }

                if (!flowApiKey) {
                  const { data: orgCfg } = await supabase
                    .from("crm_openbot_config")
                    .select("openbot_api_key_encrypted")
                    .eq("organization_id", voiceCall.organization_id)
                    .single();
                  if (orgCfg?.openbot_api_key_encrypted) {
                    flowApiKey = (await decrypt(orgCfg.openbot_api_key_encrypted)).trim();
                  }
                }

                if (!flowApiKey) {
                  console.error(`[vapi-webhook] No OpenBot API key for flow execution`);
                } else {
                  const flowPhone = flowContact.phone.replace(/\D/g, "");
                  const SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

                  for (const step of flowSteps) {
                    // Apply delay before step
                    if (step.delay_ms && step.delay_ms > 0) {
                      await new Promise(r => setTimeout(r, step.delay_ms));
                    }

                    // Replace variables in text
                    let stepText = step.text_content || "";
                    stepText = stepText.replace(/\{\{NOME\}\}/gi, flowContact.name || "");
                    stepText = stepText.replace(/\{\{TELEFONE\}\}/gi, flowContact.phone || "");

                    if (step.step_type === "file" && step.file_id) {
                      // Fetch file info from storage
                      const { data: fileData } = await supabase
                        .from("files")
                        .select("storage_path, file_name, mime_type")
                        .eq("id", step.file_id)
                        .single();

                      if (fileData) {
                        // Download and convert to base64 Data URL (same as CRM)
                        const fileBase64 = await downloadStorageFileAsBase64(
                          supabase,
                          "flow-files",
                          fileData.storage_path,
                          fileData.file_name,
                          fileData.mime_type,
                        );

                        const payload: Record<string, unknown> = {
                          apiKey: flowApiKey,
                          phone: flowPhone,
                          message: stepText,
                          desativarFluxo: true,
                        };
                        if (fileBase64) {
                          payload.arquivo = fileBase64;
                        }

                        const res = await fetch(SEND_URL, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        console.log(`[vapi-webhook] Flow step ${step.order_index} (file) sent: ${res.status}`);
                      }
                    } else if (stepText) {
                      // Text step
                      const res = await fetch(SEND_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          apiKey: flowApiKey,
                          phone: flowPhone,
                          message: stepText,
                          desativarFluxo: true,
                        }),
                      });
                      console.log(`[vapi-webhook] Flow step ${step.order_index} (text) sent: ${res.status}`);
                    }
                  }

                  console.log(`[vapi-webhook] Flow ${campaignFlow.flow_id} executed: ${flowSteps.length} steps sent`);
                }
              }
            }
          }
        } catch (flowErr) {
          console.error("[vapi-webhook] Flow automation trigger error:", flowErr);
        }
      }

      // If part of a campaign, update campaign stats and trigger next call
      if (voiceCall.campaign_id) {
        // Update campaign contact status
        await supabase
          .from("voice_campaign_contacts")
          .update({ status: "completed" })
          .eq("campaign_id", voiceCall.campaign_id)
          .eq("contact_id", voiceCall.contact_id);

        // Increment completed_calls
        const { data: campaign } = await supabase
          .from("voice_campaigns")
          .select("completed_calls, failed_calls, total_contacts")
          .eq("id", voiceCall.campaign_id)
          .single();

        if (campaign) {
          const newCompleted = (campaign.completed_calls || 0) + 1;
          const totalDone = newCompleted + (campaign.failed_calls || 0);
          const isFinished = totalDone >= campaign.total_contacts;

          await supabase
            .from("voice_campaigns")
            .update({
              completed_calls: newCompleted,
              status: isFinished ? "completed" : "running",
            })
            .eq("id", voiceCall.campaign_id);
        }
      }

      console.log(`[vapi-webhook] Processed end-of-call-report for call ${vapiCallId}`);
    } else if (eventType === "status-update") {
      const statusData = message || body;
      const vapiCallId = statusData.call?.id;
      const status = statusData.status;

      if (vapiCallId && status) {
        const statusMap: Record<string, string> = {
          ringing: "ringing",
          "in-progress": "in_progress",
          forwarding: "in_progress",
          ended: "completed",
        };

        const mappedStatus = statusMap[status] || status;

        await supabase
          .from("voice_calls")
          .update({ status: mappedStatus })
          .eq("vapi_call_id", vapiCallId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[vapi-webhook] Error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
