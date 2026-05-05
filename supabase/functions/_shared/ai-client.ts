/**
 * Centralized AI Client
 * 
 * Resolves the AI provider per organization:
 * 1. If org has a Gemini API key configured → calls Google Gemini API directly
 * 2. Otherwise → falls back to Lovable AI Gateway
 * 
 * All 11 edge functions import from this helper.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "./encryption.ts";

// ── Model mapping: Lovable Gateway → Gemini direct API ──
const LOVABLE_TO_GEMINI_MODEL: Record<string, string> = {
  "google/gemini-3-flash-preview": "gemini-2.5-flash",
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "openai/gpt-5-nano": "gemini-2.5-flash-lite",
  "openai/gpt-5-mini": "gemini-2.5-flash",
  "openai/gpt-5": "gemini-2.5-pro",
};

// ── Model mapping: any input → OpenAI direct API ──
const TO_OPENAI_MODEL: Record<string, string> = {
  "google/gemini-3-flash-preview": "gpt-5-mini",
  "google/gemini-2.5-flash": "gpt-5-mini",
  "google/gemini-2.5-flash-lite": "gpt-5-nano",
  "google/gemini-2.5-pro": "gpt-5",
  "openai/gpt-5": "gpt-5",
  "openai/gpt-5-mini": "gpt-5-mini",
  "openai/gpt-5-nano": "gpt-5-nano",
  "openai/gpt-4o": "gpt-4o",
  "openai/gpt-4o-mini": "gpt-4o-mini",
  "openai/gpt-4-turbo": "gpt-4-turbo",
  "openai/gpt-4.1": "gpt-4.1",
  "openai/gpt-4.1-mini": "gpt-4.1-mini",
  "openai/gpt-4.1-nano": "gpt-4.1-nano",
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_API_BASE = "https://api.openai.com/v1/chat/completions";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Error messages (PT-BR) ──
const ERROR_MESSAGES: Record<number, string> = {
  400: "Erro na configuração da requisição de IA",
  401: "Chave API do Gemini inválida ou sem permissão. Verifique em Configurações > Inteligência Artificial.",
  403: "Chave API do Gemini sem permissão. Verifique em Configurações > Inteligência Artificial.",
  404: "Modelo de IA não disponível. Verifique sua configuração.",
  429: "Limite de requisições do Gemini atingido. Aguarde ou aumente sua cota no Google AI Studio.",
  500: "Serviço de IA temporariamente indisponível. Tente novamente.",
  503: "Serviço de IA temporariamente indisponível. Tente novamente.",
};

// ── Multimodal content parts (discriminated by `type`) ──
export interface AITextPart { type: "text"; text: string; }
export interface AIInputAudioPart { type: "input_audio"; input_audio: { data: string; format?: string }; }
export interface AIImageUrlPart { type: "image_url"; image_url: { url: string } }
export type AIContentPart = AITextPart | AIInputAudioPart | AIImageUrlPart | { type: string; [key: string]: unknown };

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string | AIContentPart[];
}

export interface AICallOptions {
  organizationId?: string;
  model?: string;
  messages: AIMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

// ── Public response data shape (OpenAI chat.completions style) ──
export interface AIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export interface AIChoiceMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: AIToolCall[];
}
export interface AIResponseData {
  choices: Array<{ message: AIChoiceMessage; finish_reason?: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ── Provider-side raw shapes (only what we read) ──
interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
}
interface GeminiCandidate { content?: { parts?: GeminiPart[] }; finishReason?: string; }
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

interface OpenAIToolDef { type: "function"; function: { name: string; description?: string; parameters?: unknown }; }
interface OpenAIToolChoice { type: "function"; function: { name: string }; }

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  [key: string]: unknown;
};

export interface AICallResult {
  ok: boolean;
  status: number;
  data?: AIResponseData;
  error?: string;
  provider: "gemini" | "openai" | "lovable";
  /** For streaming: raw Response to forward */
  response?: Response;
}

interface OrgAIConfig {
  provider: string | null;
  gemini_api_key_encrypted: string | null;
  openai_api_key_encrypted: string | null;
  default_model: string;
  is_active: boolean;
}

// ── Cache to avoid repeated DB lookups within same request ──
const configCache = new Map<string, OrgAIConfig | null>();

