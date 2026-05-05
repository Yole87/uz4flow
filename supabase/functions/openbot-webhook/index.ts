import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { z } from "https://deno.land/x/zod@v3.23.4/mod.ts";
import { decrypt } from "../_shared/encryption.ts";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";
import { getErrorMessage } from "../_shared/getErrorMessage.ts";

// Declare EdgeRuntime for Deno
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

// Permissive envelope schema: catches empty/garbage POSTs without rejecting any
// real OpenBot variant (Baileys, Meta, fluxo, base64, mediaUrl, etc.).
const WebhookEnvelopeSchema = z
  .object({
    instanceId: z.string().min(1).max(200).optional(),
    chatId: z.string().min(1).max(200).optional(),
    pushName: z.string().max(500).optional(),
    messageType: z.string().max(100).optional(),
    fromMe: z.boolean().optional(),
    message: z.unknown().optional(),
    fluxo: z.unknown().optional(),
    key: z.unknown().optional(),
    base64: z.string().optional(),
    mediaUrl: z.string().optional(),
  })
  .passthrough()
  .refine((d) => !!(d.instanceId || d.chatId || d.message || d.key), {
    message: "empty webhook payload",
  });

interface WebhookPayload {
  // Root-level fields (OpenBot standard format)
  instanceId?: string;
  chatId?: string;
  pushName?: string;
  messageType?: string;
  timestamp?: number;
  fromMe?: boolean;
  
  // Message can have different structures
  message?: {
    // Direct format: message.conversation
    conversation?: string;
    extendedTextMessage?: { text?: string };
    
    // Nested format: message.message.conversation
    message?: { 
      conversation?: string; 
      extendedTextMessage?: { text?: string };
    };
    
    // Legacy fields that may appear in message
    chatId?: string;
    pushName?: string;
    instanceId?: string;
    messageTimestamp?: string;
    
    key?: {
      remoteJid: string;
      remoteJidAlt?: string;
      fromMe: boolean;
      id: string;
    };
    
    messageContextInfo?: Record<string, unknown>;
    
    // File message types
    documentMessage?: {
      url?: string;
      mimetype?: string;
      fileName?: string;
      mediaKey?: string;
    };
    imageMessage?: {
      url?: string;
      mimetype?: string;
      caption?: string;
      mediaKey?: string;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
      seconds?: number;
      mediaKey?: string;
    };
    videoMessage?: {
      url?: string;
      mimetype?: string;
      caption?: string;
      seconds?: number;
      mediaKey?: string;
    };
  };
  
  // Flow info from OpenBot
  fluxo?: {
    id: string;
    nome: string;
    palavraChave: string;
    apenasWebhookSaida?: boolean;
    gatilhoPorConversaIniciada?: boolean;
  };
  
  // Key at root level
  key?: {
    remoteJid: string;
    remoteJidAlt?: string;
    id: string;
  };
  
  // Base64 file data (when user sends a file)
  base64?: string;
  mediaUrl?: string;
}

interface FlowStep {
  id: string;
  order_index: number;
  step_type: string;
  text_content: string | null;
  file_id: string | null;
  delay_ms: number;
  requires_response: boolean;
  variable_name: string | null;
  validation_type: string;
  invalid_response_message: string | null;
  step_timeout_minutes: number | null;
  accept_file_response: boolean;
  condition_config?: {
    variable: string;
    operator: string;
    value: string;
    conditions?: {
      variable: string;
      operator: string;
      value: string;
      subconditions?: { logic: string; variable: string; operator: string; value: string }[];
    }[];
  } | null;
  tag_config?: {
    action: string;
    tags: string[];
  } | null;
  lane_config?: {
    stage_id: string;
    stage_name: string;
  } | null;
  active_message_config?: {
    instance_id: string;
    filter_tags: string[];
    recipients: string[];
    content_items: {
      type: "text" | "interval" | "media";
      value?: string;
      delay_ms?: number;
      file_id?: string;
      file_name?: string;
    }[];
  } | null;
  random_config?: {
    splits: { percentage: number; label: string }[];
  } | null;
  delay_config?: {
    delay_seconds: number;
  } | null;
  menu_config?: {
    message: string;
    menu_type: string;
    options: string[];
    error_enabled: boolean;
    error_message: string;
  } | null;
  file?: {
    storage_path: string;
    mime_type: string;
    file_name: string;
  }[] | null;
}

interface FlowConnection {
  id: string;
  source_step_id: string;
  target_step_id: string;
  source_handle: string;
  condition_type: string | null;
  condition_operator: string | null;
  condition_value: string | null;
  condition_variable: string | null;
  label: string | null;
}

interface Flow {
  id: string;
  is_interactive: boolean;
  session_timeout_minutes: number;
  timeout_action: string;
  timeout_message: string | null;
}

interface FlowSession {
  id: string;
  user_id: string;
  flow_id: string;
  chat_id: string;
  instance_id: string;
  push_name: string | null;
  current_step_index: number;
  current_step_id: string | null;
  status: string;
  collected_data: Record<string, unknown>;
  timeout_at: string | null;
}

interface RoutingRule {
  id: string;
  match_type: string;
  match_value: string | null;
  instance_id: string | null;
  flow_id: string;
  priority: number;
}

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";
const META_GRAPH_API_VERSION = "v21.0";

interface Integration {
  openbot_api_key_encrypted: string | null;
  openbot_inbound_url: string | null;
  webhook_secret: string | null;
}

// Instance provider context resolved once per flow execution
interface InstanceContext {
  provider: "baileys" | "meta_official";
  apiKey: string; // Decrypted API key (OpenBot key for baileys, Meta token for meta_official)
  metaPhoneNumberId: string | null;
  instanceId: string; // openbot_instance_id
  organizationId: string | null;
}

// Send a message via the correct provider (Baileys or Meta Graph API)
async function sendMessage(
  ctx: InstanceContext,
  phone: string,
  options: {
    message?: string;
    arquivo?: string;       // base64 Data URL
    mimetype?: string;
    fileName?: string;
    desativarFluxo?: boolean;
    templateName?: string;
    templateLanguage?: string;
  }
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  if (ctx.provider === "meta_official" && ctx.metaPhoneNumberId) {
    return sendViaMeta(ctx, phone, options);
  }
  // Default: Baileys via OpenBot
  const payload: Record<string, unknown> = {
    apiKey: ctx.apiKey,
    phone,
    desativarFluxo: options.desativarFluxo ?? true,
  };
  if (options.message) payload.message = options.message;
  if (options.arquivo) {
    payload.arquivo = options.arquivo;
    if (options.mimetype) payload.mimetype = options.mimetype;
    if (options.fileName) payload.fileName = options.fileName;
  }
  return sendToOpenBot(OPENBOT_SEND_URL, payload);
}

// Send via Meta Graph API (mirrors crm-send-message logic)
async function sendViaMeta(
  ctx: InstanceContext,
  phone: string,
  options: {
    message?: string;
    arquivo?: string;
    mimetype?: string;
    fileName?: string;
    desativarFluxo?: boolean;
    templateName?: string;
    templateLanguage?: string;
  }
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = Date.now();
  const metaUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${ctx.metaPhoneNumberId}/messages`;

  let metaPayload: Record<string, unknown>;

  // Template sending (for active messages outside 24h window)
  if (options.templateName) {
    const lang = options.templateLanguage || "pt_BR";
    metaPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name: options.templateName, language: { code: lang } },
    };
  } else if (options.message && !options.arquivo) {
    metaPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: options.message },
    };
  } else if (options.desativarFluxo && !options.message) {
    // End node with no message — nothing to send via Meta
    return { success: true, latencyMs: Date.now() - startTime };
  } else {
    // Fallback to text
    metaPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: options.message || "[mídia]" },
    };
  }

  try {
    const resp = await fetchWithRetry(metaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ctx.apiKey}`,
      },
      body: JSON.stringify(metaPayload),
    });

    const result = await resp.json();
    if (!resp.ok) {
      const errorMsg = result?.error?.message || `Meta API ${resp.status}`;
      const errorCode = result?.error?.code;
      // Error 131047 = Window expired
      if (errorCode === 131047 || errorMsg.includes("Re-engagement message")) {
        return { success: false, latencyMs: Date.now() - startTime, error: `META_WINDOW_EXPIRED: ${errorMsg}` };
      }
      return { success: false, latencyMs: Date.now() - startTime, error: `META_API_ERROR: ${errorMsg}` };
    }
    return { success: true, latencyMs: Date.now() - startTime };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - startTime, error: `META_FETCH_ERROR: ${String(err)}` };
  }
}

// Check if Meta conversation window is still open for a given conversation
async function isMetaWindowOpen(
  supabase: SupabaseClient<any>,
  organizationId: string,
  phone: string,
  instanceId: string
): Promise<boolean> {
  try {
    // Find the contact + conversation for this phone/instance
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .or(`phone.eq.${phone},phone.like.%${phone}`)
      .limit(1)
      .maybeSingle();

    if (!contact) return false;

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (!conv) return false;

    // Check meta_conversation_windows
    const { data: windowData } = await (supabase as any)
      .from("meta_conversation_windows")
      .select("window_expires_at")
      .eq("conversation_id", conv.id)
      .maybeSingle();

    if (windowData?.window_expires_at) {
      return new Date(windowData.window_expires_at) > new Date();
    }

    // Fallback: check last customer message (24h window)
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("timestamp")
      .eq("conversation_id", conv.id)
      .eq("sender_type", "customer")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMsg?.timestamp) {
      const expires = new Date(lastMsg.timestamp).getTime() + 24 * 60 * 60 * 1000;
      return expires > Date.now();
    }

    return false;
  } catch (err) {
    console.warn("[Meta Window Check] Error:", err);
    return false; // Assume closed on error
  }
}

