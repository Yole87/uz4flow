import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-client.ts";



serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    // ── Auth: require valid JWT to prevent anonymous quota abuse ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { text, context, organization_id } = await req.json();

    // ── Rate limiting: 10 req/min per authenticated user (no longer per IP) ──
    const svcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const windowStart = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: rlCount } = await svcClient
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", `user:${userId}`)
      .eq("endpoint", "ai-text-suggest")
      .gte("window_start", windowStart);

    if ((rlCount || 0) >= 10) {
      return new Response(JSON.stringify({ suggestions: [], error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await svcClient.from("rate_limits").insert({
      identifier: `user:${userId}`,
      endpoint: "ai-text-suggest",
      window_start: new Date().toISOString(),
    });

    if (!text || typeof text !== "string" || text.trim().length < 3) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente de autocompletar texto para um CRM de WhatsApp.
O usuário está digitando uma mensagem para um cliente.
Sugira 3 continuações naturais e completas para o texto parcial fornecido.
Cada sugestão deve ser uma frase com sentido próprio, entre 10 e 20 palavras.
As sugestões devem soar como mensagens reais que um atendente enviaria.
Mantenha o tom profissional e cordial.
Responda em português brasileiro.`;

    const userPrompt = context
      ? `Contexto da conversa: ${context}\n\nTexto parcial: "${text}"`
      : `Texto parcial: "${text}"`;

    const aiResult = await callAI({
      organizationId: organization_id,
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_completions",
            description: "Return 3 text completion suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "suggest_completions" } },
    });

    if (!aiResult.ok) {
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ suggestions: [], error: "rate_limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResult.status === 402) {
        return new Response(JSON.stringify({ suggestions: [], error: "payment_required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", aiResult.status);
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolCall = aiResult.data?.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({ suggestions: args.suggestions || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        // fallback
      }
    }

    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-text-suggest error:", e);
    return new Response(JSON.stringify({ suggestions: [], error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
