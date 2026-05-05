import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Manual storage cleanup endpoint.
 *
 * Resolves the target organization in this order:
 *   1. body.impersonate_org_id  (only honored when caller is admin_master)
 *   2. organizations.owner_user_id = caller
 *   3. organization_members.user_id = caller (first row)
 *
 * Then:
 *   - Deletes media from storage buckets (message-media + contact-attachments)
 *     scoped to the resolved org's <orgId>/ prefix.
 *   - Clears media_url/media_mime_type on messages of that org.
 *   - Recalculates storage usage and returns bytes before / bytes after.
 */
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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse body (best-effort — body is optional).
    let impersonateOrgId: string | null = null;
    try {
      const body = await req.json();
      const raw = body?.impersonate_org_id;
      if (typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw)) {
        impersonateOrgId = raw;
      }
    } catch {
      // No body or invalid JSON — fall through.
    }

    // Resolve target organization.
    let orgId: string | null = null;

    if (impersonateOrgId) {
      // Caller must be admin_master to use impersonation.
      const { data: isAdminMaster } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin_master",
      });
      if (!isAdminMaster) {
        console.warn(
          `[storage-manual-cleanup] non-admin ${user.id.substring(0, 8)} tried impersonation`
        );
        return new Response(
          JSON.stringify({ error: "Permissão negada para Modo Suporte." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate the org exists.
      const { data: targetOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", impersonateOrgId)
        .maybeSingle();

      if (!targetOrg) {
        return new Response(
          JSON.stringify({ error: "Organização do Modo Suporte não encontrada." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      orgId = targetOrg.id;

      // Audit log.
      await supabase.from("admin_audit_logs").insert({
        actor_user_id: user.id,
        action: "storage_cleanup_impersonated",
        target_type: "organization",
        target_id: orgId,
        metadata: {},
      });
    } else {
      // Self-service: try ownership first, then membership.
      const { data: ownedOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (ownedOrg?.id) {
        orgId = ownedOrg.id;
      } else {
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        orgId = membership?.organization_id ?? null;
      }
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({
          error: "Sem organização vinculada — não há nada para limpar.",
          mediaFilesDeleted: 0,
          attachmentsDeleted: 0,
          usedBytesBefore: 0,
          usedBytesAfter: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[storage-manual-cleanup] target org: ${orgId.substring(0, 8)}...`);

    // Snapshot usage BEFORE cleanup.
    const { data: usageBefore } = await supabase
      .from("organization_storage_usage")
      .select("used_bytes")
      .eq("organization_id", orgId)
      .maybeSingle();
    const usedBytesBefore = usageBefore?.used_bytes ?? 0;

    let mediaFilesDeleted = 0;
    let attachmentsDeleted = 0;

    // 1) message-media bucket — paginate through all files under <orgId>/
    try {
      const prefix = `${orgId}/`;
      let offset = 0;
      const PAGE = 1000;
      // Hard cap of 100 pages (~100k files) to avoid runaway loops.
      for (let page = 0; page < 100; page++) {
        const { data: files, error } = await supabase.storage
          .from("message-media")
          .list(orgId, { limit: PAGE, offset });
        if (error) {
          console.warn("[storage-manual-cleanup] list error:", error.message);
          break;
        }
        if (!files || files.length === 0) break;

        const paths = files.map((f) => `${prefix}${f.name}`);
        for (let i = 0; i < paths.length; i += 100) {
          const batch = paths.slice(i, i + 100);
          const { error: rmErr } = await supabase.storage
            .from("message-media")
            .remove(batch);
          if (rmErr) {
            console.warn("[storage-manual-cleanup] remove error:", rmErr.message);
          } else {
            mediaFilesDeleted += batch.length;
          }
        }

        if (files.length < PAGE) break;
        offset += PAGE;
      }
    } catch (err) {
      console.warn("[storage-manual-cleanup] message-media exception:", err);
    }

    // 2) contact-attachments
    try {
      const { data: attachments } = await supabase
        .from("contact_attachments")
        .select("id, storage_path")
        .eq("organization_id", orgId);

      if (attachments && attachments.length > 0) {
        const storagePaths = attachments.map((a: any) => a.storage_path).filter(Boolean);
        for (let i = 0; i < storagePaths.length; i += 100) {
          const batch = storagePaths.slice(i, i + 100);
          await supabase.storage.from("contact-attachments").remove(batch);
        }

        await supabase
          .from("contact_attachments")
          .delete()
          .eq("organization_id", orgId);

        attachmentsDeleted = attachments.length;
      }
    } catch (err) {
      console.warn("[storage-manual-cleanup] attachments exception:", err);
    }

    // 3) Clear media_url on messages of this org.
    const { error: clearErr } = await supabase
      .from("messages")
      .update({ media_url: null, media_mime_type: null })
      .eq("organization_id", orgId)
      .not("media_url", "is", null);
    if (clearErr) {
      console.warn("[storage-manual-cleanup] clear media_url:", clearErr.message);
    }

    // 4) Recalculate.
    await supabase.rpc("recalculate_org_storage", { p_org_id: orgId });

    const { data: usageAfter } = await supabase
      .from("organization_storage_usage")
      .select("used_bytes, file_count")
      .eq("organization_id", orgId)
      .maybeSingle();

    const usedBytesAfter = usageAfter?.used_bytes ?? 0;

    console.log(
      `[storage-manual-cleanup] done. media=${mediaFilesDeleted} attach=${attachmentsDeleted} ` +
        `bytes ${usedBytesBefore} -> ${usedBytesAfter}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        mediaFilesDeleted,
        attachmentsDeleted,
        usedBytesBefore,
        usedBytesAfter,
        newUsedBytes: usedBytesAfter,
        newFileCount: usageAfter?.file_count ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[storage-manual-cleanup] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
