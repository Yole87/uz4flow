/**
 * Google Calendar Account Info
 *
 * Returns the Google account (email/name/picture) the tenant authorized,
 * so the user can see where events are being created.
 */

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

  const refreshToken = await decrypt(refreshTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken.trim(),
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Token refresh failed: ${data.error || response.status}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  await supabase.from("mcp_connections").update({
    access_token: await encrypt(data.access_token),
    token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connectionId);

  return data.access_token;
}

Deno.serve(async (req) => {
  _corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ..._corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const organizationId = body?.organization_id;
    if (!organizationId || typeof organizationId !== "string") {
      return json({ error: "Missing required fields" }, 400);
    }

    // Ensure the caller belongs to the organization (RLS-scoped read)
    const { data: membership } = await supabaseUser
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!membership) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin_master",
      });
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
    }

    const { data: connection } = await supabase
      .from("mcp_connections")
      .select("id, access_token, refresh_token, token_expiry")
      .eq("organization_id", organizationId)
      .eq("provider", "google_calendar")
      .eq("is_active", true)
      .maybeSingle();

    if (!connection) return json({ error: "Google Calendar not connected" }, 400);

    const isExpired = connection.token_expiry
      ? new Date(connection.token_expiry).getTime() - Date.now() < 5 * 60 * 1000
      : false;

    const accessToken = isExpired && connection.refresh_token
      ? await refreshAccessToken(connection.id, connection.refresh_token, organizationId, supabaseUrl, serviceRoleKey)
      : (await decrypt(connection.access_token)).trim();

    const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error("[GCal-Account] userinfo failed:", resp.status, detail);
      return json({ error: "Não foi possível obter a conta Google conectada." }, 200);
    }

    const info = await resp.json();
    console.log("[GCal-Account] resolved account for org:", organizationId);

    return json({
      email: info.email ?? null,
      name: info.name ?? null,
      picture: info.picture ?? null,
    });
  } catch (err) {
    console.error("[GCal-Account] Error:", err);
    return json({ error: "Erro interno. Tente novamente." }, 200);
  }
});
