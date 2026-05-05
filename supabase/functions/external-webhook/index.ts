import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { callAI } from "../_shared/ai-client.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = ReturnType<typeof createClient>;

interface ConnectorInteraction {
  id: string;
  order_index: number;
  type: "text" | "file";
  text_mode?: "fixed" | "ai";
  template?: string;
  ai_prompt?: string;
  file_id?: string;
  file_name?: string;
  delay_ms: number;
}

interface WebhookConnector {
  id: string;
  user_id: string;
  name: string;
  source_type: string;
  is_active: boolean;
  sample_payload: Record<string, unknown> | null;
  field_mappings: FieldMapping[] | null;
  message_config: MessageConfig | null; // Legacy
  interactions: ConnectorInteraction[] | null; // New
  target_phone_field: string | null;
}

interface FieldMapping {
  path: string;
  label: string;
  value?: unknown;
}

// Legacy interface for backward compatibility
interface MessageConfig {
  type: "fixed" | "ai";
  template?: string;
  ai_prompt?: string;
}

// Translation map for common platform values (Kiwify, Hotmart, etc.)
const VALUE_TRANSLATIONS: Record<string, string> = {
  // Kiwify order statuses
  "waiting_payment": "Aguardando Pagamento",
  "paid": "Pago",
  "refused": "Recusado",
  "refunded": "Reembolsado",
  "chargedback": "Chargeback",
  "expired": "Expirado",
  "delayed": "Atrasado",
  "completed": "Concluído",
  // Kiwify payment methods
  "credit_card": "Cartão de Crédito",
  "boleto": "Boleto",
  "pix": "Pix",
  // Kiwify webhook event types
  "order_paid": "Pedido Pago",
  "order_refunded": "Pedido Reembolsado",
  "order_chargedback": "Chargeback Recebido",
  "pix_created": "Pix Criado",
  "subscription_created": "Assinatura Criada",
  "subscription_cancelled": "Assinatura Cancelada",
  "subscription_renewed": "Assinatura Renovada",
  // Kiwify sale types
  "producer": "Produtor",
  "coproducer": "Coprodutor",
  "affiliate": "Afiliado",
  // Hotmart common statuses
  "approved": "Aprovado",
  "canceled": "Cancelado",
  "billet_printed": "Boleto Impresso",
  "processing_transaction": "Processando",
};

// Translate a raw value if it exists in the translation map
function translateValue(raw: unknown): string {
  if (typeof raw === "string" && VALUE_TRANSLATIONS[raw]) {
    return VALUE_TRANSLATIONS[raw];
  }
  return String(raw ?? "");
}

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

interface Integration {
  openbot_api_key_encrypted: string | null;
  openbot_inbound_url: string | null;
}

interface OpenBotResponse {
  success: boolean;
  response?: {
    status_code: number;
    headers: Record<string, string>;
    body: unknown;
    raw_text?: string;
    timestamp: string;
  };
  error?: string;
  attempts?: number;
}

interface InteractionResult {
  order: number;
  type: string;
  status: "sent" | "failed" | "skipped";
  latency_ms?: number;
  error?: string;
  message?: string;
}

// Decrypt API key (uses AES-256-GCM with fallback to legacy base64)
async function decryptApiKey(encrypted: string): Promise<string> {
  try {
    return await decrypt(encrypted);
  } catch {
    // If all else fails, return as-is (shouldn't happen)
    console.error("[Webhook] Decryption failed for API key");
    return encrypted;
  }
}

// Extract value from nested object using dot notation path
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

// Replace variables in template with actual values
function replaceVariables(template: string, mappings: FieldMapping[], payload: Record<string, unknown>): string {
  let result = template;
  
  for (const mapping of mappings) {
    const rawValue = getValueByPath(payload, mapping.path);
    const placeholder = `{{${mapping.label}}}`;
    result = result.replaceAll(placeholder, translateValue(rawValue));
  }
  
  return result;
}

