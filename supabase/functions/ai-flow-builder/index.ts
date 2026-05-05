import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI, getOrgIdFromUser, type AIMessage } from "../_shared/ai-client.ts";

const SYSTEM_PROMPT = `Você é um assistente especialista em construção de fluxos de automação para WhatsApp.
O sistema permite criar fluxos visuais com nós conectados. Cada nó é uma etapa (step) do fluxo.

## TIPOS DE NÓS DISPONÍVEIS

### 1. text
Envia uma mensagem de texto. Pode coletar resposta do usuário.
- text_content: string (obrigatório) — mensagem a enviar
- requires_response: boolean — se true, aguarda resposta do contato
- variable_name: string | null — nome da variável para armazenar a resposta (ex: "nome", "email")
- validation_type: "any" | "text" | "number" | "email" | "phone" — validação da resposta
- invalid_response_message: string | null — mensagem quando resposta é inválida
- accept_file_response: boolean — aceitar arquivo como resposta

### 2. menu
Menu interativo com opções numeradas. O contato responde com o número da opção.
- menu_config: { message: string, options: Array<{ label: string, value: string }>, error_message: string }
  - message: mensagem principal do menu
  - options: lista de opções (label é o texto exibido, value é o valor armazenado)
  - error_message: mensagem quando opção é inválida
- variable_name: string | null — variável que armazena a escolha

### 3. condition
Desvio condicional baseado em variável. Tem 2 saídas: "true" e "false".
- condition_config: { variable: string, operator: string, value: string }
  - variable: nome da variável a comparar (ex: "nome", "email", "opcao")
  - operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with" | "greater_than" | "less_than" | "is_empty" | "is_not_empty"
  - value: valor para comparação

### 4. delay
Pausa a execução por um tempo.
- delay_config: { delay_seconds: number } (máximo 120 segundos)

### 5. tag
Adiciona ou remove tags do contato.
- tag_config: { action: "add" | "remove", tags: string[] }

### 6. lane
Move o contato para uma etapa do pipeline/Kanban.
- lane_config: { stage_id: "placeholder", stage_name: string }
  - Nota: use stage_id "placeholder" — o usuário configurará manualmente a etapa correta

### 7. end
Encerra o fluxo. Pode enviar mensagem final.
- end_config: { final_message: string | null }

### 8. block
Envia múltiplos conteúdos em sequência (texto, imagem, etc).
- block_contents: Array<{ type: "text" | "image" | "audio" | "video" | "document", content: string }>

### 9. random
Divisão aleatória do fluxo em ramificações por percentual.
- random_config: { splits: Array<{ percentage: number, label: string }> }
  - O total dos percentuais DEVE somar 100

### 10. active_message
Envio proativo de mensagem (fora do fluxo normal).
- active_message_config: { instance_id: "placeholder", phone: "", message: string }
  - Nota: instance_id e phone devem ser configurados pelo usuário

## REGRAS DE CONSTRUÇÃO

1. Todo fluxo DEVE começar com um nó de texto (saudação inicial)
2. Fluxos interativos devem ter is_interactive: true e session_timeout_minutes adequado
3. Posicione os nós no canvas com espaçamento adequado:
   - Eixo Y: incremente ~150px entre nós sequenciais
   - Eixo X: 250px para nó principal. Use 100px e 400px para branches (condition/menu)
4. Connections ligam nós via source_step_index e target_step_index (baseados no order_index)
5. Para condition nodes: source_handle "true" ou "false"
6. Para menu nodes: source_handle "option-0", "option-1", etc.
7. Para random nodes: source_handle "split-0", "split-1", etc.
8. source_handle "default" para conexões normais

## LIMITAÇÕES DO SISTEMA

O sistema de fluxos opera EXCLUSIVAMENTE via WhatsApp e possui APENAS os 10 tipos de nós listados acima. Ele NÃO pode:

- Enviar e-mails, SMS ou notificações push
- Processar pagamentos, cobranças ou PIX diretamente
- Consultar APIs externas, bancos de dados ou sistemas de terceiros em tempo real
- Enviar mensagens para Instagram, Telegram, Facebook Messenger ou outras plataformas
- Executar código customizado, scripts ou funções programáticas
- Fazer upload ou download de arquivos dinamicamente
- Acessar informações externas ao fluxo (ex: consultar estoque, verificar CPF, buscar CEP)
- Integrar com ERPs, CRMs externos ou sistemas de gestão
- Agendar reuniões diretamente (pode coletar dados e usar webhook externo)
- Fazer reconhecimento de imagem ou processamento de áudio inteligente
- Enviar mensagens com botões clicáveis nativos do WhatsApp (apenas menus numerados de texto)
- Realizar operações de banco de dados além de tags e movimentação de pipeline

## REGRAS DE VALIDAÇÃO (OBRIGATÓRIAS)

Antes de gerar qualquer fluxo, você DEVE:

1. **Analisar o pedido completo** — identifique TODAS as funcionalidades que o usuário está pedindo
2. **Mapear cada funcionalidade** — verifique se cada uma pode ser implementada com os 10 tipos de nós disponíveis
3. **Se TUDO for viável** — explique brevemente o plano e gere o fluxo com generate_flow
4. **Se algo NÃO for viável** — NÃO gere o fluxo silenciosamente sem avisar. Em vez disso:
   a. Explique de forma amigável e clara o que o sistema não consegue fazer e por quê
   b. Liste o que PODE ser feito com os recursos disponíveis
   c. Sugira a alternativa mais próxima possível (ex: "não consigo consultar estoque, mas posso coletar o pedido e enviar via webhook para seu sistema processar")
   d. Pergunte se o usuário quer que você gere o fluxo com as partes viáveis
5. **Se o pedido for PARCIALMENTE viável** — explique quais partes podem ser feitas, quais não podem, e ofereça gerar a parte possível
6. **Se o usuário perguntar "o que você pode fazer?"** — liste as capacidades com exemplos práticos:
   - Atendimento automatizado com menus e coleta de dados
   - Qualificação de leads com perguntas e condições
   - Roteamento por palavra-chave ou opção selecionada
   - Tagueamento automático de contatos
   - Movimentação automática no pipeline/Kanban
   - Envio de mensagens programadas com delays
   - Fluxos com ramificação condicional (if/else)
   - Testes A/B com divisão aleatória
   - Envio de blocos de conteúdo (texto, imagem, áudio, vídeo, documento)
   - Mensagens ativas proativas

## RESPOSTA

Quando o usuário pedir um fluxo, PRIMEIRO analise se é viável com os recursos disponíveis.
Se for viável, explique brevemente o que será criado, depois chame a ferramenta generate_flow com o JSON completo.
Se NÃO for viável (total ou parcialmente), explique as limitações e sugira alternativas ANTES de gerar qualquer coisa.
Após gerar, dê instruções claras sobre o que o usuário precisa configurar manualmente (ex: instância WhatsApp, IDs de pipeline, etc).

SEMPRE responda em português brasileiro.`;

