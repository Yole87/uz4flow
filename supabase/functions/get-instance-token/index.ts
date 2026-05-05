import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user ID - try getClaims first, fallback to getUser
    let userId: string;
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) throw new Error("claims failed");
      userId = claimsData.claims.sub;
    } catch {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const { instance_id } = await req.json();
    if (!instance_id) {
      return new Response(JSON.stringify({ error: "instance_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read encrypted fields
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user belongs to the organization that owns the instance
    const { data: instance, error: instError } = await adminClient
      .from("instances")
      .select("id, openbot_api_key_encrypted, api_key_encrypted, api_url, organization_id, provider")
      .eq("id", instance_id)
      .maybeSingle();

    if (instError || !instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin_master (bypass membership/owner checks)
    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin_master")
      .maybeSingle();

    if (!adminRole) {
      // Check membership
      const { data: membership } = await adminClient
        .from("organization_members")
        .select("role")
        .eq("organization_id", instance.organization_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only owners can view tokens
      if (membership.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only owners can view tokens" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Decrypt the appropriate key
    let decryptedToken: string | null = null;
    const encryptedField = instance.provider === "meta_official"
      ? instance.api_key_encrypted
      : instance.openbot_api_key_encrypted;

    if (encryptedField) {
      try {
        decryptedToken = await decrypt(encryptedField);
      } catch (e) {
        console.error("[get-instance-token] Decryption failed:", e);
        decryptedToken = null;
      }
    }

    return new Response(
      JSON.stringify({
        token: decryptedToken,
        api_url: instance.api_url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[get-instance-token] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
