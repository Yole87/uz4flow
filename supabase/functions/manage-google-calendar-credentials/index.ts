/**
 * manage-google-calendar-credentials
 *
 * Handles save / get (masked) / delete of per-tenant Google Calendar OAuth credentials.
 * Uses service_role for DB operations and JWT validation for auth.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { encrypt } from "../_shared/encryption.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // JWT validation via anon client
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, organization_id, client_id, client_secret } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All DB operations use service_role
    const supabaseServiceRole = createClient(supabaseUrl, serviceRoleKey);

    if (action === "save") {
      if (!client_id || !client_secret) {
        return new Response(JSON.stringify({ error: "client_id and client_secret are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encrypted = await encrypt(client_secret);
      const { error } = await supabaseServiceRole
        .from("google_calendar_credentials")
        .upsert({
          organization_id,
          client_id,
          client_secret_encrypted: encrypted,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const { data } = await supabaseServiceRole
        .from("google_calendar_credentials")
        .select("client_id, created_at, updated_at")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (!data) {
        return new Response(JSON.stringify({ configured: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mask client_id: show first 20 chars + "..."
      return new Response(JSON.stringify({
        configured: true,
        client_id_masked: data.client_id.substring(0, 20) + "...",
        updated_at: data.updated_at,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { error } = await supabaseServiceRole
        .from("google_calendar_credentials")
        .delete()
        .eq("organization_id", organization_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[manage-google-calendar-credentials] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