const GENERATE_FLOW_TOOL = {
  type: "function",
  function: {
    name: "generate_flow",
    description: "Gera um fluxo completo com steps e connections no formato FlowExportData",
    parameters: {
      type: "object",
      properties: {
        flow: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome do fluxo" },
            description: { type: "string", description: "Descrição do fluxo" },
            is_interactive: { type: "boolean", description: "Se o fluxo aguarda respostas do contato" },
            session_timeout_minutes: { type: "number", description: "Timeout da sessão em minutos (padrão 30)" },
            timeout_action: { type: "string", description: "Ação ao timeout: end ou restart" },
            timeout_message: { type: "string", description: "Mensagem enviada ao timeout" },
          },
          required: ["name", "description", "is_interactive", "session_timeout_minutes", "timeout_action"],
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              order_index: { type: "number" },
              step_type: { type: "string", enum: ["text", "menu", "condition", "delay", "tag", "lane", "end", "block", "random", "active_message"] },
              text_content: { type: "string" },
              delay_ms: { type: "number" },
              requires_response: { type: "boolean" },
              variable_name: { type: "string" },
              validation_type: { type: "string", enum: ["any", "text", "number", "email", "phone"] },
              invalid_response_message: { type: "string" },
              step_timeout_minutes: { type: "number" },
              accept_file_response: { type: "boolean" },
              position_x: { type: "number" },
              position_y: { type: "number" },
              condition_config: {
                type: "object",
                properties: {
                  variable: { type: "string" },
                  operator: { type: "string" },
                  value: { type: "string" },
                },
              },
              menu_config: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        value: { type: "string" },
                      },
                      required: ["label", "value"],
                    },
                  },
                  error_message: { type: "string" },
                },
                required: ["message", "options", "error_message"],
              },
              delay_config: {
                type: "object",
                properties: {
                  delay_seconds: { type: "number" },
                },
              },
              tag_config: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["add", "remove"] },
                  tags: { type: "array", items: { type: "string" } },
                },
              },
              lane_config: {
                type: "object",
                properties: {
                  stage_id: { type: "string" },
                  stage_name: { type: "string" },
                },
              },
              end_config: {
                type: "object",
                properties: {
                  final_message: { type: "string" },
                },
              },
              block_contents: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    content: { type: "string" },
                  },
                },
              },
              random_config: {
                type: "object",
                properties: {
                  splits: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        percentage: { type: "number" },
                        label: { type: "string" },
                      },
                      required: ["percentage", "label"],
                    },
                  },
                },
              },
              active_message_config: {
                type: "object",
                properties: {
                  instance_id: { type: "string" },
                  phone: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
            required: ["order_index", "step_type"],
          },
        },
        connections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source_step_index: { type: "number" },
              target_step_index: { type: "number" },
              source_handle: { type: "string" },
              label: { type: "string" },
            },
            required: ["source_step_index", "target_step_index", "source_handle"],
          },
        },
      },
      required: ["flow", "steps", "connections"],
    },
  },
};

