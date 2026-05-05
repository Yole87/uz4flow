import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-client.ts";
import { getErrorMessage } from "../_shared/getErrorMessage.ts";
import { buildWhatsAppMessage, sendEvalWhatsApp } from "./whatsapp-sender.ts";

const MAX_CONVERSATIONS_PER_ORG_PER_RUN = 10;
const MAX_TOTAL_CONVERSATIONS_PER_RUN = 200;
const MAX_MESSAGES = 50;
const MAX_CUSTOMER_MESSAGE_AGE_HOURS = 24;

interface EvalVariable {
  name: string;
  description: string;
  type: string;
}

interface EvalExtractedData {
  resumo?: string;
  sentimento?: "positivo" | "negativo" | "neutro" | string;
  [key: string]: unknown;
}

interface EvalWebhookResponse {
  webhook?: { status?: number; statusText?: string; body?: string; error?: string };
  whatsapp?: { status?: string; phone?: string; provider?: string | null; response?: unknown; error?: string } | unknown;
  whatsapp_mirror?: unknown;
}

type JsonSchemaProp = { type: string; description?: string; enum?: string[]; [key: string]: unknown };

interface EvalConfig {
  id: string;
  organization_id: string;
  instance_id: string | null;
  is_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
  silence_minutes: number;
  variables: EvalVariable[] | null;
  custom_prompt: string | null;
  webhook_url: string | null;
  webhook_method: string | null;
  webhook_headers: Record<string, string> | null;
  webhook_payload_template: string | null;
  whatsapp_enabled: boolean;
  whatsapp_phones: string[];
  whatsapp_distribution: string;
  whatsapp_counter: number;
  eval_frequency: string;
}

function generateMessagePreview(contentType: string, content: string): string {
  switch (contentType) {
    case "audio":
      return "🎵 Áudio";
    case "image":
      return "📷 Imagem";
    case "video":
      return "🎥 Vídeo";
    case "document": {
      const match = content.match(/^\[arquivo:\s*(.+)\]$/i);
      return match ? `📄 ${match[1]}` : "📄 Documento";
    }
    case "voice_call":
      return content.substring(0, 100);
    default:
      return content.substring(0, 100) || `[${contentType}]`;
  }
}

function buildCrmMirrorMessage(params: {
  contactName: string | null;
  contactPhone: string | null;
  deliveryPhone: string;
  summary: string;
}): string {
  return [
    "📤 *NOTIFICAÇÃO INTERNA ENVIADA*",
    "",
    `👤 *Contato analisado:* ${params.contactName || "Não identificado"}`,
    `📱 *Telefone do contato:* ${params.contactPhone || "—"}`,
    `📲 *Destino da notificação:* ${params.deliveryPhone}`,
    "",
    "📝 *Resumo enviado ao gestor*",
    params.summary || "Avaliação automática enviada via WhatsApp.",
  ].join("\n");
}

