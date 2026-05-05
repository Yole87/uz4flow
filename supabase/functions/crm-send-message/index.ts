import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.4/mod.ts";
import { decrypt } from "../_shared/encryption.ts";
import { convertWebmToOgg } from "../_shared/webm-to-ogg.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";
import { getErrorMessage } from "../_shared/getErrorMessage.ts";
import { sendOpenBotMessage, OPENBOT_SEND_URL } from "../_shared/openbot.ts";

const TestConnectionSchema = z.object({
  test_connection: z.literal(true),
  instance_id: z.string().uuid(),
});

const SendMessageSchema = z
  .object({
    conversation_id: z.string().uuid(),
    message: z.string().max(10000).optional(),
    arquivo: z.string().max(20_000_000).optional(),
    content_type: z.enum(["image", "audio", "video", "document"]).optional(),
    file_name: z.string().max(500).optional(),
    template_name: z.string().max(200).optional(),
    template_language: z.string().max(20).optional(),
    ig_human_agent: z.boolean().optional(),
  })
  .refine((d) => !!(d.message?.trim() || d.arquivo || d.template_name), {
    message: "message, arquivo or template_name is required",
  });

const BodySchema = z.union([TestConnectionSchema, SendMessageSchema]);

// ── Local "Lite" shapes for join results (Wave J.1 type containment) ──────
interface InstanceLite {
  id: string;
  name?: string | null;
  channel?: string | null;
  provider?: string | null;
  api_key_encrypted?: string | null;
  meta_phone_number_id?: string | null;
  instagram_account_id?: string | null;
  openbot_instance_id?: string | null;
  openbot_api_key_encrypted?: string | null;
  organization_id?: string | null;
  api_url?: string | null;
}
interface ContactLite {
  id: string;
  phone?: string | null;
  organization_id: string;
  is_blocked?: boolean | null;
  channel?: string | null;
  ig_user_scoped_id?: string | null;
}
interface ConversationLite {
  id: string;
  channel?: string | null;
  dm_window_expires_at?: string | null;
  contact?: ContactLite | null;
  instance?: InstanceLite | null;
}
interface TeamMemberLite {
  first_name?: string | null;
  last_name?: string | null;
  signature_format?: SignatureFormat | null;
  silent_mode?: boolean | null;
  team_profiles?: { title?: string | null; department?: string | null; name?: string | null } | null;
}
interface IGSendResult {
  message_id?: string;
  error?: { message?: string; code?: number; type?: string };
  raw?: string;
}
type SendMessageBody = z.infer<typeof SendMessageSchema>;
type TestConnectionBody = z.infer<typeof TestConnectionSchema>;
type ParsedBody = SendMessageBody | TestConnectionBody;

/**
 * Builds the attendant signature respecting per-member format and org toggle.
 * Mirrors src/lib/signatureFormat.ts (cannot import frontend code in edge functions).
 */
type SignatureFormat = "name_only" | "name_role" | "name_role_dept" | "none";
function buildSignature(input: {
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  department?: string | null;
  format?: SignatureFormat;
  silentMode?: boolean;
  organizationEnabled?: boolean;
}): string | null {
  const { firstName, lastName, role, department, format = "name_role_dept", silentMode = false, organizationEnabled = true } = input;
  if (silentMode || !organizationEnabled || format === "none") return null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!fullName) return null;
  switch (format) {
    case "name_only": return fullName;
    case "name_role": return role ? `${fullName} — ${role}` : fullName;
    case "name_role_dept":
      if (role && department) return `${fullName} — ${role} · ${department}`;
      if (role) return `${fullName} — ${role}`;
      if (department) return `${fullName} — ${department}`;
      return fullName;
    default: return fullName;
  }
}

/**
 * Generates a friendly message preview for the conversation list
 */
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

interface SendMessageRequest {
  conversation_id: string;
  message: string;
  arquivo?: string;       // base64 Data URL (optional)
  content_type?: string;  // "image" | "audio" | "video" | "document" (optional)
  file_name?: string;     // original file name (optional)
  template_name?: string; // Meta template name (optional)
  template_language?: string; // Meta template language code (optional, default pt_BR)
  ig_human_agent?: boolean; // For Instagram: send via HUMAN_AGENT tag (allowed up to 7d outside the 24h window)
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  console.log("[crm-send-message] Request received:", req.method);

  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const startTime = Date.now();
  let loggedOrganizationId: string | null = null;
  let loggedInstanceId: string | null = null;
  let loggedPhone: string | null = null;

