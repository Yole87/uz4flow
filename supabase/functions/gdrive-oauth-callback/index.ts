/**
 * Google OAuth 2.0 Callback Handler (shared by Drive + Calendar)
 * 
 * Receives authorization code from Google, exchanges for tokens,
 * encrypts them, and stores in mcp_connections table.
 * 
 * Supports both old state format (org_id string) and new minimal format.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encrypt } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseState(state: string): { organizationId: string; provider: string; redirectUrl: string; traceId: string } {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://uz4flow.lovable.app";
  let organizationId = "";
  let provider = "google_drive";
  let redirectUrl = `${frontendUrl}/mcp-gateway`;
  let traceId = "no-trace";

  try {
    const decoded = JSON.parse(atob(state));
    // New minimal format: { o, p, r, t }
    if (decoded.o) {
      organizationId = decoded.o;
      provider = decoded.p || "google_drive";
      redirectUrl = decoded.r || redirectUrl;
      traceId = decoded.t || traceId;
    }
    // Old format: { org_id, provider, redirect_url }
    else if (decoded.org_id) {
      organizationId = decoded.org_id;
      provider = decoded.provider || "google_drive";
      redirectUrl = decoded.redirect_url || redirectUrl;
    }
  } catch {
    // Fallback: state is just the org_id
    organizationId = state;
  }

  // If redirectUrl is a relative path, prepend frontend URL
  if (redirectUrl.startsWith("/")) {
    redirectUrl = `${frontendUrl}${redirectUrl}`;
  }

  return { organizationId, provider, redirectUrl, traceId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://uz4flow.lovable.app";

  // Log all incoming params for diagnostics
  console.log(`[GDrive-OAuth] step=callback_received code=${!!code} state_len=${state?.length} error=${error || "none"} all_params=${url.search}`);

  if (error) {
    const errorDesc = url.searchParams.get("error_description") || "";
    let reason = error;
    let traceId = "no-trace";

    if (state) {
      const parsed = parseState(state);
      traceId = parsed.traceId;
    }

    console.error(`[GDrive-OAuth] step=google_return_error trace_id=${traceId} error=${error} desc=${errorDesc}`);

    let errorRedirect = `${frontendUrl}/crm`;
    if (state) {
      const parsed = parseState(state);
      errorRedirect = parsed.redirectUrl;
    }

    return Response.redirect(`${errorRedirect}?oauth_status=error&reason=${encodeURIComponent(reason)}`, 302);
  }

  if (!code || !state) {
    console.error("[GDrive-OAuth] Missing code or state parameter");
    return Response.redirect(`${frontendUrl}/crm?oauth_status=error&reason=missing_params`, 302);
  }

  try {
    const { organizationId, provider, redirectUrl, traceId } = parseState(state);

    console.log(`[GDrive-OAuth] step=token_exchange_start trace_id=${traceId} provider=${provider} org=${organizationId.substring(0, 8)}...`);

    // Select credentials based on provider
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (provider === "google_calendar") {
      clientId = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID"))?.trim();
      clientSecret = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET"))?.trim();
    } else {
      clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
      clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    if (!organizationId) {
      throw new Error("Invalid state: no organization_id");
    }

    // Exchange code for tokens
    const redirectUri = `${supabaseUrl}/functions/v1/gdrive-oauth-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(`[GDrive-OAuth] step=token_exchange_failed trace_id=${traceId} status=${tokenResponse.status} error=${JSON.stringify(tokenData)}`);
      return Response.redirect(`${redirectUrl}?oauth_status=error&reason=token_exchange_failed`, 302);
    }

    console.log(`[GDrive-OAuth] step=token_exchange_success trace_id=${traceId} has_refresh=${!!tokenData.refresh_token} duration_ms=${Date.now() - startMs}`);

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? await encrypt(tokenData.refresh_token)
      : null;

    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await supabase
      .from("mcp_connections")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .maybeSingle();

    if (existing) {
      const updateData: Record<string, any> = {
        access_token: encryptedAccessToken,
        token_expiry: tokenExpiry,
        scopes: tokenData.scope || (provider === "google_calendar" ? "https://www.googleapis.com/auth/calendar.events" : "https://www.googleapis.com/auth/drive.readonly"),
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (encryptedRefreshToken) {
        updateData.refresh_token = encryptedRefreshToken;
      }

      const { error: updateErr } = await supabase
        .from("mcp_connections")
        .update(updateData)
        .eq("id", existing.id);

      if (updateErr) throw updateErr;
      console.log(`[GDrive-OAuth] step=connection_saved trace_id=${traceId} action=updated id=${existing.id}`);
    } else {
      const { error: insertErr } = await supabase
        .from("mcp_connections")
        .insert({
          organization_id: organizationId,
          provider,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expiry: tokenExpiry,
          scopes: tokenData.scope || (provider === "google_calendar" ? "https://www.googleapis.com/auth/calendar.events" : "https://www.googleapis.com/auth/drive.readonly"),
          is_active: true,
          description: provider === "google_calendar" ? "Google Calendar OAuth 2.0" : "Google Drive OAuth 2.0",
        });

      if (insertErr) throw insertErr;
      console.log(`[GDrive-OAuth] step=connection_saved trace_id=${traceId} action=inserted org=${organizationId.substring(0, 8)}...`);
    }

    return Response.redirect(`${redirectUrl}?oauth_status=success`, 302);
  } catch (err) {
    console.error("[GDrive-OAuth] Error:", err);
    return Response.redirect(`${frontendUrl}/crm?oauth_status=error&reason=internal_error`, 302);
  }
});
