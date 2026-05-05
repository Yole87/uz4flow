import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Automated storage cleanup routine (called via pg_cron every hour):
 * 1. Deletes media files older than 3 days from storage buckets
 * 2. Clears media_url from messages but preserves text history
 * 3. Deletes text-only messages older than 30 days
 * 4. Recalculates storage usage for affected organizations
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate cron secret to prevent unauthorized invocation
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRoleCall && (!cronSecret || providedSecret !== cronSecret)) {
    console.warn("[storage-cleanup] Unauthorized invocation blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  console.log("[storage-cleanup] Starting automated cleanup...");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Track affected organizations for recalculation
    const affectedOrgs = new Set<string>();

    // === 1. Clean media from messages older than 3 days ===
    // Find messages with media older than 3 days
    const { data: mediaMessages, error: mediaQueryError } = await supabase
      .from("messages")
      .select("id, media_url, organization_id")
      .not("media_url", "is", null)
      .lt("timestamp", threeDaysAgo)
      .limit(500);

    if (mediaQueryError) {
      console.error("[storage-cleanup] Error querying media messages:", mediaQueryError);
    } else if (mediaMessages && mediaMessages.length > 0) {
      console.log(`[storage-cleanup] Found ${mediaMessages.length} media messages to clean`);

      // Delete files from storage buckets
      for (const msg of mediaMessages) {
        if (msg.organization_id) affectedOrgs.add(msg.organization_id);

        if (msg.media_url) {
          // Extract storage path from URL
          const mediaPath = extractStoragePath(msg.media_url, "message-media");
          if (mediaPath) {
            const { error: delErr } = await supabase.storage
              .from("message-media")
              .remove([mediaPath]);
            if (delErr) console.warn("[storage-cleanup] Failed to delete media:", mediaPath, delErr);
          }
        }
      }

      // Clear media_url from these messages (preserve text)
      const messageIds = mediaMessages.map(m => m.id);
      const { error: updateErr } = await supabase
        .from("messages")
        .update({ media_url: null, media_mime_type: null })
        .in("id", messageIds);

      if (updateErr) {
        console.error("[storage-cleanup] Error clearing media_url:", updateErr);
      } else {
        console.log(`[storage-cleanup] Cleared media from ${messageIds.length} messages`);
      }
    }

    // === 2. Delete contact attachments older than 3 days ===
    const { data: oldAttachments, error: attachQueryError } = await supabase
      .from("contact_attachments")
      .select("id, storage_path, organization_id")
      .lt("created_at", threeDaysAgo)
      .limit(500);

    if (attachQueryError) {
      console.error("[storage-cleanup] Error querying attachments:", attachQueryError);
    } else if (oldAttachments && oldAttachments.length > 0) {
      console.log(`[storage-cleanup] Found ${oldAttachments.length} old attachments to clean`);

      for (const att of oldAttachments) {
        affectedOrgs.add(att.organization_id);
        const { error: delErr } = await supabase.storage
          .from("contact-attachments")
          .remove([att.storage_path]);
        if (delErr) console.warn("[storage-cleanup] Failed to delete attachment:", att.storage_path, delErr);
      }

      const attachIds = oldAttachments.map(a => a.id);
      const { error: delRecErr } = await supabase
        .from("contact_attachments")
        .delete()
        .in("id", attachIds);

      if (delRecErr) {
        console.error("[storage-cleanup] Error deleting attachment records:", delRecErr);
      } else {
        console.log(`[storage-cleanup] Deleted ${attachIds.length} attachment records`);
      }
    }

    // === 3. Delete text-only messages older than 30 days ===
    const { data: oldTextMessages, error: textQueryError } = await supabase
      .from("messages")
      .select("id, organization_id")
      .is("media_url", null)
      .lt("timestamp", thirtyDaysAgo)
      .limit(1000);

    if (textQueryError) {
      console.error("[storage-cleanup] Error querying old text messages:", textQueryError);
    } else if (oldTextMessages && oldTextMessages.length > 0) {
      console.log(`[storage-cleanup] Found ${oldTextMessages.length} old text messages to delete`);

      for (const msg of oldTextMessages) {
        if (msg.organization_id) affectedOrgs.add(msg.organization_id);
      }

      const textIds = oldTextMessages.map(m => m.id);
      const { error: delTextErr } = await supabase
        .from("messages")
        .delete()
        .in("id", textIds);

      if (delTextErr) {
        console.error("[storage-cleanup] Error deleting old text messages:", delTextErr);
      } else {
        console.log(`[storage-cleanup] Deleted ${textIds.length} old text messages`);
      }
    }

    // === 4. Recalculate storage for affected organizations ===
    for (const orgId of affectedOrgs) {
      try {
        await supabase.rpc("recalculate_org_storage", { p_org_id: orgId });
        console.log(`[storage-cleanup] Recalculated storage for org: ${orgId.substring(0, 8)}...`);
      } catch (recalcErr) {
        console.warn("[storage-cleanup] Failed to recalculate for org:", orgId, recalcErr);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[storage-cleanup] Cleanup completed in ${elapsed}ms. Affected orgs: ${affectedOrgs.size}`);

    return new Response(
      JSON.stringify({
        success: true,
        mediaMessagesCleaned: mediaMessages?.length || 0,
        attachmentsCleaned: oldAttachments?.length || 0,
        textMessagesDeleted: oldTextMessages?.length || 0,
        affectedOrganizations: affectedOrgs.size,
        processingTimeMs: elapsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[storage-cleanup] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Extracts storage path from a Supabase public URL
 */
function extractStoragePath(url: string, bucketName: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.substring(idx + marker.length));
    }
    return null;
  } catch {
    return null;
  }
}