// Extract phone number from payload using the configured field
function extractPhoneNumber(payload: Record<string, unknown>, phoneField: string): string | null {
  const value = getValueByPath(payload, phoneField);
  if (!value) return null;
  
  // Clean phone number - remove non-numeric except +
  const phone = String(value).replace(/[^\d+]/g, "");
  
  // Ensure it starts with country code
  if (phone.startsWith("+")) {
    return phone.substring(1); // Remove + for OpenBot
  }
  
  // If no country code, assume Brazil (+55)
  if (phone.length === 10 || phone.length === 11) {
    return "55" + phone;
  }
  
  return phone;
}

async function generateAIMessage(
  prompt: string,
  mappings: FieldMapping[],
  payload: Record<string, unknown>,
  organizationId?: string
): Promise<string> {
  // Build context from selected fields
  const fieldContext = mappings.map(m => {
    const rawValue = getValueByPath(payload, m.path);
    const displayValue = typeof rawValue === "string" && VALUE_TRANSLATIONS[rawValue] ? VALUE_TRANSLATIONS[rawValue] : rawValue;
    return `${m.label}: ${JSON.stringify(displayValue)}`;
  }).join("\n");
  
  const systemPrompt = `Você é um assistente que cria mensagens para WhatsApp.
Você receberá dados de um webhook e deve criar uma mensagem baseada nas instruções do usuário.

Dados disponíveis:
${fieldContext}

Regras:
- Crie mensagens curtas e diretas
- Use emojis com moderação
- Não use markdown ou formatação especial
- A mensagem deve ser adequada para WhatsApp
- Responda APENAS com a mensagem, sem explicações`;

  const aiResult = await callAI({
    organizationId,
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    max_tokens: 500,
  });
  
  if (!aiResult.ok) {
    const errorText = aiResult.error || "unknown";
    console.error("AI error:", aiResult.status, errorText);
    throw new Error(`AI error: ${aiResult.status}`);
  }
  
  return aiResult.data?.choices?.[0]?.message?.content?.trim() || "";
}

// Sleep utility for retry backoff and delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Convert ArrayBuffer to base64 safely (handles large files without stack overflow)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Process 8KB at a time to avoid stack overflow
  let binary = "";
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

// Get file from storage and convert to base64
async function getFileAsBase64(supabase: SupabaseClientAny, fileId: string, userId: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // Get file record
    const { data: fileRecord, error: fileError } = await supabase
      .from("files")
      .select("storage_path, mime_type")
      .eq("id", fileId)
      .eq("user_id", userId)
      .single();

    if (fileError || !fileRecord) {
      console.error("[File] File not found:", fileId, fileError);
      return null;
    }

    const typedRecord = fileRecord as { storage_path: string; mime_type: string };

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("flow-files")
      .download(typedRecord.storage_path);

    if (downloadError || !fileData) {
      console.error("[File] Download error:", downloadError);
      return null;
    }

    // Convert to base64 using chunked method (prevents stack overflow on large files)
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    console.log(`[File] Converted file to base64: ${arrayBuffer.byteLength} bytes`);
    
    return {
      base64: `data:${typedRecord.mime_type};base64,${base64}`,
      mimeType: typedRecord.mime_type,
    };
  } catch (error) {
    console.error("[File] Error getting file:", error);
    return null;
  }
}

