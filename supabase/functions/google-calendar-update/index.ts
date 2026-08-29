import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt, encrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getGCalCredentials } from "../_shared/gcal-credentials.ts";

let _corsHeaders: Record<string, string> = {};

async function refreshAccessToken(
  connectionId: string,
  refreshTokenEncrypted: string,
  organizationId: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string> {
  const creds = await getGCalCredentials(organizationId, supabaseUrl, serviceRoleKey);
  if (!creds) throw new Error("Google Calendar credentials not configured for this organization");
  const clientId = creds.clientId;
  const clientSecret = creds.clientSecret;

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
    const { organization_id, event_id, title, start_datetime, duration_minutes, description, include_meet } = body;

    if (!organization_id || !event_id || !title || !start_datetime || !duration_minutes) {
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
      accessToken = await refreshAccessToken(connection.id, connection.refresh_token, organization_id, supabaseUrl, serviceRoleKey);
    } else {
      accessToken = (await decrypt(connection.access_token)).trim();
    }

    const endDatetime = new Date(new Date(start_datetime).getTime() + duration_minutes * 60000).toISOString();

    const eventBody: any = {
      summary: title,
      description: description || "",
      start: { dateTime: start_datetime, timeZone: "America/Sao_Paulo" },
      end: { dateTime: endDatetime, timeZone: "America/Sao_Paulo" },
    };

    if (include_meet) {
      eventBody.conferenceData = {
        createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } }
      };
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}${include_meet ? "?conferenceDataVersion=1" : ""}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      }
    );
    const updated = await response.json();

    if (!response.ok) {
      console.error("[GCal-Update] API error:", updated);
      return new Response(JSON.stringify({ error: "Failed to update calendar event", details: updated }), {
        status: 500,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[GCal-Update] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  }
});
