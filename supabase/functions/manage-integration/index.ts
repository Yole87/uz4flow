import { createClient } from "npm:@supabase/supabase-js@2";
import { encrypt, decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



interface SaveIntegrationRequest {
  action: "save";
  apiKey?: string;
  inboundUrl?: string;
  webhookSecret?: string;
}

interface TestConnectionRequest {
  action: "test";
  apiKey?: string;
  inboundUrl: string;
}

interface GetIntegrationRequest {
  action: "get";
}

type RequestBody = SaveIntegrationRequest | TestConnectionRequest | GetIntegrationRequest;

// Rate limit configuration
interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  get: { maxRequests: 30, windowMinutes: 1 },
  test: { maxRequests: 5, windowMinutes: 5 },
  save: { maxRequests: 10, windowMinutes: 5 },
};

// Rate limit check function
// deno-lint-ignore no-explicit-any
async function checkRateLimit(
  supabaseAdmin: any,
  identifier: string,
  action: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[action] || { maxRequests: 20, windowMinutes: 1 };
  const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);

  try {
    // Count requests in current window
    const { count, error } = await supabaseAdmin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("endpoint", `manage-integration:${action}`)
      .gte("window_start", windowStart.toISOString());

    if (error) {
      console.error("Rate limit check error:", error);
      // Fail open in case of error
      return { allowed: true, remaining: config.maxRequests, resetAt: new Date() };
    }

    const currentCount = count || 0;
    const allowed = currentCount < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0));
    const resetAt = new Date(Date.now() + config.windowMinutes * 60 * 1000);

    // If allowed, record the request
    if (allowed) {
      await supabaseAdmin.from("rate_limits").insert({
        identifier,
        endpoint: `manage-integration:${action}`,
        window_start: new Date().toISOString(),
      });
    }

    return { allowed, remaining, resetAt };
  } catch (err) {
    console.error("Rate limit exception:", err);
    return { allowed: true, remaining: config.maxRequests, resetAt: new Date() };
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendToOpenBot(
  apiKey: string, 
  inboundUrl: string
): Promise<{ success: boolean; error?: string }> {
  const maxRetries = 2;
  let lastError: string | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(1000 * attempt);
      }
      
      const response = await fetch(inboundUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: apiKey,
          phone: "5500000000000",
          message: "🧪 Teste de conexão do Uz4Flow",
          desativarFluxo: true,
        }),
      });
      
      if (response.ok) {
        return { success: true };
      }
      
      const errorData = await response.json().catch(() => null);
      lastError = errorData?.error || `${response.status} ${response.statusText}`;
      
      if (response.status < 500) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }
  
  return { success: false, error: lastError || "Connection failed" };
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
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's auth token
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Verify user using getClaims for signing-keys JWT format
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseUser.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const user = { id: claimsData.claims.sub as string };
    
    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: RequestBody = await req.json();
    
    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     req.headers.get("x-real-ip") ||
                     "unknown";

    // Check rate limits (by user and by IP)
    const userLimit = await checkRateLimit(supabaseAdmin, user.id, body.action);
    const ipLimit = await checkRateLimit(supabaseAdmin, `ip:${clientIp}`, body.action);

    // Occasionally cleanup old rate limit records (1% chance)
    if (Math.random() < 0.01) {
      (async () => {
        try {
          await supabaseAdmin.rpc("cleanup_old_rate_limits");
          console.log("Rate limits cleanup completed");
        } catch (err) {
          console.error("Cleanup error:", err);
        }
      })();
    }

    if (!userLimit.allowed || !ipLimit.allowed) {
      const resetAt = userLimit.allowed ? ipLimit.resetAt : userLimit.resetAt;
      const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      
      console.warn(`Rate limit exceeded for user ${user.id} / IP ${clientIp} on action ${body.action}`);
      
      return new Response(
        JSON.stringify({ 
          error: "Limite de requisições excedido. Tente novamente em alguns minutos.",
          retryAfter,
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Remaining": String(Math.min(userLimit.remaining, ipLimit.remaining)),
          } 
        }
      );
    }

    // Rate limit headers for successful responses
    const rateLimitHeaders = {
      "X-RateLimit-Limit": String(RATE_LIMITS[body.action]?.maxRequests || 20),
      "X-RateLimit-Remaining": String(Math.min(userLimit.remaining, ipLimit.remaining)),
    };
    
    // Handle GET action - return only safe fields
    if (body.action === "get") {
      const { data: integration, error: fetchError } = await supabaseAdmin
        .from("integrations")
        .select("openbot_api_key_masked, openbot_inbound_url, id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      return new Response(
        JSON.stringify({
          success: true,
          integration: integration ? {
            hasApiKey: !!integration.openbot_api_key_masked,
            apiKeyMasked: integration.openbot_api_key_masked || null,
            inboundUrl: integration.openbot_inbound_url || null,
            hasWebhookSecret: false, // Never expose this info
          } : null,
        }),
        { headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Handle TEST action
    if (body.action === "test") {
      const { apiKey, inboundUrl } = body as TestConnectionRequest;
      
      if (!inboundUrl) {
        return new Response(
          JSON.stringify({ error: "Inbound URL is required" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let testApiKey: string | null = null;
      
      if (apiKey) {
        // New API key provided directly
        testApiKey = apiKey;
      } else {
        // Fetch existing API key from database (server-side only)
        const { data: integration, error: fetchError } = await supabaseAdmin
          .from("integrations")
          .select("openbot_api_key_encrypted")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (fetchError) throw fetchError;
        
        if (integration?.openbot_api_key_encrypted) {
          // Decrypt API key (supports both legacy base64 and new AES encryption)
          testApiKey = await decrypt(integration.openbot_api_key_encrypted);
        }
      }
      
      if (!testApiKey) {
        return new Response(
          JSON.stringify({ error: "Save an API Key before testing the connection" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const result = await sendToOpenBot(testApiKey, inboundUrl);
      
      return new Response(
        JSON.stringify({
          success: result.success,
          error: result.error,
        }),
        { headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Handle SAVE action
    if (body.action === "save") {
      const { apiKey, inboundUrl, webhookSecret } = body as SaveIntegrationRequest;
      
      // Check if integration exists
      const { data: existing, error: checkError } = await supabaseAdmin
        .from("integrations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      const updateData: Record<string, unknown> = {
        openbot_inbound_url: inboundUrl || null,
        updated_at: new Date().toISOString(),
      };
      
      // Only update webhook_secret if provided (not empty string)
      if (webhookSecret !== undefined) {
        updateData.webhook_secret = webhookSecret || null;
      }
      
      // Only update API key if provided - use AES-256-GCM encryption
      if (apiKey) {
        updateData.openbot_api_key_encrypted = await encrypt(apiKey);
        updateData.openbot_api_key_masked = maskApiKey(apiKey);
      }
      
      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from("integrations")
          .update(updateData)
          .eq("user_id", user.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("integrations")
          .insert({
            user_id: user.id,
            ...updateData,
          });
        
        if (insertError) throw insertError;
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          apiKeyMasked: apiKey ? maskApiKey(apiKey) : null,
        }),
        { headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // ── Save instance credentials (server-side encryption) ──
    if (body.action === "save-instance-credentials") {
      const { instance_id, api_key, api_url, key_field } = body as any;
      if (!instance_id) {
        return new Response(
          JSON.stringify({ error: "instance_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user belongs to the instance's organization
      const { data: instance, error: instErr } = await supabaseAdmin
        .from("instances")
        .select("organization_id")
        .eq("id", instance_id)
        .maybeSingle();

      if (instErr || !instance) {
        return new Response(
          JSON.stringify({ error: "Instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check membership
      const { data: membership } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("organization_id", instance.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin_master",
      });

      if (!membership && !isAdmin) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: Record<string, unknown> = {};

      if (api_url !== undefined) {
        updateData.api_url = api_url || null;
      }

      if (api_key) {
        const encryptedKey = await encrypt(api_key);
        const field = key_field === "api_key_encrypted" ? "api_key_encrypted" : "openbot_api_key_encrypted";
        updateData[field] = encryptedKey;
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No changes" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateErr } = await supabaseAdmin
        .from("instances")
        .update(updateData)
        .eq("id", instance_id);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Save billing OpenBot API key ──
    if (body.action === "save-billing-openbot-key") {
      const billingApiKey = (body as any).api_key;
      if (!billingApiKey) {
        return new Response(
          JSON.stringify({ error: "api_key is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify admin role
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin_master",
      });

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const encryptedKey = await encrypt(billingApiKey);

      // Upsert saas_settings
      const { error: upsertErr } = await supabaseAdmin
        .from("saas_settings")
        .upsert(
          { key: "billing_openbot_api_key_encrypted", value: encryptedKey },
          { onConflict: "key" }
        );

      if (upsertErr) throw upsertErr;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in manage-integration:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});