async function mirrorOutboundMessageToCrm(
  supabase: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    contactId: string | null;
    phone: string;
    contactName: string | null;
    instanceId: string | null;
    message: string;
    openbotMessageId?: string | null;
    metadata?: Record<string, unknown>;
    updateConversationTimeline?: boolean;
  },
) {
  const phoneClean = params.phone.replace(/\D/g, "");
  let contactId = params.contactId;

  if (!contactId) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", params.organizationId)
      .eq("phone", phoneClean)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: createdContact, error: contactError } = await supabase
        .from("contacts")
        .upsert(
          {
            organization_id: params.organizationId,
            instance_id: params.instanceId,
            phone: phoneClean,
            name: params.contactName || null,
            last_interaction_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,phone" },
        )
        .select("id")
        .single();

      if (contactError) throw contactError;
      contactId = createdContact.id;
    }
  } else if (params.updateConversationTimeline !== false) {
    await supabase
      .from("contacts")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", contactId);
  }

  if (!contactId) {
    throw new Error("Não foi possível resolver o contato para espelhar no CRM");
  }

  let conversationId: string;
  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("instance_id", params.instanceId)
    .maybeSingle();

  if (existingConversation) {
    conversationId = existingConversation.id;
  } else {
    const { data: createdConversation, error: conversationError } =
      await supabase
        .from("conversations")
        .upsert(
          {
            contact_id: contactId,
            instance_id: params.instanceId,
            status: "active",
            last_message_at: new Date().toISOString(),
            last_message_preview: generateMessagePreview(
              "text",
              params.message,
            ),
            last_sender_type: "ia",
            unread_count: 0,
          },
          { onConflict: "contact_id,instance_id" },
        )
        .select("id")
        .single();

    if (conversationError) throw conversationError;
    conversationId = createdConversation.id;
  }

  const messageTimestamp = new Date().toISOString();

  const { data: newMessage, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      organization_id: params.organizationId,
      content: params.message,
      content_type: "text",
      direction: "outbound",
      sender_type: "ia",
      sender_name: "Avaliação Automática IA",
      status: "sent",
      timestamp: messageTimestamp,
      openbot_message_id: params.openbotMessageId || null,
      metadata: {
        source: "conversation_evaluation",
        ...(params.metadata || {}),
      },
    })
    .select("id")
    .single();

  if (messageError) throw messageError;

  if (params.updateConversationTimeline !== false) {
    await supabase
      .from("conversations")
      .update({
        last_message_at: messageTimestamp,
        last_message_preview: generateMessagePreview("text", params.message),
        last_sender_type: "ia",
        unread_count: 0,
      })
      .eq("id", conversationId);
  }

  await supabase.from("crm_webhook_events").insert({
    organization_id: params.organizationId,
    event_type: "outbound",
    status: "success",
    instance_id: params.instanceId,
    phone: phoneClean,
    payload: {
      source: "conversation_evaluation",
      conversationId,
      messagePreview: params.message.substring(0, 80),
    },
    response: {
      messageId: newMessage.id,
      openbotMessageId: params.openbotMessageId || null,
    },
  });

  return { conversationId, contactId, messageId: newMessage.id };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate cron secret to prevent unauthorized invocation
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRoleCall = authHeader === `Bearer ${supabaseServiceKey}`;

  if (!isServiceRoleCall && (!cronSecret || providedSecret !== cronSecret)) {
    console.warn("[eval-cron] Unauthorized invocation blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get all enabled configs (including instance-specific ones)
    const { data: configs, error: configError } = await supabase
      .from("conversation_evaluation_configs")
      .select("*")
      .eq("is_enabled", true);

    if (configError) {
      console.error("[eval-cron] Error fetching configs:", configError);
      return new Response(JSON.stringify({ error: configError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active configs", processed: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Group configs: instance-specific configs take priority over global ones
    const configsByOrg = new Map<
      string,
      { global: EvalConfig | null; byInstance: Map<string, EvalConfig> }
    >();

    for (const cfg of configs) {
      const orgId = cfg.organization_id;
      if (!configsByOrg.has(orgId)) {
        configsByOrg.set(orgId, { global: null, byInstance: new Map() });
      }
      const entry = configsByOrg.get(orgId)!;
      if (cfg.instance_id) {
        entry.byInstance.set(cfg.instance_id, cfg as EvalConfig);
      } else {
        entry.global = cfg as EvalConfig;
      }
    }

    let totalProcessed = 0;

    for (const [orgId, orgConfigs] of configsByOrg) {
      if (totalProcessed >= MAX_TOTAL_CONVERSATIONS_PER_RUN) break;

      let orgProcessed = 0;

      // Collect all configs for this org (instance-specific + global fallback)
      const allConfigs: EvalConfig[] = [
        ...Array.from(orgConfigs.byInstance.values()),
        ...(orgConfigs.global ? [orgConfigs.global] : []),
      ];

      for (const config of allConfigs) {
        if (orgProcessed >= MAX_CONVERSATIONS_PER_ORG_PER_RUN) break;
        if (totalProcessed >= MAX_TOTAL_CONVERSATIONS_PER_RUN) break;

        const evalFrequency = config.eval_frequency || "silence_only";
        const silenceMinutes = Math.max(1, config.silence_minutes || 60);
        const silenceThreshold = new Date(
          Date.now() - silenceMinutes * 60 * 1000,
        ).toISOString();
        const ageCutoff = new Date(
          Date.now() - MAX_CUSTOMER_MESSAGE_AGE_HOURS * 60 * 60 * 1000,
        ).toISOString();

        // Build conversation query — pre-filter by age window + ordering for fairness
        const remainingForOrg = MAX_CONVERSATIONS_PER_ORG_PER_RUN - orgProcessed;
        let convQuery = supabase
          .from("conversations")
          .select(`
            id,
            contact_id,
            last_message_at,
            instance_id,
            contacts!inner (
              id,
              name,
              phone,
              organization_id
            )
          `)
          .eq("contacts.organization_id", orgId)
          .not("last_message_at", "is", null)
          .gte("last_message_at", ageCutoff)
          .order("last_message_at", { ascending: false })
          .limit(remainingForOrg * 3); // overfetch since some will be filtered

        // For silence-based modes, also enforce silence threshold at query level
        if (
          evalFrequency === "silence_only" ||
          evalFrequency === "once_per_conversation"
        ) {
          convQuery = convQuery.lte("last_message_at", silenceThreshold);
        }

        // If config is instance-specific, filter by instance
        if (config.instance_id) {
          convQuery = convQuery.eq("instance_id", config.instance_id);
        }

        const { data: conversations, error: convError } = await convQuery;

        if (convError) {
          console.error(
            `[eval-cron] Error fetching conversations for org ${orgId}:`,
            convError,
          );
          continue;
        }

        if (!conversations || conversations.length === 0) continue;

        for (const conv of conversations) {
          if (orgProcessed >= MAX_CONVERSATIONS_PER_ORG_PER_RUN) break;
          if (totalProcessed >= MAX_TOTAL_CONVERSATIONS_PER_RUN) break;

          // For global config, skip conversations that have instance-specific configs
          if (
            !config.instance_id && conv.instance_id &&
            orgConfigs.byInstance.has(conv.instance_id)
          ) {
            console.log(`[eval-cron] route conv=${conv.id} skip=global reason=has_instance_config instance=${conv.instance_id}`);
            continue;
          }
          console.log(`[eval-cron] route conv=${conv.id} config=${config.instance_id ? 'instance:' + config.instance_id : 'global'} freq=${evalFrequency}`);

          // ── ANTI-LOOP: find last CUSTOMER (inbound) message timestamp ──
          // This prevents the loop where mirrored IA messages update last_message_at
          // and cause infinite re-evaluation.
          const { data: lastCustomerMsg } = await supabase
            .from("messages")
            .select("timestamp")
            .eq("conversation_id", conv.id)
            .eq("direction", "inbound")
            .eq("sender_type", "customer")
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!lastCustomerMsg) continue; // no customer messages, skip

          const customerLastTs = lastCustomerMsg.timestamp;
          const customerLastTsMs = new Date(customerLastTs).getTime();

          // Emergency guard: never evaluate stale conversations from historical backlog
          if (
            Date.now() - customerLastTsMs >
              MAX_CUSTOMER_MESSAGE_AGE_HOURS * 60 * 60 * 1000
          ) continue;

          // ── Frequency mode logic ──
          // silence_only: requires silence threshold + only one eval per "silence cycle" (snapshot match)
          // once_per_conversation: only ever evaluate once per conversation
          // once_per_day: at most one evaluation per 24h per conversation
          // every_inbound: every new customer message triggers an evaluation (no silence required)
          if (evalFrequency === "silence_only") {
            if (customerLastTs > silenceThreshold) {
              console.log(`[eval-cron] skip conv=${conv.id} reason=customer_still_active`);
              continue;
            }
            // Compare against snapshot (timestamp of customer message that was evaluated),
            // NOT evaluated_at — fixes infinite re-eval loop.
            const { data: existing } = await supabase
              .from("conversation_evaluations")
              .select("id")
              .eq("conversation_id", conv.id)
              .eq("last_message_at_snapshot", customerLastTs)
              .limit(1)
              .maybeSingle();
            if (existing) {
              console.log(`[eval-cron] skip conv=${conv.id} reason=snapshot_already_evaluated`);
              continue;
            }
          } else if (evalFrequency === "once_per_conversation") {
            const { data: anyExisting } = await supabase
              .from("conversation_evaluations")
              .select("id")
              .eq("conversation_id", conv.id)
              .limit(1)
              .maybeSingle();
            if (anyExisting) {
              console.log(`[eval-cron] skip conv=${conv.id} reason=once_per_conversation_already_done`);
              continue;
            }
            if (customerLastTs > silenceThreshold) {
              console.log(`[eval-cron] skip conv=${conv.id} reason=customer_still_active_once`);
              continue;
            }
          } else if (evalFrequency === "once_per_day") {
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: recentExisting } = await supabase
              .from("conversation_evaluations")
              .select("id")
              .eq("conversation_id", conv.id)
              .gte("evaluated_at", dayAgo)
              .limit(1)
              .maybeSingle();
            if (recentExisting) {
              console.log(`[eval-cron] skip conv=${conv.id} reason=day_quota_used`);
              continue;
            }
          } else if (evalFrequency === "every_inbound") {
            const { data: existing } = await supabase
              .from("conversation_evaluations")
              .select("id")
              .eq("conversation_id", conv.id)
              .eq("last_message_at_snapshot", customerLastTs)
              .limit(1)
              .maybeSingle();
            if (existing) {
              console.log(`[eval-cron] skip conv=${conv.id} reason=inbound_already_evaluated`);
              continue;
            }
          }

          // Fetch messages — EXCLUDE self-generated evaluation messages to prevent
          // the AI from analyzing its own previous summaries
          const { data: messages } = await supabase
            .from("messages")
            .select("content, direction, timestamp, content_type, metadata")
            .eq("conversation_id", conv.id)
            .order("timestamp", { ascending: true })
            .limit(MAX_MESSAGES);

          if (!messages || messages.length === 0) continue;

          // Filter out self-generated evaluation messages
          const filteredMessages = messages.filter((m) => {
            const meta = m.metadata as Record<string, unknown> | null;
            return !(meta && meta.source === "conversation_evaluation");
          });

          if (filteredMessages.length === 0) continue;

          const contact = Array.isArray(conv.contacts)
            ? conv.contacts[0]
            : conv.contacts;

          // Build AI prompt
          const variables: EvalVariable[] = (config.variables as EvalVariable[] | null) || [];
          const conversationText = filteredMessages
            .map((m) =>
              `${m.direction === "inbound" ? "Cliente" : "Atendente"}: ${
                m.content || `[${m.content_type || "mídia"}]`
              }`
            )
            .join("\n");

          const variablesList = variables
            .map((v) => `- "${v.name}": ${v.description} (tipo: ${v.type})`)
            .join("\n");

          const toolProperties: Record<string, JsonSchemaProp> = {
            resumo: {
              type: "string",
              description: "Resumo de 2-3 frases sobre a conversa",
            },
            sentimento: {
              type: "string",
              enum: ["positivo", "negativo", "neutro"],
              description: "Sentimento geral da conversa",
            },
          };
          const requiredFields = ["resumo", "sentimento"];

          for (const v of variables) {
            toolProperties[v.name] = {
              type: "string",
              description:
                `${v.description}. Se não encontrado, retorne "não contemplado"`,
            };
            requiredFields.push(v.name);
          }

          const systemPrompt =
            `Você é um analista de CRM especializado em conversas de WhatsApp.
Analise a conversa abaixo e extraia as informações solicitadas.

Regras:
- Se uma informação não estiver disponível na conversa, retorne "não contemplado" para aquele campo.
- Seja conciso e direto.
- Baseie-se apenas no conteúdo da conversa.
${
              config.custom_prompt
                ? `\nInstruções adicionais do usuário:\n${config.custom_prompt}`
                : ""
            }`;

          const userPrompt = `Conversa com ${
            contact?.name || contact?.phone || "contato desconhecido"
          }:

${conversationText}

Variáveis para extrair:
${variablesList || "(nenhuma variável configurada)"}`;

          try {
            const configMaxTokens = (config as any).max_tokens as number | null;
            const aiResult = await callAI({
              organizationId: orgId,
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              ...(configMaxTokens ? { max_tokens: configMaxTokens } : { max_tokens: 8192 }),
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_conversation_data",
                    description:
                      "Extraia os dados estruturados da conversa analisada",
                    parameters: {
                      type: "object",
                      properties: toolProperties,
                      required: requiredFields,
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "extract_conversation_data" },
              },
            });

            if (!aiResult.ok) {
              console.error(
                `[eval-cron] AI error for conv ${conv.id}: ${aiResult.status} ${aiResult.error}`,
              );

              const isTransient = aiResult.status === 429 ||
                (aiResult.status >= 500 && aiResult.status < 600);

              if (isTransient) {
                // Do NOT poison snapshot — let next cron retry
                console.log(`[eval-cron] skip conv=${conv.id} reason=ai_transient_error status=${aiResult.status}`);
                continue;
              }

              // Permanent error (4xx other than 429): record so we don't loop
              await supabase.from("conversation_evaluations").insert({
                conversation_id: conv.id,
                organization_id: orgId,
                contact_id: contact?.id || null,
                extracted_data: {},
                ai_summary: `Erro na análise: ${aiResult.status}`,
                webhook_status: "skipped",
                last_message_at_snapshot: customerLastTs,
              });
              orgProcessed++;
              totalProcessed++;
              continue;
            }

            let extractedData: EvalExtractedData = {};
            const toolCall = aiResult.data?.choices?.[0]?.message?.tool_calls
              ?.[0];
            if (toolCall?.function?.arguments) {
              try {
                extractedData = JSON.parse(toolCall.function.arguments) as EvalExtractedData;
              } catch {
                console.error(
                  `[eval-cron] Failed to parse tool call for conv ${conv.id}`,
                );
              }
            }

            if (Object.keys(extractedData).length === 0) {
              const content = aiResult.data?.choices?.[0]?.message?.content;
              if (content) {
                try {
                  extractedData = JSON.parse(
                    content.replace(/```json\n?|\n?```/g, "").trim(),
                  ) as EvalExtractedData;
                } catch {
                  extractedData = {
                    resumo: content.substring(0, 500),
                    sentimento: "neutro",
                  };
                }
              }
            }

            const summary = (extractedData.resumo as string | undefined) || "Análise concluída";

            const hasWebhook = !!config.webhook_url;
            const hasWhatsApp = config.whatsapp_enabled &&
              (config.whatsapp_phones || []).filter(Boolean).length > 0;

            const { error: insertError } = await supabase.from(
              "conversation_evaluations",
            ).insert({
              conversation_id: conv.id,
              organization_id: orgId,
              contact_id: contact?.id || null,
              extracted_data: extractedData,
              ai_summary: summary,
              webhook_status: hasWebhook
                ? "pending"
                : (hasWhatsApp ? "pending" : "skipped"),
              last_message_at_snapshot: customerLastTs,
            });

            if (insertError) {
              if ((insertError as { code?: string }).code === "23505") {
                console.log(`[eval-cron] skip conv=${conv.id} reason=duplicate_race_caught`);
                continue;
              }
              console.error(
                `[eval-cron] Insert error for conv ${conv.id}:`,
                insertError,
              );
              orgProcessed++;
              totalProcessed++;
              continue;
            }
            console.log(`[eval-cron] insert conv=${conv.id} freq=${evalFrequency} snapshot=${customerLastTs}`);

            // Update last_evaluated_at on conversation (for once_per_day mode tracking)
            await supabase
              .from("conversations")
              .update({ last_evaluated_at: new Date().toISOString() })
              .eq("id", conv.id);

            // Send webhook if configured
            let finalWebhookStatus = hasWebhook || hasWhatsApp
              ? "sent"
              : "skipped";
            const finalWebhookResponse: EvalWebhookResponse = {};

            if (hasWebhook) {
              try {
                let payload = config.webhook_payload_template ||
                  JSON.stringify(extractedData);

                for (const [key, value] of Object.entries(extractedData)) {
                  payload = payload.split(`{{${key}}}`).join(String(value));
                }
                payload = payload.split("{{contactName}}").join(
                  contact?.name || "",
                );
                payload = payload.split("{{contactPhone}}").join(
                  contact?.phone || "",
                );
                payload = payload.split("{{conversationId}}").join(conv.id);

                const webhookHeaders: Record<string, string> =
                  (config.webhook_headers as Record<string, string> | null) ? { ...config.webhook_headers as Record<string, string> } : {};
                if (!webhookHeaders["Content-Type"]) {
                  webhookHeaders["Content-Type"] = "application/json";
                }

                console.log(
                  `[eval-cron] Webhook request: method=${
                    config.webhook_method || "POST"
                  }, url=${config.webhook_url}, headers=${
                    JSON.stringify(Object.keys(webhookHeaders))
                  }, payloadLen=${payload.length}`,
                );

                const whResponse = await fetch(config.webhook_url!, {
                  method: config.webhook_method || "POST",
                  headers: webhookHeaders,
                  body: payload,
                });

                const webhookBody = await whResponse.text();
                console.log(
                  `[eval-cron] Webhook response: status=${whResponse.status}, body=${
                    webhookBody.substring(0, 500)
                  }`,
                );

                finalWebhookResponse.webhook = {
                  status: whResponse.status,
                  statusText: whResponse.statusText,
                  body: webhookBody.substring(0, 1000),
                };

                if (!whResponse.ok) {
                  finalWebhookStatus = "failed";
                }
              } catch (whErr) {
                finalWebhookStatus = "failed";
                finalWebhookResponse.webhook = { error: getErrorMessage(whErr) };
              }
            }

            // Send via WhatsApp if configured
            if (hasWhatsApp) {
              try {
                const waMessage = buildWhatsAppMessage(
                  extractedData,
                  contact?.name || "",
                  contact?.phone || "",
                );

                const waResult = await sendEvalWhatsApp(
                  supabase,
                  orgId,
                  config.id,
                  {
                    whatsapp_phones: config.whatsapp_phones || [],
                    whatsapp_distribution:
                      (config.whatsapp_distribution as "linear" | "random") ||
                      "linear",
                    whatsapp_counter: config.whatsapp_counter || 0,
                    preferred_instance_id: config.instance_id ||
                      conv.instance_id || null,
                  },
                  waMessage,
                );

                finalWebhookResponse.whatsapp = waResult;
                if (waResult.status === "sent") {
                  try {
                    const crmMirrorMessage = buildCrmMirrorMessage({
                      contactName: contact?.name || null,
                      contactPhone: contact?.phone || null,
                      deliveryPhone: waResult.phone,
                      summary,
                    });

                    // Mirror goes to the ADMIN phone's conversation, not the original contact
                    const mirrorResult = await mirrorOutboundMessageToCrm(
                      supabase,
                      {
                        organizationId: orgId,
                        contactId: null, // Force lookup by admin phone, NOT original contact
                        phone: waResult.phone,
                        contactName: `Gestor (${waResult.phone})`,
                        instanceId: config.instance_id || conv.instance_id ||
                          waResult.crm_instance_id || null,
                        message: crmMirrorMessage,
                        openbotMessageId: waResult.external_message_id || null,
                        metadata: {
                          evaluation_config_id: config.id,
                          evaluation_conversation_id: conv.id,
                          original_contact_name: contact?.name || null,
                          original_contact_phone: contact?.phone || null,
                          delivery_provider: waResult.provider || null,
                          delivery_response: waResult.response || null,
                          delivery_target_phone: waResult.phone,
                          delivery_message_preview: waMessage.substring(0, 200),
                          hidden_from_inbox: true,
                          source: "conversation_evaluation",
                        },
                        updateConversationTimeline: true, // Update timeline so it appears in CRM list
                      },
                    );
                    finalWebhookResponse.whatsapp_mirror = mirrorResult;
                  } catch (mirrorErr) {
                    console.error(`[eval-cron] CRM mirror error:`, mirrorErr);
                    finalWebhookResponse.whatsapp_mirror = {
                      error: getErrorMessage(mirrorErr),
                    };
                    finalWebhookStatus =
                      hasWebhook && finalWebhookStatus === "sent"
                        ? "partial"
                        : "failed";
                  }
                }
                if (waResult.status === "failed") {
                  finalWebhookStatus =
                    hasWebhook && finalWebhookStatus === "sent"
                      ? "partial"
                      : "failed";
                }
                console.log(
                  `[eval-cron] WhatsApp sent to ${waResult.phone}: ${waResult.status}`,
                );
              } catch (waErr) {
                console.error(`[eval-cron] WhatsApp error:`, waErr);
                finalWebhookResponse.whatsapp = { error: getErrorMessage(waErr) };
                finalWebhookStatus = hasWebhook && finalWebhookStatus === "sent"
                  ? "partial"
                  : "failed";
              }
            }

            if (hasWebhook || hasWhatsApp) {
              await supabase
                .from("conversation_evaluations")
                .update({
                  webhook_status: finalWebhookStatus,
                  webhook_response: finalWebhookResponse,
                })
                .eq("conversation_id", conv.id)
                .eq("last_message_at_snapshot", customerLastTs);
            }

            orgProcessed++;
            totalProcessed++;
            console.log(
              `[eval-cron] Processed conv ${conv.id} for org ${orgId} (instance: ${
                config.instance_id || "global"
              })`,
            );
          } catch (aiErr) {
            console.error(
              `[eval-cron] Error processing conv ${conv.id}:`,
              aiErr,
            );
            orgProcessed++;
            totalProcessed++;
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[eval-cron] Done. Processed ${totalProcessed} conversations in ${duration}ms`,
    );

    return new Response(
      JSON.stringify({ processed: totalProcessed, duration_ms: duration }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[eval-cron] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