serve(async (req) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org for AI config
    const orgId = await getOrgIdFromUser(userId);

    // Build AI messages
    const aiMessages: AIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Call AI with tool-calling
    const result = await callAI({
      organizationId: orgId || undefined,
      model: "google/gemini-2.5-flash",
      messages: aiMessages,
      tools: [GENERATE_FLOW_TOOL],
      temperature: 0.7,
      max_tokens: 8000,
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error || "Erro na IA" }), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const choice = result.data?.choices?.[0];
    const message = choice?.message;

    // Extract tool call if present
    let generatedFlow = null;
    if (message?.tool_calls?.length > 0) {
      const toolCall = message.tool_calls.find((tc: any) => tc.function?.name === "generate_flow");
      if (toolCall) {
        try {
          generatedFlow = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error("[ai-flow-builder] Failed to parse tool call:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        text: message?.content || "",
        flow: generatedFlow
          ? {
              version: 1,
              flow: generatedFlow.flow,
              steps: (generatedFlow.steps || []).map((s: any) => ({
                order_index: s.order_index ?? 0,
                step_type: s.step_type || "text",
                text_content: s.text_content || null,
                delay_ms: s.delay_ms || 0,
                requires_response: s.requires_response || false,
                variable_name: s.variable_name || null,
                validation_type: s.validation_type || "any",
                invalid_response_message: s.invalid_response_message || null,
                step_timeout_minutes: s.step_timeout_minutes || null,
                accept_file_response: s.accept_file_response || false,
                position_x: s.position_x ?? 250,
                position_y: s.position_y ?? s.order_index * 150,
                condition_config: s.condition_config || null,
                menu_config: s.menu_config || null,
                delay_config: s.delay_config || null,
                tag_config: s.tag_config || null,
                lane_config: s.lane_config || null,
                end_config: s.end_config || null,
                block_contents: s.block_contents || null,
                random_config: s.random_config || null,
                active_message_config: s.active_message_config || null,
              })),
              connections: generatedFlow.connections || [],
            }
          : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[ai-flow-builder] Error:", e);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
