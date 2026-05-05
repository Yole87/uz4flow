import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

type ProviderKind = "openbot" | "meta_official";

interface WhatsAppConfig {
  whatsapp_phones: string[];
  whatsapp_distribution: "linear" | "random";
  whatsapp_counter: number;
  preferred_instance_id?: string | null;
}

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

/**
 * Pick the next phone based on distribution mode
 */
function pickPhone(config: WhatsAppConfig): { phone: string; nextCounter: number } {
  const phones = config.whatsapp_phones.filter(Boolean);
  if (phones.length === 0) throw new Error("Nenhum telefone configurado");

  if (config.whatsapp_distribution === "random") {
    const idx = Math.floor(Math.random() * phones.length);
    return { phone: phones[idx], nextCounter: config.whatsapp_counter };
  }

  // Linear: round-robin
  const idx = config.whatsapp_counter % phones.length;
  return { phone: phones[idx], nextCounter: config.whatsapp_counter + 1 };
}

/**
 * Build a human-readable message from AI evaluation data
 */
export function buildWhatsAppMessage(
  extractedData: Record<string, any>,
  contactName: string,
  contactPhone: string
): string {
  const summary = extractedData.resumo || "Sem resumo disponível";

  // Build variables list excluding resumo/sentimento (they're shown separately)
  const skipKeys = new Set(["resumo", "sentimento"]);
  const variables = Object.entries(extractedData)
    .filter(([k]) => !skipKeys.has(k))
    .map(([key, value]) => `• *${key}:* ${String(value ?? "—")}`)
    .join("\n");

  let message = `📊 *AVALIAÇÃO AUTOMÁTICA - IA*\n\n`;
  message += `👤 *Contato:* ${contactName || "Não identificado"}\n`;
  message += `📱 *Telefone:* ${contactPhone || "—"}\n\n`;
  message += `📝 *RESUMO*\n${summary}\n`;

  if (extractedData.sentimento) {
    const sentimentEmoji =
      extractedData.sentimento === "positivo" ? "🟢" :
      extractedData.sentimento === "negativo" ? "🔴" : "🟡";
    message += `\n${sentimentEmoji} *Sentimento:* ${extractedData.sentimento}\n`;
  }

  if (variables) {
    message += `\n📋 *DADOS EXTRAÍDOS*\n${variables}\n`;
  }

  return message;
}