async function getOrgAIConfig(orgId: string): Promise<OrgAIConfig | null> {
  if (configCache.has(orgId)) return configCache.get(orgId)!;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("organization_ai_configs")
      .select("provider, gemini_api_key_encrypted, openai_api_key_encrypted, default_model, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      configCache.set(orgId, null);
      return null;
    }

    const config = data as OrgAIConfig;
    configCache.set(orgId, config);
    return config;
  } catch (e) {
    console.warn("[ai-client] Error fetching org AI config:", e);
    configCache.set(orgId, null);
    return null;
  }
}

/**
 * Resolve the organization_id from a user_id via organization_members
 */
export async function getOrgIdFromUser(userId: string): Promise<string | null> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    return data?.organization_id || null;
  } catch {
    return null;
  }
}

// ── Convert OpenAI-style messages to Gemini format ──
function convertToGeminiMessages(messages: AIMessage[]): { systemInstruction?: { parts: { text: string }[] }; contents: unknown[] } {
  const systemParts: string[] = [];
  const contents: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";

    if (typeof msg.content === "string") {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      // Handle multimodal content (text + audio/image)
      const parts: unknown[] = [];
      for (const part of msg.content as AIContentPart[]) {
        if (part.type === "text" && "text" in part) {
          parts.push({ text: (part as AITextPart).text });
        } else if (part.type === "input_audio" && "input_audio" in part) {
          const audio = (part as AIInputAudioPart).input_audio;
          parts.push({
            inlineData: {
              mimeType: `audio/${audio.format || "ogg"}`,
              data: audio.data,
            },
          });
        } else if (part.type === "image_url" && "image_url" in part) {
          const url = (part as AIImageUrlPart).image_url?.url;
          if (!url) continue;
          if (url.startsWith("data:")) {
            const match = url.match(/^data:(.+?);base64,(.+)$/);
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            }
          } else {
            parts.push({ fileData: { mimeType: "image/jpeg", fileUri: url } });
          }
        }
      }
      contents.push({ role, parts });
    }
  }

  return {
    ...(systemParts.length > 0 ? { systemInstruction: { parts: systemParts.map(t => ({ text: t })) } } : {}),
    contents,
  };
}

// ── Strip unsupported OpenAI schema fields for Gemini ──
function cleanSchemaForGemini(schema: JsonSchema | unknown): JsonSchema | unknown {
  if (!schema || typeof schema !== "object") return schema;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "additionalProperties" || key === "minItems" || key === "maxItems") continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      cleaned[key] = cleanSchemaForGemini(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((v) => typeof v === "object" && v !== null ? cleanSchemaForGemini(v) : v);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ── Convert OpenAI-style tools to Gemini function declarations ──
function convertToolsToGemini(tools: unknown[]): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  const isToolDef = (t: unknown): t is OpenAIToolDef =>
    !!t && typeof t === "object" && (t as { type?: unknown }).type === "function" && !!(t as { function?: unknown }).function;

  const declarations = tools
    .filter(isToolDef)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description || "",
      parameters: cleanSchemaForGemini(t.function.parameters as JsonSchema | undefined),
    }));

  return declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined;
}

// ── Convert tool_choice to Gemini toolConfig ──
function convertToolChoice(toolChoice: unknown): unknown | undefined {
  if (!toolChoice || typeof toolChoice !== "object") return undefined;

  const tc = toolChoice as OpenAIToolChoice;
  if (tc.type === "function" && tc.function?.name) {
    return {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: [tc.function.name],
      },
    };
  }
  return undefined;
}

// ── Convert Gemini response to OpenAI format ──
function convertGeminiResponse(geminiData: GeminiResponse): AIResponseData {
  const candidate = geminiData.candidates?.[0];
  if (!candidate) {
    return { choices: [{ message: { role: "assistant", content: "" } }] };
  }

  const parts: GeminiPart[] = candidate.content?.parts || [];
  const textParts: string[] = [];
  const toolCalls: AIToolCall[] = [];

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall) {
      toolCalls.push({
        id: `call_${crypto.randomUUID().substring(0, 8)}`,
        type: "function",
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        },
      });
    }
  }

  const message: AIChoiceMessage = {
    role: "assistant",
    content: textParts.join("\n") || null,
  };

  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    choices: [{ message, finish_reason: candidate.finishReason?.toLowerCase() || "stop" }],
    usage: geminiData.usageMetadata ? {
      prompt_tokens: geminiData.usageMetadata.promptTokenCount || 0,
      completion_tokens: geminiData.usageMetadata.candidatesTokenCount || 0,
      total_tokens: geminiData.usageMetadata.totalTokenCount || 0,
    } : undefined,
  };
}

