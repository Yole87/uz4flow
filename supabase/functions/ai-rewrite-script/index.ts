import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-client.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    // ── Auth: require valid JWT to prevent quota abuse ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, reason, organization_id } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Texto muito curto para reescrever" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um especialista em copywriting, neurovendas e gatilhos mentais para scripts de ligações telefônicas comerciais.

Sua tarefa: receber um texto de script de ligação e reescrevê-lo aplicando técnicas profissionais para torná-lo mais persuasivo, direto e comercial.

Técnicas que você DEVE aplicar:
- **Gatilhos de escassez e urgência**: Criar senso de oportunidade limitada
- **Prova social**: Mencionar que outros clientes já aproveitaram/utilizaram
- **Reciprocidade**: Oferecer algo de valor antes de pedir ação
- **Linguagem direta e comercial**: Frases curtas, assertivas, sem rodeios
- **Tom conversacional**: Como se estivesse falando naturalmente ao telefone
- **Conexão emocional**: Usar o nome do contato ({{NOME}}) de forma natural

Regras obrigatórias:
- Mantenha as variáveis {{NOME}} e {{TELEFONE}} exatamente como estão
- NÃO adicione frases de encerramento ou despedida (a IA encerra automaticamente)
- Mantenha o texto conciso (máximo 30% maior que o original)
- Use português brasileiro natural e fluido
- Retorne APENAS o texto reescrito, sem explicações ou comentários`;

    const userPrompt = reason
      ? `Motivo da ligação: ${reason}\n\nTexto original:\n${text}`
      : `Texto original:\n${text}`;

    const aiResult = await callAI({
      organizationId: organization_id,
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    if (!aiResult.ok) {
      console.error("[ai-rewrite-script] AI error:", aiResult.error);
      throw new Error("Erro na API de IA");
    }

    const rewrittenText = aiResult.data?.choices?.[0]?.message?.content?.trim();

    if (!rewrittenText) {
      throw new Error("Resposta vazia da IA");
    }

    return new Response(
      JSON.stringify({ rewritten_text: rewrittenText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ai-rewrite-script] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
