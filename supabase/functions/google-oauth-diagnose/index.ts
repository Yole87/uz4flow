/**
 * Google OAuth Diagnostic Endpoint
 * 
 * Validates OAuth configuration for Google Calendar.
 * Checks: Client ID presence/format, Client Secret, redirect URI, Google reachability.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checks: { name: string; ok: boolean; detail: string }[] = [];

    // --- Check GOOGLE_CLIENT_ID (primary) then GOOGLE_CALENDAR_CLIENT_ID (override) ---
    const sharedClientIdRaw = Deno.env.get("GOOGLE_CLIENT_ID");
    const sharedClientId = sharedClientIdRaw?.trim();
    const calClientIdRaw = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
    const calClientId = calClientIdRaw?.trim();
    const effectiveClientId = calClientId || sharedClientId;
    const clientIdSource = calClientId ? "GOOGLE_CALENDAR_CLIENT_ID" : (sharedClientId ? "GOOGLE_CLIENT_ID (fallback)" : "NENHUM");

    checks.push({
      name: "Client ID efetivo",
      ok: !!effectiveClientId && effectiveClientId.length > 10,
      detail: effectiveClientId
        ? `Usando ${clientIdSource} (${effectiveClientId.substring(0, 15)}..., ${effectiveClientId.length} chars)`
        : "NÃO configurado (nem GOOGLE_CLIENT_ID nem GOOGLE_CALENDAR_CLIENT_ID)",
    });

    // Check format
    const validFormat = effectiveClientId?.endsWith(".apps.googleusercontent.com") ?? false;
    checks.push({
      name: "Formato Client ID",
      ok: validFormat,
      detail: validFormat
        ? "Formato correto (termina com .apps.googleusercontent.com)"
        : `Formato inválido. Valor termina com: ...${effectiveClientId?.slice(-30) || "N/A"}`,
    });

    // Check for whitespace issues
    const hasWhitespace = (sharedClientIdRaw !== sharedClientId) || (!sharedClientId && calClientIdRaw !== calClientId);
    checks.push({
      name: "Whitespace no Client ID",
      ok: !hasWhitespace,
      detail: hasWhitespace
        ? `ALERTA: Client ID contém espaços extras (raw length: ${(sharedClientIdRaw || calClientIdRaw)?.length}, trimmed: ${effectiveClientId?.length})`
        : "Sem whitespace detectado",
    });

    // --- Check Client Secret (same priority: shared first) ---
    const sharedSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
    const calSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")?.trim();
    const effectiveSecret = calSecret || sharedSecret;

    checks.push({
      name: "Client Secret efetivo",
      ok: !!effectiveSecret && effectiveSecret.length > 5,
      detail: effectiveSecret
        ? `Configurado via ${calSecret ? "GOOGLE_CALENDAR_CLIENT_SECRET" : "GOOGLE_CLIENT_SECRET (fallback)"} (${effectiveSecret.length} chars)` 
        : "NÃO configurado",
    });

    // --- Redirect URI ---
    const redirectUri = `${supabaseUrl}/functions/v1/gdrive-oauth-callback`;
    checks.push({
      name: "Redirect URI",
      ok: true,
      detail: redirectUri,
    });

    // --- Google reachability ---
    let googleReachable = false;
    try {
      const resp = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=test");
      googleReachable = resp.status === 400 || resp.status === 200;
      await resp.text(); // consume body
    } catch {
      googleReachable = false;
    }
    checks.push({
      name: "Google OAuth reachável",
      ok: googleReachable,
      detail: googleReachable ? "Google APIs acessível" : "Não foi possível alcançar Google APIs",
    });

    // --- Try to validate client_id via Google's auth endpoint ---
    let clientIdValid = false;
    if (effectiveClientId) {
      try {
        const testUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        testUrl.searchParams.set("client_id", effectiveClientId);
        testUrl.searchParams.set("redirect_uri", redirectUri);
        testUrl.searchParams.set("response_type", "code");
        testUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
        
        const testResp = await fetch(testUrl.toString(), { method: "GET", redirect: "manual" });
        // A valid client_id returns 302 redirect to consent screen
        // An invalid one returns 400 or shows error page (200 with error)
        clientIdValid = testResp.status === 302 || testResp.status === 200;
        try { await testResp.text(); } catch { /* consume */ }
      } catch {
        clientIdValid = false;
      }
    }
    checks.push({
      name: "Client ID aceito pelo Google",
      ok: clientIdValid,
      detail: clientIdValid
        ? "Google aceitou o client_id (redirecionou para consent screen)"
        : "Google rejeitou ou não respondeu para o client_id fornecido",
    });

    const allOk = checks.every((c) => c.ok);

    return new Response(
      JSON.stringify({
        status: allOk ? "ok" : "issues_found",
        checks,
        effective_client_id_source: clientIdSource,
        redirect_uri: redirectUri,
        hint: allOk
          ? "Configuração parece correta. Se o 403 persistir: 1) Tela de consentimento OAuth (External + test users), 2) Google Calendar API habilitada, 3) Redirect URI exata no Google Cloud Console."
          : "Corrija os itens acima antes de tentar conectar.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[OAuth-Diagnose] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
