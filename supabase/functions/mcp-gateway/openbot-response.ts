/**
 * Openbot MCP Gateway - Response Service
 * 
 * Sends the MCP tool result back to the Openbot API, unlocking the
 * bot flow with desativarFluxo: true.
 * 
 * Uses per-instance API keys from the database (instances table),
 * decrypted via the shared encryption utility.
 * 
 * 100% ISOLATED - Does not depend on or affect any existing CRM code.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";
const RESPONSE_TIMEOUT_MS = 15_000;

/**
 * Fetches and decrypts the Openbot API key for a given instance.
 */
async function getInstanceApiKey(instanceId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[MCP-Gateway] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("instances")
    .select("openbot_api_key_encrypted")
    .eq("openbot_instance_id", instanceId)
    .maybeSingle();

  if (error) {
    console.error(`[MCP-Gateway] DB error fetching instance ${instanceId}:`, error.message);
    return null;
  }

  if (!data?.openbot_api_key_encrypted) {
    console.error(`[MCP-Gateway] No Openbot API key configured for instance ${instanceId}`);
    return null;
  }

  try {
    const decrypted = await decrypt(data.openbot_api_key_encrypted);
    return decrypted.trim();
  } catch (err) {
    console.error(`[MCP-Gateway] Failed to decrypt API key for instance ${instanceId}:`, err);
    return null;
  }
}

/**
 * Extracts a readable text response from the MCP tool result.
 */
function extractText(mcpResult: any): string {
  if (!mcpResult) return "Sem resposta do servidor MCP.";

  if (mcpResult.content && Array.isArray(mcpResult.content)) {
    const textParts = mcpResult.content
      .filter((c: any) => c.type === "text" && c.text)
      .map((c: any) => c.text);
    if (textParts.length > 0) return textParts.join("\n");
  }

  if (typeof mcpResult.text === "string") return mcpResult.text;
  if (typeof mcpResult.message === "string") return mcpResult.message;
  if (typeof mcpResult === "string") return mcpResult;

  return JSON.stringify(mcpResult);
}

/**
 * Extracts a file (Base64) from the MCP result if present.
 */
function extractFile(mcpResult: any): string | null {
  if (!mcpResult?.content || !Array.isArray(mcpResult.content)) return null;

  const resource = mcpResult.content.find(
    (c: any) => c.type === "resource" && c.resource?.blob
  );
  if (resource) {
    const mime = resource.resource.mimeType || "application/octet-stream";
    return `data:${mime};base64,${resource.resource.blob}`;
  }

  const image = mcpResult.content.find(
    (c: any) => c.type === "image" && c.data
  );
  if (image) {
    const mime = image.mimeType || "image/png";
    return `data:${mime};base64,${image.data}`;
  }

  return null;
}

/**
 * Sends the processed MCP result back to the Openbot API.
 * Fetches the API key from the database based on instanceId.
 */
export async function sendToOpenbot(
  chatId: string,
  instanceId: string,
  mcpResult: any
): Promise<void> {
  const apiKey = await getInstanceApiKey(instanceId);

  if (!apiKey) {
    console.error(
      `[MCP-Gateway] Cannot send response: no valid API key for instance ${instanceId}`
    );
    return;
  }

  const message = extractText(mcpResult);
  const file = extractFile(mcpResult);

  const payload: Record<string, any> = {
    apiKey,
    phone: chatId,
    message,
    desativarFluxo: true,
  };

  if (file) {
    payload.arquivo = file;
  }

  console.log(
    `[MCP-Gateway] Sending response to Openbot for chat ${chatId} (${message.substring(0, 80)}...)`
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS);

  try {
    const response = await fetch(OPENBOT_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[MCP-Gateway] Openbot API error: HTTP ${response.status} - ${body.substring(0, 200)}`
      );
    } else {
      console.log("[MCP-Gateway] Response sent to Openbot successfully");
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.error("[MCP-Gateway] Timeout sending response to Openbot");
    } else {
      console.error("[MCP-Gateway] Error sending response to Openbot:", error);
    }
  }
}