  try {
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    const isInternalCron = !!(cronSecretHeader && expectedCronSecret && cronSecretHeader === expectedCronSecret);

    let user: { id: string } | null = null;

    if (isInternalCron) {
      // Internal call from process-scheduled-messages: no JWT, uses x-acting-user-id
      const actingUserId = req.headers.get("x-acting-user-id");
      if (!actingUserId) {
        return new Response(
          JSON.stringify({ error: "x-acting-user-id required for internal cron call" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = { id: actingUserId };
      console.log("[crm-send-message] Internal cron call, acting as user:", actingUserId);
    } else {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");

      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { data: authData, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !authData?.user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = { id: authData.user.id };
    }

    const rawBody = await req.json().catch(() => null);
    const parsedBody = BodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      console.warn("[crm-send-message] invalid_payload", parsedBody.error.flatten());
      return new Response(
        JSON.stringify({ error: "invalid_payload", issues: parsedBody.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const body: ParsedBody = parsedBody.data;

    // ── Test Connection handler (validates Meta credentials without sending) ──
    if (body.test_connection && body.instance_id) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Validate instance belongs to user's organization
      const { data: userOrgs } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id);

      const orgIds = (userOrgs || []).map((o) => o.organization_id);

      const { data: inst, error: instErr } = await supabaseAdmin
        .from("instances")
        .select("api_key_encrypted, meta_phone_number_id, provider, organization_id")
        .eq("id", body.instance_id)
        .single();

      if (instErr || !inst || !orgIds.includes(inst.organization_id)) {
        return new Response(
          JSON.stringify({ success: false, error: "Instância não encontrada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!inst.api_key_encrypted) {
        return new Response(
          JSON.stringify({ success: false, error: "Token de Acesso Meta não configurado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!inst.meta_phone_number_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Phone Number ID não configurado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let metaToken: string;
      try {
        metaToken = await decrypt(inst.api_key_encrypted);
      } catch (e) {
        console.error("[crm-send-message] test_connection decrypt error:", e);
        return new Response(
          JSON.stringify({ success: false, error: "Falha ao descriptografar token" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const metaResp = await fetchWithRetry(
          `https://graph.facebook.com/v21.0/${inst.meta_phone_number_id}?fields=verified_name,quality_rating`,
          { headers: { Authorization: `Bearer ${metaToken}` } }
        );
        const metaData = await metaResp.json();

        if (!metaResp.ok) {
          const msg = metaData?.error?.message || `Meta API ${metaResp.status}`;
          return new Response(
            JSON.stringify({ success: false, error: msg }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, verified_name: metaData.verified_name, quality_rating: metaData.quality_rating }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchErr) {
        console.error("[crm-send-message] test_connection fetch error:", fetchErr);
        return new Response(
          JSON.stringify({ success: false, error: "Falha ao conectar na API da Meta" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { conversation_id, message, arquivo, content_type, file_name, template_name, template_language, ig_human_agent } = body as {
      conversation_id: string;
      message?: string;
      arquivo?: string;
      content_type?: string;
      file_name?: string;
      template_name?: string;
      template_language?: string;
      ig_human_agent?: boolean;
    };

    // Zod already enforced (conversation_id uuid) + (message OR arquivo OR template_name).

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let organizationId: string;

    if (membership) {
      organizationId = membership.organization_id;
    } else {
      // Check if admin_master (support mode)
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin_master")
        .maybeSingle();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não associado a uma organização.", code: "ORG_MEMBERSHIP_MISSING" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Admin: resolve org from the conversation's contact
      const { data: conv } = await supabase
        .from("conversations")
        .select("contact_id, contacts(organization_id)")
        .eq("id", conversation_id)
        .maybeSingle();

      const convOrg = (conv?.contacts as { organization_id?: string } | null)?.organization_id;
      if (!convOrg) {
        console.error("[crm-send-message] Admin bypass: could not resolve org from conversation", conversation_id);
        return new Response(
          JSON.stringify({ success: false, error: "Conversa não encontrada.", code: "CONV_NOT_FOUND" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      organizationId = convOrg;
      console.log("[crm-send-message] Admin bypass: resolved org from conversation:", organizationId);
    }
    loggedOrganizationId = organizationId;

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select(`
        id,
        channel,
        dm_window_expires_at,
        contact:contacts(id, phone, organization_id, is_blocked, channel, ig_user_scoped_id),
        instance:instances(id, name, openbot_instance_id, openbot_api_key_encrypted, organization_id, provider, api_key_encrypted, api_url, meta_phone_number_id, channel, instagram_account_id)
      `)
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      console.error("[crm-send-message] Conversation not found:", convError);
      return new Response(
        JSON.stringify({ success: false, error: "Conversa não encontrada.", code: "CONV_NOT_FOUND" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For normal users, verify org ownership; for admins who resolved org from conversation, this is naturally consistent
    if (conversation.contact?.organization_id !== organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado a esta conversa.", code: "ACCESS_DENIED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conversation.contact?.is_blocked) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Contato está bloqueado. Desbloqueie o contato para enviar mensagens.",
          code: "CONTACT_BLOCKED"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────
    // ── INSTAGRAM DM BRANCH ──────────────────────────────────
    // ─────────────────────────────────────────────────────────
    const convo = conversation as unknown as ConversationLite;
    const channel = convo.channel || convo.instance?.channel || "whatsapp";

    if (channel === "instagram") {
      const igAccountId = convo.instance?.instagram_account_id;
      const igScopedId = convo.contact?.ig_user_scoped_id;
      const dmWindowExpiresAt = convo.dm_window_expires_at;
      loggedInstanceId = convo.instance?.id || null;
      loggedPhone = igScopedId ? `ig_${igScopedId.substring(0, 6)}****` : "ig_unknown";

      if (!igAccountId) {
        return new Response(
          JSON.stringify({ success: false, error: "Instância Instagram não vinculada a uma conta conectada.", code: "IG_ACCOUNT_MISSING" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!igScopedId) {
        return new Response(
          JSON.stringify({ success: false, error: "Contato sem identificador do Instagram.", code: "IG_SCOPED_ID_MISSING" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate 24h DM window — bypass via HUMAN_AGENT tag (allowed up to 7d)
      const now = Date.now();
      const windowOpen = dmWindowExpiresAt ? new Date(dmWindowExpiresAt).getTime() > now : false;
      const useHumanAgent = !windowOpen && ig_human_agent === true;
      if (!windowOpen && !useHumanAgent) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "A janela de 24h do Instagram expirou. Reenvie usando a etiqueta 'Atendente Humano' (válida até 7 dias) ou aguarde nova mensagem do usuário.",
            code: "IG_WINDOW_CLOSED",
            can_use_human_agent: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Block document/PDF uploads (unsupported by Instagram)
      if (content_type === "document") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "O Instagram não suporta envio de documentos/PDF. Use texto, imagem, áudio ou vídeo.",
            code: "IG_DOCUMENT_UNSUPPORTED",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch IG account token
      const { data: igAccount } = await supabase
        .from("instagram_accounts")
        .select("access_token_encrypted, ig_user_id, organization_id")
        .eq("id", igAccountId)
        .maybeSingle();

      if (!igAccount || igAccount.organization_id !== organizationId || !igAccount.access_token_encrypted) {
        return new Response(
          JSON.stringify({ success: false, error: "Conta do Instagram não disponível para envio.", code: "IG_ACCOUNT_INVALID" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let igAccessToken: string;
      try {
        igAccessToken = await decrypt(igAccount.access_token_encrypted);
      } catch (e) {
        console.error("[crm-send-message] IG token decrypt failed:", e);
        return new Response(
          JSON.stringify({ success: false, error: "Falha ao descriptografar token do Instagram. Reconecte a conta.", code: "IG_DECRYPT_FAILED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Resolve sender prefix (same logic as WhatsApp)
      let igSenderName: string | null = null;
      const { data: igTeamMember } = await supabase
        .from("team_members")
        .select("first_name, last_name, signature_format, silent_mode, team_profiles:team_profile_id(title, department, name)")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      const { data: igOrg } = await supabase
        .from("organizations")
        .select("message_signature_enabled")
        .eq("id", organizationId)
        .maybeSingle();
      const igSignatureEnabled = (igOrg as { message_signature_enabled?: boolean } | null)?.message_signature_enabled !== false;
      const igTm = igTeamMember as TeamMemberLite | null;
      if (igTm) {
        igSenderName = buildSignature({
          firstName: igTm.first_name,
          lastName: igTm.last_name,
          role: igTm.team_profiles?.title,
          department: igTm.team_profiles?.department || igTm.team_profiles?.name,
          format: igTm.signature_format || "name_role_dept",
          silentMode: igTm.silent_mode ?? undefined,
          organizationEnabled: igSignatureEnabled,
        });
      } else {
        const { data: profile } = await supabase
          .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        igSenderName = igSignatureEnabled ? (profile?.full_name || "Atendente") : null;
      }

      const igRawText = (message?.trim() || "");
      const igPrefixed = igRawText && igSenderName ? `*${igSenderName}:*\n${igRawText}` : igRawText;

      // Optional media upload to message-media bucket for public URL (IG requires public URLs)
      let igPublicUrl: string | null = null;
      let igDetectedMime = "application/octet-stream";
      if (arquivo && content_type && ["image", "audio", "video"].includes(content_type)) {
        const m = arquivo.match(/^data:(.+?);base64,(.+)$/);
        if (m) {
          igDetectedMime = m[1].split(";")[0].trim().toLowerCase() || "application/octet-stream";
          const raw = atob(m[2]);
          const buf = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);

          // Map MIME → file extension. IG demands a recognizable extension on the URL.
          const mimeExtMap: Record<string, string> = {
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/mp4": "m4a",
            "audio/aac": "aac",
            "audio/ogg": "ogg",
            "audio/webm": "webm",
            "video/mp4": "mp4",
            "video/quicktime": "mov",
            "video/webm": "webm",
          };
          const ext = mimeExtMap[igDetectedMime] || igDetectedMime.split("/")[1]?.split(";")[0] || "bin";
          const path = `${organizationId}/ig_${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("message-media").upload(path, buf, {
            contentType: igDetectedMime,
            upsert: false,
            cacheControl: "3600",
          });
          if (!upErr) {
            igPublicUrl = supabase.storage.from("message-media").getPublicUrl(path).data.publicUrl;
            console.log("[crm-send-message] IG media uploaded:", { path, mime: igDetectedMime, size: buf.length, url: igPublicUrl });
            try { await supabase.rpc("recalculate_org_storage", { p_org_id: organizationId }); } catch {}
          } else {
            console.warn("[crm-send-message] IG media upload failed:", upErr);
          }
        }
      }

      // Build IG message payload
      const igUrl = `https://graph.instagram.com/v25.0/${igAccount.ig_user_id}/messages`;
      let igMessage: Record<string, unknown>;
      if (content_type && ["image", "audio", "video"].includes(content_type) && igPublicUrl) {
        igMessage = {
          attachment: {
            type: content_type,
            payload: { url: igPublicUrl, is_reusable: false },
          },
        };
      } else {
        const textBody = (igPrefixed || "[mídia]").substring(0, 1000);
        igMessage = { text: textBody };
      }

      const igPayload: Record<string, unknown> = {
        recipient: { id: igScopedId },
        message: igMessage,
      };
      if (useHumanAgent) {
        igPayload.messaging_type = "MESSAGE_TAG";
        igPayload.tag = "HUMAN_AGENT";
      }

      let igResult: IGSendResult = {};
      try {
        const igResp = await fetchWithRetry(igUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${igAccessToken}` },
          body: JSON.stringify(igPayload),
        });
        const igRespText = await igResp.text();
        try { igResult = JSON.parse(igRespText) as IGSendResult; } catch { igResult = { raw: igRespText }; }

        if (!igResp.ok) {
          const rawErrMsg = igResult.error?.message || `Instagram API ${igResp.status}`;
          // Friendlier message for the most common media failures
          let friendly = rawErrMsg;
          if (/Unsupported.*get|fetch.*url|download/i.test(rawErrMsg)) {
            friendly = "O Instagram não conseguiu baixar a mídia. Verifique o formato do arquivo e tente novamente.";
          } else if (/file size|too large/i.test(rawErrMsg)) {
            friendly = "Arquivo muito grande para envio via Instagram DM.";
          }
          console.error("[crm-send-message] IG send error:", { rawErrMsg, igPublicUrl, igDetectedMime, igResult });
          await supabase.from("crm_webhook_events").insert({
            organization_id: organizationId,
            event_type: "outbound",
            status: "error",
            instance_id: loggedInstanceId,
            phone: loggedPhone,
            payload: { conversationId: conversation_id, channel: "instagram", messagePreview: igRawText.substring(0, 50), mediaUrl: igPublicUrl, mime: igDetectedMime },
            error_message: `IG: ${rawErrMsg.substring(0, 200)}`,
            processing_time_ms: Date.now() - startTime,
          });
          return new Response(
            JSON.stringify({ success: false, error: friendly, code: "IG_SEND_FAILED" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log("[crm-send-message] IG send success:", { messageId: igResult.message_id, recipient: igScopedId });
      } catch (e) {
        console.error("[crm-send-message] IG fetch error:", e);
        return new Response(
          JSON.stringify({ success: false, error: "Falha ao conectar com a API do Instagram.", code: "IG_FETCH_FAILED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const igMid = igResult.message_id || null;

      // Persist message locally
      const igLocalContent = igRawText ||
        (content_type === "audio" ? "🎵 Áudio" :
         content_type === "image" ? "📷 Imagem" :
         content_type === "video" ? "🎥 Vídeo" : "");

      const { data: igNewMessage } = await supabase.from("messages").insert({
        conversation_id,
        organization_id: organizationId,
        content: igLocalContent,
        content_type: content_type || "text",
        direction: "outbound",
        sender_type: "attendant",
        sender_name: igSenderName,
        status: "sent",
        timestamp: new Date().toISOString(),
        openbot_message_id: igMid,
        media_url: igPublicUrl,
        media_mime_type: content_type === "audio" ? igDetectedMime : null,
        metadata: { source: "instagram_dm" },
      }).select().single();

      await supabase.from("conversations").update({
        last_message_at: new Date().toISOString(),
        last_message_preview: generateMessagePreview(content_type || "text", igRawText),
        last_sender_type: "attendant",
        unread_count: 0,
      }).eq("id", conversation_id);

      await supabase.from("contacts").update({ last_interaction_at: new Date().toISOString() })
        .eq("id", conversation.contact?.id);

      await supabase.from("crm_webhook_events").insert({
        organization_id: organizationId,
        event_type: "outbound",
        status: "success",
        instance_id: loggedInstanceId,
        phone: loggedPhone,
        payload: { conversationId: conversation_id, channel: "instagram", messagePreview: igRawText.substring(0, 50) },
        response: { messageId: igNewMessage?.id || null, igMid },
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ success: true, message: igNewMessage, instagram: { mid: igMid } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ─────────────────────────────────────────────────────────
    // ── END INSTAGRAM DM BRANCH ─────────────────────────────
    // ─────────────────────────────────────────────────────────

    const instanceProvider = convo.instance?.provider || "baileys";
    let instanceApiKeyEncrypted = convo.instance?.openbot_api_key_encrypted;
    const instanceId = convo.instance?.openbot_instance_id;

    // For meta_official instances, ALWAYS prioritize api_key_encrypted (Meta token)
    if (instanceProvider === "meta_official") {
      const metaApiKey = convo.instance?.api_key_encrypted;
      if (metaApiKey) {
        instanceApiKeyEncrypted = metaApiKey;
        console.log("[crm-send-message] Using Meta API key from instance (api_key_encrypted)");
      }
    }

    // Validate key length – keys < 20 chars are truncated/invalid legacy values
    if (!instanceApiKeyEncrypted || instanceApiKeyEncrypted.length < 20) {
      console.warn("[crm-send-message] Instance key missing or too short, trying org-level fallbacks");
      
      // Fallback 1: crm_openbot_config (organization-level)
      const { data: orgConfig } = await supabase
        .from("crm_openbot_config")
        .select("openbot_api_key_encrypted")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (orgConfig?.openbot_api_key_encrypted && orgConfig.openbot_api_key_encrypted.length >= 20) {
        instanceApiKeyEncrypted = orgConfig.openbot_api_key_encrypted;
        console.log("[crm-send-message] Using API key from crm_openbot_config (org-level)");
      } else {
        // Fallback 2: integrations table (legacy, uses org owner)
        const { data: orgOwner } = await supabase
          .from("organizations")
          .select("owner_user_id")
          .eq("id", organizationId)
          .maybeSingle();

        const fallbackUserId = orgOwner?.owner_user_id || user.id;
        const { data: fallbackIntegration } = await supabase
          .from("integrations")
          .select("openbot_api_key_encrypted")
          .eq("user_id", fallbackUserId)
          .maybeSingle();

        if (fallbackIntegration?.openbot_api_key_encrypted && fallbackIntegration.openbot_api_key_encrypted.length >= 20) {
          instanceApiKeyEncrypted = fallbackIntegration.openbot_api_key_encrypted;
          console.log("[crm-send-message] Using API key from integrations fallback (owner)");
        } else {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: "Esta instância não possui API Key válida configurada. Configure nas Configurações do CRM.",
              code: "INSTANCE_NO_API_KEY"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // For meta_official, don't require openbot_instance_id; for baileys, warn but don't block
    if (!instanceId && instanceProvider !== "meta_official") {
      console.warn("[crm-send-message] Instance not linked to OpenBot yet, will try sending without instanceId");
    }

    let apiKey: string;
    try {
      apiKey = await decrypt(instanceApiKeyEncrypted);
    } catch (decryptError) {
      console.error("[crm-send-message] Failed to decrypt API key:", decryptError);
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao descriptografar a API Key. Reconfigure nas Configurações.", code: "DECRYPT_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = conversation.contact?.phone?.replace(/\D/g, "") || "";
    loggedPhone = phone.substring(0, 6) + "****";
    loggedInstanceId = instanceId || null;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Número de telefone do contato não encontrado.", code: "NO_PHONE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check storage limit before uploading media
    let permanentMediaUrl: string | null = null;
    let base64Data: string | null = null;
    let detectedMime = "application/octet-stream";
    let storageSkipped = false;
    let currentUsedBytes = 0;
    let currentFileCount = 0;

    if (arquivo) {
      // Check storage limit
      const { data: storageUsage } = await supabase
        .from("organization_storage_usage")
        .select("used_bytes, file_count")
        .eq("organization_id", organizationId)
        .maybeSingle();

      currentUsedBytes = storageUsage?.used_bytes || 0;
      currentFileCount = storageUsage?.file_count || 0;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans(limits)")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle();

      const planLimits = (sub as { subscription_plans?: { limits?: Record<string, unknown> } } | null)?.subscription_plans?.limits;
      const storageLimitMB = (planLimits?.storage_limit_mb as number) ?? 500;
      const limitBytes = storageLimitMB * 1024 * 1024;

      if (currentUsedBytes >= limitBytes) {
        console.warn("[crm-send-message] Storage limit reached, skipping media upload");
        storageSkipped = true;
      }
    }

    // Upload media to Storage to get a public URL (avoids base64 size limits)

    if (arquivo && !storageSkipped) {
      const base64Match = arquivo.match(/^data:(.+?);base64,(.+)$/);
      if (base64Match) {
        detectedMime = base64Match[1];
        base64Data = base64Match[2];
        const raw = atob(base64Data);
        const buffer = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);

        // Determine file extension from MIME
        const mimeExtMap: Record<string, string> = {
          "ogg": "ogg", "mp4": "mp4", "webm": "webm", "m4a": "m4a",
          "mpeg": "mp3", "wav": "wav", "jpeg": "jpg", "png": "png",
          "gif": "gif", "pdf": "pdf", "mp4v": "mp4",
        };
        const mimeKey = Object.keys(mimeExtMap).find(k => detectedMime.includes(k));
        const ext = mimeKey ? mimeExtMap[mimeKey] : (content_type === "audio" ? "ogg" : "bin");
        const safeName = file_name
          ? file_name.replace(/[^a-zA-Z0-9._-]/g, '_')
          : `${crypto.randomUUID()}.${ext}`;
        const storagePath = `${organizationId}/${crypto.randomUUID()}_${safeName}`;

        const normalizedMime = detectedMime.replace(/\s*;\s*/g, ";");
        const { error: uploadErr } = await supabase.storage
          .from("message-media")
          .upload(storagePath, buffer, { contentType: normalizedMime, upsert: false });

        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage
            .from("message-media")
            .getPublicUrl(storagePath);
          permanentMediaUrl = publicUrlData.publicUrl;
          // Recalculate storage usage accurately
          try {
            await supabase.rpc("recalculate_org_storage", { p_org_id: organizationId });
          } catch (usageErr) {
            console.warn("[crm-send-message] Failed to recalculate storage usage:", usageErr);
          }
          console.log("[crm-send-message] Media uploaded to storage:", storagePath);
        } else {
          console.warn("[crm-send-message] Storage upload error:", uploadErr);
        }
      }
    }

    // Build OpenBot payload
    // Determine content_type for the local message
    const resolvedContentType = content_type || "text";

    // Convert WebM audio to OGG Opus for WhatsApp PTT compatibility
    let finalArquivo = arquivo || null;
    if (arquivo && resolvedContentType === "audio" && detectedMime.includes("webm")) {
      try {
        console.log("[crm-send-message] Converting WebM to OGG Opus for WhatsApp PTT...");
        const raw = atob(base64Data!);
        const webmBytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) webmBytes[i] = raw.charCodeAt(i);
        
        const oggBytes = convertWebmToOgg(webmBytes);
        
        // Build new Data URL with OGG MIME
        const oggBase64 = btoa(String.fromCharCode(...oggBytes));
        finalArquivo = `data:audio/ogg;codecs=opus;base64,${oggBase64}`;
        detectedMime = "audio/ogg;codecs=opus";
        console.log("[crm-send-message] WebM→OGG conversion successful, size:", oggBytes.length);
      } catch (convError) {
        console.warn("[crm-send-message] WebM→OGG conversion failed, sending original:", convError);
        // Fallback: send original WebM
      }
    }

    // Convert Data URL to OpenBot @file format for proper document handling
    if (finalArquivo && file_name && resolvedContentType === "document") {
      const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
      finalArquivo = finalArquivo.replace(
        /^data:[^;]+;base64,/,
        `data:@file/${safeName};base64,`
      );
      console.log("[crm-send-message] Converted Data URL to @file format:", safeName);
    }

    // Resolve sender name early for WhatsApp prefix
    let senderName: string | null = null;
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("first_name, last_name, team_profile_id, signature_format, silent_mode, team_profiles:team_profile_id(title, department, name)")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: orgSig } = await supabase
      .from("organizations")
      .select("message_signature_enabled")
      .eq("id", organizationId)
      .maybeSingle();
    const signatureEnabled = (orgSig as { message_signature_enabled?: boolean } | null)?.message_signature_enabled !== false;

    const tm = teamMember as TeamMemberLite | null;
    if (tm) {
      senderName = buildSignature({
        firstName: tm.first_name,
        lastName: tm.last_name,
        role: tm.team_profiles?.title,
        department: tm.team_profiles?.department || tm.team_profiles?.name,
        format: tm.signature_format || "name_role_dept",
        silentMode: tm.silent_mode ?? undefined,
        organizationEnabled: signatureEnabled,
      });
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      senderName = signatureEnabled ? (profile?.full_name || "Atendente") : null;
    }

    // Build message text with sender prefix for WhatsApp (not for local CRM)
    const rawText = resolvedContentType === "audio" ? "" : (message?.trim() || "");
    const prefixedMessage = rawText && senderName
      ? `*${senderName}:*\n${rawText}`
      : rawText;

    const resolvedInstanceId = instanceId || "default";

    // ── Meta Graph API direct route for meta_official instances ──
    const metaPhoneNumberId = convo.instance?.meta_phone_number_id;
    const useMetaDirect = instanceProvider === "meta_official" && metaPhoneNumberId;

    let openbotResult: Record<string, unknown> = {};

    if (useMetaDirect) {
      console.log("[crm-send-message] Using Meta Graph API direct route:", {
        phoneNumberId: metaPhoneNumberId,
        phone: phone.substring(0, 6) + "...",
        hasArquivo: !!arquivo,
        contentType: resolvedContentType,
      });

      const metaUrl = `https://graph.facebook.com/v21.0/${metaPhoneNumberId}/messages`;
      let metaPayload: Record<string, unknown>;

      // ── Template sending (outside 24h window) ──
      if (template_name) {
        const lang = template_language || "pt_BR";
        console.log("[crm-send-message] Sending Meta template:", template_name, "lang:", lang);
        metaPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: template_name,
            language: { code: lang },
          },
        };
      } else if (resolvedContentType === "text" || (!arquivo && resolvedContentType !== "audio")) {
        metaPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: prefixedMessage },
        };
      } else if (resolvedContentType === "image" && permanentMediaUrl) {
        metaPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "image",
          image: { link: permanentMediaUrl, ...(prefixedMessage ? { caption: prefixedMessage } : {}) },
        };
      } else if (resolvedContentType === "document" && permanentMediaUrl) {
        metaPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "document",
          document: { link: permanentMediaUrl, filename: file_name || "document", ...(prefixedMessage ? { caption: prefixedMessage } : {}) },
        };
      } else if ((resolvedContentType === "audio" || resolvedContentType === "video") && permanentMediaUrl) {
        metaPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: resolvedContentType,
          [resolvedContentType]: { link: permanentMediaUrl },
        };
      } else {
        // Fallback to text if media URL not available
        metaPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: prefixedMessage || "[mídia]" },
        };
      }

      const metaResponse = await fetchWithRetry(metaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(metaPayload),
      });

      const metaResult = await metaResponse.json();
      console.log("[crm-send-message] Meta API response:", JSON.stringify(metaResult));

      if (!metaResponse.ok) {
        const errorMsg = metaResult?.error?.message || `Meta API returned ${metaResponse.status}`;
        console.error("[crm-send-message] Meta API error:", errorMsg);

        await supabase.from("crm_webhook_events").insert({
          organization_id: organizationId,
          event_type: "outbound",
          status: "error",
          instance_id: instanceId,
          phone: loggedPhone,
          payload: { conversationId: conversation_id, messagePreview: (message || "").trim().substring(0, 50), hasArquivo: !!arquivo },
          error_message: `Meta API: ${errorMsg.substring(0, 200)}`,
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ error: `Meta API error: ${errorMsg}`, details: metaResult }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const wamid = metaResult?.messages?.[0]?.id || null;
      openbotResult = { success: true, messageId: wamid, meta_direct: true };
      console.log("[crm-send-message] Meta direct send success, wamid:", wamid);

    } else {
      // ── OpenBot sendWebhook route (baileys and fallback) ──
      const openbotExtra: Record<string, unknown> = {
        ...(resolvedInstanceId ? { instanceId: resolvedInstanceId } : {}),
      };
      if (finalArquivo) {
        openbotExtra.arquivo = finalArquivo;
      }
      if (file_name) {
        openbotExtra.fileName = file_name;
      }

      console.log("[crm-send-message] Sending to OpenBot:", {
        url: OPENBOT_SEND_URL,
        instanceId: resolvedInstanceId,
        phone: phone.substring(0, 6) + "...",
        hasArquivo: !!arquivo,
        detectedMime,
        contentType: content_type || "text",
      });

      const openbotResponse = await sendOpenBotMessage({
        apiKey,
        phone,
        message: prefixedMessage,
        desativarFluxo: true,
        extra: openbotExtra,
      });

      if (!openbotResponse.ok) {
        const errorText = await openbotResponse.text();
        console.error("[crm-send-message] OpenBot error:", openbotResponse.status, errorText);

        // Friendly message for 413 (file too large)
        const friendlyError = openbotResponse.status === 413
          ? "O arquivo enviado excede o limite máximo de 16MB permitido pela API do WhatsApp. Reduza o tamanho do arquivo e tente novamente."
          : `OpenBot returned error: ${openbotResponse.status}`;

        await supabase.from("crm_webhook_events").insert({
          organization_id: organizationId,
          event_type: "outbound",
          status: "error",
          instance_id: instanceId,
          phone: loggedPhone,
          payload: { conversationId: conversation_id, messagePreview: (message || "").trim().substring(0, 50), hasArquivo: !!arquivo },
          error_message: friendlyError,
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ error: friendlyError, details: errorText }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      openbotResult = await openbotResponse.json();
      console.log("[crm-send-message] OpenBot response:", openbotResult);
    }

    // Determine content for local message - preserve file name if present
    // Determine content for local message - preserve file name if present
    // For local CRM display: use friendly label when no text was provided
    const messageContent = message?.trim() || 
      (resolvedContentType === "audio" ? "🎵 Áudio" : 
       resolvedContentType === "image" ? "📷 Imagem" :
       resolvedContentType === "video" ? "🎥 Vídeo" :
       resolvedContentType === "document" && file_name ? `📄 ${file_name}` :
       resolvedContentType === "document" ? "📄 Documento" : "");

    // senderName already resolved above

    // Insert message locally
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        organization_id: organizationId,
        content: messageContent,
        content_type: resolvedContentType,
        direction: "outbound",
        sender_type: "attendant",
        sender_name: senderName,
        status: "sent",
        timestamp: new Date().toISOString(),
        openbot_message_id: openbotResult.messageId || null,
        media_url: permanentMediaUrl || (resolvedContentType !== "audio" ? arquivo : null) || null,
        media_mime_type: resolvedContentType === "audio" ? detectedMime : (resolvedContentType !== "text" ? resolvedContentType : null),
      })
      .select()
      .single();

    if (msgError) {
      console.error("[crm-send-message] Error inserting message:", msgError);
    }

    // Update conversation preview
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: generateMessagePreview(resolvedContentType, (message || "").trim()),
        last_sender_type: "attendant",
        unread_count: 0,
      })
      .eq("id", conversation_id);

    // Update contact last interaction
    await supabase
      .from("contacts")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", conversation.contact?.id);

    // Log success
    await supabase.from("crm_webhook_events").insert({
      organization_id: organizationId,
      event_type: "outbound",
      status: "success",
      instance_id: instanceId,
      phone: loggedPhone,
      payload: {
        conversationId: conversation_id,
        messagePreview: (message || "").trim().substring(0, 50),
        hasArquivo: !!arquivo,
        contentType: resolvedContentType,
      },
      response: {
        messageId: newMessage?.id || null,
        openbotMessageId: openbotResult.messageId || null,
      },
      processing_time_ms: Date.now() - startTime,
    });

    console.log("[crm-send-message] Message sent successfully:", newMessage?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: newMessage || { content: message?.trim() || "" },
        openbot: openbotResult
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[crm-send-message] error:", error, getErrorMessage(error));

    if (loggedOrganizationId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from("crm_webhook_events").insert({
          organization_id: loggedOrganizationId,
          event_type: "outbound",
          status: "error",
          instance_id: loggedInstanceId,
          phone: loggedPhone,
          payload: { error: "processing_failed" },
          error_message: getErrorMessage(error).slice(0, 500),
          processing_time_ms: Date.now() - startTime,
        });
      } catch (logError) {
        console.error("[crm-send-message] Failed to log error event:", logError);
      }
    }

    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
