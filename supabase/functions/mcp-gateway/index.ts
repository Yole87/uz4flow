/**
 * Openbot MCP Gateway - Main Entry Point
 * 
 * This edge function receives webhooks from Openbot (WhatsApp bot),
 * normalizes the payload, executes a tool on an external MCP server,
 * and sends the result back to Openbot.
 * 
 * CRITICAL BUSINESS RULE:
 * When Openbot triggers this webhook, its native flow is PAUSED.
 * After MCP processing, we MUST send a POST back to the Openbot API
 * with { "desativarFluxo": true } to unlock the bot. This is handled
 * by the openbot-response.ts service.
 * 
 * Dynamic MCP Server Config:
 * Fetches the active MCP server configuration from the database
 * based on the organization that owns the instance.
 * Falls back to provider connections (mcp_connections) if no manual
 * MCP server is configured.
 * 
 * 100% ISOLATED - Does not depend on or affect any existing CRM code.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePayload } from "./message-adapter.ts";
import { connectAndExecute } from "./mcp-engine.ts";
import { sendToOpenbot } from "./openbot-response.ts";
import { executeProvider } from "./provider-handlers.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



interface McpServerConfig {
  server_url: string;
  tool_name: string;
  name: string;
  auth_type: string;
  auth_token: string | null;
  custom_headers: Record<string, string> | null;
}

/**
 * Fetches the active MCP server config for the organization that owns the instance.
 * Flow: instanceId -> instances table -> organization_id -> mcp_server_configs (active)
 */
async function getMcpConfig(instanceId: string): Promise<McpServerConfig | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[MCP-Gateway] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: instance, error: instErr } = await supabase
    .from("instances")
    .select("organization_id")
    .eq("openbot_instance_id", instanceId)
    .maybeSingle();

  if (instErr || !instance) {
    console.error(`[MCP-Gateway] Instance not found for openbot_instance_id=${instanceId}:`, instErr?.message);
    return null;
  }

  const { data: config, error: cfgErr } = await supabase
    .from("mcp_server_configs")
    .select("server_url, tool_name, name, auth_type, auth_token, custom_headers")
    .eq("organization_id", instance.organization_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (cfgErr || !config) {
    console.error(`[MCP-Gateway] No active MCP config for org=${instance.organization_id}:`, cfgErr?.message);
    return null;
  }

  return config as McpServerConfig;
}

interface ProviderConnection {
  id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  description: string | null;
  organization_id: string;
}

/**
 * Fetches an active provider connection from mcp_connections for the organization.
 * Used as fallback when no manual MCP server is configured.
 */
async function getProviderConnection(instanceId: string): Promise<ProviderConnection | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: instance, error: instErr } = await supabase
    .from("instances")
    .select("organization_id")
    .eq("openbot_instance_id", instanceId)
    .maybeSingle();

  if (instErr || !instance) {
    console.error(`[MCP-Gateway] Instance not found for provider lookup: ${instanceId}`);
    return null;
  }

  const { data: connection, error: connErr } = await supabase
    .from("mcp_connections")
    .select("id, provider, access_token, refresh_token, token_expiry, description, organization_id")
    .eq("organization_id", instance.organization_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (connErr || !connection) {
    console.error(`[MCP-Gateway] No active provider for org=${instance.organization_id}:`, connErr?.message);
    return null;
  }

  return connection as ProviderConnection;
}


/**
 * Resolves the organization for an instance and its configured webhook secret.
 */
async function getInstanceAuthContext(instanceId: string): Promise<{ organizationId: string; secret: string | null } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: instance } = await supabase
    .from("instances")
    .select("organization_id")
    .eq("openbot_instance_id", instanceId)
    .maybeSingle();
  if (!instance) return null;

  const { data: cfg } = await supabase
    .from("crm_openbot_config")
    .select("webhook_secret")
    .eq("organization_id", instance.organization_id)
    .maybeSingle();

  return { organizationId: instance.organization_id, secret: cfg?.webhook_secret ?? null };
}

