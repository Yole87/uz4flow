/**
 * Instagram OAuth Edge Function
 * 
 * Manages the Instagram Login OAuth flow (new API).
 * Supports 4 actions via query param `action`:
 *   - start: Redirects user to Instagram Login
 *   - callback: Exchanges code for tokens, stores in instagram_accounts
 *   - refresh: Renews long-lived token
 *   - disconnect: Revokes token and marks account as revoked
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { encrypt, decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

const GRAPH_API_VERSION = "v25.0";

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

// ─── Helpers ────────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getLongTokenErrorReason(errorData: any) {
  const message = String(errorData?.error?.message || "").toLowerCase();

  if (
    message.includes("unsupported request - method type: get") ||
    message.includes("unsupported request - method type: post")
  ) {
    return "app_access_limited";
  }

  return "long_token_failed";
}

/**
 * Maps the Meta token exchange error response to a specific, actionable reason code.
 */
function getTokenExchangeErrorReason(errorData: any): string {
  const msg = String(errorData?.error_message || errorData?.error?.message || "").toLowerCase();
  const errorType = String(errorData?.error_type || errorData?.error?.type || "").toLowerCase();
  const code = errorData?.code || errorData?.error?.code;

  console.log("[IG-OAuth] Token exchange error details:", {
    error_message: errorData?.error_message,
    error_type: errorData?.error_type,
    code,
    full_error: JSON.stringify(errorData),
  });

  // Invalid redirect_uri
  if (msg.includes("redirect_uri") || msg.includes("redirect uri") || msg.includes("url blocked")) {
    return "redirect_uri_mismatch";
  }

  // Invalid client_secret / app secret
  if (msg.includes("client_secret") || msg.includes("app secret") || msg.includes("invalid appsecret")) {
    return "invalid_app_secret";
  }

  // Code already used or expired
  if (msg.includes("code has already been used") || msg.includes("code was invalid") || msg.includes("expired")) {
    return "code_expired_or_reused";
  }

  // Invalid client_id / app_id mismatch
  if (msg.includes("client_id") || msg.includes("invalid app") || msg.includes("invalid client")) {
    return "invalid_app_id";
  }

  // OAuthException generic
  if (errorType.includes("oauthexception")) {
    return "oauth_exception";
  }

  return "token_exchange_failed";
}

async function authenticateUser(req: Request, supabaseUrl: string, serviceRoleKey: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseUser.auth.getUser(token);
  if (error || !user) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: orgId } = await supabase.rpc("get_user_organization_id", { _user_id: user.id });
  if (!orgId) return null;

  return { userId: user.id, orgId, supabase };
}

