import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface CampaignContact {
  id: string;
  contact_id: string | null;
  phone: string | null;
  name: string | null;
  status: string;
}

interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  call_type: string;
  script_content: string | null;
  assistant_config: Record<string, unknown> | null;
  call_reason: string | null;
  whatsapp_followup_enabled: boolean;
  whatsapp_followup_text: string | null;
  whatsapp_followup_file_url: string | null;
  flow_id: string | null;
  webhook_enabled: boolean;
  webhook_url: string | null;
  call_mode: string;
  calling_mode: string;
  batch_size: number;
}

const MESES_PT: Record<number, string> = {
  1: "janeiro", 2: "fevereiro", 3: "março", 4: "abril",
  5: "maio", 6: "junho", 7: "julho", 8: "agosto",
  9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
};

const UNITS_PT = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
  "dezoito", "dezenove", "vinte", "vinte e um", "vinte e dois", "vinte e três",
  "vinte e quatro", "vinte e cinco", "vinte e seis", "vinte e sete", "vinte e oito",
  "vinte e nove", "trinta", "trinta e um",
];

function numberToPortuguese(n: number): string {
  if (n >= 0 && n <= 31) return UNITS_PT[n];
  return String(n);
}

function yearToPortuguese(y: number): string {
  if (y < 0) return String(y);
  const thousands = Math.floor(y / 1000);
  const remainder = y % 1000;
  const hundreds = Math.floor(remainder / 100);
  const tens = remainder % 100;

  const thousandWords: Record<number, string> = { 1: "mil", 2: "dois mil", 3: "três mil" };
  const hundredWords: Record<number, string> = {
    1: "cento", 2: "duzentos", 3: "trezentos", 4: "quatrocentos",
    5: "quinhentos", 6: "seiscentos", 7: "setecentos", 8: "oitocentos", 9: "novecentos",
  };
  const tensWords: Record<number, string> = {
    2: "vinte", 3: "trinta", 4: "quarenta", 5: "cinquenta",
    6: "sessenta", 7: "setenta", 8: "oitenta", 9: "noventa",
  };
  const teensWords: Record<number, string> = {
    10: "dez", 11: "onze", 12: "doze", 13: "treze", 14: "quatorze",
    15: "quinze", 16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove",
  };
  const onesWords: Record<number, string> = {
    1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
    6: "seis", 7: "sete", 8: "oito", 9: "nove",
  };

  const parts: string[] = [];
  if (thousands > 0) parts.push(thousandWords[thousands] || `${thousands} mil`);
  if (hundreds > 0) {
    if (hundreds === 1 && tens === 0) {
      parts.push("cem");
    } else {
      parts.push(hundredWords[hundreds]);
    }
  }
  if (tens >= 10 && tens <= 19) {
    parts.push(teensWords[tens]);
  } else {
    if (tens >= 20) parts.push(tensWords[Math.floor(tens / 10)]);
    const ones = tens % 10;
    if (ones > 0 && tens >= 20) {
      parts[parts.length - 1] += ` e ${onesWords[ones]}`;
    } else if (ones > 0 && tens < 10) {
      parts.push(onesWords[ones]);
    }
  }

  return parts.join(" e ");
}

