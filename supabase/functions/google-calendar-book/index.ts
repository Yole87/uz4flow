import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt, encrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getGCalCredentials } from "../_shared/gcal-credentials.ts";

let _corsHeaders: Record<string, string> = {};

// Helper to format a Date as a Brazil-local ISO string with explicit offset
function toBrazilISO(date: Date): string {
  const offset = -3 * 60; // America/Sao_Paulo standard offset in minutes
  const local = new Date(date.getTime() + offset * 60 * 1000);
  return local.toISOString().replace("Z", "-03:00");
}

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      organization_id,
      start_datetime,
      duration_minutes,
      title,
      description,
      attendee_email,
      observations,
      include_meet,
    } = body;

    console.log("[GCal-Book] org:", organization_id, "slot:", start_datetime, "duration:", duration_minutes);

    if (!organization_id || !start_datetime || !duration_minutes || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate start_datetime
    const parsedStart = new Date(start_datetime);
    if (isNaN(parsedStart.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid start_datetime" }), {
        status: 400,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clamp duration (between 5 and 480 minutes) and sanitize text
    const safeDuration = Math.min(Math.max(Number(duration_minutes) || 30, 5), 480);
    const safeTitle = String(title).slice(0, 200);
    const safeObservations = observations ? String(observations).slice(0, 1000) : "";
    const baseDescription = description ? String(description).slice(0, 2000) : "";
    const safeDescription = safeObservations
      ? `${baseDescription}${baseDescription ? "\n" : ""}Observações: ${safeObservations}`
      : baseDescription;
    const wantsMeet = include_meet === true;

    // Get Google Calendar connection
    const { data: connection } = await supabase
      .from("mcp_connections")
      .select("id, access_token, refresh_token, token_expiry")
      .eq("organization_id", organization_id)
      .eq("provider", "google_calendar")
      .eq("is_active", true)
      .maybeSingle();

    console.log("[GCal-Book] connection found:", !!connection);

    if (!connection) {
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
      accessToken = await refreshAccessToken(
        connection.id,
        connection.refresh_token,
        organization_id,
        supabaseUrl,
        serviceRoleKey
      );
    } else {
      accessToken = (await decrypt(connection.access_token)).trim();
    }

    // Build end datetime
    const endDatetimeDate = new Date(
      new Date(start_datetime).getTime() + safeDuration * 60000
    );

    const eventBody: Record<string, unknown> = {
      summary: safeTitle,
      description: safeDescription,
      start: { dateTime: toBrazilISO(parsedStart), timeZone: "America/Sao_Paulo" },
      end: { dateTime: toBrazilISO(endDatetimeDate), timeZone: "America/Sao_Paulo" },
    };

    if (attendee_email) {
      eventBody.attendees = [{ email: attendee_email }];
    }

    if (wantsMeet) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const createResp = await fetch(
      wantsMeet
        ? "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1"
        : "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );
    const created = await createResp.json();

    console.log("[GCal-Book] API status:", createResp.status, "event_id:", created?.id);

    if (!createResp.ok) {
      console.error("[GCal-Book] API error:", created);
      return new Response(JSON.stringify({ error: "Failed to create event", details: created }), {
        status: 500,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        event_id: created.id,
        html_link: created.htmlLink,
        meet_url:
          created.conferenceData?.entryPoints?.find(
            (ep: { entryPointType?: string; uri?: string }) => ep.entryPointType === "video"
          )?.uri ?? null,
      }),
      {
        status: 200,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[GCal-Book]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  }
});