async function safeDecrypt(value: string | null | undefined): Promise<string | null> {
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
    .select("id, name, openbot_instance_id, openbot_api_key_encrypted, provider, api_key_encrypted, meta_phone_number_id")
    .eq("organization_id", orgId);

  const instanceList = (instances || []) as InstanceChannelRow[];

  console.log(`[eval-whatsapp] resolveChannel: org=${orgId}, preferredInstanceId=${preferredInstanceId}, instances=${instanceList.map(i => `${i.name}(${i.id},provider=${i.provider})`).join(", ")}`);

  // When preferred instance is set, use ONLY that instance — no fallback
  if (preferredInstanceId) {
    const preferredInstance = instanceList.find((inst) => inst.id === preferredInstanceId);

    if (!preferredInstance) {
      throw new Error(`Instância preferida ${preferredInstanceId} não encontrada`);
    }

    console.log(`[eval-whatsapp] Using preferred instance: ${preferredInstance.name} (provider=${preferredInstance.provider}, openbot_id=${preferredInstance.openbot_instance_id})`);

    // For non-meta instances (baileys/evolution_api), ONLY use OpenBot path
    if (preferredInstance.provider !== "meta_official") {
      const openbotApiKey = await safeDecrypt(preferredInstance.openbot_api_key_encrypted);
      if (!openbotApiKey) {
        throw new Error(`Instância ${preferredInstance.name} não possui chave OpenBot válida`);
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

    // For meta_official, try Meta first, fallback to OpenBot
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

    const openbotApiKey = await safeDecrypt(preferredInstance.openbot_api_key_encrypted);
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

    throw new Error(`Instância ${preferredInstance.name} não possui credenciais válidas de WhatsApp`);
  }

  // No preferred instance — iterate all
  for (const inst of instanceList) {
    if (inst.provider === "meta_official") {
      const metaToken = await safeDecrypt(inst.api_key_encrypted);
      if (metaToken && inst.meta_phone_number_id) {
        console.log(`[eval-whatsapp] Resolved to meta_official: ${inst.name} (${inst.id})`);
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
      console.log(`[eval-whatsapp] Resolved to openbot: ${inst.name} (${inst.id}, openbot_id=${inst.openbot_instance_id})`);
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

  // Fallback to org-level config
  const { data: orgConfig } = await supabase
    .from("crm_openbot_config")
    .select("openbot_api_key_encrypted")
    .eq("organization_id", orgId)
    .maybeSingle();

  const fallbackApiKey = await safeDecrypt(orgConfig?.openbot_api_key_encrypted);
  if (!fallbackApiKey) {
    throw new Error("Nenhuma credencial válida encontrada para envio WhatsApp");
  }

  const fallbackInstance = instanceList[0] || null;
  console.log(`[eval-whatsapp] Resolved to org-level fallback openbot (instance=${fallbackInstance?.id || "none"})`);

  return {
    provider: "openbot",
    crmInstanceId: fallbackInstance?.id || null,
    openbotInstanceId: fallbackInstance?.openbot_instance_id || null,
    apiKey: fallbackApiKey,
    metaToken: null,
    metaPhoneNumberId: null,
  };
}

/**
 * Send evaluation results via WhatsApp using the org's OpenBot/Meta credentials
 */
export async function sendEvalWhatsApp(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  configId: string,
  whatsappConfig: WhatsAppConfig,
  message: string
): Promise<SendResult> {
  const { phone, nextCounter } = pickPhone(whatsappConfig);

  // Update counter for linear distribution
  if (whatsappConfig.whatsapp_distribution === "linear") {
    await supabase
      .from("conversation_evaluation_configs")
      .update({ whatsapp_counter: nextCounter })
      .eq("id", configId);
  }

  const channel = await resolveWhatsAppChannel(supabase, orgId, whatsappConfig.preferred_instance_id || null);

  console.log(`[eval-whatsapp] Channel resolved: provider=${channel.provider}, crmInstanceId=${channel.crmInstanceId}, openbotInstanceId=${channel.openbotInstanceId}`);

  // Send via Meta Official API
  if (channel.provider === "meta_official" && channel.metaToken && channel.metaPhoneNumberId) {
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
        }
      );

      const metaData = await metaResp.json().catch(() => ({}));
      console.log(`[eval-whatsapp] Meta response: status=${metaResp.status}, body=${JSON.stringify(metaData).substring(0, 300)}`);

      if (!metaResp.ok) {
        return {
          phone,
          status: "failed",
          provider: "meta_official",
          crm_instance_id: channel.crmInstanceId,
          error: (metaData as any)?.error?.message || `Meta API ${metaResp.status}`,
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

  // Send via OpenBot
  if (!channel.apiKey) {
    return {
      phone,
      status: "failed",
      provider: "openbot",
      crm_instance_id: channel.crmInstanceId,
      error: "Nenhuma credencial válida encontrada para envio WhatsApp",
    };
  }

  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const payload: any = {
      apiKey: channel.apiKey,
      phone: cleanPhone,
      message: message,
      desativarFluxo: true,
    };
    if (channel.openbotInstanceId) payload.instanceId = channel.openbotInstanceId;

    console.log(`[eval-whatsapp] Sending to OpenBot: phone=${cleanPhone}, instanceId=${channel.openbotInstanceId}, messageLen=${message.length}`);

    const resp = await fetch(OPENBOT_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawResponse = await resp.text().catch(() => "");
    const parsedResponse = rawResponse ? parseJsonSafe(rawResponse) : null;

    console.log(`[eval-whatsapp] OpenBot response: status=${resp.status}, body=${rawResponse.substring(0, 500)}`);

    if (!resp.ok) {
      return {
        phone,
        status: "failed",
        provider: "openbot",
        crm_instance_id: channel.crmInstanceId,
        error: `OpenBot ${resp.status}: ${rawResponse.substring(0, 200)}`,
        response: parsedResponse || rawResponse.substring(0, 500),
      };
    }

    return {
      phone,
      status: "sent",
      provider: "openbot",
      crm_instance_id: channel.crmInstanceId,
      external_message_id: (parsedResponse as any)?.messageId || (parsedResponse as any)?.id || null,
      response: parsedResponse || rawResponse.substring(0, 500),
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
