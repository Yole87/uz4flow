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
      date,
      slot_duration = 30,
      availability_start = "09:00",
      availability_end = "18:00",
      available_days = [1, 2, 3, 4, 5],
      advance_hours = 0,
    } = body;

    if (!organization_id || !date) {
      return new Response(JSON.stringify({ error: "Missing organization_id or date" }), {
        status: 400,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requested day is available
    const requestedDate = new Date(date + "T00:00:00");
    const dayOfWeek = requestedDate.getDay();
    if (!available_days.includes(dayOfWeek)) {
      return new Response(JSON.stringify({ slots: [], reason: "day_not_available" }), {
        status: 200,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get connection
    const { data: connection } = await supabase
      .from("mcp_connections")
      .select("id, access_token, refresh_token, token_expiry")
      .eq("organization_id", organization_id)
      .eq("provider", "google_calendar")
      .eq("is_active", true)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ error: "Calendar not connected" }), {
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

    // Build time range for the day (America/Sao_Paulo -03:00)
    const dayStart = new Date(`${date}T${availability_start}:00-03:00`);
    const dayEnd = new Date(`${date}T${availability_end}:00-03:00`);

    // Fetch busy events from Google Calendar
    const eventsResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
        }),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const eventsData = await eventsResp.json();
    const busyEvents = (eventsData.items || []) as Array<{
      start: { dateTime?: string };
      end: { dateTime?: string };
    }>;

    // Generate all possible slots
    const allSlots: { time: string; available: boolean }[] = [];
    const minBookingTime = new Date(Date.now() + advance_hours * 3600 * 1000);
    let cursor = new Date(dayStart);

    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + slot_duration * 60000);
      if (slotEnd > dayEnd) break;

      const isPast = cursor <= minBookingTime;
      const isConflict = busyEvents.some((ev) => {
        if (!ev.start.dateTime || !ev.end.dateTime) return false;
        const evStart = new Date(ev.start.dateTime);
        const evEnd = new Date(ev.end.dateTime);
        return cursor < evEnd && slotEnd > evStart;
      });

      allSlots.push({
        time: cursor.toISOString(),
        available: !isPast && !isConflict,
      });

      cursor = slotEnd;
    }

    return new Response(JSON.stringify({ slots: allSlots }), {
      status: 200,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[GCal-Slots]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  }
});