// Resolve instance context for the flow engine
async function resolveInstanceContext(
  supabase: SupabaseClient<any>,
  instanceId: string,
  integration: Integration
): Promise<InstanceContext> {
  // Try to find the instance in DB to check provider
  const { data: instance } = await supabase
    .from("instances")
    .select("id, provider, api_key_encrypted, meta_phone_number_id, openbot_instance_id, organization_id")
    .eq("openbot_instance_id", instanceId)
    .maybeSingle();

  if (instance && instance.provider === "meta_official" && instance.api_key_encrypted) {
    const metaToken = await decryptApiKey(instance.api_key_encrypted);
    return {
      provider: "meta_official",
      apiKey: metaToken,
      metaPhoneNumberId: instance.meta_phone_number_id || null,
      instanceId: instanceId,
      organizationId: instance.organization_id || null,
    };
  }

  // Default: Baileys via OpenBot
  const apiKey = integration.openbot_api_key_encrypted
    ? await decryptApiKey(integration.openbot_api_key_encrypted)
    : "";
  return {
    provider: "baileys",
    apiKey,
    metaPhoneNumberId: null,
    instanceId: instanceId,
    organizationId: instance?.organization_id || null,
  };
}

// Convert ArrayBuffer to base64 safely (handles large files without stack overflow)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Process 8KB at a time
  let binary = "";
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
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

// Extract message text from payload - handles multiple structures
function extractMessageText(payload: WebhookPayload): string {
  try {
    // Format 1: Direct message.conversation (OpenBot standard)
    if (payload.message?.conversation) {
      return payload.message.conversation;
    }
    
    // Format 2: Nested message.message.conversation
    if (payload.message?.message?.conversation) {
      return payload.message.message.conversation;
    }
    
    // Format 3: Direct extendedTextMessage
    if (payload.message?.extendedTextMessage?.text) {
      return payload.message.extendedTextMessage.text;
    }
    
    // Format 4: Nested extendedTextMessage
    if (payload.message?.message?.extendedTextMessage?.text) {
      return payload.message.message.extendedTextMessage.text;
    }
    
    // Format 5: Image/video caption
    if (payload.message?.imageMessage?.caption) {
      return payload.message.imageMessage.caption;
    }
    if (payload.message?.videoMessage?.caption) {
      return payload.message.videoMessage.caption;
    }
    
    return "";
  } catch (error) {
    console.error("Error extracting message text:", error);
    return "";
  }
}

// Check if payload contains a file
function extractFileFromPayload(payload: WebhookPayload): { 
  hasFile: boolean; 
  base64?: string; 
  url?: string;
  mimeType?: string; 
  fileName?: string;
  fileType?: string;
} {
  // Check for base64 directly in payload
  if (payload.base64) {
    return { 
      hasFile: true, 
      base64: payload.base64,
      mimeType: "application/octet-stream",
      fileName: `file_${Date.now()}`,
      fileType: "document"
    };
  }
  
  // Check for document message
  if (payload.message?.documentMessage) {
    const doc = payload.message.documentMessage;
    return {
      hasFile: true,
      url: doc.url || payload.mediaUrl,
      mimeType: doc.mimetype || "application/octet-stream",
      fileName: doc.fileName || `document_${Date.now()}`,
      fileType: "document"
    };
  }
  
  // Check for image message
  if (payload.message?.imageMessage) {
    const img = payload.message.imageMessage;
    return {
      hasFile: true,
      url: img.url || payload.mediaUrl,
      mimeType: img.mimetype || "image/jpeg",
      fileName: `image_${Date.now()}.${(img.mimetype || "image/jpeg").split("/")[1]}`,
      fileType: "image"
    };
  }
  
  // Check for audio message
  if (payload.message?.audioMessage) {
    const audio = payload.message.audioMessage;
    return {
      hasFile: true,
      url: audio.url || payload.mediaUrl,
      mimeType: audio.mimetype || "audio/ogg",
      fileName: `audio_${Date.now()}.${(audio.mimetype || "audio/ogg").split("/")[1]}`,
      fileType: "audio"
    };
  }
  
  // Check for video message
  if (payload.message?.videoMessage) {
    const video = payload.message.videoMessage;
    return {
      hasFile: true,
      url: video.url || payload.mediaUrl,
      mimeType: video.mimetype || "video/mp4",
      fileName: `video_${Date.now()}.${(video.mimetype || "video/mp4").split("/")[1]}`,
      fileType: "video"
    };
  }
  
  return { hasFile: false };
}

// Replace variables in text - handles multiple payload structures and collected data
function replaceVariables(text: string, payload: WebhookPayload, collectedData?: Record<string, unknown>): string {
  // Extract values with fallbacks for different payload formats
  const pushName = payload.pushName || payload.message?.pushName || "";
  const chatId = payload.chatId || payload.message?.chatId || 
    payload.message?.key?.remoteJid?.split("@")[0] || 
    payload.key?.remoteJid?.split("@")[0] || "";
  const instanceId = payload.instanceId || payload.message?.instanceId || "";
  
  let result = text
    .replace(/\{\{pushName\}\}/g, pushName)
    .replace(/\{\{chatId\}\}/g, chatId)
    .replace(/\{\{instanceId\}\}/g, instanceId)
    .replace(/\{\{messageText\}\}/g, extractMessageText(payload));
  
  // Replace collected data variables (supports nested keys via dot, e.g. {{voice.transcript}})
  if (collectedData) {
    for (const [key, value] of Object.entries(collectedData)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [nestedKey, nestedVal] of Object.entries(value as Record<string, unknown>)) {
          const regex = new RegExp(`\\{\\{${key}\\.${nestedKey}\\}\\}`, "g");
          result = result.replace(regex, String(nestedVal ?? ""));
        }
      } else {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        result = result.replace(regex, String(value ?? ""));
      }
    }
  }
  
  return result;
}

// Validate response based on validation type
function validateResponse(text: string, validationType: string): { valid: boolean; error?: string } {
  if (!text || text.trim() === "") {
    return { valid: false, error: "Resposta vazia" };
  }
  
  const trimmed = text.trim();
  
  switch (validationType) {
    case "any":
      return { valid: true };
      
    case "text":
      // Only letters and spaces
      if (/^[a-zA-ZÀ-ÿ\s]+$/.test(trimmed)) {
        return { valid: true };
      }
      return { valid: false, error: "Por favor, envie apenas texto (sem números ou símbolos)" };
      
    case "number":
      if (/^\d+$/.test(trimmed)) {
        return { valid: true };
      }
      return { valid: false, error: "Por favor, envie apenas números" };
      
    case "email":
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { valid: true };
      }
      return { valid: false, error: "Por favor, envie um email válido" };
      
    case "phone":
      // Remove common formatting and check for digits
      const digits = trimmed.replace(/[\s\-\(\)\+]/g, "");
      if (/^\d{10,15}$/.test(digits)) {
        return { valid: true };
      }
      return { valid: false, error: "Por favor, envie um telefone válido" };
      
    default:
      return { valid: true };
  }
}

// Verify HMAC signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expected = hmac.digest("hex");
    return signature === expected || signature === `sha256=${expected}`;
  } catch {
    return false;
  }
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Send webhook to OpenBot with retries
async function sendToOpenBot(
  url: string,
  payload: Record<string, unknown>,
  maxRetries = 3
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }, { retries: 1, delay: 0 });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return { success: true, latencyMs: Date.now() - startTime };
      }
      
      const errorText = await response.text();
      console.error(`OpenBot request failed (attempt ${attempt}): ${response.status} - ${errorText}`);
      
      if (attempt < maxRetries) {
        await sleep(1000 * Math.pow(2, attempt - 1)); // Exponential backoff
      } else {
        return { success: false, latencyMs: Date.now() - startTime, error: `HTTP ${response.status}: ${errorText}` };
      }
    } catch (error) {
      console.error(`OpenBot request error (attempt ${attempt}):`, error);
      
      if (attempt < maxRetries) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      } else {
        return { success: false, latencyMs: Date.now() - startTime, error: String(error) };
      }
    }
  }
  
  return { success: false, latencyMs: Date.now() - startTime, error: "Max retries exceeded" };
}

// Download file from URL
async function downloadFileFromUrl(url: string): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
  try {
    const response = await fetchWithRetry(url, {});
    if (!response.ok) {
      console.error("Failed to download file:", response.status);
      return null;
    }
    const data = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") || "application/octet-stream";
    return { data, mimeType };
  } catch (error) {
    console.error("Error downloading file:", error);
    return null;
  }
}

