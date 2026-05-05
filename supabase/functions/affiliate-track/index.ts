// Edge Function: affiliate-track
// Public, registers a click on an affiliate link and returns the resolved code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "").trim().toUpperCase();
    if (!code || code.length < 4 || code.length > 32) {
      return new Response(
        JSON.stringify({ error: "Código inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup affiliate (accept any status — we only skip insertion for completely unknown codes)
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id, status")
      .eq("code", code)
      .maybeSingle();

    if (!affiliate) {
      // Silently accept but don't store (avoid leaking validity)
      return new Response(
        JSON.stringify({ ok: true, valid: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const ipHash = await sha256(ip);
    const ua = req.headers.get("user-agent") || null;
    const country = req.headers.get("cf-ipcountry") || null;

    await supabase.from("affiliate_clicks").insert({
      code,
      affiliate_id: affiliate.id,
      ip_hash: ipHash,
      user_agent: ua,
      referer: body?.referer || null,
      landing_page: body?.landing_page || null,
      country,
      utm_source: body?.utm_source || null,
      utm_medium: body?.utm_medium || null,
      utm_campaign: body?.utm_campaign || null,
    });

    return new Response(
      JSON.stringify({ ok: true, valid: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("affiliate-track error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
