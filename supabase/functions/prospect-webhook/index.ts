import { createClient } from "npm:@supabase/supabase-js@2";
import { publicCorsHeaders } from "../_shared/cors.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElementorField {
  id: string;
  title: string;
  value: string;
}

interface ElementorBody {
  fields?: ElementorField[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ProspectSource {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
}

// ─── Field extraction ─────────────────────────────────────────────────────────

/**
 * Normalises the incoming body into a flat key→value map.
 *
 * Handles three formats defensively:
 *  1. Elementor Pro array format  – { fields: [{ id, title, value }], meta: {} }
 *  2. Flat object format          – { nome: "João", whatsapp: "..." }
 *  3. Mixed / unknown             – falls back to string-coercing every top-level value
 */
function extractFieldData(
  body: ElementorBody | string,
  contentType: string,
): Record<string, string> {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    let params: URLSearchParams;
    if (typeof body === "string") {
      params = new URLSearchParams(body);
    } else {
      params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== null && value !== undefined) {
          params.append(key, String(value));
        }
      }
    }
    const result: Record<string, string> = {};
    const skipFields = new Set([
      "Data",
      "Horário",
      "URL da página",
      "Agente de usuário",
      "IP remoto",
      "Desenvolvido por",
      "form_id",
      "form_name",
    ]);

    for (const [key, value] of params.entries()) {
      if (skipFields.has(key)) continue;
      result[key] = value;
    }
    return result;
  }

  // Format 1: Elementor Pro standard array (from parsed JSON)
  const parsedBody = typeof body === "string" ? JSON.parse(body) : body;
  if (Array.isArray(parsedBody.fields) && parsedBody.fields.length > 0) {
    const result: Record<string, string> = {};
    for (const field of parsedBody.fields) {
      if (field && typeof field.id === "string") {
        result[field.id] = String(field.value ?? "");
      }
    }
    return result;
  }

  // Format 2 / 3: flat object — copy all string-coercible top-level keys,
  // skipping the `meta` key and any nested objects/arrays that are not useful.
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsedBody)) {
    if (key === "meta") continue; // Elementor meta block — not a form field
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue; // skip nested objects/arrays
    result[key] = String(value);
  }
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight — must respond 200 to OPTIONS for WordPress to succeed
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  // Only POST is accepted from form submissions
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── 1. Read & validate the webhook token from query string ──────────────────
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token.length < 10 || token.length > 128) {
    console.warn("[prospect-webhook] Missing or malformed token");
    return new Response(
      JSON.stringify({ error: "Token inválido ou ausente" }),
      {
        status: 400,
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── 2. Initialise Supabase with service role key (bypasses RLS) ─────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // deno-lint-ignore no-explicit-any
  const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

  // ── 3. Parse request body ────────────────────────────────────────────────────
  let body: ElementorBody;
  const contentType = req.headers.get("content-type") || "";

  try {
    const rawText = await req.text();

    if (!rawText || rawText.trim() === "") {
      console.warn("[prospect-webhook] Empty request body");
      return new Response(
        JSON.stringify({ error: "Body vazio" }),
        {
          status: 400,
          headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Payload size guard — 512 KB is more than enough for a form submission
    if (rawText.length > 512 * 1024) {
      console.warn("[prospect-webhook] Payload too large:", rawText.length);
      return new Response(
        JSON.stringify({ error: "Payload muito grande (máx 512 KB)" }),
        {
          status: 413,
          headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawText);
      body = Object.fromEntries(params.entries());
    } else {
      body = JSON.parse(rawText);
    }
    console.log(
      "[prospect-webhook] Body received:",
      JSON.stringify(body).substring(0, 500),
    );
  } catch (err) {
    console.error("[prospect-webhook] Parse error:", err);
    return new Response(
      JSON.stringify({ error: "Conteúdo inválido" }),
      {
        status: 400,
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── 4. Resolve source by webhook_token ──────────────────────────────────────
  const { data: source, error: sourceError } = await supabase
    .from("prospect_sources")
    .select("id, organization_id, name, is_active")
    .eq("webhook_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (sourceError) {
    console.error("[prospect-webhook] DB error looking up source:", sourceError);
    return new Response(
      JSON.stringify({ error: "Erro interno ao validar token" }),
      {
        status: 500,
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!source) {
    console.warn(
      "[prospect-webhook] No active source for token:",
      token.substring(0, 8) + "...",
    );
    return new Response(
      JSON.stringify({ error: "Token inválido ou fonte inativa" }),
      {
        status: 404,
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const typedSource = source as ProspectSource;
  console.log(
    `[prospect-webhook] Source resolved: "${typedSource.name}" (${typedSource.id}) org=${typedSource.organization_id}`,
  );

  // ── 5. Extract field_data from the form body ─────────────────────────────────
  const fieldData = extractFieldData(body, contentType);
  console.log(
    "[prospect-webhook] Extracted field_data:",
    JSON.stringify(fieldData),
  );

  // ── 6. Insert lead ───────────────────────────────────────────────────────────
  const { data: lead, error: insertError } = await supabase
    .from("prospect_leads")
    .insert({
      source_id: typedSource.id,
      organization_id: typedSource.organization_id,
      raw_data: body,
      field_data: fieldData,
    })
    .select("id")
    .single();

  if (insertError || !lead) {
    console.error("[prospect-webhook] Failed to insert lead:", insertError);
    return new Response(
      JSON.stringify({ error: "Erro ao registrar lead" }),
      {
        status: 500,
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const leadId = (lead as { id: string }).id;
  console.log(`[prospect-webhook] Lead created: ${leadId}`);

  // ── 7. Return success ────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
    },
  );
});