// Security: Payload size limit (2MB for file uploads)
const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024;
// Security: Maximum JSON nesting depth
const MAX_NESTING_DEPTH = 15;
// Security: Maximum base64 file size (10MB)
const MAX_BASE64_SIZE = 10 * 1024 * 1024;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(supabaseUrl, supabaseServiceKey) as SupabaseClient<any>;

  let rawBody: string;
  let payload: WebhookPayload;

  try {
    rawBody = await req.text();
    
    // Security: Check payload size
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      console.error("Payload too large:", rawBody.length, "bytes");
      return new Response(JSON.stringify({ error: "Payload too large (max 2MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    payload = JSON.parse(rawBody);

    // Security: Check nesting depth
    if (!checkNestingDepth(payload)) {
      console.error("Payload nesting too deep");
      return new Response(JSON.stringify({ error: "Payload structure too deeply nested" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: Check base64 file size if present
    if (payload.base64 && payload.base64.length > MAX_BASE64_SIZE) {
      console.error("Base64 file too large:", payload.base64.length, "bytes");
      return new Response(JSON.stringify({ error: "File too large (max 10MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permissive zod envelope (catches empty/garbage; preserves all real variants)
    const parsed = WebhookEnvelopeSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn("[openbot-webhook] invalid_payload", parsed.error.flatten());
      return new Response(
        JSON.stringify({ error: "invalid_payload", issues: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received payload:", JSON.stringify(payload, null, 2).substring(0, 2000));
  } catch {
    console.error("[openbot-webhook] Invalid JSON payload");
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate required fields - accept both root-level and nested instanceId
  const instanceId = payload.instanceId || payload.message?.instanceId;
  if (!instanceId) {
    console.error("Missing required field: instanceId", { 
      hasMessage: !!payload.message, 
      hasRootInstanceId: !!payload.instanceId,
      hasNestedInstanceId: !!payload.message?.instanceId,
      receivedPayload: JSON.stringify(payload).substring(0, 1000)
    });
    return new Response(JSON.stringify({ error: "Missing required field: instanceId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract user_id from query params (passed by OpenBot config)
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    console.error("Missing user_id query parameter. The webhook URL must include ?user_id=YOUR_USER_ID");
    console.error("Received URL:", req.url);
    console.error("Received payload (first 500 chars):", JSON.stringify(payload).substring(0, 500));
    return new Response(JSON.stringify({ 
      error: "Missing user_id query parameter", 
      hint: "A URL do webhook deve incluir ?user_id=SEU_USER_ID. Copie a URL completa da página de Configurações.",
      received_url: req.url
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get user's integration settings
  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .select("openbot_api_key_encrypted, openbot_inbound_url, webhook_secret")
    .eq("user_id", userId)
    .single();

  if (integrationError || !integration) {
    console.error("Integration not found for user:", userId);
    return new Response(JSON.stringify({ error: "Integration not configured" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Feature gate: check if user's org has automations feature
  {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (membership?.organization_id) {
      let features: string[] = [];
      try {
        const mod = await import("../_shared/getOrgFeatures.ts");
        features = await mod.getOrgFeatures(supabase, membership.organization_id);
      } catch { /* fallback: allow */ }
      if (features.length > 0 && !features.includes("automations")) {
        console.log(`[Webhook] Org ${membership.organization_id} lacks 'automations' feature, skipping`);
        return new Response(JSON.stringify({ skipped: true, reason: "Feature not available in current plan" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  // Verify webhook signature if secret is configured
  const signature = req.headers.get("x-webhook-signature");
  if (integration.webhook_secret && signature) {
    if (!verifySignature(rawBody, signature, integration.webhook_secret)) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Check for idempotency - generate unique ID from multiple sources
  const messageId = payload.key?.id || 
    payload.message?.key?.id || 
    `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  // Extract chatId from multiple possible sources
  const chatId = payload.chatId ||
    payload.message?.chatId || 
    payload.message?.key?.remoteJid?.split("@")[0] ||
    payload.key?.remoteJid?.split("@")[0] ||
    payload.key?.remoteJidAlt?.split("@")[0] ||
    "";
  
  // Extract pushName from multiple sources
  const pushName = payload.pushName || payload.message?.pushName || "";

  // ── fromMe filter: ignore bot/attendant messages to prevent execution loops ──
  const isFromMe = payload.fromMe === true ||
    payload.message?.key?.fromMe === true;

  if (isFromMe) {
    console.log("[openbot-webhook] Ignoring fromMe message, chatId:", chatId, "messageId:", messageId);
    return new Response(
      JSON.stringify({ status: "ignored", reason: "fromMe" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: existingEvent } = await supabase
    .from("events")
    .select("id, status")
    .eq("message_id", messageId)
    .eq("instance_id", instanceId)
    .eq("user_id", userId)
    .single();

  if (existingEvent) {
    console.log("Duplicate event detected:", existingEvent.id);
    return new Response(JSON.stringify({ 
      eventId: existingEvent.id, 
      status: existingEvent.status,
      duplicate: true 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check for active session BEFORE creating event
  const { data: activeSession } = await supabase
    .from("flow_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("chat_id", chatId)
    .eq("instance_id", instanceId)
    .eq("status", "active")
    .maybeSingle();

  // Create event record
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      instance_id: instanceId,
      chat_id: chatId,
      message_id: messageId,
      message_text: extractMessageText(payload),
      push_name: pushName,
      received_payload_json: payload,
      status: "pending",
      chosen_flow_id: activeSession?.flow_id || null,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    console.error("Failed to create event:", eventError);
    return new Response(JSON.stringify({ error: "Failed to create event" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Event created:", event.id, activeSession ? "(has active session)" : "(new conversation)");

  // Process flow in background
  EdgeRuntime.waitUntil(processFlow(
    supabase, 
    event.id, 
    userId, 
    payload, 
    integration as Integration,
    activeSession as FlowSession | null
  ));

  // Return immediately with event ID
  return new Response(JSON.stringify({ 
    eventId: event.id, 
    status: "processing",
    hasActiveSession: !!activeSession
  }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function processFlow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  eventId: string,
  userId: string,
  payload: WebhookPayload,
  integration: Integration,
  existingSession: FlowSession | null
) {
  const messageText = extractMessageText(payload);
  const instanceId = payload.instanceId || payload.message?.instanceId || "";
  const chatId = payload.chatId ||
    payload.message?.chatId || 
    payload.message?.key?.remoteJid?.split("@")[0] ||
    payload.key?.remoteJid?.split("@")[0] ||
    "";
  const pushName = payload.pushName || payload.message?.pushName || "";

  // Resolve instance context (provider, API key, Meta phone number) once
  const instanceCtx = await resolveInstanceContext(supabase, instanceId, integration);
  console.log(`[processFlow] Instance context: provider=${instanceCtx.provider}, hasMetaPhoneId=${!!instanceCtx.metaPhoneNumberId}`);

  try {
    // ========================================
    // CASE 1: ACTIVE SESSION EXISTS (User response)
    // ========================================
    if (existingSession) {
      console.log("Processing response for active session:", existingSession.id);
      
      // Check if session has timed out
      if (existingSession.timeout_at && new Date(existingSession.timeout_at) < new Date()) {
        console.log("Session has timed out:", existingSession.id);
        await handleSessionTimeout(supabase, existingSession, userId, payload, integration, eventId, instanceCtx);
        return;
      }

      await processUserResponse(supabase, existingSession, userId, payload, integration, eventId, instanceCtx);
      return;
    }

    // ========================================
    // CASE 2: NO ACTIVE SESSION (New conversation)
    // ========================================
    console.log("Starting new conversation flow");
    
    // Find matching routing rule
    const { data: rules } = await supabase
      .from("routing_rules")
      .select("id, match_type, match_value, instance_id, flow_id, priority")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    let matchedRule: RoutingRule | null = null;
    const matchedCandidates: RoutingRule[] = [];

    for (const rule of (rules as RoutingRule[]) || []) {
      if (rule.match_type === "fallback") {
        // Legacy fallback rules are ignored; use flows.is_default instead
        continue;
      }

      if (rule.match_type === "instance_id" && rule.instance_id === instanceId) {
        matchedCandidates.push(rule);
        if (!matchedRule) matchedRule = rule;
        continue;
      }

      if (rule.match_type === "keyword" && rule.match_value) {
        const keywords = rule.match_value.split(",").map((k: string) => k.trim().toLowerCase());
        if (keywords.some((keyword: string) => messageText.toLowerCase().includes(keyword))) {
          matchedCandidates.push(rule);
          if (!matchedRule) matchedRule = rule;
          continue;
        }
      }
    }

    // Log if multiple rules matched (conflict)
    if (matchedCandidates.length > 1) {
      console.log(`[CONFLICT] ${matchedCandidates.length} rules matched for message "${messageText}" on instance ${instanceId}. Using rule ${matchedRule?.id} (priority ${matchedRule?.priority}). Discarded: ${matchedCandidates.filter(r => r.id !== matchedRule?.id).map(r => r.id).join(", ")}`);
    }

    // If still no match, check for default flow
    if (!matchedRule) {
      const { data: defaultFlow } = await supabase
        .from("flows")
        .select("id")
        .eq("user_id", userId)
        .eq("is_default", true)
        .eq("is_active", true)
        .single();

      if (defaultFlow) {
        matchedRule = {
          id: "default",
          match_type: "default",
          match_value: null,
          instance_id: null,
          flow_id: (defaultFlow as { id: string }).id,
          priority: 999,
        };
      }
    }

    if (!matchedRule) {
      console.log("No matching rule found for event:", eventId);
      await supabase
        .from("events")
        .update({ status: "no_match", completed_at: new Date().toISOString() })
        .eq("id", eventId);
      return;
    }

    // Get flow details
    const { data: flow } = await supabase
      .from("flows")
      .select("id, is_interactive, session_timeout_minutes, timeout_action, timeout_message")
      .eq("id", matchedRule.flow_id)
      .single();

    if (!flow) {
      console.error("Flow not found:", matchedRule.flow_id);
      await supabase
        .from("events")
        .update({ status: "failed", error_message: "Flow not found", completed_at: new Date().toISOString() })
        .eq("id", eventId);
      return;
    }

    // Update event with matched rule and flow
    await supabase
      .from("events")
      .update({ 
        chosen_rule_id: matchedRule.id === "default" ? null : matchedRule.id,
        chosen_flow_id: matchedRule.flow_id,
        status: "processing"
      })
      .eq("id", eventId);

    // Get flow steps with new fields
    const { data: steps } = await supabase
      .from("flow_steps")
      .select(`
        id,
        order_index,
        step_type,
        text_content,
        file_id,
        delay_ms,
        requires_response,
        variable_name,
        validation_type,
        invalid_response_message,
        step_timeout_minutes,
        accept_file_response,
         condition_config,
         end_config,
         tag_config,
         lane_config,
         active_message_config,
         random_config,
         delay_config,
         menu_config,
         file:files(storage_path, mime_type, file_name)
      `)
      .eq("flow_id", matchedRule.flow_id)
      .order("order_index", { ascending: true });

    // Get flow connections for graph traversal
    const { data: connections } = await supabase
      .from("flow_connections")
      .select("id, source_step_id, target_step_id, source_handle, condition_type, condition_operator, condition_value, condition_variable, label")
      .eq("flow_id", matchedRule.flow_id);

    if (!steps || steps.length === 0) {
      console.log("No steps found for flow:", matchedRule.flow_id);
      await supabase
        .from("events")
        .update({ status: "no_steps", completed_at: new Date().toISOString() })
        .eq("id", eventId);
      return;
    }

    // Create session for interactive flows
    let session: FlowSession | null = null;
    if ((flow as Flow).is_interactive) {
      const timeoutMinutes = (flow as Flow).session_timeout_minutes || 30;
      const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
      
      const { data: newSession, error: sessionError } = await supabase
        .from("flow_sessions")
        .insert({
          user_id: userId,
          flow_id: matchedRule.flow_id,
          chat_id: chatId,
          instance_id: instanceId,
          push_name: pushName,
          current_step_index: 0,
          current_step_id: (steps as FlowStep[])[0]?.id || null,
          status: "active",
          collected_data: {},
          timeout_at: timeoutAt,
        })
        .select("*")
        .single();

      if (sessionError) {
        console.error("Failed to create session:", sessionError);
      } else {
        session = newSession as FlowSession;
        console.log("Created interactive session:", session.id);
      }
    }

    // Execute steps starting from 0
    await executeFlowSteps(
      supabase, 
      steps as FlowStep[], 
      0, 
      userId, 
      payload, 
      integration, 
      eventId, 
      session,
      flow as Flow,
      (connections || []) as FlowConnection[],
      instanceCtx
    );

  } catch (error) {
    console.error("Flow processing error:", error);
    const errorStr = String(error);
    let translatedError = errorStr;
    
    // Traduzir erros conhecidos
    if (errorStr.includes("Network error") || errorStr.includes("fetch failed")) {
      translatedError = "[NET_001] Erro de conexão com o OpenBot. Verifique se a URL está correta e o serviço está online.";
    } else if (!errorStr.startsWith("[")) {
      translatedError = `[UNKNOWN] Erro inesperado: ${errorStr}. Entre em contato com o suporte se o problema persistir.`;
    }
    
    await supabase
      .from("events")
      .update({ 
        status: "failed", 
        error_message: translatedError,
        completed_at: new Date().toISOString() 
      })
      .eq("id", eventId);
  }
}

async function processUserResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  session: FlowSession,
  userId: string,
  payload: WebhookPayload,
  integration: Integration,
  eventId: string,
  instanceCtx: InstanceContext
) {
  const messageText = extractMessageText(payload);
  const fileData = extractFileFromPayload(payload);

  // Get flow and steps
  const { data: flow } = await supabase
    .from("flows")
    .select("id, is_interactive, session_timeout_minutes, timeout_action, timeout_message")
    .eq("id", session.flow_id)
    .single();

  const { data: steps } = await supabase
    .from("flow_steps")
    .select(`
      id,
      order_index,
      step_type,
      text_content,
      file_id,
      delay_ms,
      requires_response,
      variable_name,
      validation_type,
      invalid_response_message,
      step_timeout_minutes,
      accept_file_response,
       condition_config,
       end_config,
       tag_config,
       lane_config,
       active_message_config,
       random_config,
       delay_config,
       menu_config,
       file:files(storage_path, mime_type, file_name)
    `)
    .eq("flow_id", session.flow_id)
    .order("order_index", { ascending: true });

  // Get flow connections for graph traversal
  const { data: connections } = await supabase
    .from("flow_connections")
    .select("id, source_step_id, target_step_id, source_handle, condition_type, condition_operator, condition_value, condition_variable, label")
    .eq("flow_id", session.flow_id);

  if (!steps || steps.length === 0) {
    console.error("No steps found for session flow:", session.flow_id);
    return;
  }

  // Get current step that was awaiting response - use current_step_id if available, fallback to index
  const currentStep = session.current_step_id
    ? (steps as FlowStep[]).find(s => s.id === session.current_step_id)
    : (steps as FlowStep[])[session.current_step_index];
  if (!currentStep) {
    console.error("Current step not found, step_id:", session.current_step_id, "index:", session.current_step_index);
    return;
  }

  console.log("Processing response for step:", currentStep.order_index, "variable:", currentStep.variable_name, "type:", currentStep.step_type);

  // ── MENU STEP RESPONSE: Validate option number and route ──
  if (currentStep.step_type === "menu" && currentStep.menu_config) {
    const menuOptions = currentStep.menu_config.options || [];
    const trimmed = messageText.trim();
    const chosenNum = parseInt(trimmed);

    if (isNaN(chosenNum) || chosenNum < 1 || chosenNum > menuOptions.length) {
      // Invalid option
      const errorMsg = currentStep.menu_config.error_enabled && currentStep.menu_config.error_message
        ? currentStep.menu_config.error_message
        : `Opção inválida. Digite um número de 1 a ${menuOptions.length}.`;
      
      console.log("Invalid menu response:", trimmed);
      await sendInvalidResponseMessage(supabase, instanceCtx, payload, errorMsg, session.collected_data, eventId);
      return;
    }

    const chosenIndex = chosenNum - 1;
    const chosenOption = menuOptions[chosenIndex];
    const handle = `option-${chosenIndex}`;
    console.log(`Menu step ${currentStep.id}: user chose option ${chosenNum} (${chosenOption}), handle: ${handle}`);

    // Save response
    const variableName = currentStep.variable_name || `menu_${currentStep.order_index}`;
    const newCollectedData = { ...session.collected_data, [variableName]: chosenOption, [`${variableName}_number`]: chosenNum };

    await supabase.from("session_responses").insert({
      session_id: session.id,
      step_id: currentStep.id,
      step_index: currentStep.order_index,
      variable_name: variableName,
      response_type: "text",
      response_text: trimmed,
      is_valid: true,
    });

    // Find next step via the option handle
    const allConnections = (connections || []) as FlowConnection[];
    const nextStepId = getNextStepId(currentStep.id, handle, allConnections)
      || getNextStepId(currentStep.id, "default", allConnections);
    const nextStepIndex = nextStepId
      ? (steps as FlowStep[]).findIndex(s => s.id === nextStepId)
      : session.current_step_index + 1;

    // Calculate new timeout
    const timeoutMinutes = (flow as Flow)?.session_timeout_minutes || 30;
    const newTimeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

    // Update session
    await supabase
      .from("flow_sessions")
      .update({
        collected_data: newCollectedData,
        current_step_index: nextStepIndex >= 0 ? nextStepIndex : session.current_step_index + 1,
        current_step_id: nextStepId || null,
        last_activity_at: new Date().toISOString(),
        timeout_at: newTimeoutAt,
      })
      .eq("id", session.id);

    await supabase.from("events").update({ status: "processing" }).eq("id", eventId);

    const updatedSession: FlowSession = {
      ...session,
      collected_data: newCollectedData,
      current_step_index: nextStepIndex >= 0 ? nextStepIndex : session.current_step_index + 1,
      current_step_id: nextStepId || null,
    };

    await executeFlowSteps(
      supabase, steps as FlowStep[],
      nextStepIndex >= 0 ? nextStepIndex : session.current_step_index + 1,
      userId, payload, integration, eventId, updatedSession, flow as Flow, allConnections, instanceCtx
    );
    return;
  }

  // Check if it's a file response
  let responseType = "text";
  let responseText = messageText;
  let fileId: string | null = null;

  if (fileData.hasFile) {
    if (!currentStep.accept_file_response) {
      // Step doesn't accept file, send error message
      console.log("Step doesn't accept file response");
      await sendInvalidResponseMessage(
        supabase, 
        instanceCtx, 
        payload, 
        currentStep.invalid_response_message || "Por favor, envie uma resposta em texto.",
        session.collected_data,
        eventId
      );
      return;
    }
    responseType = "file";
    responseText = fileData.fileName || "arquivo";
    
    // Save file to storage
    fileId = await saveUserFile(supabase, userId, session.id, fileData, payload);
  } else {
    // Validate text response
    const validation = validateResponse(messageText, currentStep.validation_type);
    if (!validation.valid) {
      console.log("Invalid response:", validation.error);
      await sendInvalidResponseMessage(
        supabase, 
        instanceCtx, 
        payload, 
        currentStep.invalid_response_message || validation.error || "Resposta inválida. Tente novamente.",
        session.collected_data,
        eventId
      );
      return;
    }
  }

  // Save response
  const variableName = currentStep.variable_name || `step_${currentStep.order_index}`;
  
  await supabase.from("session_responses").insert({
    session_id: session.id,
    step_id: currentStep.id,
    step_index: currentStep.order_index,
    variable_name: variableName,
    response_type: responseType,
    response_text: responseText,
    file_id: fileId,
    is_valid: true,
  });

  // Update collected data
  const newCollectedData = {
    ...session.collected_data,
    [variableName]: responseType === "file" ? { file_id: fileId, file_name: responseText } : responseText,
  };

  // Calculate new timeout
  const timeoutMinutes = (flow as Flow)?.session_timeout_minutes || 30;
  const newTimeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

  // Find next step via connections (graph) or linear fallback
  const allConnections = (connections || []) as FlowConnection[];
  const nextStepId = getNextStepId(currentStep.id, "default", allConnections);
  const nextStepIndex = nextStepId 
    ? (steps as FlowStep[]).findIndex(s => s.id === nextStepId)
    : session.current_step_index + 1;

  // Update session
  await supabase
    .from("flow_sessions")
    .update({
      collected_data: newCollectedData,
      current_step_index: nextStepIndex >= 0 ? nextStepIndex : session.current_step_index + 1,
      current_step_id: nextStepId || null,
      last_activity_at: new Date().toISOString(),
      timeout_at: newTimeoutAt,
    })
    .eq("id", session.id);

  // Update event
  await supabase
    .from("events")
    .update({ status: "processing" })
    .eq("id", eventId);

  // Continue with next step
  const updatedSession: FlowSession = {
    ...session,
    collected_data: newCollectedData,
    current_step_index: nextStepIndex >= 0 ? nextStepIndex : session.current_step_index + 1,
    current_step_id: nextStepId || null,
  };

  await executeFlowSteps(
    supabase, 
    steps as FlowStep[], 
    nextStepIndex >= 0 ? nextStepIndex : session.current_step_index + 1, 
    userId, 
    payload, 
    integration, 
    eventId, 
    updatedSession,
    flow as Flow,
    allConnections,
    instanceCtx
  );
}

async function saveUserFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  sessionId: string,
  fileData: { hasFile: boolean; base64?: string; url?: string; mimeType?: string; fileName?: string },
  payload: WebhookPayload
): Promise<string | null> {
  try {
    let fileBuffer: ArrayBuffer;
    let mimeType = fileData.mimeType || "application/octet-stream";
    const fileName = fileData.fileName || `file_${Date.now()}`;

    // Get file data from base64 or URL
    if (fileData.base64) {
      const base64Data = fileData.base64.replace(/^data:[^;]+;base64,/, "");
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    } else if (fileData.url) {
      const downloaded = await downloadFileFromUrl(fileData.url);
      if (!downloaded) {
        console.error("Failed to download file from URL");
        return null;
      }
      fileBuffer = downloaded.data;
      mimeType = downloaded.mimeType;
    } else {
      console.error("No file data available");
      return null;
    }

    // Upload to storage
    const storagePath = `${userId}/responses/${sessionId}/${Date.now()}_${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("flow-files")
      .upload(storagePath, new Uint8Array(fileBuffer), {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload user file:", uploadError);
      return null;
    }

    // Create file record
    const { data: fileRecord, error: fileRecordError } = await supabase
      .from("files")
      .insert({
        user_id: userId,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: fileBuffer.byteLength,
      })
      .select("id")
      .single();

    if (fileRecordError) {
      console.error("Failed to create file record:", fileRecordError);
      return null;
    }

    console.log("Saved user file:", storagePath, "size:", fileBuffer.byteLength);
    return fileRecord.id;

  } catch (error) {
    console.error("Error saving user file:", error);
    return null;
  }
}

async function sendInvalidResponseMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  instanceCtx: InstanceContext,
  payload: WebhookPayload,
  message: string,
  collectedData: Record<string, unknown>,
  eventId: string
) {
  const chatId = payload.chatId ||
    payload.message?.chatId || 
    payload.message?.key?.remoteJid?.split("@")[0] ||
    payload.key?.remoteJid?.split("@")[0] ||
    "";
  const phone = chatId.replace(/\D/g, "");
  if (!instanceCtx.apiKey) return;

  const msgText = replaceVariables(message, payload, collectedData);
  const result = await sendMessage(instanceCtx, phone, {
    message: msgText,
    desativarFluxo: false, // Keep flow active for retry
  });

  // Record action
  await supabase.from("event_actions").insert({
    event_id: eventId,
    step_id: null,
    step_order: -1,
    status: result.success ? "sent" : "failed",
    sent_at: result.success ? new Date().toISOString() : null,
    sent_payload_json: { message: msgText, provider: instanceCtx.provider },
    latency_ms: result.latencyMs,
    error_message: result.error || null,
    attempt_count: 1,
  });

  // Update event status
  await supabase
    .from("events")
    .update({ status: "awaiting_response", completed_at: new Date().toISOString() })
    .eq("id", eventId);
}

async function handleSessionTimeout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  session: FlowSession,
  userId: string,
  payload: WebhookPayload,
  integration: Integration,
  eventId: string,
  instanceCtx: InstanceContext
) {
  // Get flow timeout settings
  const { data: flow } = await supabase
    .from("flows")
    .select("timeout_action, timeout_message")
    .eq("id", session.flow_id)
    .single();

  const timeoutAction = (flow as Flow)?.timeout_action || "end";
  const timeoutMessage = (flow as Flow)?.timeout_message;

  // Mark session as timed out
  await supabase
    .from("flow_sessions")
    .update({
      status: "timeout",
      completed_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  // Send timeout message if configured
  if (timeoutMessage && instanceCtx.apiKey) {
    const chatId = payload.chatId ||
      payload.message?.chatId || 
      payload.message?.key?.remoteJid?.split("@")[0] ||
      payload.key?.remoteJid?.split("@")[0] ||
      "";
    const phone = chatId.replace(/\D/g, "");
    const msgText = replaceVariables(timeoutMessage, payload, session.collected_data);
    await sendMessage(instanceCtx, phone, {
      message: msgText,
      desativarFluxo: true,
    });
  }

  // Check for auto-reengagement configuration and schedule if enabled
  try {
    const { data: reengagementConfig } = await supabase
      .from("auto_reengagement_config")
      .select("id, is_enabled, delay_minutes, max_attempts")
      .eq("flow_id", session.flow_id)
      .eq("is_enabled", true)
      .maybeSingle();

    if (reengagementConfig) {
      const scheduledFor = new Date(Date.now() + reengagementConfig.delay_minutes * 60 * 1000);
      
      await supabase.from("auto_reengagement_queue").insert({
        session_id: session.id,
        user_id: userId,
        config_id: reengagementConfig.id,
        scheduled_for: scheduledFor.toISOString(),
        status: "pending",
        attempt_count: 0,
      });
      
      console.log("Auto-reengagement scheduled for:", scheduledFor.toISOString(), "session:", session.id);
    }
  } catch (reengagementError) {
    console.error("Error scheduling auto-reengagement:", reengagementError);
    // Don't fail the timeout handling if reengagement scheduling fails
  }

  // Update event
  await supabase
    .from("events")
    .update({ 
      status: "session_timeout", 
      error_message: "Sessão expirada por inatividade",
      completed_at: new Date().toISOString() 
    })
    .eq("id", eventId);

  console.log("Session timed out:", session.id, "action:", timeoutAction);
}

// Evaluate a single condition check
function evaluateSingleCondition(
  variable: string,
  operator: string,
  value: string,
  collectedData: Record<string, unknown>
): boolean {
  const rawValue = collectedData[variable];
  const actual = rawValue == null ? "" : String(rawValue);
  const expected = value || "";
  
  switch (operator) {
    case "equals": return actual.toLowerCase() === expected.toLowerCase();
    case "not_equals": return actual.toLowerCase() !== expected.toLowerCase();
    case "contains": return actual.toLowerCase().includes(expected.toLowerCase());
    case "not_contains": return !actual.toLowerCase().includes(expected.toLowerCase());
    case "starts_with": return actual.toLowerCase().startsWith(expected.toLowerCase());
    case "ends_with": return actual.toLowerCase().endsWith(expected.toLowerCase());
    case "greater_than": return parseFloat(actual) > parseFloat(expected);
    case "less_than": return parseFloat(actual) < parseFloat(expected);
    case "is_empty": return actual.trim() === "";
    case "is_not_empty": return actual.trim() !== "";
    case "regex": try { return new RegExp(expected, "i").test(actual); } catch { return false; }
    default: return true;
  }
}

// Evaluate a condition (supports advanced multi-condition format)
function evaluateCondition(
  config: FlowStep["condition_config"],
  collectedData: Record<string, unknown>
): boolean {
  if (!config || !config.variable) return true;
  
  // Advanced format with conditions array
  if (config.conditions && config.conditions.length > 0) {
    // All conditions must be true (AND between conditions)
    return config.conditions.every(cond => {
      // Evaluate main condition
      let result = evaluateSingleCondition(cond.variable, cond.operator, cond.value, collectedData);
      
      // Evaluate subconditions
      if (cond.subconditions && cond.subconditions.length > 0) {
        for (const sub of cond.subconditions) {
          const subResult = evaluateSingleCondition(sub.variable, sub.operator, sub.value, collectedData);
          if (sub.logic === "or") {
            result = result || subResult;
          } else {
            result = result && subResult;
          }
        }
      }
      
      return result;
    });
  }
  
  // Legacy single condition format
  return evaluateSingleCondition(config.variable, config.operator, config.value || "", collectedData);
}

// Find next step ID via connections graph
function getNextStepId(
  currentStepId: string,
  sourceHandle: string,
  connections: FlowConnection[]
): string | null {
  const conn = connections.find(
    c => c.source_step_id === currentStepId && c.source_handle === sourceHandle
  );
  return conn?.target_step_id || null;
}

async function executeFlowSteps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  steps: FlowStep[],
  startIndex: number,
  userId: string,
  payload: WebhookPayload,
  integration: Integration,
  eventId: string,
  session: FlowSession | null,
  flow: Flow,
  connections: FlowConnection[] = [],
  instanceCtx?: InstanceContext
) {
  // Extract chatId from multiple sources - prioritize root level (OpenBot standard)
  const flowChatId = payload.chatId ||                                    // Root (OpenBot standard)
    payload.message?.chatId ||                                            // Inside message
    payload.key?.remoteJidAlt?.split("@")[0] ||                          // Root key.remoteJidAlt
    payload.key?.remoteJid?.split("@")[0] ||                             // Root key.remoteJid  
    payload.message?.key?.remoteJidAlt?.split("@")[0] ||                 // Inside message.key
    payload.message?.key?.remoteJid?.split("@")[0] ||                    // Inside message.key
    "";
  const phone = flowChatId.replace(/\D/g, "");
  console.log("Extracted phone for flow:", phone, "from chatId:", flowChatId, "provider:", instanceCtx?.provider || "unknown");
  
  // Resolve instance context if not provided (backward compat)
  const ctx = instanceCtx || {
    provider: "baileys" as const,
    apiKey: integration.openbot_api_key_encrypted ? await decryptApiKey(integration.openbot_api_key_encrypted) : "",
    metaPhoneNumberId: null,
    instanceId: payload.instanceId || "",
    organizationId: null,
  };
  
  if (!ctx.apiKey) {
    console.error("API key not configured for provider:", ctx.provider);
    await supabase
      .from("events")
      .update({ 
        status: "failed", 
        error_message: ctx.provider === "meta_official" 
          ? "[CONFIG_003] Token Meta não configurado na instância."
          : "[CONFIG_002] OpenBot não configurado. Adicione a API Key nas Configurações.",
        completed_at: new Date().toISOString() 
      })
      .eq("id", eventId);
    return;
  }

  let hasError = false;
  const collectedData = session?.collected_data || {};
  const hasConnections = connections.length > 0;
  const stepsMap = new Map(steps.map(s => [s.id, s]));

  // Determine starting step
  let currentStep: FlowStep | undefined;
  if (hasConnections && session?.current_step_id) {
    currentStep = stepsMap.get(session.current_step_id);
  }
  if (!currentStep) {
    currentStep = steps[startIndex];
  }

  const visitCount = new Map<string, number>();
  const MAX_ITERATIONS = 100; // Safety limit
  const MAX_NODE_VISITS = 3; // Max times a single non-condition node can be visited
  let iterations = 0;

  while (currentStep && iterations < MAX_ITERATIONS) {
    iterations++;
    const step = currentStep;

    // Prevent infinite loops: cap per-node visits for non-condition nodes
    if (step.step_type !== "condition" && step.step_type !== "end") {
      const count = visitCount.get(step.id) || 0;
      if (count >= MAX_NODE_VISITS) {
        console.warn("Loop limit reached at step:", step.id, "visits:", count);
        break;
      }
      visitCount.set(step.id, count + 1);
    }

    // ── END NODE: Send desativarFluxo and stop ──
    if (step.step_type === "end") {
      console.log("End node reached:", step.id);
      const endConfig = step.end_config as { desativar_fluxo?: boolean; mensagem_final?: string | null; webhook_url?: string | null; final_message?: string | null } | null;
      const finalMessage = endConfig?.final_message
        ? replaceVariables(endConfig.final_message, payload, collectedData)
        : null;

      const endResult = await sendMessage(ctx, phone, {
        message: finalMessage || undefined,
        desativarFluxo: true,
      });
      await supabase.from("event_actions").insert({
        event_id: eventId,
        step_id: step.id,
        step_order: step.order_index,
        status: endResult.success ? "sent" : "failed",
        sent_at: endResult.success ? new Date().toISOString() : null,
        sent_payload_json: { message: finalMessage, desativarFluxo: true, provider: ctx.provider },
        latency_ms: endResult.latencyMs,
        error_message: endResult.error || null,
      });

      // End the session
      if (session) {
        await supabase
          .from("flow_sessions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", session.id);
      }

      // Break out of loop — flow completion webhook will be triggered below
      currentStep = undefined;
      break;
    }

    // Check if this is the last step (no outgoing connections or last in linear order)
    const hasOutgoing = connections.some(c => c.source_step_id === step.id);
    const stepIndex = steps.findIndex(s => s.id === step.id);
    const isLastStep = hasConnections 
      ? !hasOutgoing 
      : stepIndex === steps.length - 1;

    // ── TAG NODE: Add or remove tags from contact ──
    if (step.step_type === "tag") {
      const tagConfig = step.tag_config;
      if (tagConfig && tagConfig.tags && tagConfig.tags.length > 0) {
        try {
          // Find the contact by phone in the user's organization
          const phoneClean = phone.replace(/\D/g, "");
          const { data: contacts } = await supabase
            .from("contacts")
            .select("id, tags")
            .or(`phone.eq.${phoneClean},phone.like.%${phoneClean}`)
            .limit(1);

          if (contacts && contacts.length > 0) {
            const contact = contacts[0];
            const existingTags: string[] = (contact.tags as string[]) || [];
            let newTags: string[];

            if (tagConfig.action === "remove") {
              const tagsToRemove = new Set(tagConfig.tags.map((t: string) => t.toLowerCase()));
              newTags = existingTags.filter((t: string) => !tagsToRemove.has(t.toLowerCase()));
            } else {
              // add — merge without duplicates
              const tagSet = new Set(existingTags.map((t: string) => t.toLowerCase()));
              newTags = [...existingTags];
              for (const t of tagConfig.tags) {
                if (!tagSet.has(t.toLowerCase())) {
                  newTags.push(t);
                  tagSet.add(t.toLowerCase());
                }
              }
            }

            await supabase
              .from("contacts")
              .update({ tags: newTags })
              .eq("id", contact.id);

            console.log(`Tag node ${step.id}: ${tagConfig.action} tags [${tagConfig.tags.join(",")}] on contact ${contact.id}`);
          } else {
            console.warn(`Tag node ${step.id}: No contact found for phone ${phoneClean}`);
          }
        } catch (tagError) {
          console.error(`Tag node error:`, tagError);
        }
      }

      // Record action
      await supabase.from("event_actions").insert({
        event_id: eventId,
        step_id: step.id,
        step_order: step.order_index,
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_payload_json: { tag_config: tagConfig },
        latency_ms: 0,
      });

      // Navigate to next step
      const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
      if (nextId) {
        currentStep = stepsMap.get(nextId);
      } else if (!hasConnections) {
        const idx = steps.findIndex(s => s.id === step.id);
        currentStep = steps[idx + 1];
      } else {
        currentStep = undefined;
      }
      continue;
    }

    // ── LANE NODE: Move contact to a pipeline stage ──
    if (step.step_type === "lane") {
      const laneConfig = step.lane_config;
      if (laneConfig && laneConfig.stage_id) {
        try {
          const phoneClean = phone.replace(/\D/g, "");
          const { data: contacts } = await supabase
            .from("contacts")
            .select("id")
            .or(`phone.eq.${phoneClean},phone.like.%${phoneClean}`)
            .limit(1);

          if (contacts && contacts.length > 0) {
            await supabase
              .from("contacts")
              .update({ pipeline_stage_id: laneConfig.stage_id })
              .eq("id", contacts[0].id);
            console.log(`Lane node ${step.id}: moved contact ${contacts[0].id} to stage ${laneConfig.stage_id}`);
          } else {
            console.warn(`Lane node ${step.id}: No contact found for phone ${phoneClean}`);
          }
        } catch (laneError) {
          console.error(`Lane node error:`, laneError);
        }
      }

      await supabase.from("event_actions").insert({
        event_id: eventId,
        step_id: step.id,
        step_order: step.order_index,
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_payload_json: { lane_config: laneConfig },
        latency_ms: 0,
      });

      const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
      if (nextId) {
        currentStep = stepsMap.get(nextId);
      } else if (!hasConnections) {
        const idx = steps.findIndex(s => s.id === step.id);
        currentStep = steps[idx + 1];
      } else {
        currentStep = undefined;
      }
      continue;
    }

    // ── ACTIVE MESSAGE NODE: Send proactive outbound messages ──
    if (step.step_type === "active_message") {
      const amConfig = step.active_message_config;
      if (amConfig && amConfig.instance_id) {
        try {
          // 1. Resolve the instance and its API key + provider
          const { data: inst } = await supabase
            .from("instances")
            .select("id, organization_id, api_key_encrypted, provider, meta_phone_number_id, openbot_instance_id, openbot_api_key_encrypted")
            .eq("id", amConfig.instance_id)
            .single();

          if (!inst) {
            console.error(`Active message node ${step.id}: instance not found`);
          } else {
            // Build instance context for the active message target instance
            let amCtx: InstanceContext;
            if (inst.provider === "meta_official" && inst.api_key_encrypted) {
              const metaToken = await decryptApiKey(inst.api_key_encrypted);
              amCtx = {
                provider: "meta_official",
                apiKey: metaToken,
                metaPhoneNumberId: inst.meta_phone_number_id || null,
                instanceId: inst.openbot_instance_id || inst.id,
                organizationId: inst.organization_id,
              };
            } else {
              // Baileys: use openbot_api_key_encrypted or api_key_encrypted
              const key = inst.openbot_api_key_encrypted || inst.api_key_encrypted;
              if (!key) {
                console.error(`Active message node ${step.id}: no API key for instance`);
                throw new Error("No API key");
              }
              const amApiKey = await decryptApiKey(key);
              amCtx = {
                provider: "baileys",
                apiKey: amApiKey,
                metaPhoneNumberId: null,
                instanceId: inst.openbot_instance_id || inst.id,
                organizationId: inst.organization_id,
              };
            }

            // Check for Meta template config
            const metaTemplateName = (amConfig as { meta_template_name?: string | null }).meta_template_name;
            const metaTemplateLanguage = (amConfig as { meta_template_language?: string | null }).meta_template_language;

            // 2. Resolve recipients
            const recipientPhones = new Set<string>(amConfig.recipients || []);

            // Add contacts matching filter tags
            if (amConfig.filter_tags && amConfig.filter_tags.length > 0) {
              const { data: taggedContacts } = await supabase
                .from("contacts")
                .select("phone")
                .eq("organization_id", inst.organization_id)
                .overlaps("tags", amConfig.filter_tags);

              if (taggedContacts) {
                for (const c of taggedContacts) {
                  recipientPhones.add(c.phone.replace(/\D/g, ""));
                }
              }
            }

            console.log(`Active message node ${step.id}: sending to ${recipientPhones.size} recipients via ${amCtx.provider}`);

            // 3. For each recipient, send content items sequentially
            for (const recipientPhone of recipientPhones) {
              // For Meta, if no window is open and we have a template, use it
              if (amCtx.provider === "meta_official" && metaTemplateName) {
                await sendMessage(amCtx, recipientPhone, {
                  templateName: metaTemplateName,
                  templateLanguage: metaTemplateLanguage || "pt_BR",
                });
                continue; // Template sent, skip individual content items
              }

              for (const item of (amConfig.content_items || [])) {
                if (item.type === "text" && item.value) {
                  const msg = replaceVariables(item.value, payload, collectedData);
                  await sendMessage(amCtx, recipientPhone, {
                    message: msg,
                    desativarFluxo: true,
                  });
                } else if (item.type === "interval" && item.delay_ms) {
                  await sleep(item.delay_ms);
                } else if (item.type === "media" && item.file_id) {
                  // Download file from storage
                  const { data: fileInfo } = await supabase
                    .from("files")
                    .select("storage_path, mime_type, file_name")
                    .eq("id", item.file_id)
                    .single();

                  if (fileInfo) {
                    const { data: fileData } = await supabase.storage
                      .from("flow-files")
                      .download(fileInfo.storage_path);

                    if (fileData) {
                      const buffer = await fileData.arrayBuffer();
                      const base64 = arrayBufferToBase64(buffer);
                      await sendMessage(amCtx, recipientPhone, {
                        arquivo: `data:${fileInfo.mime_type};base64,${base64}`,
                        mimetype: fileInfo.mime_type,
                        fileName: fileInfo.file_name,
                        desativarFluxo: true,
                      });
                    }
                  }
                }
              }
            }
          }
        } catch (amError) {
          console.error(`Active message node error:`, amError);
        }
      }

      // Record action
      await supabase.from("event_actions").insert({
        event_id: eventId,
        step_id: step.id,
        step_order: step.order_index,
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_payload_json: { active_message_config: amConfig },
        latency_ms: 0,
      });

      // Navigate to next step
      const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
      if (nextId) {
        currentStep = stepsMap.get(nextId);
      } else if (!hasConnections) {
        const idx = steps.findIndex(s => s.id === step.id);
        currentStep = steps[idx + 1];
      } else {
        currentStep = undefined;
      }
      continue;
    }

    // ── RANDOM NODE: Pick a random path based on percentages ──
    if (step.step_type === "random") {
      const splits = step.random_config?.splits || [];
      let chosenHandle = "default";
      if (splits.length > 0) {
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (let i = 0; i < splits.length; i++) {
          cumulative += splits[i].percentage;
          if (rand <= cumulative) {
            chosenHandle = `split-${i}`;
            break;
          }
        }
      }
      console.log(`Random step ${step.id}: chose handle ${chosenHandle}`);
      await supabase.from("event_actions").insert({
        event_id: eventId, step_id: step.id, step_order: step.order_index,
        status: "sent", sent_at: new Date().toISOString(),
        sent_payload_json: { random_config: step.random_config, chosen: chosenHandle }, latency_ms: 0,
      });
      const nextId = getNextStepId(step.id, chosenHandle, connections) || getNextStepId(step.id, "default", connections);
      currentStep = nextId ? stepsMap.get(nextId) : undefined;
      continue;
    }

    // ── DELAY NODE: Wait N seconds then continue ──
    if (step.step_type === "delay") {
      const delaySec = Math.min(step.delay_config?.delay_seconds || 0, 120);
      if (delaySec > 0) {
        console.log(`Delay step ${step.id}: waiting ${delaySec}s`);
        await sleep(delaySec * 1000);
      }
      await supabase.from("event_actions").insert({
        event_id: eventId, step_id: step.id, step_order: step.order_index,
        status: "sent", sent_at: new Date().toISOString(),
        sent_payload_json: { delay_seconds: delaySec }, latency_ms: delaySec * 1000,
      });
      const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
      if (nextId) { currentStep = stepsMap.get(nextId); }
      else if (!hasConnections) { const idx = steps.findIndex(s => s.id === step.id); currentStep = steps[idx + 1]; }
      else { currentStep = undefined; }
      continue;
    }

    // ── VOICE CALL NODE: Enqueue Vapi call and pause flow ──
    if (step.step_type === "voice_call") {
      const voiceCfg = (step as { voice_config?: { script?: string; [k: string]: unknown } | null }).voice_config;
      if (!voiceCfg || !voiceCfg.script) {
        console.warn(`Voice call step ${step.id} has no config — skipping`);
        const nextId = hasConnections ? getNextStepId(step.id, "voice-no-answer", connections) || getNextStepId(step.id, "default", connections) : null;
        currentStep = nextId ? stepsMap.get(nextId) : undefined;
        continue;
      }

      // Resolve contact + organization from instance + chat_id
      const chatIdNorm = (payload.chatId || payload.message?.chatId || payload.message?.key?.remoteJid?.split("@")[0] || payload.key?.remoteJid?.split("@")[0] || "").replace(/\D/g, "");
      const { data: instData } = await supabase
        .from("instances")
        .select("id, organization_id")
        .eq("openbot_instance_id", instanceCtx.openbotInstanceId)
        .maybeSingle();

      let contactId: string | null = null;
      let orgId: string | null = instData?.organization_id || null;
      if (orgId && chatIdNorm) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("organization_id", orgId)
          .eq("phone", chatIdNorm)
          .maybeSingle();
        contactId = contact?.id || null;
      }

      if (!contactId || !orgId) {
        console.warn(`Voice call step ${step.id}: contact/org not found — skipping`);
        const nextId = hasConnections ? getNextStepId(step.id, "voice-no-answer", connections) || getNextStepId(step.id, "default", connections) : null;
        currentStep = nextId ? stepsMap.get(nextId) : undefined;
        continue;
      }

      // Enqueue
      await supabase.from("flow_voice_pending").insert({
        flow_session_id: session?.id || null,
        flow_step_id: step.id,
        contact_id: contactId,
        organization_id: orgId,
        attempt_number: 1,
        scheduled_for: new Date().toISOString(),
        status: "queued",
        config: voiceCfg,
      });

      await supabase.from("event_actions").insert({
        event_id: eventId, step_id: step.id, step_order: step.order_index,
        status: "sent", sent_at: new Date().toISOString(),
        sent_payload_json: { enqueued: true, voice_config: voiceCfg }, latency_ms: 0,
      });

      if (session) {
        await supabase
          .from("flow_sessions")
          .update({
            current_step_id: step.id,
            current_step_index: step.order_index,
            last_activity_at: new Date().toISOString(),
            status: "awaiting_voice",
          })
          .eq("id", session.id);
      }

      await supabase
        .from("events")
        .update({ status: "awaiting_voice", completed_at: new Date().toISOString() })
        .eq("id", eventId);

      console.log(`Voice call step ${step.id}: enqueued for ${contactId}`);
      return;
    }

    // ── MENU NODE: Send numbered options and await response ──
    if (step.step_type === "menu") {
      const menuConfig = step.menu_config;
      if (menuConfig && menuConfig.options && menuConfig.options.length >= 2) {
        // Build numbered menu message
        const menuLines = menuConfig.options.map((opt: string, i: number) => `${i + 1} - ${opt}`);
        const fullMessage = menuConfig.message
          ? replaceVariables(menuConfig.message, payload, collectedData) + "\n\n" + menuLines.join("\n")
          : menuLines.join("\n");

        const menuResult = await sendMessage(ctx, phone, {
          message: fullMessage,
          desativarFluxo: false,
        });

        await supabase.from("event_actions").insert({
          event_id: eventId,
          step_id: step.id,
          step_order: step.order_index,
          status: menuResult.success ? "sent" : "failed",
          sent_at: menuResult.success ? new Date().toISOString() : null,
          sent_payload_json: { message: fullMessage, provider: ctx.provider },
          latency_ms: menuResult.latencyMs,
          error_message: menuResult.error || null,
        });

        // Update session to await response at this step
        if (session) {
          const timeoutMinutes = flow?.session_timeout_minutes || 30;
          const newTimeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
          await supabase
            .from("flow_sessions")
            .update({
              current_step_index: step.order_index,
              current_step_id: step.id,
              last_activity_at: new Date().toISOString(),
              timeout_at: newTimeoutAt,
            })
            .eq("id", session.id);
        }

        // Mark event as awaiting response
        await supabase
          .from("events")
          .update({ status: "awaiting_response", completed_at: new Date().toISOString() })
          .eq("id", eventId);

        // Stop execution — will resume when user responds
        return;
      }

      // Fallback: no valid config, skip to next
      const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
      if (nextId) { currentStep = stepsMap.get(nextId); }
      else if (!hasConnections) { const idx = steps.findIndex(s => s.id === step.id); currentStep = steps[idx + 1]; }
      else { currentStep = undefined; }
      continue;
    }

    // ── CONDITION NODE: Evaluate and route ──
    if (step.step_type === "condition") {
      const result = evaluateCondition(step.condition_config, collectedData);
      const handle = result ? "true" : "false";
      console.log(`Condition step ${step.id}: variable=${step.condition_config?.variable}, result=${result}, handle=${handle}`);

      // Record condition evaluation as action
      await supabase.from("event_actions").insert({
        event_id: eventId,
        step_id: step.id,
        step_order: step.order_index,
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_payload_json: { condition: step.condition_config, result, handle },
        latency_ms: 0,
      });

      // Navigate to next step via the appropriate handle
      const nextId = getNextStepId(step.id, handle, connections);
      if (!nextId) {
        // Try fallback: follow the default handle
        const fallbackId = getNextStepId(step.id, "default", connections);
        currentStep = fallbackId ? stepsMap.get(fallbackId) : undefined;
      } else {
        currentStep = stepsMap.get(nextId);
      }
      continue;
    }

    // ── STANDARD STEP (text/file): Execute as before ──
    const shouldAwaitResponse = step.requires_response && !isLastStep;
    const desativarFluxo = isLastStep || !step.requires_response;

    // Build send options
    const sendOpts: Parameters<typeof sendMessage>[2] = {
      desativarFluxo: !shouldAwaitResponse && desativarFluxo,
    };

    if (step.step_type === "text" && step.text_content) {
      sendOpts.message = replaceVariables(step.text_content, payload, collectedData);
    } else if (step.step_type === "file" && step.file_id) {
      // Download file from storage and convert to base64
      let fileInfo = step.file?.[0];
      if (!fileInfo) {
        const { data: fetchedFile } = await supabase
          .from("files")
          .select("storage_path, mime_type, file_name")
          .eq("id", step.file_id)
          .single();
        fileInfo = fetchedFile || undefined;
      }
      
      if (!fileInfo) {
        await supabase.from("event_actions").insert({
          event_id: eventId,
          step_id: step.id,
          step_order: step.order_index,
          status: "failed",
          error_message: "[DATA_002] Arquivo não encontrado no banco de dados.",
        });
        hasError = true;
        // Navigate to next step
        const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
        currentStep = nextId ? stepsMap.get(nextId) : steps[stepIndex + 1];
        continue;
      }
      
      try {
        const { data: fileData, error: fileError } = await supabase.storage
          .from("flow-files")
          .download(fileInfo.storage_path);
        if (fileError || !fileData) throw new Error(`[FILE_002] Erro ao baixar arquivo: ${fileError?.message}`);
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        sendOpts.arquivo = `data:${fileInfo.mime_type};base64,${base64}`;
        sendOpts.mimetype = fileInfo.mime_type;
        sendOpts.fileName = fileInfo.file_name;
      } catch (error) {
        const errorStr = String(error);
        const translatedError = errorStr.includes("Maximum call stack size exceeded")
          ? "[FILE_001] Arquivo muito grande para processar."
          : errorStr.startsWith("[") ? errorStr : `[FILE_002] Erro ao processar arquivo: ${errorStr}`;
        await supabase.from("event_actions").insert({
          event_id: eventId, step_id: step.id, step_order: step.order_index,
          status: "failed", error_message: translatedError,
        });
        hasError = true;
        const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
        currentStep = nextId ? stepsMap.get(nextId) : steps[stepIndex + 1];
        continue;
      }
    }

    // Send via provider-aware sendMessage
    const result = await sendMessage(ctx, phone, sendOpts);

    // Record action
    await supabase.from("event_actions").insert({
      event_id: eventId,
      step_id: step.id,
      step_order: step.order_index,
      status: result.success ? "sent" : "failed",
      sent_at: result.success ? new Date().toISOString() : null,
      sent_payload_json: { ...sendOpts, provider: ctx.provider },
      latency_ms: result.latencyMs,
      error_message: result.error || null,
      attempt_count: result.success ? 1 : 3,
    });

    if (!result.success) {
      hasError = true;
      console.error(`Step ${step.order_index} failed:`, result.error);
    }

    // If this step requires a response and we sent successfully, STOP here
    if (shouldAwaitResponse && result.success) {
      console.log("Waiting for user response at step:", step.order_index, "variable:", step.variable_name);
      
      if (session) {
        const stepTimeout = step.step_timeout_minutes || flow.session_timeout_minutes || 30;
        const newTimeoutAt = new Date(Date.now() + stepTimeout * 60 * 1000).toISOString();
        
        await supabase
          .from("flow_sessions")
          .update({
            current_step_index: stepIndex,
            current_step_id: step.id,
            last_activity_at: new Date().toISOString(),
            timeout_at: newTimeoutAt,
          })
          .eq("id", session.id);
      }

      await supabase
        .from("events")
        .update({ status: "awaiting_response", completed_at: new Date().toISOString() })
        .eq("id", eventId);

      console.log("Flow paused, awaiting user response for event:", eventId);
      return; // STOP execution here
    }

    // Wait for delay if not last step
    if (!isLastStep && step.delay_ms > 0) {
      await sleep(step.delay_ms);
    }

    // Navigate to next step: prefer connections graph, fallback to linear
    const nextId = hasConnections ? getNextStepId(step.id, "default", connections) : null;
    if (nextId) {
      currentStep = stepsMap.get(nextId);
    } else if (!hasConnections) {
      // Linear fallback
      currentStep = steps[stepIndex + 1];
    } else {
      // No outgoing connection in graph mode = end
      currentStep = undefined;
    }
  } // end while

  // All steps completed
  if (session) {
    await supabase
      .from("flow_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    // --- Flow Completion Webhook ---
    try {
      const { data: webhookConfig } = await supabase
        .from("flow_webhooks")
        .select("*")
        .eq("flow_id", session.flow_id)
        .eq("is_enabled", true)
        .maybeSingle();

      if (webhookConfig) {
        console.log("[webhook-completion] Found webhook config for flow:", session.flow_id);
        const collectedData = (session.collected_data as Record<string, unknown>) || {};

        // Build variable map
        const variableMap: Record<string, string> = {
          pushName: payload.pushName || session.push_name || "",
          chatId: payload.chatId || session.chat_id || "",
          instanceId: payload.instanceId || session.instance_id || "",
        };
        for (const [k, v] of Object.entries(collectedData)) {
          variableMap[k] = String(v ?? "");
        }

        // Replace variables in template
        let processedPayload = webhookConfig.payload_template || "{}";
        for (const [key, value] of Object.entries(variableMap)) {
          processedPayload = processedPayload.split(`{{${key}}}`).join(value);
        }

        const method = (webhookConfig.http_method || "POST").toUpperCase();
        const webhookHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          ...((webhookConfig.headers as Record<string, string>) || {}),
        };

        console.log(`[webhook-completion] Sending ${method} to ${webhookConfig.webhook_url}`);

        const webhookResponse = await fetch(webhookConfig.webhook_url, {
          method,
          headers: webhookHeaders,
          body: processedPayload,
        });

        const responseText = await webhookResponse.text();
        console.log(`[webhook-completion] Response: ${webhookResponse.status} - ${responseText.substring(0, 200)}`);

        // Log result in event_actions
        await supabase.from("event_actions").insert({
          event_id: eventId,
          step_order: steps.length + 1,
          status: webhookResponse.ok ? "sent" : "error",
          sent_payload_json: JSON.parse(processedPayload),
          error_message: webhookResponse.ok ? null : `HTTP ${webhookResponse.status}: ${responseText.substring(0, 500)}`,
          sent_at: new Date().toISOString(),
          latency_ms: 0,
        });
      }
    } catch (webhookError) {
      console.error("[webhook-completion] Error dispatching webhook:", webhookError);
      // Don't fail the entire flow for a webhook error
      await supabase.from("event_actions").insert({
        event_id: eventId,
        step_order: steps.length + 1,
        status: "error",
        error_message: `Webhook error: ${webhookError.message || "Unknown"}`,
        sent_at: new Date().toISOString(),
        latency_ms: 0,
      });
    }
  }

  // Update event status
  await supabase
    .from("events")
    .update({ 
      status: hasError ? "partial" : "completed", 
      completed_at: new Date().toISOString() 
    })
    .eq("id", eventId);

  console.log("Flow processing completed for event:", eventId);
}