// ── Call Gemini API directly ──
async function callGeminiDirect(apiKey: string, options: AICallOptions, geminiModel: string): Promise<AICallResult> {
  const { systemInstruction, contents } = convertToGeminiMessages(options.messages);

  const body: Record<string, unknown> = {
    ...(systemInstruction ? { systemInstruction } : {}),
    contents,
    generationConfig: {
      ...(options.max_tokens ? { maxOutputTokens: options.max_tokens } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    },
  };

  const geminiTools = convertToolsToGemini(options.tools || []);
  if (geminiTools) body.tools = geminiTools;

  const toolConfig = convertToolChoice(options.tool_choice);
  if (toolConfig) body.toolConfig = toolConfig;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const endpoint = options.stream
      ? `${GEMINI_API_BASE}/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`
      : `${GEMINI_API_BASE}/models/${geminiModel}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ai-client] Gemini error ${response.status}:`, errText.substring(0, 300));
      const userMsg = ERROR_MESSAGES[response.status] || "Erro na API de IA. Tente novamente.";
      return { ok: false, status: response.status, error: userMsg, provider: "gemini" };
    }

    if (options.stream) {
      // Return the raw response for streaming
      return { ok: true, status: 200, provider: "gemini", response };
    }

    const data = await response.json() as GeminiResponse;
    const converted = convertGeminiResponse(data);
    return { ok: true, status: 200, data: converted, provider: "gemini" };
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, status: 408, error: "A IA demorou para responder. Tente novamente.", provider: "gemini" };
    }
    console.error("[ai-client] Gemini fetch error:", e);
    return { ok: false, status: 500, error: "Erro ao conectar com o serviço de IA.", provider: "gemini" };
  }
}

// ── Call Lovable AI Gateway (fallback) ──
async function callLovableGateway(apiKey: string, options: AICallOptions): Promise<AICallResult> {
  const body: Record<string, unknown> = {
    model: options.model || "google/gemini-3-flash-preview",
    messages: options.messages,
    ...(options.max_tokens ? { max_tokens: options.max_tokens } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.stream ? { stream: true } : {}),
  };

  if (options.tools) body.tools = options.tools;
  if (options.tool_choice) body.tool_choice = options.tool_choice;

  try {
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ai-client] Lovable gateway error ${response.status}:`, errText.substring(0, 300));

      if (response.status === 429) {
        return { ok: false, status: 429, error: "Limite de requisições atingido. Aguarde e tente novamente.", provider: "lovable" };
      }
      if (response.status === 402) {
        return { ok: false, status: 402, error: "Créditos insuficientes. Entre em contato com o suporte.", provider: "lovable" };
      }
      return { ok: false, status: response.status, error: "Erro na API de IA. Tente novamente.", provider: "lovable" };
    }

    if (options.stream) {
      return { ok: true, status: 200, provider: "lovable", response };
    }

    const data = await response.json() as AIResponseData;
    return { ok: true, status: 200, data, provider: "lovable" };
  } catch (e) {
    console.error("[ai-client] Lovable gateway fetch error:", e);
    return { ok: false, status: 500, error: "Erro ao conectar com o serviço de IA.", provider: "lovable" };
  }
}

// ── Call OpenAI API directly ──
async function callOpenAIDirect(apiKey: string, options: AICallOptions, openaiModel: string): Promise<AICallResult> {
  const isGpt5 = openaiModel.startsWith("gpt-5");
  const body: Record<string, unknown> = {
    model: openaiModel,
    messages: options.messages,
    ...(options.max_tokens
      ? (isGpt5 ? { max_completion_tokens: options.max_tokens } : { max_tokens: options.max_tokens })
      : {}),
    ...(options.stream ? { stream: true } : {}),
  };

  // GPT-5 family does not support custom temperature (only default). GPT-4 family does.
  if (options.temperature !== undefined && !isGpt5) {
    body.temperature = options.temperature;
  }

  if (options.tools) body.tools = options.tools;
  if (options.tool_choice) body.tool_choice = options.tool_choice;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(OPENAI_API_BASE, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ai-client] OpenAI error ${response.status}:`, errText.substring(0, 300));
      const errorMessages: Record<number, string> = {
        400: "Erro na configuração da requisição de IA",
        401: "Chave API do OpenAI inválida. Verifique em Configurações > Inteligência Artificial.",
        403: "Chave API do OpenAI sem permissão.",
        404: "Modelo OpenAI não disponível para esta chave.",
        429: "Limite de requisições do OpenAI atingido. Aguarde ou aumente sua cota.",
        500: "Serviço OpenAI temporariamente indisponível. Tente novamente.",
        503: "Serviço OpenAI temporariamente indisponível. Tente novamente.",
      };
      return {
        ok: false,
        status: response.status,
        error: errorMessages[response.status] || "Erro na API OpenAI. Tente novamente.",
        provider: "openai",
      };
    }

    if (options.stream) {
      return { ok: true, status: 200, provider: "openai", response };
    }

    const data = await response.json() as AIResponseData;
    return { ok: true, status: 200, data, provider: "openai" };
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, status: 408, error: "A IA demorou para responder. Tente novamente.", provider: "openai" };
    }
    console.error("[ai-client] OpenAI fetch error:", e);
    return { ok: false, status: 500, error: "Erro ao conectar com o serviço de IA.", provider: "openai" };
  }
}

