import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: userError } = await anonClient.auth.getClaims(token);
    const user = claimsData?.claims ? { id: claimsData.claims.sub as string } : null;

    if (userError || !user) {
      console.error("[admin-list-leads] Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin_master",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Parse body for action
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // no body = list action
    }

    // --- ACTION: search-user-by-email ---
    if (body?.action === "search-user-by-email") {
      const email = body.email?.trim()?.toLowerCase();
      if (!email) {
        return new Response(
          JSON.stringify({ error: "email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[admin-list-leads] Searching user by email");

      // Search directly by email (fast, no pagination needed)
      const { data: { users: matchedUsers }, error: listErr } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 50,
      });
      // Use filter on smaller set or try direct approach
      let found: any = null;
      // Try to find via listing with email filter
      const allUsersSearch: any[] = [];
      let searchPage = 1;
      while (true) {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page: searchPage, perPage: 1000 });
        if (error) throw error;
        const match = users.find((u: any) => u.email?.toLowerCase() === email);
        if (match) { found = match; break; }
        if (users.length < 1000) break;
        searchPage++;
      }
      if (!found) {
        return new Response(
          JSON.stringify({ found: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user already has an org
      const { data: membership } = await adminClient
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", found.id)
        .maybeSingle();

      const { data: profile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", found.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          found: true,
          user: {
            id: found.id,
            email: found.email,
            full_name: profile?.full_name || null,
            created_at: found.created_at,
            has_organization: !!membership,
            organization_id: membership?.organization_id || null,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ACTION: create-org-for-lead ---
    if (body?.action === "create-org-for-lead") {
      const leadUserId = body.user_id;
      const leadEmail = body.email;
      if (!leadUserId || !leadEmail) {
        return new Response(
          JSON.stringify({ error: "user_id and email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const slug = leadEmail.split("@")[0].replace(/[^a-z0-9]/gi, "-").toLowerCase() + "-" + Date.now();
      const orgName = leadEmail;

      const { data: newOrg, error: orgError } = await adminClient
        .from("organizations")
        .insert({
          name: orgName,
          slug,
          owner_user_id: leadUserId,
          is_active: true,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      const { error: memberError } = await adminClient
        .from("organization_members")
        .insert({
          organization_id: newOrg.id,
          user_id: leadUserId,
          role: "owner",
        });

      if (memberError) throw memberError;

      return new Response(
        JSON.stringify({ organization: { id: newOrg.id, name: newOrg.name } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- DEFAULT: list leads ---
    console.log("[admin-list-leads] Starting list leads...");
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;
      allUsers.push(...users);
      if (users.length < perPage) break;
      page++;
    }
    console.log(`[admin-list-leads] Found ${allUsers.length} total auth users`);

    const { data: orgMembers } = await adminClient
      .from("organization_members")
      .select("user_id");

    const orgUserIds = new Set((orgMembers || []).map((m: any) => m.user_id));

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, full_name");

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p.full_name])
    );

    const leads = allUsers
      .filter((u) => !orgUserIds.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        full_name: profileMap.get(u.id) || null,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        status: "pending_signup",
      }));

    const allUsersMap: Record<string, string> = {};
    for (const u of allUsers) {
      if (u.email) allUsersMap[u.id] = u.email;
    }

    console.log(`[admin-list-leads] Returning ${leads.length} leads, ${Object.keys(allUsersMap).length} mapped users`);

    return new Response(JSON.stringify({ leads, allUsersMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin-list-leads] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
