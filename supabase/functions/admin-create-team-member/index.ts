import { createClient } from "npm:@supabase/supabase-js@2";
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

    // Verify caller identity
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: userError } = await anonClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = callerUser.id;

    const body = await req.json();
    const { action } = body;

    // Service role client for admin operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is organization owner
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", callerId)
      .limit(1)
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = orgMember.organization_id;

    // Verify ownership
    const { data: org } = await supabase
      .from("organizations")
      .select("owner_user_id")
      .eq("id", orgId)
      .single();

    if (!org || org.owner_user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Only the organization owner can manage team members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { first_name, last_name, password, team_profile_id } = body;
      const email = (body.email || "").trim().toLowerCase();

      if (!first_name || !email || !password || !team_profile_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify profile belongs to org
      const { data: profile } = await supabase
        .from("team_profiles")
        .select("id")
        .eq("id", team_profile_id)
        .eq("organization_id", orgId)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Team profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `${first_name} ${last_name || ""}`.trim() },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        const friendlyMsg = createError.message?.toLowerCase().includes("already been registered")
          ? "Este e-mail já está cadastrado no sistema."
          : createError.message;
        return new Response(JSON.stringify({ error: friendlyMsg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newUserId = newUser.user.id;

      // Create profile
      await supabase
        .from("profiles")
        .upsert({ user_id: newUserId, full_name: `${first_name} ${last_name || ""}`.trim() });

      // Add to organization
      await supabase
        .from("organization_members")
        .insert({ organization_id: orgId, user_id: newUserId, role: "member" });

      // Create team member
      const { data: member, error: memberError } = await supabase
        .from("team_members")
        .insert({
          organization_id: orgId,
          user_id: newUserId,
          team_profile_id,
          first_name,
          last_name: last_name || "",
        })
        .select()
        .single();

      if (memberError) {
        console.error("Error creating team member:", memberError);
        return new Response(JSON.stringify({ error: "Erro ao criar membro da equipe." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, member }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { member_id } = body;
      
      // Get member's user_id
      const { data: member } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("id", member_id)
        .eq("organization_id", orgId)
        .single();

      if (!member) {
        return new Response(JSON.stringify({ error: "Member not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete team member record
      await supabase.from("team_members").delete().eq("id", member_id);
      
      // Remove from organization
      await supabase.from("organization_members")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", member.user_id);

      // Delete auth user
      await supabase.auth.admin.deleteUser(member.user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
