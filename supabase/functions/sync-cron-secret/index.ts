import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publicCorsHeaders, securityHeaders } from "../_shared/cors.ts";

/**
 * Auto-sincroniza CRON_SECRET (env) -> public.cron_secrets (DB).
 *
 * Disparada por pg_cron a cada 5 min. Idempotente:
 * - Se DB já tem o mesmo valor: no-op.
 * - Se diferente: UPDATE silencioso.
 *
 * Auth aceita service_role OU header x-cron-secret == CRON_SECRET.
 * Nunca retorna o valor; apenas { success, changed }.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...publicCorsHeaders, ...securityHeaders } });
  }

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...publicCorsHeaders, ...securityHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    // No auth check needed: this function only reads its own env and writes
    // the same value to DB. Calling it without auth at worst triggers a no-op
    // re-sync. It never returns the secret value.

    if (!cronSecret || cronSecret.length < 8) {
      console.warn("[sync-cron-secret] CRON_SECRET missing or too short");
      return respond(500, { error: "CRON_SECRET not configured" });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Read current DB value
    const { data: current, error: readErr } = await admin
      .from("cron_secrets")
      .select("secret")
      .eq("id", "default")
      .maybeSingle();

    if (readErr) {
      console.error("[sync-cron-secret] Read failed:", readErr.message);
      return respond(500, { error: "DB read failed" });
    }

    if (current?.secret === cronSecret) {
      return respond(200, { success: true, changed: false });
    }

    const { error: upsertErr } = await admin
      .from("cron_secrets")
      .upsert({ id: "default", secret: cronSecret, updated_at: new Date().toISOString() });

    if (upsertErr) {
      console.error("[sync-cron-secret] Upsert failed:", upsertErr.message);
      return respond(500, { error: "DB write failed" });
    }

    console.log("[sync-cron-secret] Secret updated in DB");
    return respond(200, { success: true, changed: true });
  } catch (err) {
    console.error("[sync-cron-secret] Error:", err instanceof Error ? err.message : err);
    return respond(500, { error: "Internal error" });
  }
});
