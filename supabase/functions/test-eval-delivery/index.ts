import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { decrypt } from "../_shared/encryption.ts";

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

type ProviderKind = "openbot" | "meta_official";

interface SendResult {
  phone: string;
  status: "sent" | "failed";
  error?: string;
  provider?: ProviderKind;
  crm_instance_id?: string | null;
  external_message_id?: string | null;
  response?: unknown;
}

interface ResolvedChannel {
  provider: ProviderKind;
  crmInstanceId: string | null;
  openbotInstanceId: string | null;
  apiKey: string | null;
  metaToken: string | null;
  metaPhoneNumberId: string | null;
}

interface InstanceChannelRow {
  id: string;
  name: string | null;
  openbot_instance_id: string | null;
  openbot_api_key_encrypted: string | null;
  provider: string | null;
  api_key_encrypted: string | null;
  meta_phone_number_id: string | null;
}

async function safeDecrypt(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value || value.length < 20) return null;
  try {
    return await decrypt(value);
  } catch {
    return null;
  }
}

function parseJsonSafe(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function resolveWhatsAppChannel(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  preferredInstanceId?: string | null,
): Promise<ResolvedChannel> {
  const { data: instances } = await supabase
    .from("instances")
    .select(
      "id, name, openbot_instance_id, openbot_api_key_encrypted, provider, api_key_encrypted, meta_phone_number_id",
    )
    .eq("organization_id", orgId);

  const instanceList = (instances || []) as InstanceChannelRow[];

  console.log(
    `[test-eval] resolveChannel: org=${orgId}, preferredInstanceId=${preferredInstanceId}, instances=${
      instanceList.map((i) => `${i.name}(${i.id},provider=${i.provider})`).join(
        ", ",
      )
    }`,
  );

  if (preferredInstanceId) {
    const preferredInstance = instanceList.find((inst) =>
      inst.id === preferredInstanceId
    );
    if (!preferredInstance) {
      throw new Error(
        `Instância preferida ${preferredInstanceId} não encontrada`,
      );
    }

    console.log(
      `[test-eval] Using preferred instance: ${preferredInstance.name} (provider=${preferredInstance.provider}, openbot_id=${preferredInstance.openbot_instance_id})`,
    );

    if (preferredInstance.provider !== "meta_official") {
      const openbotApiKey = await safeDecrypt(
        preferredInstance.openbot_api_key_encrypted,
      );
      if (!openbotApiKey) {
        throw new Error(
          `Instância ${preferredInstance.name} não possui chave OpenBot válida`,
        );
      }
      return {
        provider: "openbot",
        crmInstanceId: preferredInstance.id,
        openbotInstanceId: preferredInstance.openbot_instance_id,
        apiKey: openbotApiKey,
        metaToken: null,
        metaPhoneNumberId: null,
      };
    }

    const metaToken = await safeDecrypt(preferredInstance.api_key_encrypted);
    if (metaToken && preferredInstance.meta_phone_number_id) {
      return {
        provider: "meta_official",
        crmInstanceId: preferredInstance.id,
        openbotInstanceId: preferredInstance.openbot_instance_id,
        apiKey: null,
        metaToken,
        metaPhoneNumberId: preferredInstance.meta_phone_number_id,
      };
    }

    const openbotApiKey = await safeDecrypt(
      preferredInstance.openbot_api_key_encrypted,
    );
    if (openbotApiKey) {
      return {
        provider: "openbot",
        crmInstanceId: preferredInstance.id,
        openbotInstanceId: preferredInstance.openbot_instance_id,
        apiKey: openbotApiKey,
        metaToken: null,
        metaPhoneNumberId: null,
      };
    }

    throw new Error(
      `Instância ${preferredInstance.name} não possui credenciais válidas`,
    );
  }

  for (const inst of instanceList) {
    if (inst.provider === "meta_official") {
      const metaToken = await safeDecrypt(inst.api_key_encrypted);
      if (metaToken && inst.meta_phone_number_id) {
        return {
          provider: "meta_official",
          crmInstanceId: inst.id,
          openbotInstanceId: inst.openbot_instance_id,
          apiKey: null,
          metaToken,
          metaPhoneNumberId: inst.meta_phone_number_id,
        };
      }
    }
    const openbotApiKey = await safeDecrypt(inst.openbot_api_key_encrypted);
    if (openbotApiKey) {
      return {
        provider: "openbot",
        crmInstanceId: inst.id,
        openbotInstanceId: inst.openbot_instance_id,
        apiKey: openbotApiKey,
        metaToken: null,
        metaPhoneNumberId: null,
      };
    }
  }

  const { data: orgConfig } = await supabase.from("crm_openbot_config").select(
    "openbot_api_key_encrypted",
  ).eq("organization_id", orgId).maybeSingle();
  const fallbackApiKey = await safeDecrypt(
    orgConfig?.openbot_api_key_encrypted,
  );
  if (!fallbackApiKey) {
    throw new Error("Nenhuma credencial válida encontrada para envio WhatsApp");
  }
  const fb = instanceList[0] || null;
  return {
    provider: "openbot",
    crmInstanceId: fb?.id || null,
    openbotInstanceId: fb?.openbot_instance_id || null,
    apiKey: fallbackApiKey,
    metaToken: null,
    metaPhoneNumberId: null,
  };
}

async function sendEvalWhatsApp(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  configId: string,
  whatsappConfig: {
    whatsapp_phones: string[];
    whatsapp_distribution: "linear" | "random";
    whatsapp_counter: number;
    preferred_instance_id?: string | null;
  },
  message: string,
): Promise<SendResult> {
  const phones = whatsappConfig.whatsapp_phones.filter(Boolean);
  if (phones.length === 0) throw new Error("Nenhum telefone configurado");

  const idx = whatsappConfig.whatsapp_distribution === "random"
    ? Math.floor(Math.random() * phones.length)
    : whatsappConfig.whatsapp_counter % phones.length;
  const phone = phones[idx];

  if (whatsappConfig.whatsapp_distribution === "linear") {
    await supabase.from("conversation_evaluation_configs").update({
      whatsapp_counter: whatsappConfig.whatsapp_counter + 1,
    }).eq("id", configId);
  }

  const channel = await resolveWhatsAppChannel(
    supabase,
    orgId,
    whatsappConfig.preferred_instance_id || null,
  );

  console.log(
    `[test-eval] Channel resolved: provider=${channel.provider}, crmInstanceId=${channel.crmInstanceId}, openbotInstanceId=${channel.openbotInstanceId}`,
  );

  if (
    channel.provider === "meta_official" && channel.metaToken &&
    channel.metaPhoneNumberId
  ) {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const metaResp = await fetch(
        `https://graph.facebook.com/v21.0/${channel.metaPhoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${channel.metaToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: message },
          }),
        },
      );
      const metaData = await metaResp.json().catch(() => ({}));
      console.log(
        `[test-eval] Meta response: status=${metaResp.status}, body=${
          JSON.stringify(metaData).substring(0, 300)
        }`,
      );
      if (!metaResp.ok) {
        return {
          phone,
          status: "failed",
          provider: "meta_official",
          crm_instance_id: channel.crmInstanceId,
          error: (metaData as any)?.error?.message ||
            `Meta API ${metaResp.status}`,
          response: metaData,
        };
      }
      return {
        phone,
        status: "sent",
        provider: "meta_official",
        crm_instance_id: channel.crmInstanceId,
        external_message_id: (metaData as any)?.messages?.[0]?.id || null,
        response: metaData,
      };
    } catch (err: any) {
      return {
        phone,
        status: "failed",
        provider: "meta_official",
        crm_instance_id: channel.crmInstanceId,
        error: err.message,
      };
    }
  }

  if (!channel.apiKey) {
    return {
      phone,
      status: "failed",
      provider: "openbot",
      crm_instance_id: channel.crmInstanceId,
      error: "Sem credencial válida",
    };
  }

  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const payload: any = {
      apiKey: channel.apiKey,
      phone: cleanPhone,
      message,
      desativarFluxo: true,
    };
    if (channel.openbotInstanceId) {
      payload.instanceId = channel.openbotInstanceId;
    }
    console.log(
      `[test-eval] Sending to OpenBot: phone=${cleanPhone}, instanceId=${channel.openbotInstanceId}`,
    );
    const resp = await fetch(OPENBOT_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const rawResponse = await resp.text().catch(() => "");
    const parsed = rawResponse ? parseJsonSafe(rawResponse) : null;
    console.log(
      `[test-eval] OpenBot response: status=${resp.status}, body=${
        rawResponse.substring(0, 500)
      }`,
    );
    if (!resp.ok) {
      return {
        phone,
        status: "failed",
        provider: "openbot",
        crm_instance_id: channel.crmInstanceId,
        error: `OpenBot ${resp.status}: ${rawResponse.substring(0, 200)}`,
        response: parsed || rawResponse.substring(0, 500),
      };
    }
    return {
      phone,
      status: "sent",
      provider: "openbot",
      crm_instance_id: channel.crmInstanceId,
      external_message_id: (parsed as any)?.messageId || (parsed as any)?.id ||
        null,
      response: parsed || rawResponse.substring(0, 500),
    };
  } catch (err: any) {
    return {
      phone,
      status: "failed",
      provider: "openbot",
      crm_instance_id: channel.crmInstanceId,
      error: err.message,
    };
  }
}

interface TestPayload {
  organization_id: string;
  config_id: string;
  whatsapp_phone: string;
  c2s_payload: {
    data: {
      attributes: {
        name: string;
        email: string;
        phone: string;
        channel_id: number;
        lead_source_id: number;
        message: string;
      };
    };
  };
}

function buildMirrorMessage(payload: TestPayload["c2s_payload"]): string {
  const attrs = payload.data.attributes;
  return [
    "📊 *AVALIAÇÃO AUTOMÁTICA - IA*",
    "",
    "🔁 *Reflexo do envio para o C2S*",
    `👤 *Nome:* ${attrs.name}`,
    `📧 *Email:* ${attrs.email}`,
    `📱 *Telefone:* ${attrs.phone}`,
    `🏷️ *Canal:* ${attrs.channel_id}`,
    `📍 *Origem:* ${attrs.lead_source_id}`,
    "",
    "📝 *Mensagem enviada ao C2S*",
    attrs.message,
  ].join("\n");
}

function buildCrmMirrorMessage(
  payload: TestPayload["c2s_payload"],
  deliveryPhone: string,
): string {
  const attrs = payload.data.attributes;
  return [
    "📤 *NOTIFICAÇÃO INTERNA ENVIADA*",
    "",
    `👤 *Contato analisado:* ${attrs.name}`,
    `📱 *Telefone do contato:* ${attrs.phone}`,
    `📲 *Destino da notificação:* ${deliveryPhone}`,
    "",
    "📝 *Resumo enviado ao gestor*",
    attrs.message,
  ].join("\n");
}

function generateMessagePreview(content: string): string {
  return content.substring(0, 100) || "[text]";
}

async function mirrorOutboundMessageToCrm(
  supabase: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    phone: string;
    contactName: string;
    instanceId: string | null;
    message: string;
    openbotMessageId?: string | null;
    metadata?: Record<string, unknown>;
    updateConversationTimeline?: boolean;
  },
) {
  const phoneClean = params.phone.replace(/\D/g, "");

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("phone", phoneClean)
    .maybeSingle();

  let contactId = existingContact?.id || null;

  if (!contactId) {
    const { data: createdContact, error: contactError } = await supabase
      .from("contacts")
      .upsert(
        {
          organization_id: params.organizationId,
          instance_id: params.instanceId,
          phone: phoneClean,
          name: params.contactName,
          last_interaction_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,phone" },
      )
      .select("id")
      .single();

    if (contactError) throw contactError;
    contactId = createdContact.id;
  } else if (params.updateConversationTimeline !== false) {
    await supabase
      .from("contacts")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", contactId);
  }

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("instance_id", params.instanceId)
    .maybeSingle();

  let conversationId = existingConversation?.id || null;
  if (!conversationId) {
    const { data: createdConversation, error: conversationError } =
      await supabase
        .from("conversations")
        .upsert(
          {
            contact_id: contactId,
            instance_id: params.instanceId,
            status: "active",
            last_message_at: new Date().toISOString(),
            last_message_preview: generateMessagePreview(params.message),
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
  const { data: insertedMessage, error: messageError } = await supabase
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
        source: "test_eval_delivery",
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
        last_message_preview: generateMessagePreview(params.message),
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
      source: "test_eval_delivery",
      conversationId,
      messagePreview: params.message.substring(0, 80),
    },
    response: {
      messageId: insertedMessage.id,
      openbotMessageId: params.openbotMessageId || null,
    },
  });

  return { contactId, conversationId, messageId: insertedMessage.id };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as TestPayload;
    if (
      !body.organization_id || !body.config_id || !body.whatsapp_phone ||
      !body.c2s_payload?.data?.attributes
    ) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios ausentes" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: config, error: configError } = await supabase
      .from("conversation_evaluation_configs")
      .select(
        "id, organization_id, instance_id, webhook_url, webhook_method, webhook_headers",
      )
      .eq("id", body.config_id)
      .eq("organization_id", body.organization_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Configuração não encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const webhookHeaders =
      (config.webhook_headers as Record<string, string> | null) || {};
    if (!webhookHeaders["Content-Type"]) {
      webhookHeaders["Content-Type"] = "application/json";
    }

    const webhookPayload = JSON.stringify(body.c2s_payload);
    console.log(
      `[test-eval] Webhook request: url=${config.webhook_url}, method=${
        config.webhook_method || "POST"
      }, headers=${JSON.stringify(webhookHeaders)}, payload=${
        webhookPayload.substring(0, 500)
      }`,
    );

    const webhookResponse = await fetch(config.webhook_url!, {
      method: config.webhook_method || "POST",
      headers: webhookHeaders,
      body: webhookPayload,
    });
    const webhookText = await webhookResponse.text();
    console.log(
      `[test-eval] Webhook response: status=${webhookResponse.status}, body=${
        webhookText.substring(0, 500)
      }`,
    );

    const mirrorMessage = buildMirrorMessage(body.c2s_payload);
    const crmMirrorMessage = buildCrmMirrorMessage(
      body.c2s_payload,
      body.whatsapp_phone,
    );
    const whatsappResult = await sendEvalWhatsApp(
      supabase,
      body.organization_id,
      body.config_id,
      {
        whatsapp_phones: [body.whatsapp_phone],
        whatsapp_distribution: "linear",
        whatsapp_counter: 0,
        preferred_instance_id: config.instance_id || null,
      },
      mirrorMessage,
    );

    let crmMirror = null;
    if (whatsappResult.status === "sent") {
      crmMirror = await mirrorOutboundMessageToCrm(supabase, {
        organizationId: body.organization_id,
        phone: body.whatsapp_phone,
        contactName: `Gestor (${body.whatsapp_phone})`,
        instanceId: config.instance_id || whatsappResult.crm_instance_id ||
          null,
        message: crmMirrorMessage,
        openbotMessageId: whatsappResult.external_message_id || null,
        metadata: {
          c2s_payload: body.c2s_payload,
          original_contact_name: body.c2s_payload.data.attributes.name,
          original_contact_phone: body.c2s_payload.data.attributes.phone,
          delivery_provider: whatsappResult.provider || null,
          delivery_response: whatsappResult.response || null,
          delivery_target_phone: body.whatsapp_phone,
          delivery_message_preview: mirrorMessage.substring(0, 200),
        },
        updateConversationTimeline: true,
      });
    }

    return new Response(
      JSON.stringify({
        webhook: {
          status: webhookResponse.status,
          ok: webhookResponse.ok,
          body: webhookText.substring(0, 1000),
          headers_sent: Object.keys(webhookHeaders),
          payload_sent: webhookPayload.substring(0, 500),
        },
        whatsapp: whatsappResult,
        crm_mirror: crmMirror,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[test-eval-delivery] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