// Send message to OpenBot with retry logic
async function sendToOpenBotWithRetry(
  url: string,
  apiKey: string,
  phone: string,
  message: string | null,
  arquivo: string | null,
  desativarFluxo: boolean,
  maxRetries: number = 3
): Promise<OpenBotResponse> {
  let lastError: string | undefined;
  let lastResponse: OpenBotResponse["response"] | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // deno-lint-ignore no-explicit-any
      const payload: any = {
        apiKey,
        phone,
        desativarFluxo,
      };
      
      if (message) {
        payload.message = message;
      }
      if (arquivo) {
        payload.arquivo = arquivo;
      }
      
      console.log(`[OpenBot] Attempt ${attempt}/${maxRetries} - Sending to:`, { 
        url, 
        phone, 
        hasMessage: !!message,
        hasArquivo: !!arquivo,
        messageLength: message?.length || 0,
        desativarFluxo
      });
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const latency = Date.now() - startTime;
      
      const responseText = await response.text();
      
      // Capture full response details
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      console.log(`[OpenBot] Response received in ${latency}ms:`, {
        status: response.status,
        statusText: response.statusText,
        bodyPreview: responseText.substring(0, 500),
        attempt
      });
      
      let responseJson: unknown;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { raw: responseText };
      }
      
      lastResponse = {
        status_code: response.status,
        headers: responseHeaders,
        body: responseJson,
        raw_text: responseText.substring(0, 2000),
        timestamp: new Date().toISOString(),
      };
      
      // Check HTTP status
      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
        console.error(`[OpenBot] HTTP error on attempt ${attempt}:`, lastError);
        
        // Retry on 5xx errors, don't retry on 4xx
        if (response.status >= 500 && attempt < maxRetries) {
          await sleep(attempt * 1000);
          continue;
        }
        
        return { 
          success: false, 
          error: lastError, 
          response: lastResponse,
          attempts: attempt 
        };
      }
      
      // Validate response JSON for success field
      if (typeof responseJson === "object" && responseJson !== null) {
        const jsonObj = responseJson as Record<string, unknown>;
        
        if (jsonObj.success === false) {
          lastError = `OpenBot returned success:false - ${JSON.stringify(jsonObj)}`;
          console.error(`[OpenBot] API rejected on attempt ${attempt}:`, lastError);
          
          return { 
            success: false, 
            error: lastError, 
            response: lastResponse,
            attempts: attempt 
          };
        }
        
        if (jsonObj.error) {
          lastError = `OpenBot error: ${JSON.stringify(jsonObj.error)}`;
          console.error(`[OpenBot] Error in response on attempt ${attempt}:`, lastError);
          
          if (attempt < maxRetries) {
            await sleep(attempt * 1000);
            continue;
          }
          
          return { 
            success: false, 
            error: lastError, 
            response: lastResponse,
            attempts: attempt 
          };
        }
      }
      
      // Success!
      console.log(`[OpenBot] Success on attempt ${attempt}`);
      
      return { 
        success: true, 
        response: lastResponse,
        attempts: attempt 
      };
      
    } catch (error) {
      lastError = `Network error: ${String(error)}`;
      console.error(`[OpenBot] Exception on attempt ${attempt}:`, error);
      
      if (attempt < maxRetries) {
        await sleep(attempt * 1000);
        continue;
      }
      
      return { 
        success: false, 
        error: lastError,
        response: lastResponse,
        attempts: attempt 
      };
    }
  }
  
  return { 
    success: false, 
    error: lastError || "Max retries exceeded",
    response: lastResponse,
    attempts: maxRetries 
  };
}

// Security: Payload size limit (1MB)
const MAX_PAYLOAD_SIZE = 1024 * 1024;
// Security: Maximum JSON nesting depth
const MAX_NESTING_DEPTH = 10;