function expandDatesInText(text: string): string {
  return text.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, (_match, day, month, year) => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    let y = parseInt(year, 10);
    if (y < 100) y += 2000;
    const mesNome = MESES_PT[m] || month;
    return `${numberToPortuguese(d)} de ${mesNome} de ${yearToPortuguese(y)}`;
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveContactId(
  adminClient: ReturnType<typeof createClient>,
  contact: CampaignContact,
  organizationId: string
): Promise<string | null> {
  // If already has contact_id, return it
  if (contact.contact_id) return contact.contact_id;

  // Try to find existing contact by phone
  const phone = contact.phone;
  if (!phone) return null;

  const { data: existing } = await adminClient
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create a new contact for this phone
  const { data: newContact, error } = await adminClient
    .from("contacts")
    .insert({
      organization_id: organizationId,
      phone: phone,
      name: contact.name || phone,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[followup] Failed to create contact for phone:", phone, error);
    return null;
  }

  return newContact.id;
}

async function processCampaign(
  adminClient: ReturnType<typeof createClient>,
  campaign: Campaign
): Promise<{ success: number; failed: number }> {
  console.log(`[followup] Processing campaign: ${campaign.id} - ${campaign.name}`);

  // Set campaign to running
  await adminClient
    .from("voice_campaigns")
    .update({ status: "running" })
    .eq("id", campaign.id);

  // Fetch pending contacts
  const { data: contacts, error: contactsError } = await adminClient
    .from("voice_campaign_contacts")
    .select("id, contact_id, phone, name, status")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (contactsError || !contacts || contacts.length === 0) {
    console.log(`[followup] No pending contacts for campaign ${campaign.id}`);
    // Mark completed if no pending contacts
    await adminClient
      .from("voice_campaigns")
      .update({ status: "completed" })
      .eq("id", campaign.id);
    return { success: 0, failed: 0 };
  }

  console.log(`[followup] Found ${contacts.length} pending contacts`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Pre-fetch Vapi config once for the entire campaign
  const { data: vapiConfig } = await adminClient
    .from("crm_openbot_config")
    .select("vapi_api_key_encrypted, vapi_phone_number_id, vapi_default_voice")
    .eq("organization_id", campaign.organization_id)
    .single();

  if (!vapiConfig?.vapi_api_key_encrypted) {
    console.error(`[followup] No Vapi config for org ${campaign.organization_id}`);
    await adminClient
      .from("voice_campaigns")
      .update({ status: "failed" })
      .eq("id", campaign.id);
    return { success: 0, failed: contacts.length };
  }

  if (!vapiConfig.vapi_phone_number_id?.trim()) {
    console.error(`[followup] No phoneNumberId configured for org ${campaign.organization_id}`);
    await adminClient
      .from("voice_campaigns")
      .update({ status: "failed" })
      .eq("id", campaign.id);
    return { success: 0, failed: contacts.length };
  }

  const { decrypt } = await import("../_shared/encryption.ts");
  const vapiApiKey = (await decrypt(vapiConfig.vapi_api_key_encrypted)).trim();

  // Get a service role token to call vapi-call as an authenticated user
  // We need to find an admin user from the organization to act on behalf of
  const { data: orgMember } = await adminClient
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", campaign.organization_id)
    .limit(1)
    .single();

  if (!orgMember) {
    console.error(`[followup] No org member found for org ${campaign.organization_id}`);
    await adminClient
      .from("voice_campaigns")
      .update({ status: "failed" })
      .eq("id", campaign.id);
    return { success: 0, failed: contacts.length };
  }

  let successCount = 0;
  let failCount = 0;

  const isBatch = campaign.calling_mode === "batch";
  const batchSize = isBatch ? Math.max(1, Math.min(campaign.batch_size || 2, 10)) : 1;

  console.log(`[followup] Calling mode: ${campaign.calling_mode}, batch_size: ${batchSize}`);

  // Helper to mark a campaign contact as failed with auditable reason
  async function markFailed(campaignContactId: string, reason: string) {
    await adminClient
      .from("voice_campaign_contacts")
      .update({
        status: "failed",
        error_message: reason.substring(0, 500),
        attempted_at: new Date().toISOString(),
      })
      .eq("id", campaignContactId);
  }

  // Process a single contact — extracted for reuse in both modes
  async function processOneContact(contact: CampaignContact): Promise<boolean> {
      const contactId = await resolveContactId(adminClient, contact, campaign.organization_id);

      if (!contactId) {
        console.error(`[followup] Could not resolve contact for campaign contact ${contact.id}`);
        await markFailed(contact.id, "Não foi possível resolver o contato (telefone/contact_id inválido)");
        return false;
      }

      // Get contact phone
      const { data: contactData } = await adminClient
        .from("contacts")
        .select("phone")
        .eq("id", contactId)
        .single();

      if (!contactData?.phone) {
        console.error(`[followup] Contact ${contactId} has no phone`);
        await markFailed(contact.id, "Contato sem número de telefone cadastrado");
        return false;
      }

      // Format phone
      let phoneNumber = contactData.phone.replace(/\D/g, "");
      if (phoneNumber.startsWith("0")) phoneNumber = phoneNumber.substring(1);
      if (phoneNumber.length >= 10 && phoneNumber.length <= 11 && !phoneNumber.startsWith("55")) {
        phoneNumber = "+55" + phoneNumber;
      } else if (!phoneNumber.startsWith("+")) {
        phoneNumber = "+" + phoneNumber;
      }

      // Get or create conversation
      const { data: conversation } = await adminClient
        .from("conversations")
        .select("id")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const conversationId = conversation?.id || null;

      // Build Vapi payload
      const webhookUrl = `${supabaseUrl}/functions/v1/vapi-webhook`;
      const isScript = campaign.call_type === "script";

      const commonAssistantConfig = {
        language: "pt-BR",
        transcriber: { provider: "deepgram", language: "pt-BR" },
        voice: {
          provider: "11labs",
          voiceId: vapiConfig.vapi_default_voice || "pFZP5JQG7iQjIQuC4Bku",
        },
        serverUrl: webhookUrl,
        hipaaEnabled: false,
        clientMessages: ["transcript", "hang", "speech-update"],
        serverMessages: ["end-of-call-report", "status-update", "transcript"],
        voicemailDetection: "off",
      };

      const vapiCallPayload: Record<string, unknown> = {
        type: "outboundPhoneCall",
        name: `C-${campaign.name}`.substring(0, 40),
        customer: { number: phoneNumber },
        phoneNumberId: vapiConfig.vapi_phone_number_id?.trim(),
      };


      if (isScript) {
        let script = campaign.script_content || "";
        script = script.replace(/\{\{NOME\}\}/gi, contact.name || "");
        script = script.replace(/\{\{TELEFONE\}\}/gi, contact.phone || "");
        script = expandDatesInText(script);
        
        const callMode = campaign.call_mode || "acao";
        const isInformativo = callMode === "informativo";

        if (isInformativo) {
          script = script.trimEnd();
          if (!script.endsWith(".")) script += ".";
          script += " Obrigado pela atenção e até logo.";
        }

        const wordCount = script.split(/\s+/).filter(Boolean).length;
        const estimatedReadTime = Math.ceil(wordCount / 2.5);
        const dynamicMaxDuration = Math.max(60, Math.min(300, estimatedReadTime + 30));

        const systemPrompt = isInformativo
          ? `Você é um assistente de notificação em português brasileiro.
Leia a mensagem inicial para o cliente de forma clara.
Datas devem ser faladas por extenso (ex: "quinze de fevereiro de dois mil e vinte e seis").
NUNCA fale em inglês.
Assim que terminar de ler o texto, chame a função endCall IMEDIATAMENTE sem falar mais nada.
NÃO espere resposta. NÃO faça perguntas. NÃO diga "obrigado" nem nada antes de chamar endCall.`
          : `Você é um assistente de atendimento que fala exclusivamente português brasileiro.
REGRAS:
- Leia a mensagem inicial para o cliente de forma clara
- Datas por extenso em português
- NUNCA fale em inglês
- Após ler o script, AGUARDE a resposta do cliente (máximo 5 segundos)
- Assim que o cliente responder (positiva ou negativamente), agradeça brevemente e chame endCall IMEDIATAMENTE
- Se houver silêncio, agradeça e chame endCall`;

        const assistantConfig: Record<string, unknown> = {
          ...commonAssistantConfig,
          firstMessage: script,
          model: {
            provider: "openai",
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }],
            tools: [{ type: "endCall" }],
          },
          endCallFunctionEnabled: true,
          endCallMessage: isInformativo ? undefined : "Obrigado pela atenção. Tenha um ótimo dia!",
          maxDurationSeconds: dynamicMaxDuration,
          silenceTimeoutSeconds: 10,
        };

        if (isInformativo) {
          (assistantConfig as any).endCallPhrases = ["até logo"];
        } else {
          (assistantConfig as any).endCallPhrases = ["obrigado", "até logo", "tenha um bom dia", "tchau", "falou"];
        }

        vapiCallPayload.assistant = assistantConfig;
      } else {
        vapiCallPayload.assistant = {
          ...(campaign.assistant_config || {}),
          ...commonAssistantConfig,
          firstMessage: (campaign.assistant_config as any)?.firstMessage || "Olá! Tudo bem?",
          model: (campaign.assistant_config as any)?.model || {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [{
              role: "system",
              content: "Você é um assistente de atendimento profissional e amigável que fala português brasileiro. Converse naturalmente com o cliente, entenda suas necessidades e ofereça ajuda. NUNCA fale em inglês.",
            }],
          },
          maxDurationSeconds: (campaign.assistant_config as any)?.maxDurationSeconds || 300,
        };
      }

      // Create voice_call record
      const { data: voiceCall, error: insertError } = await adminClient
        .from("voice_calls")
        .insert({
          organization_id: campaign.organization_id,
          contact_id: contactId,
          conversation_id: conversationId,
          call_type: isScript ? "script" : "conversational",
          status: "pending",
          script_content: isScript ? (vapiCallPayload.assistant as any)?.firstMessage : null,
          assistant_config: vapiCallPayload.assistant,
          call_reason: campaign.call_reason || campaign.name,
          whatsapp_followup_enabled: campaign.whatsapp_followup_enabled,
          whatsapp_followup_text: campaign.whatsapp_followup_text,
          whatsapp_followup_file_url: campaign.whatsapp_followup_file_url,
          campaign_id: campaign.id,
          webhook_url: campaign.webhook_enabled ? campaign.webhook_url : null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`[followup] Failed to create voice_call:`, insertError);
        await markFailed(contact.id, `Falha ao criar registro da chamada: ${insertError.message}`);
        return false;
      }

      // Call Vapi API
      const vapiResponse = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vapiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vapiCallPayload),
      });

      const vapiResult = await vapiResponse.json();

      if (!vapiResponse.ok) {
        console.error(`[followup] Vapi API error for contact ${contact.id}:`, vapiResult);
        const reason = vapiResult?.message
          ? (Array.isArray(vapiResult.message) ? vapiResult.message.join("; ") : String(vapiResult.message))
          : `HTTP ${vapiResponse.status}`;
        await adminClient
          .from("voice_calls")
          .update({ status: "failed", ended_reason: reason })
          .eq("id", voiceCall.id);
        await markFailed(contact.id, `Vapi: ${reason}`);
        return false;
      } else {
        await adminClient
          .from("voice_calls")
          .update({ vapi_call_id: vapiResult.id, status: "ringing" })
          .eq("id", voiceCall.id);
        await adminClient
          .from("voice_campaign_contacts")
          .update({
            status: "calling",
            voice_call_id: voiceCall.id,
            attempted_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", contact.id);
        console.log(`[followup] Call initiated for contact ${contact.id}, vapi_call_id: ${vapiResult.id}`);
        return true;
      }
  }

  // Process contacts based on calling mode
  if (isBatch && batchSize > 1) {
    // Batch mode: process in chunks of batchSize concurrently
    for (let i = 0; i < (contacts as CampaignContact[]).length; i += batchSize) {
      const chunk = (contacts as CampaignContact[]).slice(i, i + batchSize);
      console.log(`[followup] Processing batch ${Math.floor(i / batchSize) + 1}: ${chunk.length} contacts`);

      const results = await Promise.allSettled(
        chunk.map(async (contact) => {
          try {
            return await processOneContact(contact);
          } catch (err) {
            console.error(`[followup] Error processing contact ${contact.id}:`, err);
            await markFailed(contact.id, `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
            return false;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) successCount++;
        else failCount++;
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < (contacts as CampaignContact[]).length) {
        await delay(3000);
      }
    }
  } else {
    // Sequential mode: one at a time
    for (const contact of contacts as CampaignContact[]) {
      try {
        const ok = await processOneContact(contact);
        if (ok) successCount++;
        else failCount++;
      } catch (err) {
        console.error(`[followup] Error processing contact ${contact.id}:`, err);
        await markFailed(contact.id, `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
        failCount++;
      }
      // Delay between calls
      await delay(2000);
    }
  }

  // Update campaign counters — only set failed here; completed is tracked by vapi-webhook
  await adminClient
    .from("voice_campaigns")
    .update({
      completed_calls: 0,
      failed_calls: failCount,
    })
    .eq("id", campaign.id);

  // Check if all contacts processed — mark completed
  const { data: remaining } = await adminClient
    .from("voice_campaign_contacts")
    .select("id")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .limit(1);

  if (!remaining || remaining.length === 0) {
    if (successCount === 0) {
      // All calls failed, no webhook will come — mark completed now
      console.log(`[followup] All calls failed for campaign ${campaign.id}, marking as completed`);
      await adminClient
        .from("voice_campaigns")
        .update({ status: "completed", failed_calls: failCount })
        .eq("id", campaign.id);
    } else {
      // Some calls succeeded — keep as 'running', vapi-webhook will finalize
      console.log(`[followup] ${successCount} calls in progress for campaign ${campaign.id}`);
    }
  }

  return { success: successCount, failed: failCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate cron secret
  const cronSecret = Deno.env.get("FOLLOWUP_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");

  const isValidSecret = cronSecret && providedSecret && providedSecret === cronSecret;
  const isInternalCron = providedSecret === "followup-cron-internal";

  if (!isValidSecret && !isInternalCron) {
    console.error("[followup] Invalid or missing cron secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date().toISOString();

    // Fetch scheduled campaigns ready to execute
    const { data: campaigns, error: fetchError } = await adminClient
      .from("voice_campaigns")
      .select("id, organization_id, name, call_type, script_content, assistant_config, call_reason, whatsapp_followup_enabled, whatsapp_followup_text, whatsapp_followup_file_url, flow_id, webhook_enabled, webhook_url, call_mode, calling_mode, batch_size")
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[followup] Error fetching campaigns:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch campaigns" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: "No scheduled campaigns ready",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[followup] Found ${campaigns.length} campaigns to process`);

    const { getOrgFeatures } = await import("../_shared/getOrgFeatures.ts");

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const campaign of campaigns as Campaign[]) {
      // Feature gate: check if org has followup feature
      const features = await getOrgFeatures(adminClient, campaign.organization_id);
      if (!features.includes("followup") && !features.includes("ai_features")) {
        console.log(`[followup] Org ${campaign.organization_id} lacks 'followup' feature, skipping campaign ${campaign.id}`);
        totalSkipped++;
        continue;
      }
      const result = await processCampaign(adminClient, campaign);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    return new Response(JSON.stringify({
      success: true,
      campaigns_processed: campaigns.length,
      total_success: totalSuccess,
      total_failed: totalFailed,
      total_skipped: totalSkipped,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[followup] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
