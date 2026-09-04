/**
 * Google Calendar OAuth 2.0 Initiation
 * 
 * Generates the Google OAuth URL with calendar.events scope
 * and redirects the user to Google consent screen.
 * 
 * KEY: The state parameter MUST be minimal to avoid 403 from Google.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getGCalCredentials } from "../_shared/gcal-credentials.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  const startMs = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl) {
      console.error("[GCal-OAuth] Missing supabaseUrl config");
      return new Response(JSON.stringify({ error: "Missing configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { organization_id, redirect_url, trace_id } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const traceId = trace_id || "no-trace";

    // Fetch per-tenant credentials (with env var fallback)
    const creds = await getGCalCredentials(organization_id, supabaseUrl, serviceRoleKey);

    if (!creds) {
      return new Response(JSON.stringify({
        error_code: "tenant_google_not_configured",
        error: "Configure as credenciais do Google Calendar em Agenda > Configurações antes de conectar.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sanitize redirect_url: only allow short internal paths
    let safeRedirect = redirect_url || "";
    // Strip any query params or tokens from the redirect
    try {
      const parsed = new URL(safeRedirect);
      safeRedirect = `${parsed.origin}${parsed.pathname}`;
    } catch {
      safeRedirect = "/crm";
    }
    // Enforce max length
    if (safeRedirect.length > 256) {
      safeRedirect = "/crm";
    }

    // Build MINIMAL state — this is critical to avoid Google 403
    const stateObj = {
      o: organization_id,       // org_id (short key)
      p: "google_calendar",     // provider
      r: safeRedirect,          // redirect
      t: traceId,               // trace
    };
    const stateStr = btoa(JSON.stringify(stateObj));

    const redirectUri = `${supabaseUrl}/functions/v1/gdrive-oauth-callback`;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", creds.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events"
    );
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", stateStr);

    const generatedUrl = authUrl.toString();

    // Structured diagnostic logging
    console.log(`[GCal-OAuth] step=oauth_url_generated trace_id=${traceId} source=${creds.source} client_id_len=${creds.clientId.length} client_id_prefix=${creds.clientId.substring(0, 20)} state_length=${stateStr.length} url_length=${generatedUrl.length} redirect_uri=${redirectUri} duration_ms=${Date.now() - startMs}`);

    return new Response(JSON.stringify({ url: generatedUrl, state_length: stateStr.length, url_length: generatedUrl.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[GCal-OAuth] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
