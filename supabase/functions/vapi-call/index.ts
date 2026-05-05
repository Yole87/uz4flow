import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



const VAPI_API_URL = "https://api.vapi.ai";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Get user's organization
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: orgMember } = await adminClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const organizationId = orgMember.organization_id;

    const body = await req.json();
    const { action } = body;

    // Get Vapi config
    const { data: config } = await adminClient
      .from("crm_openbot_config")
      .select("vapi_api_key_encrypted, vapi_phone_number_id, vapi_default_voice")
      .eq("organization_id", organizationId)
      .single();

    if (action === "create") {
      const { contact_id, call_type, assistant_config, script_content, first_message, call_reason } = body;

      if (!contact_id) {
        return new Response(JSON.stringify({ error: "contact_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract follow-up fields
      const whatsappFollowupEnabled = body.whatsapp_followup_enabled || false;
      const whatsappFollowupText = body.whatsapp_followup_text || null;
      const whatsappFollowupFileUrl = body.whatsapp_followup_file_url || null;

      if (!config?.vapi_api_key_encrypted) {
        return new Response(JSON.stringify({ error: "Vapi API key not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const vapiApiKey = (await decrypt(config.vapi_api_key_encrypted)).trim();

      // Get contact phone
      const { data: contact } = await adminClient
        .from("contacts")
        .select("phone")
        .eq("id", contact_id)
        .single();

      if (!contact?.phone) {
        return new Response(JSON.stringify({ error: "Contact has no phone number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get or create conversation
      const { data: conversation } = await adminClient
        .from("conversations")
        .select("id")
        .eq("contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let conversationId = conversation?.id || null;

      // Format phone number for Vapi (E.164: +countrycode number)
      let phoneNumber = contact.phone.replace(/\D/g, "");
      // If number starts with 0, remove leading zero
      if (phoneNumber.startsWith("0")) {
        phoneNumber = phoneNumber.substring(1);
      }
      // Brazilian numbers: if 10-11 digits without country code, prepend +55
      if (phoneNumber.length >= 10 && phoneNumber.length <= 11 && !phoneNumber.startsWith("55")) {
        phoneNumber = "+55" + phoneNumber;
      } else if (!phoneNumber.startsWith("+")) {
        phoneNumber = "+" + phoneNumber;
      }

      // Build Vapi call payload
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook`;

      const isScript = call_type === "script";

      const vapiPayload: Record<string, unknown> = {
        type: "outboundPhoneCall",
        name: `CRM-${contact.phone}`.substring(0, 40),
        customer: { number: phoneNumber },
      };

      if (config.vapi_phone_number_id && config.vapi_phone_number_id.trim()) {
        vapiPayload.phoneNumberId = config.vapi_phone_number_id.trim();
      } else {
        // Vapi requires either phoneNumberId or phoneNumber for outbound calls
        console.error("[vapi-call] No phoneNumberId configured. Outbound calls require a Vapi phone number.");
        return new Response(JSON.stringify({ error: "Phone Number ID não configurado. Configure nas configurações do Vapi." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const commonAssistantConfig = {
        language: "pt-BR",
        transcriber: {
          provider: "deepgram",
          language: "pt-BR",
        },
        voice: {
          provider: "11labs",
          voiceId: config.vapi_default_voice || "pFZP5JQG7iQjIQuC4Bku",
        },
        serverUrl: webhookUrl,
        hipaaEnabled: false,
        clientMessages: ["transcript", "hang", "speech-update"],
        serverMessages: ["end-of-call-report", "status-update", "transcript"],
        voicemailDetection: "off",
      };

      if (isScript) {
        vapiPayload.assistant = {
          ...commonAssistantConfig,
          firstMessage: script_content || first_message || "Olá!",
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "Você é um assistente de atendimento que fala português brasileiro. Leia a mensagem inicial e aguarde a resposta do cliente. Se o cliente confirmar interesse, registre a ação. Seja breve e direto. NUNCA fale em inglês.",
              },
            ],
          },
          endCallMessage: "Obrigado pela atenção. Até logo!",
          maxDurationSeconds: 120,
        };
      } else {
      if (assistant_config) {
          // Merge user config preserving their firstMessage and model, but forcing language/voice/server
          const userModel = assistant_config.model || {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Você é um assistente de atendimento profissional e amigável que fala português brasileiro. Converse naturalmente com o cliente, entenda suas necessidades e ofereça ajuda. NUNCA fale em inglês.",
              },
            ],
          };
          vapiPayload.assistant = {
            ...commonAssistantConfig,
            firstMessage: assistant_config.firstMessage || first_message || "Olá! Tudo bem?",
            model: userModel,
            maxDurationSeconds: assistant_config.maxDurationSeconds || 300,
            serverUrl: webhookUrl,
          };
        } else {
          vapiPayload.assistant = {
            ...commonAssistantConfig,
            firstMessage: first_message || "Olá! Tudo bem?",
            model: {
              provider: "openai",
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "Você é um assistente de atendimento profissional e amigável que fala português brasileiro. Converse naturalmente com o cliente, entenda suas necessidades e ofereça ajuda. NUNCA fale em inglês.",
                },
              ],
            },
            maxDurationSeconds: 300,
          };
        }
      }

      // Create voice_call record first
      const { data: voiceCall, error: insertError } = await adminClient
        .from("voice_calls")
        .insert({
          organization_id: organizationId,
          contact_id,
          conversation_id: conversationId,
          call_type: isScript ? "script" : "conversational",
          status: "pending",
          script_content: isScript ? (script_content || first_message) : null,
          assistant_config: vapiPayload.assistant,
          call_reason: call_reason || null,
          whatsapp_followup_enabled: whatsappFollowupEnabled,
          whatsapp_followup_text: whatsappFollowupText,
          whatsapp_followup_file_url: whatsappFollowupFileUrl,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[vapi-call] Failed to create voice_call:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create call record" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call Vapi API
      const vapiResponse = await fetch(`${VAPI_API_URL}/call`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vapiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vapiPayload),
      });

      const vapiResult = await vapiResponse.json();

      if (!vapiResponse.ok) {
        console.error("[vapi-call] Vapi API error:", vapiResult);
        await adminClient
          .from("voice_calls")
          .update({ status: "failed", ended_reason: vapiResult.message || "API error" })
          .eq("id", voiceCall.id);

        return new Response(
          JSON.stringify({ error: vapiResult.message || "Vapi API error", details: vapiResult }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update with Vapi call ID
      await adminClient
        .from("voice_calls")
        .update({
          vapi_call_id: vapiResult.id,
          status: "ringing",
        })
        .eq("id", voiceCall.id);

      return new Response(
        JSON.stringify({
          success: true,
          voice_call_id: voiceCall.id,
          vapi_call_id: vapiResult.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "save-config") {
      const { vapi_api_key, vapi_phone_number_id, vapi_default_voice } = body;

      const { encrypt } = await import("../_shared/encryption.ts");

      const updateData: Record<string, unknown> = {};
      if (vapi_api_key) {
        updateData.vapi_api_key_encrypted = await encrypt(vapi_api_key);
      }
      if (vapi_phone_number_id !== undefined) {
        updateData.vapi_phone_number_id = vapi_phone_number_id;
      }
      if (vapi_default_voice !== undefined) {
        updateData.vapi_default_voice = vapi_default_voice;
      }

      // Upsert config
      const { data: existing } = await adminClient
        .from("crm_openbot_config")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("crm_openbot_config")
          .update(updateData)
          .eq("organization_id", organizationId);
      } else {
        await adminClient.from("crm_openbot_config").insert({
          organization_id: organizationId,
          ...updateData,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-config") {
      const hasKey = !!config?.vapi_api_key_encrypted;
      return new Response(
        JSON.stringify({
          configured: hasKey,
          phone_number_id: config?.vapi_phone_number_id || null,
          default_voice: config?.vapi_default_voice || "pt-BR-female",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[vapi-call] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