// ─── Main Handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  const url = new URL(req.url);
  // Auto-detect callback when Meta redirects with code/state but no action param
  const hasCode = url.searchParams.has("code") || url.searchParams.has("error");
  const action = url.searchParams.get("action") || (hasCode ? "callback" : null);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://uz4flow.lovable.app";

  // Read org-specific credentials from DB, with fallback to env vars
  let appId = Deno.env.get("INSTAGRAM_APP_ID") || "";
  let appSecret = Deno.env.get("INSTAGRAM_APP_SECRET") || "";

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Resolve org-specific credentials when organization_id is available
  async function resolveOrgCredentials(organizationId: string): Promise<boolean> {
    try {
      const { data: orgConfig } = await adminClient
        .from("instagram_app_config")
        .select("app_id, app_secret_encrypted, is_configured")
        .eq("organization_id", organizationId)
        .eq("is_configured", true)
        .maybeSingle();

      if (orgConfig?.app_id && orgConfig?.app_secret_encrypted) {
        appId = orgConfig.app_id;
        appSecret = await decrypt(orgConfig.app_secret_encrypted);
        return true;
      }
    } catch (e) {
      console.warn("[IG-OAuth] Failed to load org config, using fallback:", e);
    }
    return false;
  }

  try {
    // ─── ACTION: START ───────────────────────────────────────
    if (action === "start" && req.method === "GET") {
      const organizationId = url.searchParams.get("organization_id");
      if (organizationId) await resolveOrgCredentials(organizationId);
      if (!appId || !appSecret) {
        return jsonResponse({ error: "O aplicativo Instagram não está configurado para esta organização. Configure as credenciais primeiro." }, 400);
      }
      return handleStart(url, appId, supabaseUrl, frontendUrl);
    }

    // ─── ACTION: CALLBACK ────────────────────────────────────
    if (action === "callback" && req.method === "GET") {
      const stateParam = url.searchParams.get("state");
      if (stateParam) {
        try {
          const stateData = JSON.parse(atob(stateParam));
          if (stateData.org_id) await resolveOrgCredentials(stateData.org_id);
        } catch { /* will use fallback */ }
      }
      if (!appId || !appSecret) {
        return Response.redirect(`${frontendUrl}/instagram?ig_oauth=error&reason=credenciais_nao_encontradas`, 302);
      }
      return await handleCallback(url, appId, appSecret, supabaseUrl, serviceRoleKey, frontendUrl);
    }

    // ─── ACTION: REFRESH (POST, authenticated) ───────────────
    if (action === "refresh" && req.method === "POST") {
      return await handleRefresh(req, appSecret, supabaseUrl, serviceRoleKey);
    }

    // ─── ACTION: DISCONNECT (POST, authenticated) ────────────
    if (action === "disconnect" && req.method === "POST") {
      return await handleDisconnect(req, supabaseUrl, serviceRoleKey);
    }

    // ─── ACTION: DEAUTHORIZE (POST from Meta) ──────────────────
    if (action === "deauthorize") {
      console.log("[IG-OAuth] Deauthorization callback received");
      return jsonResponse({ success: true, message: "Desautorização recebida" });
    }

    // ─── ACTION: DATA-DELETION (POST from Meta) ─────────────────
    if (action === "data-deletion") {
      console.log("[IG-OAuth] Data deletion request received");
      const confirmationCode = crypto.randomUUID();
      return jsonResponse({
        url: `${frontendUrl}/instagram?data_deletion=${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
    }

    return jsonResponse({ error: "Ação inválida. Ações disponíveis: start, callback, refresh, disconnect, deauthorize, data-deletion" }, 400);
  } catch (err) {
    console.error("[IG-OAuth] Error:", err);
    return jsonResponse({ error: "Erro interno. Tente novamente." }, 500);
  }
});

// ─── ACTION HANDLERS ────────────────────────────────────────

function handleStart(url: URL, appId: string, supabaseUrl: string, frontendUrl: string) {
  const organizationId = url.searchParams.get("organization_id");
  const redirectUrl = url.searchParams.get("redirect_url") || `${frontendUrl}/instagram`;

  if (!organizationId) {
    return jsonResponse({ error: "organization_id is required" }, 400);
  }

  const state = btoa(JSON.stringify({ org_id: organizationId, redirect_url: redirectUrl }));
  const callbackUrl = `${supabaseUrl}/functions/v1/instagram-oauth`;

  // New Instagram Login endpoint
  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("enable_fb_login", "0");
  authUrl.searchParams.set("force_authentication", "1");

  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(
  url: URL, appId: string, appSecret: string,
  supabaseUrl: string, serviceRoleKey: string, frontendUrl: string,
) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("[IG-OAuth] Meta returned error:", error);
    return Response.redirect(`${frontendUrl}/instagram?ig_oauth=error&reason=${encodeURIComponent(error)}`, 302);
  }

  if (!code) {
    return Response.redirect(`${frontendUrl}/instagram?ig_oauth=error&reason=codigo_ausente`, 302);
  }

  let organizationId: string | null = null;
  let redirectUrl = `${frontendUrl}/instagram`;

  if (state) {
    try {
      const stateData = JSON.parse(atob(state));
      organizationId = stateData.org_id;
      if (stateData.redirect_url) redirectUrl = stateData.redirect_url;
    } catch {
      console.warn("[IG-OAuth] Failed to parse state, will try to resolve org from config");
    }
  }

  // If no org from state, try to find the single org that has instagram configured
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  if (!organizationId) {
    const { data: configs } = await adminClient
      .from("instagram_app_config")
      .select("organization_id, app_id")
      .eq("is_configured", true)
      .eq("app_id", appId);
    
    if (configs && configs.length === 1) {
      organizationId = configs[0].organization_id;
      console.log("[IG-OAuth] Resolved org from app_id match:", organizationId);
    } else {
      console.error("[IG-OAuth] Could not resolve organization - no state and no unique config match");
      return Response.redirect(`${redirectUrl}?ig_oauth=error&reason=organizacao_nao_identificada`, 302);
    }
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/instagram-oauth`;

  // Log the exact parameters being used for token exchange (without secrets)
  console.log("[IG-OAuth] Token exchange attempt:", {
    app_id: appId,
    redirect_uri: callbackUrl,
    code_length: code?.length,
    org_id: organizationId,
  });

  // 1. Exchange code for short-lived token (POST form-urlencoded)
  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
      code,
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    const reason = getTokenExchangeErrorReason(tokenData);
    console.error("[IG-OAuth] Token exchange failed:", {
      status: tokenRes.status,
      reason,
      redirect_uri_used: callbackUrl,
      app_id_used: appId,
      response: JSON.stringify(tokenData),
    });
    return Response.redirect(`${redirectUrl}?ig_oauth=error&reason=${reason}`, 302);
  }

  const shortLivedToken = tokenData.access_token;

  // 2. Exchange for long-lived token (60 days) via ig_exchange_token
  const longTokenParams = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortLivedToken,
  });

  const endpoint = `https://graph.instagram.com/access_token?${longTokenParams}`;
  console.log("[IG-OAuth] Trying long-lived token exchange:", endpoint.replace(/access_token=[^&]+/g, "access_token=***").replace(/client_secret=[^&]+/g, "client_secret=***"));

  const longTokenRes = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const longTokenData = await longTokenRes.json();

  if (!longTokenRes.ok || !longTokenData.access_token) {
    console.error("[IG-OAuth] Long-lived token exchange failed:", longTokenData);
    return Response.redirect(`${redirectUrl}?ig_oauth=error&reason=${getLongTokenErrorReason(longTokenData)}`, 302);
  }

  const accessToken = longTokenData.access_token;
  const expiresIn = longTokenData.expires_in || 5184000;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // 3. Get IG profile info directly (no Pages needed)
  const igProfileRes = await fetch(
    `https://graph.instagram.com/${GRAPH_API_VERSION}/me?fields=user_id,username,profile_picture_url&access_token=${accessToken}`
  );
  const igProfile = await igProfileRes.json();

  if (!igProfileRes.ok || !igProfile.user_id) {
    console.error("[IG-OAuth] Profile fetch failed:", igProfile);
    return Response.redirect(`${redirectUrl}?ig_oauth=error&reason=profile_fetch_failed`, 302);
  }

  const igUserId = igProfile.user_id;

  // 4. Encrypt token and store
  const encryptedToken = await encrypt(accessToken);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const accountData = {
    organization_id: organizationId,
    ig_user_id: igUserId,
    page_id: igUserId, // No page_id in new flow, use ig_user_id as placeholder
    access_token_encrypted: encryptedToken,
    token_expires_at: tokenExpiresAt,
    token_status: "active",
    username: igProfile.username || null,
    profile_picture_url: igProfile.profile_picture_url || null,
    scopes: SCOPES,
    updated_at: new Date().toISOString(),
  };

  // Upsert by org + ig_user_id
  const { data: existing } = await supabase
    .from("instagram_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("ig_user_id", igUserId)
    .maybeSingle();

  if (existing) {
    const { error: updateErr } = await supabase
      .from("instagram_accounts")
      .update(accountData)
      .eq("id", existing.id);
    if (updateErr) throw updateErr;
    console.log("[IG-OAuth] Updated existing account:", existing.id);
  } else {
    const { error: insertErr } = await supabase
      .from("instagram_accounts")
      .insert(accountData);
    if (insertErr) throw insertErr;
    console.log("[IG-OAuth] Created new account for org:", organizationId);
  }

  return Response.redirect(`${redirectUrl}?ig_oauth=success`, 302);
}

async function handleRefresh(req: Request, appSecret: string, supabaseUrl: string, serviceRoleKey: string) {
  const auth = await authenticateUser(req, supabaseUrl, serviceRoleKey);
  if (!auth) return jsonResponse({ error: "Não autorizado. Faça login novamente." }, 401);

  const body = await req.json();
  const accountId = body.account_id;
  if (!accountId) return jsonResponse({ error: "ID da conta é obrigatório" }, 400);

  const { data: account, error: accErr } = await auth.supabase
    .from("instagram_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("organization_id", auth.orgId)
    .single();

  if (accErr || !account) return jsonResponse({ error: "Conta não encontrada" }, 404);

  const currentToken = await decrypt(account.access_token_encrypted);

  // New Instagram refresh endpoint
  const refreshRes = await fetch(
    `https://graph.instagram.com/refresh_access_token?` + new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: currentToken,
    })
  );
  const refreshData = await refreshRes.json();

  if (!refreshRes.ok || !refreshData.access_token) {
    console.error("[IG-OAuth] Token refresh failed:", refreshData);
    return jsonResponse({ error: "Falha ao renovar o token. O token pode ter expirado — reconecte a conta." }, 502);
  }

  const newEncrypted = await encrypt(refreshData.access_token);
  const newExpiry = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000).toISOString();

  await auth.supabase.from("instagram_accounts").update({
    access_token_encrypted: newEncrypted,
    token_expires_at: newExpiry,
    token_status: "active",
    updated_at: new Date().toISOString(),
  }).eq("id", accountId);

  return jsonResponse({ success: true, expires_at: newExpiry });
}

async function handleDisconnect(req: Request, supabaseUrl: string, serviceRoleKey: string) {
  const auth = await authenticateUser(req, supabaseUrl, serviceRoleKey);
  if (!auth) return jsonResponse({ error: "Não autorizado. Faça login novamente." }, 401);

  const body = await req.json();
  const accountId = body.account_id;

  const { data: account, error: accErr } = await auth.supabase
    .from("instagram_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("organization_id", auth.orgId)
    .single();

  if (accErr || !account) return jsonResponse({ error: "Conta não encontrada" }, 404);

  // Try to revoke token at Meta (best effort)
  try {
    const currentToken = await decrypt(account.access_token_encrypted);
    await fetch(`https://graph.instagram.com/${GRAPH_API_VERSION}/me/permissions?access_token=${currentToken}`, {
      method: "DELETE",
    });
    console.log("[IG-OAuth] Token revoked at Meta");
  } catch (e) {
    console.warn("[IG-OAuth] Failed to revoke token at Meta:", e);
  }

  // Delete related records and the account itself
  await auth.supabase.from("instagram_account_instances").delete().eq("account_id", accountId);
  await auth.supabase.from("instagram_accounts").delete().eq("id", accountId);

  return jsonResponse({ success: true });
}
