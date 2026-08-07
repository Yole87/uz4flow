import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  console.log("[process-scheduled-messages] tick", new Date().toISOString());

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

    // Mandatory authentication: valid cron secret header OR service-role bearer.
    const incomingSecret = req.headers.get("x-cron-secret") || "";
    const authHeader = req.headers.get("authorization") || "";
    const isServiceRoleCall = !!SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`;
    const hasValidCronSecret =
      !!CRON_SECRET &&
      incomingSecret.length === CRON_SECRET.length &&
      incomingSecret
        .split("")
        .reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ CRON_SECRET.charCodeAt(i)), 0) === 0;

    if (!isServiceRoleCall && !hasValidCronSecret) {
      console.warn("[process-scheduled-messages] Unauthorized invocation blocked");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);


    // Fetch pending messages due now (limit 50/run)
    const { data: pending, error: queryErr } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (queryErr) {
      console.error("[process-scheduled-messages] query error:", queryErr);
      return new Response(JSON.stringify({ error: "db query failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, ms: Date.now() - startedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-scheduled-messages] processing ${pending.length} messages`);

    let sent = 0;
    let failed = 0;

    for (const msg of pending) {
      try {
        // Mark as in-flight immediately to avoid double-send (set sent_at provisionally null)
        const { error: lockErr } = await supabase
          .from("scheduled_messages")
          .update({ status: "sending" } as any)
          .eq("id", msg.id)
          .eq("status", "pending");
        // 'sending' is not in the allowed enum (validate trigger restricts), so skip lock
        // Instead rely on idempotency via single cron + small batches.
        if (lockErr) {
          // Expected: validation rejects non-allowed status. Continue without explicit lock.
        }

        // If media_url present, fetch and convert to base64 Data URL for crm-send-message
        let arquivoDataUrl: string | undefined;
        if (msg.media_url) {
          try {
            const mediaResp = await fetch(msg.media_url);
            if (mediaResp.ok) {
              const buf = new Uint8Array(await mediaResp.arrayBuffer());
              let bin = "";
              for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
              const b64 = btoa(bin);
              arquivoDataUrl = `data:${msg.mime_type || "application/octet-stream"};base64,${b64}`;
            } else {
              throw new Error(`media fetch ${mediaResp.status}`);
            }
          } catch (mediaErr) {
            console.warn("[process-scheduled-messages] media fetch failed, sending text only:", mediaErr);
          }
        }

        const sendBody = {
          conversation_id: msg.conversation_id,
          message: msg.content || "",
          ...(arquivoDataUrl
            ? {
                arquivo: arquivoDataUrl,
                content_type: msg.media_type || "document",
                file_name: msg.file_name || undefined,
              }
            : {}),
        };

        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/crm-send-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": CRON_SECRET,
            "x-acting-user-id": msg.created_by,
          },
          body: JSON.stringify(sendBody),
        });

        const sendResult = await sendResp.json().catch(() => ({}));
        const success = sendResp.ok && (sendResult?.success !== false);

        if (success) {
          await supabase
            .from("scheduled_messages")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", msg.id);
          sent++;
          console.log("[process-scheduled-messages] sent:", msg.id);
        } else {
          const errMsg =
            sendResult?.error ||
            sendResult?.message ||
            `crm-send-message returned ${sendResp.status}`;
          await supabase
            .from("scheduled_messages")
            .update({
              status: "failed",
              error_message: String(errMsg).substring(0, 500),
            })
            .eq("id", msg.id);
          failed++;
          console.warn("[process-scheduled-messages] failed:", msg.id, errMsg);
        }
      } catch (err) {
        console.error("[process-scheduled-messages] error processing", msg.id, err);
        await supabase
          .from("scheduled_messages")
          .update({
            status: "failed",
            error_message: String((err as Error)?.message || err).substring(0, 500),
          })
          .eq("id", msg.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        processed: pending.length,
        sent,
        failed,
        ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[process-scheduled-messages] fatal:", err);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
