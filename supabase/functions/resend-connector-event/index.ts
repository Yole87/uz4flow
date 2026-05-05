import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-client.ts";

interface ConnectorEvent {
  id: string;
  connector_id: string;
  user_id: string;
  received_payload: Record<string, unknown>;
  status: string;
}

interface WebhookConnector {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  field_mappings: FieldMapping[] | null;
  message_config: MessageConfig | null;
  target_phone_field: string | null;
}

interface FieldMapping {
  path: string;
  label: string;
}

interface MessageConfig {
  type: "fixed" | "ai";
  template?: string;
  ai_prompt?: string;
}

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

interface Integration {
  openbot_api_key_encrypted: string | null;
  openbot_inbound_url: string | null;
}

// Utility functions - use shared encryption helper
async function decryptApiKey(encrypted: string): Promise<string> {
  return await decrypt(encrypted);
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function replaceVariables(template: string, mappings: FieldMapping[], payload: Record<string, unknown>): string {
  let result = template;
  for (const mapping of mappings) {
    const value = getValueByPath(payload, mapping.path);
    const placeholder = `{{${mapping.label}}}`;
    result = result.replaceAll(placeholder, String(value ?? ""));
  }
  return result;
}

function extractPhoneNumber(payload: Record<string, unknown>, phoneField: string): string | null {
  const value = getValueByPath(payload, phoneField);
  if (!value) return null;
  const phone = String(value).replace(/[^\d+]/g, "");
  if (phone.startsWith("+")) return phone.substring(1);
  if (phone.length === 10 || phone.length === 11) return "55" + phone;
  return phone;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateAIMessage(
  prompt: string,
  mappings: FieldMapping[],
  payload: Record<string, unknown>
): Promise<string> {
  const fieldContext = mappings.map(m => {
    const value = getValueByPath(payload, m.path);
    return `${m.label}: ${JSON.stringify(value)}`;
  }).join("\n");

  const systemPrompt = `Você é um assistente que cria mensagens para WhatsApp.
Dados disponíveis:
${fieldContext}

Regras:
- Crie mensagens curtas e diretas
- Use emojis com moderação
- Responda APENAS com a mensagem`;

  const aiResult = await callAI({
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    max_tokens: 500,
  });

  if (!aiResult.ok) throw new Error(`AI error: ${aiResult.status}`);
  return aiResult.data?.choices?.[0]?.message?.content?.trim() || "";
}

async function sendToOpenBot(
  url: string,
  apiKey: string,
  phone: string,
  message: string,
  maxRetries: number = 3
): Promise<{ success: boolean; response?: unknown; error?: string; attempts: number }> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Resend] OpenBot attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, phone, message, desativarFluxo: true }),
      });

      const responseText = await response.text();
      let responseJson: unknown;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { raw: responseText };
      }

      const responseData = {
        status_code: response.status,
        body: responseJson,
        timestamp: new Date().toISOString(),
      };

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        if (response.status >= 500 && attempt < maxRetries) {
          await sleep(attempt * 1000);
          continue;
        }
        return { success: false, error: lastError, response: responseData, attempts: attempt };
      }

      if (typeof responseJson === "object" && responseJson !== null) {
        const json = responseJson as Record<string, unknown>;
        if (json.success === false || json.error) {
          lastError = `OpenBot error: ${JSON.stringify(json)}`;
          return { success: false, error: lastError, response: responseData, attempts: attempt };
        }
      }

      console.log(`[Resend] Success on attempt ${attempt}`);
      return { success: true, response: responseData, attempts: attempt };

    } catch (error) {
      lastError = String(error);
      if (attempt < maxRetries) {
        await sleep(attempt * 1000);
        continue;
      }
      return { success: false, error: lastError, attempts: attempt };
    }
  }

  return { success: false, error: lastError, attempts: maxRetries };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get auth token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get event ID from body
  let eventId: string;
  try {
    const body = await req.json();
    eventId = body.event_id;
    if (!eventId) throw new Error("Missing event_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[Resend] Processing event ${eventId} for user ${user.id}`);

  // Get the event
  const { data: event, error: eventError } = await supabase
    .from("connector_events")
    .select("*")
    .eq("id", eventId)
    .eq("user_id", user.id)
    .single();

  if (eventError || !event) {
    return new Response(JSON.stringify({ error: "Event not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const typedEvent = event as ConnectorEvent;

  // Get connector
  const { data: connector, error: connectorError } = await supabase
    .from("webhook_connectors")
    .select("*")
    .eq("id", typedEvent.connector_id)
    .single();

  if (connectorError || !connector) {
    return new Response(JSON.stringify({ error: "Connector not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const typedConnector = connector as WebhookConnector;

  // Get user's organization
  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (memberError || !membership) {
    return new Response(JSON.stringify({ error: "Organization not found" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = (membership as { organization_id: string }).organization_id;

  // Try to get API key from instances table (preferred)
  const { data: instances } = await supabase
    .from("instances")
    .select("openbot_api_key_encrypted")
    .eq("organization_id", orgId)
    .not("openbot_api_key_encrypted", "is", null)
    .limit(1);

  let encryptedApiKey: string | null = null;

  // Find first instance with a valid key (min 20 chars to skip truncated/garbage keys)
  const validInstance = (instances || []).find(
    (inst: { openbot_api_key_encrypted: string }) => inst.openbot_api_key_encrypted && inst.openbot_api_key_encrypted.length >= 20
  );

  if (validInstance) {
    encryptedApiKey = (validInstance as { openbot_api_key_encrypted: string }).openbot_api_key_encrypted;
    console.log("[Resend] Using API key from instances table");
  } else {
    // Fallback: try legacy integrations table
    const { data: integration } = await supabase
      .from("integrations")
      .select("openbot_api_key_encrypted")
      .eq("user_id", user.id)
      .single();

    if (integration) {
      encryptedApiKey = (integration as { openbot_api_key_encrypted: string | null }).openbot_api_key_encrypted;
      console.log("[Resend] Fallback: Using API key from integrations table");
    }
  }

  if (!encryptedApiKey) {
    return new Response(JSON.stringify({ error: "API Key not configured" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update event to processing
  await supabase
    .from("connector_events")
    .update({ status: "sending", error_message: null })
    .eq("id", eventId);

  try {
    const payload = typedEvent.received_payload;
    const mappings = typedConnector.field_mappings || [];
    const messageConfig = typedConnector.message_config;

    // Extract phone
    if (!typedConnector.target_phone_field) {
      throw new Error("Phone field not configured");
    }
    const phone = extractPhoneNumber(payload, typedConnector.target_phone_field);
    if (!phone) {
      throw new Error("Phone number not found");
    }

    // Generate message
    let message: string;
    if (!messageConfig) {
      throw new Error("Message config not configured");
    }
    if (messageConfig.type === "fixed" && messageConfig.template) {
      message = replaceVariables(messageConfig.template, mappings, payload);
    } else if (messageConfig.type === "ai" && messageConfig.ai_prompt) {
      message = await generateAIMessage(messageConfig.ai_prompt, mappings, payload);
    } else {
      throw new Error("Invalid message configuration");
    }

    // Update message
    await supabase
      .from("connector_events")
      .update({ generated_message: message })
      .eq("id", eventId);

    // Send to OpenBot
    const apiKey = await decryptApiKey(encryptedApiKey);
    const result = await sendToOpenBot(
      OPENBOT_SEND_URL,
      apiKey,
      phone,
      message
    );

    // Build transformed payload
    const transformedPayload = {
      phone,
      message,
      resent_at: new Date().toISOString(),
      fields: mappings.reduce((acc, m) => {
        acc[m.label] = getValueByPath(payload, m.path);
        return acc;
      }, {} as Record<string, unknown>),
    };

    // Update final status
    await supabase
      .from("connector_events")
      .update({
        transformed_payload: transformedPayload,
        openbot_response: { 
          ...result.response as object, 
          resent: true, 
          attempts: result.attempts 
        },
        status: result.success ? "sent" : "failed",
        error_message: result.error || null,
      })
      .eq("id", eventId);

    console.log(`[Resend] Event ${eventId} completed:`, result.success);

    return new Response(JSON.stringify({ 
      success: result.success,
      message: result.success ? "Evento reenviado com sucesso" : "Falha ao reenviar",
      error: result.error 
    }), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[Resend] Error:`, error);
    
    await supabase
      .from("connector_events")
      .update({
        status: "failed",
        error_message: String(error),
      })
      .eq("id", eventId);

    return new Response(JSON.stringify({ 
      success: false, 
      error: String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