/**
 * Main entry point — resolves the best AI provider and makes the call.
 * 
 * Priority:
 * 1. Org-specific provider (gemini or openai) if active
 * 2. Lovable AI Gateway (LOVABLE_API_KEY)
 * 3. Error: AI not configured
 */
export async function callAI(options: AICallOptions): Promise<AICallResult> {
  // 1. Try org-specific provider
  if (options.organizationId) {
    const config = await getOrgAIConfig(options.organizationId);

    if (config?.is_active) {
      const provider = config.provider || "gemini";

      // OpenAI provider
      if (provider === "openai" && config.openai_api_key_encrypted) {
        try {
          const openaiKey = await decrypt(config.openai_api_key_encrypted);
          const requestedModel = options.model || "openai/gpt-5-mini";
          const openaiModel = TO_OPENAI_MODEL[requestedModel] || config.default_model || "gpt-5-mini";

          console.log(`[ai-client] Using OpenAI direct for org ${options.organizationId.substring(0, 8)}, model: ${openaiModel}`);
          return await callOpenAIDirect(openaiKey, options, openaiModel);
        } catch (e) {
          console.error("[ai-client] Failed to use org OpenAI key, falling back:", e);
        }
      }

      // Gemini provider
      if (provider === "gemini" && config.gemini_api_key_encrypted) {
        try {
          const geminiKey = await decrypt(config.gemini_api_key_encrypted);
          const requestedModel = options.model || "google/gemini-3-flash-preview";
          const geminiModel = LOVABLE_TO_GEMINI_MODEL[requestedModel] || config.default_model || "gemini-2.5-flash";

          console.log(`[ai-client] Using Gemini direct for org ${options.organizationId.substring(0, 8)}, model: ${geminiModel}`);
          return await callGeminiDirect(geminiKey, options, geminiModel);
        } catch (e) {
          console.error("[ai-client] Failed to use org Gemini key, falling back:", e);
        }
      }
    }
  }

  // 2. Fallback to Lovable AI Gateway
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    console.log(`[ai-client] Using Lovable AI gateway${options.organizationId ? ` for org ${options.organizationId.substring(0, 8)}` : ""}`);
    return await callLovableGateway(lovableKey, options);
  }

  // 3. No AI available
  return {
    ok: false,
    status: 500,
    error: "Configure sua chave de IA em Configurações > Inteligência Artificial.",
    provider: "lovable",
  };
}

/**
 * Convert a Gemini SSE stream to OpenAI-compatible SSE stream.
 * Used when streaming from Gemini direct API through our edge functions.
 */
export function geminiStreamToOpenAI(geminiResponse: Response): ReadableStream {
  const reader = geminiResponse.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const geminiChunk = JSON.parse(jsonStr);
          const candidate = geminiChunk.candidates?.[0];
          if (!candidate?.content?.parts) continue;

          for (const part of candidate.content.parts) {
            if (part.text) {
              const openaiChunk = {
                choices: [{
                  delta: { content: part.text },
                  index: 0,
                  finish_reason: null,
                }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
            }
          }

          if (candidate.finishReason === "STOP") {
            const stopChunk = { choices: [{ delta: {}, index: 0, finish_reason: "stop" }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`));
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    },
  });
}
