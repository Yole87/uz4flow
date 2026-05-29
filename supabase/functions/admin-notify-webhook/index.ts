import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhook receiver for Uz4FLOW WhatsApp delivery callbacks (status, read receipts)
// Stub: logs callbacks to admin_notification_logs payload for inspection
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json().catch(() => ({}));

    // Best-effort: store callback as a synthetic log entry
    await supabase.from("admin_notification_logs").insert({
      event_type: "delivery_callback",
      recipient_phone: String(payload?.number || payload?.to || "callback"),
      recipient_name: "Uz4FLOW callback",
      rendered_body: null,
      status: "callback",
      payload,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-notify-webhook error", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, // always 200 to avoid provider retries
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
