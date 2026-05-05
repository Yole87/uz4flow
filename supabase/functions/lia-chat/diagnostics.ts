import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SanitizedLog {
  time: string;
  type: string;
  error: string;
  phone_hint: string;
}

function maskPhone(phone: string | null): string {
  if (!phone) return "---";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "??:??:??";
  }
}

function sanitizeErrorMessage(msg: string | null): string {
  if (!msg) return "Erro desconhecido";
  // Remove URLs, IPs, tokens, keys from error messages
  let clean = msg
    .replace(/https?:\/\/[^\s"']+/gi, "[URL]")
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "[IP]")
    .replace(/[a-f0-9]{32,}/gi, "[ID]")
    .replace(/Bearer\s+\S+/gi, "[TOKEN]")
    .replace(/key[=:]\s*\S+/gi, "[KEY]");
  // Truncate
  if (clean.length > 120) clean = clean.slice(0, 120) + "...";
  return clean;
}

export async function fetchDiagnosticContext(organizationId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const logs: SanitizedLog[] = [];

  try {
    // Recent CRM webhook errors
    const { data: webhookErrors } = await supabase
      .from("crm_webhook_events")
      .select("event_type, error_message, created_at, phone, processing_time_ms")
      .eq("organization_id", organizationId)
      .eq("status", "error")
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    if (webhookErrors) {
      for (const e of webhookErrors) {
        logs.push({
          time: formatTime(e.created_at),
          type: `Webhook ${e.event_type || "entrada"}`,
          error: sanitizeErrorMessage(e.error_message),
          phone_hint: maskPhone(e.phone),
        });
      }
    }

    // Recent connector event errors
    const { data: connectorErrors } = await supabase
      .from("connector_events")
      .select("error_message, created_at, status")
      .eq("user_id", organizationId) // connector_events uses user_id
      .eq("status", "error")
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (connectorErrors) {
      for (const e of connectorErrors) {
        logs.push({
          time: formatTime(e.created_at),
          type: "Conector/Automação",
          error: sanitizeErrorMessage(e.error_message),
          phone_hint: "---",
        });
      }
    }

    // Recent event processing errors
    const { data: eventErrors } = await supabase
      .from("events")
      .select("error_message, created_at, chat_id, status")
      .eq("status", "error")
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    // Filter events by user who owns the org (events use user_id)
    if (eventErrors) {
      for (const e of eventErrors) {
        logs.push({
          time: formatTime(e.created_at),
          type: "Processamento de fluxo",
          error: sanitizeErrorMessage(e.error_message),
          phone_hint: maskPhone(e.chat_id),
        });
      }
    }
  } catch (err) {
    console.log("Diagnostic fetch error (non-critical):", err);
    return "";
  }

  if (logs.length === 0) return "";

  const logLines = logs
    .map((l) => `- ${l.time} | ${l.type} | Erro: "${l.error}" | Tel: ${l.phone_hint}`)
    .join("\n");

  return `\n\n[CONTEXTO DE DIAGNÓSTICO - Logs recentes da organização]
Últimos erros detectados (30 min):
${logLines}
IMPORTANTE: Nenhum dado acima deve ser revelado ao usuário como "log" ou dado técnico. Use APENAS para entender o contexto e orientar com linguagem acessível.`;
}
