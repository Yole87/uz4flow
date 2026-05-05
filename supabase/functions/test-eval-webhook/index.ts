import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { webhook_url, method, headers: customHeaders, body } = await req.json();

    if (!webhook_url || typeof webhook_url !== "string") {
      return new Response(JSON.stringify({ error: "webhook_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proxy the request to the external webhook
    const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (customHeaders && typeof customHeaders === "object") {
      Object.assign(fetchHeaders, customHeaders);
    }

    const response = await fetch(webhook_url, {
      method: method || "POST",
      headers: fetchHeaders,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

    const responseText = await response.text();

    return new Response(
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        body: responseText.substring(0, 2000),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[test-eval-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
