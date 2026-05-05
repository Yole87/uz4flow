import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProcessedRow {
  rowIndex: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  stage: string | null;
  notes: string | null;
  custom_fields: Record<string, string>;
  errors: string[];
}

interface ImportConfig {
  dedupe_strategy: "skip" | "update" | "create_new";
  default_stage_id: string | null;
  default_assignee_id: string | null;
  default_tags: string[];
  source: string;
  default_country_code: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // JWT auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse({ error: "Sessão inválida" }, 401);
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json();

    // Cancel branch
    if (body.action === "cancel") {
      const importId = body.import_id as string;
      if (!importId) return jsonResponse({ error: "import_id requerido" }, 400);

      // Verify ownership
      const { data: hist } = await admin
        .from("contact_import_history")
        .select("organization_id")
        .eq("id", importId)
        .maybeSingle();

      if (!hist) return jsonResponse({ error: "Importação não encontrada" }, 404);

      const allowed = await isOrgMember(admin, userId, hist.organization_id);
      if (!allowed) return jsonResponse({ error: "Acesso negado" }, 403);

      await admin
        .from("contact_import_history")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("id", importId);

      return jsonResponse({ cancelled: true });
    }

    // Process chunk branch
    const {
      import_id,
      organization_id,
      rows,
      config,
      is_last_chunk,
    } = body as {
      import_id: string;
      organization_id: string;
      rows: ProcessedRow[];
      config: ImportConfig;
      is_last_chunk: boolean;
    };

    if (!import_id || !organization_id || !Array.isArray(rows)) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }

    // Membership check
    const allowed = await isOrgMember(admin, userId, organization_id);
    if (!allowed) return jsonResponse({ error: "Acesso negado" }, 403);

    // Cancellation check
    const { data: hist } = await admin
      .from("contact_import_history")
      .select("status, created_count, updated_count, skipped_count, error_count, errors_jsonb")
      .eq("id", import_id)
      .maybeSingle();

    if (!hist) return jsonResponse({ error: "Importação não encontrada" }, 404);
    if (hist.status === "cancelled") {
      return jsonResponse({
        cancelled: true,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row_index: number; reason: string }[] = [];

    // Pre-fetch existing phones to avoid N queries
    const phonesToCheck = rows
      .filter((r) => r.phone && r.errors.length === 0)
      .map((r) => r.phone as string);

    let existingMap = new Map<string, string>(); // phone -> contact id
    if (phonesToCheck.length > 0) {
      const { data: existing } = await admin
        .from("contacts")
        .select("id, phone")
        .eq("organization_id", organization_id)
        .eq("channel", "whatsapp")
        .in("phone", phonesToCheck);
      for (const c of existing || []) {
        existingMap.set(c.phone as string, c.id as string);
      }
    }

    for (const row of rows) {
      // Validation errors from frontend
      if (row.errors.length > 0) {
        errors.push({
          row_index: row.rowIndex,
          reason: row.errors.join(" · "),
        });
        continue;
      }
      if (!row.phone || !row.name) {
        errors.push({ row_index: row.rowIndex, reason: "Nome/telefone obrigatórios" });
        continue;
      }

      const mergedTags = Array.from(
        new Set([...(row.tags || []), ...(config.default_tags || [])])
      );

      const metadata: Record<string, unknown> = {};
      if (config.source) metadata.source = config.source;
      if (Object.keys(row.custom_fields).length > 0) {
        metadata.custom_fields = row.custom_fields;
      }
      if (row.notes) metadata.notes = row.notes;

      const existingId = existingMap.get(row.phone);

      try {
        if (existingId) {
          // Duplicate — apply strategy
          if (config.dedupe_strategy === "skip") {
            skipped++;
            continue;
          } else if (config.dedupe_strategy === "update") {
            const updatePayload: Record<string, unknown> = {
              name: row.name,
              updated_at: new Date().toISOString(),
            };
            if (row.email) updatePayload.email = row.email;
            if (mergedTags.length > 0) updatePayload.tags = mergedTags;
            if (config.default_stage_id)
              updatePayload.pipeline_stage_id = config.default_stage_id;
            if (config.default_assignee_id)
              updatePayload.assigned_to_member_id = config.default_assignee_id;
            if (Object.keys(metadata).length > 0) {
              updatePayload.metadata = metadata;
            }
            const { error } = await admin
              .from("contacts")
              .update(updatePayload)
              .eq("id", existingId);
            if (error) throw error;
            updated++;
          } else {
            // create_new — append suffix
            const newPhone = row.phone + "_" + Date.now().toString(36).slice(-4);
            const { error } = await admin.from("contacts").insert({
              organization_id,
              channel: "whatsapp",
              name: row.name,
              phone: newPhone,
              email: row.email,
              tags: mergedTags.length > 0 ? mergedTags : null,
              pipeline_stage_id: config.default_stage_id,
              assigned_to_member_id: config.default_assignee_id,
              metadata: Object.keys(metadata).length > 0 ? metadata : null,
            });
            if (error) throw error;
            created++;
          }
        } else {
          // New contact
          const { error } = await admin.from("contacts").insert({
            organization_id,
            channel: "whatsapp",
            name: row.name,
            phone: row.phone,
            email: row.email,
            tags: mergedTags.length > 0 ? mergedTags : null,
            pipeline_stage_id: config.default_stage_id,
            assigned_to_member_id: config.default_assignee_id,
            metadata: Object.keys(metadata).length > 0 ? metadata : null,
          });
          if (error) {
            if (error.code === "23505") {
              skipped++;
              continue;
            }
            throw error;
          }
          created++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error("Row insert error:", msg);
        errors.push({ row_index: row.rowIndex, reason: "Falha ao salvar" });
      }
    }

    // Update history
    const newCreated = (hist.created_count || 0) + created;
    const newUpdated = (hist.updated_count || 0) + updated;
    const newSkipped = (hist.skipped_count || 0) + skipped;
    const prevErrors = (hist.errors_jsonb as { row_index: number; reason: string }[]) || [];
    const newErrors = [...prevErrors, ...errors];

    await admin
      .from("contact_import_history")
      .update({
        created_count: newCreated,
        updated_count: newUpdated,
        skipped_count: newSkipped,
        error_count: newErrors.length,
        errors_jsonb: newErrors.slice(0, 5000) as never,
        status: is_last_chunk ? "completed" : "processing",
        finished_at: is_last_chunk ? new Date().toISOString() : null,
      })
      .eq("id", import_id);

    return jsonResponse({ created, updated, skipped, errors });
  } catch (err) {
    console.error("bulk-import-contacts error:", err);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});

async function isOrgMember(
  admin: ReturnType<typeof createClient>,
  userId: string,
  orgId: string
): Promise<boolean> {
  // Admin master?
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if ((roles || []).some((r) => r.role === "admin_master")) return true;

  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  return !!data;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