/** HMAC-SHA256 hex signature validation with constant-time comparison. */
async function validateWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (expected.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return result === 0;
  } catch (_e) {
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Basic validation: must have chatId and instanceId
  if (!payload.chatId || !payload.instanceId) {
    console.warn("[MCP-Gateway] Invalid payload: missing chatId or instanceId");
    return new Response(
      JSON.stringify({ error: "Missing required fields: chatId, instanceId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // --- Mandatory caller authentication ---
  // The caller must prove knowledge of a shared secret bound to the instance's
  // organization (HMAC-SHA256 of the raw body, or the raw secret), or present
  // the service-role bearer token. Anonymous invocation is rejected.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceRoleCall =
    !!serviceRoleKey && req.headers.get("authorization") === `Bearer ${serviceRoleKey}`;

  if (!isServiceRoleCall) {
    const providedSignature =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("x-hub-signature-256") ||
      req.headers.get("x-signature") ||
      "";

    const authCtx = await getInstanceAuthContext(payload.instanceId);
    if (!authCtx || !authCtx.secret) {
      console.warn("[MCP-Gateway] Unauthorized: no webhook secret configured for instance");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const secret = authCtx.secret;
    const validHmac = providedSignature
      ? await validateWebhookSignature(rawBody, providedSignature.replace(/^sha256=/, ""), secret)
      : false;
    const validRaw =
      providedSignature.length === secret.length &&
      providedSignature.split("").reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ secret.charCodeAt(i)), 0) === 0;

    if (!validHmac && !validRaw) {
      console.warn("[MCP-Gateway] Unauthorized: invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  console.log(
    `[MCP-Gateway] Webhook received from instance=${payload.instanceId} chat=${payload.chatId} type=${payload.messageType}`
  );

  // Respond immediately with 200 OK - Openbot only needs acknowledgment
  const immediateResponse = new Response(
    JSON.stringify({ status: "received" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  // Asynchronous processing pipeline
  const processingPromise = (async () => {
    try {
      // Phase 1: Normalize payload
      const standardized = await normalizePayload(payload);
      console.log(
        `[MCP-Gateway] Normalized: type=${standardized.messageType} text="${(standardized.textContent || "").substring(0, 50)}" hasMedia=${!!standardized.mediaContent}`
      );

      let mcpResult: any;

      // Phase 2a: Try manual MCP server config first
      const mcpConfig = await getMcpConfig(payload.instanceId);

      if (mcpConfig) {
        console.log(`[MCP-Gateway] Using MCP server: "${mcpConfig.name}" url=${mcpConfig.server_url} tool=${mcpConfig.tool_name}`);
        mcpResult = await connectAndExecute(
          mcpConfig.server_url,
          mcpConfig.tool_name,
          standardized,
          {
            authType: mcpConfig.auth_type,
            authToken: mcpConfig.auth_token || undefined,
            customHeaders: mcpConfig.custom_headers || undefined,
          }
        );
      } else {
        // Phase 2b: Fallback to provider connections (mcp_connections)
        console.log("[MCP-Gateway] No manual MCP server found. Trying provider connections...");
        const provider = await getProviderConnection(payload.instanceId);

        if (provider) {
          console.log(`[MCP-Gateway] Using provider: "${provider.provider}"`);
          mcpResult = await executeProvider(provider, standardized);
        } else {
          console.error("[MCP-Gateway] No MCP server or provider configured. Aborting.");
          await sendToOpenbot(payload.chatId, payload.instanceId, {
            content: [{ type: "text", text: "⚠️ Nenhum servidor MCP ou provedor configurado para esta instância." }],
          });
          return;
        }
      }

      console.log("[MCP-Gateway] Result received:", JSON.stringify(mcpResult).substring(0, 200));

      // Phase 3: Send result back to Openbot
      await sendToOpenbot(
        standardized.chatId,
        standardized.instanceId,
        mcpResult
      );

      console.log("[MCP-Gateway] Full pipeline completed successfully");
    } catch (error) {
      console.error("[MCP-Gateway] Pipeline error:", error);

      try {
        await sendToOpenbot(payload.chatId, payload.instanceId, {
          content: [
            {
              type: "text",
              text: "⚠️ Erro no processamento MCP. Tente novamente.",
            },
          ],
        });
      } catch (notifyError) {
        console.error(
          "[MCP-Gateway] Failed to send error notification to Openbot:",
          notifyError
        );
      }
    }
  })();

  // Keep the edge function alive until processing completes
  // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(processingPromise);
  }

  return immediateResponse;
});
