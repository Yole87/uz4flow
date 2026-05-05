import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



interface BulkDeleteRequest {
  action: "delete_all_conversations" | "delete_selected_conversations" | "delete_all_contacts";
  instance_id?: string;
  conversation_ids?: string[];
  contact_ids?: string[];
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's organization
    const { data: orgMember, error: orgError } = await adminClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgError || !orgMember) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organizationId = orgMember.organization_id;

    const body: BulkDeleteRequest = await req.json();
    const { action, instance_id, conversation_ids, contact_ids } = body;

    console.log("[crm-bulk-delete] Action:", action, "Org:", organizationId);

    let deletedCount = 0;

    switch (action) {
      case "delete_all_conversations": {
        // Get contacts from org to find their conversations
        const { data: contacts } = await adminClient
          .from("contacts")
          .select("id")
          .eq("organization_id", organizationId);

        if (!contacts || contacts.length === 0) {
          return new Response(
            JSON.stringify({ success: true, deleted: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const contactIds = contacts.map((c) => c.id);

        // Build query for conversations
        let convQuery = adminClient
          .from("conversations")
          .select("id")
          .in("contact_id", contactIds);

        if (instance_id) {
          convQuery = convQuery.eq("instance_id", instance_id);
        }

        const { data: conversations } = await convQuery;

        if (!conversations || conversations.length === 0) {
          return new Response(
            JSON.stringify({ success: true, deleted: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const convIds = conversations.map((c) => c.id);

        // Delete messages first
        await adminClient.from("messages").delete().in("conversation_id", convIds);

        // Delete conversations
        const { count } = await adminClient
          .from("conversations")
          .delete({ count: "exact" })
          .in("id", convIds);

        deletedCount = count || 0;
        break;
      }

      case "delete_selected_conversations": {
        if (!conversation_ids || conversation_ids.length === 0) {
          return new Response(
            JSON.stringify({ error: "No conversation IDs provided" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Step 1: fetch conversations by ID
        const { data: convs } = await adminClient
          .from("conversations")
          .select("id, contact_id")
          .in("id", conversation_ids);

        if (!convs || convs.length === 0) {
          console.log("[crm-bulk-delete] No conversations found for IDs:", conversation_ids);
          return new Response(
            JSON.stringify({ error: "No valid conversations to delete" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Step 2: verify contacts belong to org (separate query)
        const uniqueContactIds = [...new Set(convs.map(c => c.contact_id))];
        const { data: validContacts } = await adminClient
          .from("contacts")
          .select("id")
          .in("id", uniqueContactIds)
          .eq("organization_id", organizationId);

        const validContactSet = new Set((validContacts || []).map(c => c.id));
        const validIds = convs
          .filter(c => validContactSet.has(c.contact_id))
          .map(c => c.id);

        console.log("[crm-bulk-delete] Conversations:", convs.length, "Valid:", validIds.length);

        if (validIds.length === 0) {
          return new Response(
            JSON.stringify({ error: "No valid conversations to delete" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Step 3: delete messages then conversations
        await adminClient.from("messages").delete().in("conversation_id", validIds);

        const { count } = await adminClient
          .from("conversations")
          .delete({ count: "exact" })
          .in("id", validIds);

        deletedCount = count || 0;
        break;
      }

      case "delete_all_contacts": {
        // Get contacts from org
        let contactQuery = adminClient
          .from("contacts")
          .select("id")
          .eq("organization_id", organizationId);

        if (instance_id) {
          contactQuery = contactQuery.eq("instance_id", instance_id);
        }

        const { data: contacts } = await contactQuery;

        if (!contacts || contacts.length === 0) {
          return new Response(
            JSON.stringify({ success: true, deleted: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const contactIds = contacts.map((c) => c.id);

        // Get conversations for these contacts
        const { data: conversations } = await adminClient
          .from("conversations")
          .select("id")
          .in("contact_id", contactIds);

        const convIds = conversations?.map((c) => c.id) || [];

        if (convIds.length > 0) {
          // Delete messages
          await adminClient.from("messages").delete().in("conversation_id", convIds);

          // Delete conversations
          await adminClient.from("conversations").delete().in("id", convIds);
        }

        // Delete contacts
        const { count } = await adminClient
          .from("contacts")
          .delete({ count: "exact" })
          .in("id", contactIds);

        deletedCount = count || 0;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log("[crm-bulk-delete] Deleted:", deletedCount);

    return new Response(
      JSON.stringify({ success: true, deleted: deletedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[crm-bulk-delete] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
