import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { webhook_url, http_method, headers, payload_template, sample_data } = await req.json();

    if (!webhook_url) {
      return new Response(JSON.stringify({ error: "webhook_url é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replace variables in template
    let processedPayload = payload_template || "{}";
    if (sample_data && typeof sample_data === "object") {
      for (const [key, value] of Object.entries(sample_data)) {
        processedPayload = processedPayload.replaceAll(`{{${key}}}`, String(value));
      }
    }

    // Validate JSON
    try {
      JSON.parse(processedPayload);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Payload template não é um JSON válido após substituição de variáveis" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const method = (http_method || "POST").toUpperCase();
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers || {}),
    };

    console.log(`[test-flow-webhook] Sending ${method} to ${webhook_url}`);

    const response = await fetch(webhook_url, {
      method,
      headers: fetchHeaders,
      body: processedPayload,
    });

    const responseText = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        response: responseBody,
        sent_payload: JSON.parse(processedPayload),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[test-flow-webhook] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
