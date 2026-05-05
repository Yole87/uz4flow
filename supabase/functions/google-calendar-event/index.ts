/**
 * Google Calendar Event Creator
 * 
 * Creates an event on Google Calendar and optionally sends
 * a WhatsApp confirmation message to the client.
 */

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
    const {
      organization_id,
      title,
      start_datetime, // ISO string
      duration_minutes,
      description,
      include_meet,
      conversation_id,
      contact_name,
    } = body;

    if (!organization_id || !title || !start_datetime || !duration_minutes) {
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

    // Build Google Calendar event
    const startDate = new Date(start_datetime);
    const endDate = new Date(startDate.getTime() + duration_minutes * 60 * 1000);

    const event: Record<string, any> = {
      summary: title,
      start: { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" },
    };

    if (description) event.description = description;

    if (include_meet) {
      event.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    // Create event via Google Calendar API
    const calendarUrl = include_meet
      ? "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1"
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    const calResponse = await fetch(calendarUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    const calData = await calResponse.json();

    if (!calResponse.ok) {
      console.error("[GCal-Event] API error:", calData);
      return new Response(JSON.stringify({ error: "Failed to create calendar event", details: calData }), {
        status: 500,
        headers: { ..._corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[GCal-Event] Event created:", calData.id);

    // Format confirmation message
    const meetUrl = calData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri;
    const dateStr = startDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const startTime = startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const endTime = endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

    let confirmationMsg = `📅 *Reunião Agendada!*\n\n`;
    confirmationMsg += `*Título:* ${title}\n`;
    confirmationMsg += `*Data:* ${dateStr}\n`;
    confirmationMsg += `*Horário:* ${startTime} - ${endTime}\n`;
    if (meetUrl) {
      confirmationMsg += `\n🔗 *Link Google Meet:* ${meetUrl}\n`;
    }
    confirmationMsg += `\nNos vemos lá! 🤝`;

    // Send WhatsApp confirmation if conversation_id provided
    if (conversation_id) {
      try {
        const { error: sendError } = await supabaseUser.functions.invoke("crm-send-message", {
          body: {
            conversation_id,
            message: confirmationMsg,
          },
        });
        if (sendError) console.error("[GCal-Event] Failed to send WhatsApp confirmation:", sendError);
        else console.log("[GCal-Event] WhatsApp confirmation sent");
      } catch (e) {
        console.error("[GCal-Event] Error sending WhatsApp:", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      event_id: calData.id,
      event_link: calData.htmlLink,
      meet_url: meetUrl || null,
      confirmation_message: confirmationMsg,
    }), {
      status: 200,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[GCal-Event] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });
  }
});
