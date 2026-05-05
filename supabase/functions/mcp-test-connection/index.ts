/**
 * MCP Test Connection - Edge Function
 * 
 * Tests connectivity to an external MCP server via SSE,
 * lists available tools, and returns the result.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "npm:@modelcontextprotocol/sdk@1.12.1/client/index.js";
import { SSEClientTransport } from "npm:@modelcontextprotocol/sdk@1.12.1/client/sse.js";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const TEST_TIMEOUT_MS = 15_000;

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}

function buildAuthHeaders(
  authType: string,
  authToken?: string,
  customHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (authType === "api_key" && authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else if (authType === "custom_headers" && customHeaders) {
    Object.assign(headers, customHeaders);
  }
  return headers;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("claims failed");
    userId = claimsData.claims.sub;
  } catch {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    userId = user.id;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { server_url, auth_type = "none", auth_token, custom_headers } = body;

  if (!server_url) {
    return new Response(
      JSON.stringify({ success: false, error: "server_url é obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[MCP-Test] User ${userId} testing connection to: ${server_url}`);

  try {
    const mcpAuthHeaders = buildAuthHeaders(auth_type, auth_token, custom_headers);

    const transportOptions: any = {};
    if (Object.keys(mcpAuthHeaders).length > 0) {
      transportOptions.requestInit = { headers: mcpAuthHeaders };
    }

    const transport = new SSEClientTransport(new URL(server_url), transportOptions);
    const client = new Client(
      { name: "MCP-Test-Connection", version: "1.0.0" },
      { capabilities: {} }
    );

    await Promise.race([
      client.connect(transport),
      timeout(TEST_TIMEOUT_MS, "Timeout ao conectar ao servidor MCP"),
    ]);

    // List available tools
    const toolsResult = await Promise.race([
      client.listTools(),
      timeout(TEST_TIMEOUT_MS, "Timeout ao listar ferramentas"),
    ]);

    const tools = (toolsResult?.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || "",
    }));

    try {
      await transport.close();
    } catch {
      // ignore close errors
    }

    return new Response(
      JSON.stringify({ success: true, tools }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MCP-Test] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
