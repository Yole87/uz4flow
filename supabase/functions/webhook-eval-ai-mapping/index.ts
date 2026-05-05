import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI, getOrgIdFromUser } from "../_shared/ai-client.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Auth check
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

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Get org_id from user
    const orgId = await getOrgIdFromUser(user.id);

    const body = await req.json();
    const { target_payload_example, variables, system_variables } = body;

    if (!target_payload_example || typeof target_payload_example !== "string") {
      return new Response(
        JSON.stringify({ error: "target_payload_example is required (string)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the list of available source variables
    const sourceVars = [
      ...(system_variables || [
        { name: "resumo", description: "Resumo da conversa gerado pela IA" },
        { name: "sentimento", description: "Sentimento: positivo/negativo/neutro" },
        { name: "contactName", description: "Nome do contato" },
        { name: "contactPhone", description: "Telefone do contato" },
        { name: "conversationId", description: "ID da conversa" },
      ]),
      ...(variables || []),
    ];

    const sourceList = sourceVars
      .map((v: any) => `- ${v.name}: ${v.description}`)
      .join("\n");

    const systemPrompt = `Você é um especialista em integração de sistemas via webhook/API.

Sua tarefa: dado um payload JSON de exemplo que um sistema de destino espera receber, mapear as variáveis de origem (do sistema OpenFlow) para os campos do sistema destino.

VARIÁVEIS DE ORIGEM DISPONÍVEIS:
${sourceList}

REGRAS:
1. Analise o payload de destino campo a campo
2. Para cada campo do destino, identifique qual variável de origem melhor se encaixa
3. Se não houver correspondência clara, sugira "não_mapeado"
4. Gere o payload final com placeholders {{variavel}} no lugar dos valores
5. Seja preciso no mapeamento — não invente variáveis que não existem na lista de origem`;

    const userPrompt = `Payload de exemplo do sistema de destino:

\`\`\`json
${target_payload_example}
\`\`\`

Mapeie os campos e gere o payload convertido.`;

    const aiResult = await callAI({
      organizationId: orgId || undefined,
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_mapping",
            description: "Gera o mapeamento DE/PARA e o payload convertido",
            parameters: {
              type: "object",
              properties: {
                mappings: {
                  type: "array",
                  description: "Lista de mapeamentos campo-a-campo",
                  items: {
                    type: "object",
                    properties: {
                      target_field: {
                        type: "string",
                        description: "Caminho do campo no payload de destino (ex: 'lead.name')",
                      },
                      source_variable: {
                        type: "string",
                        description: "Nome da variável de origem do OpenFlow (ex: 'contactName') ou 'não_mapeado'",
                      },
                      confidence: {
                        type: "string",
                        enum: ["alta", "media", "baixa"],
                        description: "Nível de confiança no mapeamento",
                      },
                      reason: {
                        type: "string",
                        description: "Motivo breve do mapeamento",
                      },
                    },
                    required: ["target_field", "source_variable", "confidence", "reason"],
                    additionalProperties: false,
                  },
                },
                converted_payload: {
                  type: "string",
                  description: "Payload JSON convertido com {{placeholders}} prontos para uso",
                },
                observations: {
                  type: "string",
                  description: "Observações gerais sobre o mapeamento para o usuário",
                },
              },
              required: ["mappings", "converted_payload", "observations"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_mapping" } },
    });

    if (!aiResult.ok) {
      console.error("[ai-mapping] AI error:", aiResult.status, aiResult.error);

      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResult.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolCall = aiResult.data?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      // Fallback: try content
      const content = aiResult.data?.choices?.[0]?.message?.content || "";
      return new Response(
        JSON.stringify({
          mappings: [],
          converted_payload: "",
          observations: content.substring(0, 500) || "Não foi possível gerar o mapeamento.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[ai-mapping] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
