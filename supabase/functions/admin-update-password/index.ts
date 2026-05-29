import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin_master role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin_master")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Permission denied: admin_master required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, email, new_password, force_change } = await req.json();

    if (!new_password || (!user_id && !email)) {
      return new Response(
        JSON.stringify({ error: "user_id or email, and new_password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let targetUserId = user_id;

    if (!targetUserId && email) {
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const found = users.users.find((u: any) => u.email === email);
      if (!found) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetUserId = found.id;
    }

    console.log(`[admin-update-password] Updating password for user: ${targetUserId} by admin: ${user.id}, force_change: ${!!force_change}`);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: new_password }
    );

    if (error) {
      console.error("[admin-update-password] Error:", error);
      const code = (error as any).code;
      let friendly = error.message || "Não foi possível alterar a senha";
      if (code === "weak_password") {
        friendly = "Esta senha é fraca ou já apareceu em vazamentos públicos. Escolha uma senha mais forte e única (evite sequências, datas e palavras comuns).";
      } else if (code === "same_password") {
        friendly = "A nova senha precisa ser diferente da senha atual.";
      }
      return new Response(
        JSON.stringify({ error: friendly, code }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If force_change is true, set force_password_change flag on profile
    if (force_change) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ force_password_change: true })
        .eq("user_id", targetUserId);

      if (profileError) {
        console.warn("[admin-update-password] Could not set force_password_change:", profileError);
      }
    }

    // Audit log
    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_user_id: user.id,
      action: "reset_password",
      target_type: "user",
      target_id: targetUserId,
      metadata: { force_change: !!force_change },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[admin-update-password] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