// Check JSON nesting depth to prevent stack overflow
function checkNestingDepth(obj: unknown, currentDepth = 0): boolean {
  if (currentDepth > MAX_NESTING_DEPTH) return false;
  if (typeof obj !== "object" || obj === null) return true;
  if (Array.isArray(obj)) {
    return obj.every(item => checkNestingDepth(item, currentDepth + 1));
  }
  return Object.values(obj).every(value => checkNestingDepth(value, currentDepth + 1));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: SupabaseClientAny = createClient(supabaseUrl, supabaseServiceKey);

  // Get token from query params
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token.length > 100) {
    console.error("[Webhook] Missing or invalid token parameter");
    return new Response(JSON.stringify({ error: "Missing or invalid token parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse payload with security validations
  let payload: Record<string, unknown>;
  try {
    const rawBody = await req.text();
    
    // Security: Check payload size
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      console.error("[Webhook] Payload too large:", rawBody.length, "bytes");
      return new Response(JSON.stringify({ error: "Payload too large (max 1MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    payload = JSON.parse(rawBody);
    
    // Security: Check nesting depth
    if (!checkNestingDepth(payload)) {
      console.error("[Webhook] Payload nesting too deep");
      return new Response(JSON.stringify({ error: "Payload structure too deeply nested" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("[Webhook] Received external webhook:", JSON.stringify(payload, null, 2).substring(0, 2000));
  } catch {
    console.error("[Webhook] Invalid JSON payload");
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find connector by token
  const { data: connector, error: connectorError } = await supabase
    .from("webhook_connectors")
    .select("*")
    .eq("webhook_token", token)
    .single();

  if (connectorError || !connector) {
    console.error("[Webhook] Connector not found for token:", token.substring(0, 10) + "...");
    return new Response(JSON.stringify({ error: "Connector not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const typedConnector = connector as WebhookConnector;
  console.log("[Webhook] Found connector:", typedConnector.name, typedConnector.id);

  // Check if this is a discovery request (no mappings configured yet)
  const isDiscovery = !typedConnector.field_mappings || typedConnector.field_mappings.length === 0;

  if (isDiscovery) {
    // Update connector with sample payload for discovery
    // deno-lint-ignore no-explicit-any
    await (supabase as any)
      .from("webhook_connectors")
      .update({ sample_payload: payload })
      .eq("id", typedConnector.id);

    // Create event for discovery
    // deno-lint-ignore no-explicit-any
    await (supabase as any)
      .from("connector_events")
      .insert({
        connector_id: typedConnector.id,
        user_id: typedConnector.user_id,
        received_payload: payload,
        status: "discovery",
      });

    console.log("[Webhook] Discovery mode - saved sample payload for connector:", typedConnector.id);
    
    return new Response(JSON.stringify({ 
      status: "discovery",
      message: "Payload recebido e salvo para configuração",
      connector_id: typedConnector.id
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Now check if connector is active
  if (!typedConnector.is_active) {
    console.log("[Webhook] Connector is inactive:", typedConnector.id);
    return new Response(JSON.stringify({ error: "Connector is inactive" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create event record
  // deno-lint-ignore no-explicit-any
  const { data: event, error: eventError } = await (supabase as any)
    .from("connector_events")
    .insert({
      connector_id: typedConnector.id,
      user_id: typedConnector.user_id,
      received_payload: payload,
      status: "pending",
    })
    .select("id")
    .single();

  if (eventError || !event) {
    console.error("[Webhook] Failed to create event:", eventError);
    return new Response(JSON.stringify({ error: "Failed to create event" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventId = (event as { id: string }).id;
  console.log("[Webhook] Created event:", eventId);

  // Process in background
  EdgeRuntime.waitUntil(processConnectorWebhook(
    supabase,
    eventId,
    typedConnector,
    payload
  ));

  return new Response(JSON.stringify({ 
    eventId, 
    status: "processing" 
  }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function processConnectorWebhook(
  supabase: SupabaseClientAny,
  eventId: string,
  connector: WebhookConnector,
  payload: Record<string, unknown>
) {
  console.log(`[Process] Starting processing for event ${eventId}`);
  
  const interactionResults: InteractionResult[] = [];
  let totalLatency = 0;
  let finalStatus = "failed";
  let finalErrorMessage: string | null = null;
  
  try {
    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", connector.user_id)
      .limit(1)
      .single();

    if (memberError || !membership) {
      throw new Error("[CONFIG_001] Organização não encontrada para o usuário. Verifique se o usuário possui uma organização ativa.");
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
      console.log("[Process] Using API key from instances table");
    } else {
      // Fallback: try legacy integrations table
      const { data: integration } = await supabase
        .from("integrations")
        .select("openbot_api_key_encrypted")
        .eq("user_id", connector.user_id)
        .single();

      if (integration) {
        encryptedApiKey = (integration as { openbot_api_key_encrypted: string | null }).openbot_api_key_encrypted;
        console.log("[Process] Fallback: Using API key from integrations table");
      }
    }

    if (!encryptedApiKey) {
      throw new Error("[CONFIG_002] API Key do WhatsApp AI não configurada. Adicione a API Key na configuração da instância.");
    }

    // Extract phone number
    if (!connector.target_phone_field) {
      throw new Error("[CONFIG_003] Campo de telefone não configurado. Selecione qual campo do webhook contém o número de telefone.");
    }

    const phone = extractPhoneNumber(payload, connector.target_phone_field);
    if (!phone) {
      throw new Error(`[DATA_001] Número de telefone não encontrado no payload no caminho: ${connector.target_phone_field}`);
    }
    
    console.log(`[Process] Extracted phone: ${phone}`);

    const apiKey = await decryptApiKey(encryptedApiKey);
    const mappings = connector.field_mappings || [];

    // Get interactions (new format) or migrate from legacy message_config
    let interactions: ConnectorInteraction[] = [];
    
    if (connector.interactions && connector.interactions.length > 0) {
      interactions = connector.interactions;
    } else if (connector.message_config) {
      // Legacy: migrate message_config to single interaction
      const legacy = connector.message_config;
      interactions = [{
        id: "legacy",
        order_index: 0,
        type: "text",
        text_mode: legacy.type,
        template: legacy.template,
        ai_prompt: legacy.ai_prompt,
        delay_ms: 0,
      }];
    }

    if (interactions.length === 0) {
      throw new Error("[CONFIG_004] Nenhuma interação configurada. Adicione pelo menos uma mensagem ou arquivo para enviar.");
    }

    // Sort interactions by order_index
    interactions.sort((a, b) => a.order_index - b.order_index);

    console.log(`[Process] Processing ${interactions.length} interactions`);

    // Update event status to sending
    // deno-lint-ignore no-explicit-any
    await (supabase as any)
      .from("connector_events")
      .update({ status: "sending" })
      .eq("id", eventId);

    // Process each interaction sequentially
    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];
      const isLast = i === interactions.length - 1;
      const startTime = Date.now();

      console.log(`[Process] Processing interaction ${i + 1}/${interactions.length}:`, {
        type: interaction.type,
        textMode: interaction.text_mode,
        isLast
      });

      try {
        let message: string | null = null;
        let arquivo: string | null = null;

        if (interaction.type === "text") {
          if (interaction.text_mode === "fixed" && interaction.template) {
            message = replaceVariables(interaction.template, mappings, payload);
            console.log(`[Process] Generated fixed message (${message.length} chars)`);
          } else if (interaction.text_mode === "ai" && interaction.ai_prompt) {
            try {
              message = await generateAIMessage(interaction.ai_prompt, mappings, payload);
              console.log(`[Process] Generated AI message (${message.length} chars)`);
            } catch (aiError) {
              const aiErrorStr = String(aiError);
              if (aiErrorStr.includes("not configured")) {
                throw new Error("[AI_001] Serviço de IA não disponível. Tente novamente mais tarde ou use um template fixo.");
              }
              throw new Error(`[AI_002] Erro ao gerar mensagem com IA: ${aiErrorStr}`);
            }
          } else {
            throw new Error("[INT_001] Configuração de texto inválida. Preencha o template ou prompt de IA.");
          }
        } else if (interaction.type === "file" && interaction.file_id) {
          try {
            const fileData = await getFileAsBase64(supabase, interaction.file_id, connector.user_id);
            if (!fileData) {
              throw new Error(`[DATA_002] Arquivo não encontrado: ${interaction.file_id}. O arquivo pode ter sido excluído.`);
            }
            arquivo = fileData.base64;
            console.log(`[Process] Got file base64 (${fileData.mimeType})`);
          } catch (fileError) {
            const fileErrorStr = String(fileError);
            if (fileErrorStr.includes("Maximum call stack size exceeded")) {
              throw new Error("[FILE_001] Arquivo muito grande para processar. Reduza o tamanho do arquivo (máximo recomendado: 5MB).");
            }
            if (fileErrorStr.includes("DATA_002")) {
              throw fileError;
            }
            throw new Error(`[FILE_002] Erro ao baixar arquivo: ${fileErrorStr}`);
          }
        } else {
          throw new Error("[INT_002] Configuração de interação inválida. Verifique se todos os campos obrigatórios estão preenchidos.");
        }

        // Send to OpenBot
        const result = await sendToOpenBotWithRetry(
          OPENBOT_SEND_URL,
          apiKey,
          phone,
          message,
          arquivo,
          isLast, // desativarFluxo only on last interaction
          3
        );

        const latency = Date.now() - startTime;
        totalLatency += latency;

        // Translate OpenBot errors
        let translatedError: string | undefined;
        if (result.error) {
          if (result.error.includes("Network error")) {
            translatedError = "[NET_001] Erro de conexão com o OpenBot. Verifique se a URL está correta e o serviço está online.";
          } else if (result.error.includes("HTTP 5")) {
            translatedError = "[NET_002] Servidor do OpenBot indisponível temporariamente.";
          } else if (result.error.includes("HTTP 4")) {
            translatedError = "[NET_003] Requisição rejeitada pelo OpenBot. Verifique a API Key e o formato do payload.";
          } else if (result.error.includes("success:false")) {
            translatedError = "[OB_001] OpenBot rejeitou a mensagem. Verifique se o número de telefone é válido.";
          } else if (result.error.includes("Max retries exceeded")) {
            translatedError = "[NET_004] Máximo de tentativas excedido. O OpenBot não está respondendo.";
          } else {
            translatedError = result.error;
          }
        }

        interactionResults.push({
          order: i,
          type: interaction.type,
          status: result.success ? "sent" : "failed",
          latency_ms: latency,
          error: translatedError,
          message: message?.substring(0, 100),
        });

        if (!result.success) {
          console.error(`[Process] Interaction ${i + 1} failed:`, result.error);
          // Continue to next interaction even if one fails
        }

        // Apply delay before next interaction (not after the last one)
        if (!isLast && interaction.delay_ms > 0) {
          console.log(`[Process] Waiting ${interaction.delay_ms}ms before next interaction`);
          await sleep(interaction.delay_ms);
        }

      } catch (interactionError) {
        const latency = Date.now() - startTime;
        totalLatency += latency;
        
        interactionResults.push({
          order: i,
          type: interaction.type,
          status: "failed",
          latency_ms: latency,
          error: String(interactionError),
        });
        console.error(`[Process] Interaction ${i + 1} error:`, interactionError);
      }
    }

    // Determine overall status
    const allSent = interactionResults.every(r => r.status === "sent");
    const allFailed = interactionResults.every(r => r.status === "failed");
    finalStatus = allFailed ? "failed" : (allSent ? "sent" : "partial");
    finalErrorMessage = interactionResults.find(r => r.error)?.error || null;

    // Build transformed payload
    const transformedPayload = {
      phone,
      fields: mappings.reduce((acc, m) => {
        acc[m.label] = getValueByPath(payload, m.path);
        return acc;
      }, {} as Record<string, unknown>),
      interactions_count: interactions.length,
    };

    // Update event with results
    // deno-lint-ignore no-explicit-any
    await (supabase as any)
      .from("connector_events")
      .update({
        transformed_payload: transformedPayload,
        interaction_results: {
          interactions: interactionResults,
          total_latency_ms: totalLatency,
        },
        status: finalStatus,
        generated_message: interactionResults.find(r => r.message)?.message || null,
        error_message: finalErrorMessage,
      })
      .eq("id", eventId);

    console.log(`[Process] Event ${eventId} completed:`, {
      status: finalStatus,
      interactions: interactionResults.length,
      totalLatency
    });

  } catch (error) {
    console.error(`[Process] Error processing event ${eventId}:`, error);
    
    const errorStr = String(error);
    finalErrorMessage = errorStr;
    finalStatus = "failed";
    
    // deno-lint-ignore no-explicit-any
    await (supabase as any)
      .from("connector_events")
      .update({
        status: finalStatus,
        error_message: finalErrorMessage,
        interaction_results: {
          interactions: interactionResults,
          error: finalErrorMessage,
        },
      })
      .eq("id", eventId);
  }
}
