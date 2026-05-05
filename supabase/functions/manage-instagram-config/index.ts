import { createClient } from "npm:@supabase/supabase-js@2";
import { encrypt, decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

// Mapeamento de erros da Meta para mensagens amigáveis em PT-BR
function translateMetaError(errorMessage: string): string {
  const msg = (errorMessage || "").toLowerCase();

  if (msg.includes("cannot get application info"))
    return "O App ID informado é do tipo 'Instagram Login for Business' e não pode ser validado pelo endpoint padrão da Meta. Isso é normal — as credenciais serão verificadas ao conectar uma conta.";
  if (msg.includes("error validating client secret"))
    return "O App Secret informado está incorreto. Verifique o valor em Configurações → Básico no painel da Meta.";
  if (msg.includes("invalid oauth access token"))
    return "O token de acesso gerado é inválido. Verifique se o App ID e App Secret correspondem ao mesmo aplicativo.";
  if (msg.includes("application does not have"))
    return "O aplicativo não possui as permissões necessárias. Verifique se o app está configurado corretamente no painel da Meta.";
  if (msg.includes("app not setup") || msg.includes("app is not set up"))
    return "O aplicativo ainda não está configurado. Complete a configuração no painel da Meta.";
  if (msg.includes("session has expired"))
    return "A sessão expirou. Tente novamente.";

  // Fallback genérico
  return "Não foi possível validar as credenciais junto à Meta. Verifique se o App ID e o App Secret estão corretos.";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const { action } = body;

    // Support admin impersonation
    const impersonateOrgId = body.impersonate_org_id || null;
    let organizationId: string;

    if (impersonateOrgId) {
      const { data: roleRow } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin_master")
        .maybeSingle();

      if (!roleRow) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão para acessar esta organização" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      organizationId = impersonateOrgId;
      console.log(`[manage-instagram-config] [impersonation] admin ${userId} impersonating org ${impersonateOrgId}`);
    } else {
      const { data: ownedOrg } = await adminClient
        .from("organizations")
        .select("id")
        .eq("owner_user_id", userId)
        .limit(1)
        .maybeSingle();

      if (ownedOrg) {
        organizationId = ownedOrg.id;
      } else {
        const { data: orgMember } = await adminClient
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (!orgMember) {
          return new Response(
            JSON.stringify({ success: false, error: "Organização não encontrada. Verifique se você pertence a uma organização." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        organizationId = orgMember.organization_id;
      }
    }

    console.log(`[manage-instagram-config] Action: ${action}, Org: ${organizationId}`);

    switch (action) {
      case "get": {
        const { data } = await adminClient
          .from("instagram_app_config")
          .select("app_id, app_secret_masked, webhook_verify_token, is_configured, redirect_uri, embedded_login_url, updated_at")
          .eq("organization_id", organizationId)
          .maybeSingle();

        const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth`;
        const webhookUrl = `${supabaseUrl}/functions/v1/instagram-webhooks`;
        const deauthorizationCallbackUrl = `${supabaseUrl}/functions/v1/instagram-oauth?action=deauthorize`;
        const dataDeletionUrl = `${supabaseUrl}/functions/v1/instagram-oauth?action=data-deletion`;

        return new Response(
          JSON.stringify({
            success: true,
            data: data || {
              app_id: null,
              app_secret_masked: null,
              webhook_verify_token: null,
              is_configured: false,
              embedded_login_url: null,
            },
            redirect_uri: redirectUri,
            webhook_url: webhookUrl,
            deauthorization_callback_url: deauthorizationCallbackUrl,
            data_deletion_url: dataDeletionUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "save": {
        const { appId, appSecret, webhookVerifyToken, embeddedLoginUrl } = body;

        if (!appId || typeof appId !== "string" || appId.trim().length < 5) {
          return new Response(
            JSON.stringify({ success: false, error: "App ID inválido. Informe o ID do aplicativo Instagram (mínimo 5 caracteres)." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const keepExistingSecret = appSecret === "__keep__";

        if (!keepExistingSecret && (!appSecret || typeof appSecret !== "string" || appSecret.trim().length < 10)) {
          return new Response(
            JSON.stringify({ success: false, error: "App Secret inválido. O valor deve ter pelo menos 10 caracteres." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Build upsert data
        const upsertData: Record<string, unknown> = {
          organization_id: organizationId,
          app_id: appId.trim(),
          webhook_verify_token: webhookVerifyToken?.trim() || null,
          embedded_login_url: embeddedLoginUrl?.trim() || null,
          is_configured: true,
          redirect_uri: `${supabaseUrl}/functions/v1/instagram-oauth`,
          updated_at: new Date().toISOString(),
        };

        let masked: string | undefined;
        if (!keepExistingSecret) {
          const trimmedSecret = appSecret.trim();
          upsertData.app_secret_encrypted = await encrypt(trimmedSecret);
          masked = "••••••••" + trimmedSecret.slice(-4);
          upsertData.app_secret_masked = masked;
        }
        const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth`;

        const { error: upsertError } = await adminClient
          .from("instagram_app_config")
          .upsert(upsertData, { onConflict: "organization_id" });

        if (upsertError) {
          console.error("[manage-instagram-config] Upsert error:", upsertError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao salvar configuração. Tente novamente." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Configuração do Instagram salva com sucesso",
            ...(masked ? { masked_secret: masked } : {}),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "remove": {
        const { error: deleteError } = await adminClient
          .from("instagram_app_config")
          .delete()
          .eq("organization_id", organizationId);

        if (deleteError) {
          console.error("[manage-instagram-config] Delete error:", deleteError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao remover configuração. Tente novamente." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Configuração removida com sucesso" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "test": {
        const { data: configRow } = await adminClient
          .from("instagram_app_config")
          .select("app_id, app_secret_encrypted, is_configured")
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (!configRow || !configRow.is_configured || !configRow.app_id || !configRow.app_secret_encrypted) {
          return new Response(
            JSON.stringify({ success: false, error: "Credenciais não configuradas. Salve o App ID e App Secret primeiro." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const appSecret = await decrypt(configRow.app_secret_encrypted);
          console.log("[manage-instagram-config] Testing credentials for app_id:", configRow.app_id, "secret length:", appSecret.length);

          // Try Facebook Graph API (works for standard FB app IDs)
          const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${configRow.app_id}&client_secret=${appSecret}&grant_type=client_credentials`;
          const tokenRes = await fetch(tokenUrl);
          const tokenData = await tokenRes.json();

          if (tokenData.access_token) {
            return new Response(
              JSON.stringify({
                success: true,
                message: "Credenciais válidas! O App ID e App Secret estão corretos.",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (tokenData.error) {
            const metaErrorMsg = tokenData.error.message || "";
            console.log("[manage-instagram-config] FB Graph test result:", metaErrorMsg);

            // For Instagram Login for Business apps, the Instagram App ID ≠ Facebook App ID
            // The graph.facebook.com endpoint won't recognize Instagram App IDs
            // This is EXPECTED behavior, not an error
            const isInstagramAppId = metaErrorMsg.toLowerCase().includes("cannot get application info");
            
            if (isInstagramAppId) {
              // The app_id is Instagram-specific. We can't fully validate via API,
              // but credentials are stored and will be verified during OAuth flow
              return new Response(
                JSON.stringify({
                  success: true,
                  message: "Credenciais salvas! Realize uma conexão com a conta do Instagram para validar o acesso.",
                  partial: true,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // For other errors (wrong secret, etc.), translate to PT-BR
            const friendlyMsg = translateMetaError(metaErrorMsg);
            console.error("[manage-instagram-config] Test failed:", tokenData.error);
            return new Response(
              JSON.stringify({
                success: false,
                error: friendlyMsg,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ success: false, error: "Resposta inesperada da Meta. Verifique as credenciais e tente novamente." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (testErr) {
          console.error("[manage-instagram-config] Test error:", testErr);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao conectar com a Meta. Verifique sua conexão e tente novamente." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Ação inválida. Ações disponíveis: get, save, remove, test" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("[manage-instagram-config] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno. Tente novamente." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
