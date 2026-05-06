import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt, encrypt } from "../_shared/encryption.ts";
import { interpolateTemplate } from "../_shared/templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const VALID_EVENTS = [
  "signup_free", "free_plan_expiring", "upgrade_free_to_paid", "plan_change",
  "payment_received", "cancel_refund", "cancel_unpaid",
  "affiliate_signup_request", "affiliate_new_referral", "affiliate_payout_request",
];

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { event_type, variables = {}, test, action, key } = body;

    // Guard sensitive admin actions: require admin_master JWT
    const SENSITIVE_ACTIONS = new Set(["store_key", "reveal_key"]);
    if (action && SENSITIVE_ACTIONS.has(action)) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) {
          console.error("admin-notify auth failed:", userErr?.message);
          return new Response(JSON.stringify({ error: "unauthorized", detail: userErr?.message }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: isAdmin, error: roleErr } = await userClient.rpc("is_admin_master");
        if (roleErr || !isAdmin) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Helper action to encrypt API key/Token for admin UI
    if (action === "store_key" && typeof key === "string" && key.length > 0) {
      try {
        const encrypted = await encrypt(key);
        return new Response(JSON.stringify({ encrypted }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "encrypt_failed", detail: e?.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Helper action to reveal stored token for admin UI (admin-only via service role)
    if (action === "reveal_key") {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: cfg } = await supabaseAdmin
          .from("admin_notification_config")
          .select("openbot_token_encrypted")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cfg?.openbot_token_encrypted) {
          return new Response(JSON.stringify({ token: "" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const token = await decrypt(cfg.openbot_token_encrypted);
        return new Response(JSON.stringify({ token }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "reveal_failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Send execution guard: trusted internal callers only.
    //  1) x-cron-secret header == CRON_SECRET (DB triggers via notify_admin_async)
    //  2) Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (server-to-server)
    //  3) admin_master JWT (UI test/manual send)
    {
      const cronHeader = req.headers.get("x-cron-secret") || "";
      const cronSecret = Deno.env.get("CRON_SECRET") || "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const authHeader = req.headers.get("Authorization") || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

      const cronOk = !!cronSecret && cronHeader === cronSecret;
      const serviceOk = !!serviceRoleKey && bearer === serviceRoleKey;

      let adminOk = false;
      if (!cronOk && !serviceOk && authHeader.startsWith("Bearer ")) {
        try {
          const userClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } },
          );
          const { data: userData } = await userClient.auth.getUser();
          if (userData?.user) {
            const { data: isAdmin } = await userClient.rpc("is_admin_master");
            adminOk = !!isAdmin;
          }
        } catch (e) {
          console.error("admin-notify send-guard auth check failed:", (e as any)?.message);
        }
      }

      if (!cronOk && !serviceOk && !adminOk) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!event_type || !VALID_EVENTS.includes(event_type)) {
      return new Response(JSON.stringify({ error: "invalid_event_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rule } = await supabase
      .from("admin_notification_rules")
      .select("enabled, template_id")
      .eq("event_type", event_type)
      .maybeSingle();

    if (!rule?.enabled && !test) {
      return new Response(JSON.stringify({ skipped: true, reason: "rule_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateId = rule?.template_id;
    let template: any = null;
    if (templateId) {
      const { data } = await supabase
        .from("admin_notification_templates")
        .select("*")
        .eq("id", templateId)
        .maybeSingle();
      template = data;
    }

    if (!template?.body) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_template" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recipients } = await supabase
      .from("admin_notification_recipients")
      .select("name, phone, enabled")
      .eq("enabled", true);

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OpenBot config
    const { data: config } = await supabase
      .from("admin_notification_config")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!config?.openbot_base_url || !config?.openbot_token_encrypted) {
      // Não é erro: admin ainda não configurou o canal de notificações.
      // Retorna 200 para não quebrar triggers (signup, trial expiration, etc).
      return new Response(JSON.stringify({ skipped: true, reason: "openbot_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bearerToken = "";
    try {
      bearerToken = await decrypt(config.openbot_token_encrypted);
    } catch {
      console.error("admin-notify: decrypt failed");
      return new Response(JSON.stringify({ skipped: true, reason: "decrypt_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rendered = interpolateTemplate(template.body, {
      ...variables,
      date: variables.date || new Date().toLocaleString("pt-BR"),
    }, "curly");

    // The configured URL IS the final endpoint (e.g. https://api.digitalbotia.com.br/sendWebhook)
    const sendUrl = config.openbot_base_url.trim();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const results: any[] = [];
    for (const r of recipients) {
      const phone = normalizePhone(r.phone);
      try {
        const resp = await fetch(sendUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            apiKey: bearerToken,
            phone,
            message: rendered,
          }),
        });
        const ok = resp.ok;
        const respText = await resp.text().catch(() => "");

        await supabase.from("admin_notification_logs").insert({
          event_type, recipient_phone: phone, recipient_name: r.name,
          rendered_body: rendered, status: ok ? "sent" : "failed",
          error_message: ok ? null : `HTTP ${resp.status}: ${respText.slice(0, 300)}`,
          payload: { variables, response: respText.slice(0, 500) },
        });
        results.push({ phone, ok, response: respText.slice(0, 200) });
      } catch (e: any) {
        await supabase.from("admin_notification_logs").insert({
          event_type, recipient_phone: phone, recipient_name: r.name,
          rendered_body: rendered, status: "failed",
          error_message: e?.message?.slice(0, 300) || "unknown_error",
          payload: { variables },
        });
        results.push({ phone, ok: false, error: e?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-notify error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
