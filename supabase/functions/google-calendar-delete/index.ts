import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt, encrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

let _corsHeaders: Record<string, string> = {};

async function refreshAccessToken(
  connectionId: string,
  refreshTokenEncrypted: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string> {
  const clientId = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID"))?.trim();
  const clientSecret = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET"))?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const refreshToken = await decrypt(refreshTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken.trim(),
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Token refresh failed: ${data.error || response.status}`);

  // Update stored token
  const newEncryptedToken = await encrypt(data.access_token);
  const tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  await supabase.from("mcp_connections").update({
    access_token: newEncryptedToken,
    token_expiry: tokenExpiry,
    updated_at: new Date().toISOString(),
  }).eq("id", connectionId);

  return data.access_token;
}

Deno.serve(async (req) => {
  _corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { organization_id, event_id } = body;

    if (!organization_id || !event_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google Calendar connection
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: connection, error: connError } = await supabase
      .from("mcp_connections")
      .select("id, access_token, refresh_token, token_expiry")
      .eq("organization_id", organization_id)
      .eq("provider", "google_calendar")
      .eq("is_active", true)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get valid access token
    const isExpired = connection.token_expiry
      ? new Date(connection.token_expiry).getTime() - Date.now() < 5 * 60 * 1000
      : false;

    let accessToken: string;
    if (isExpired && connection.refresh_token) {
      accessToken = await refreshAccessToken(connection.id, connection.refresh_token, supabaseUrl, serviceRoleKey);
    } else {
      accessToken = (await decrypt(connection.access_token)).trim();
    }

    // Call Google Calendar API to delete event
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => ({}));
      console.error("[GCal-Delete] API error:", data);
      return new Response(JSON.stringify({ error: "Failed to delete calendar event", details: data }), {
        status: 500,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[GCal-Delete] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  }
});
