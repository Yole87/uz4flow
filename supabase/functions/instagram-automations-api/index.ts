/**
 * Instagram Automations API Edge Function
 * 
 * Authenticated CRUD for automations and templates.
 * Receives `action` in JSON body.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

let _corsHeaders: Record<string, string> = {};

async function getAuthContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const userId = user.id;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Resolve organization
  const { data: orgId } = await supabase.rpc("get_user_organization_id", { _user_id: userId });
  if (!orgId) {
    return { error: "No organization" };
  }

  return { userId, orgId, supabase };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ..._corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  _corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await getAuthContext(req);
  if ("error" in auth) {
    return jsonResponse({ error: auth.error }, 401);
  }

  const { orgId, supabase } = auth;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      // ─── AUTOMATIONS ──────────────────────────────────────
      case "automations/create": {
        const { data, error } = await supabase.from("instagram_automations").insert({
          organization_id: orgId,
          name: body.name || "Nova Automação",
          description: body.description || null,
          trigger_type: body.trigger_type || "dm",
          definition_json: body.definition_json || { conditions: {}, steps: [] },
          is_enabled: body.is_enabled ?? false,
          account_id: body.account_id || null,
        }).select().single();

        if (error) throw error;
        return jsonResponse({ success: true, automation: data });
      }

      case "automations/update": {
        if (!body.id) return jsonResponse({ error: "id is required" }, 400);

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.trigger_type !== undefined) updateData.trigger_type = body.trigger_type;
        if (body.definition_json !== undefined) updateData.definition_json = body.definition_json;
        if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled;
        if (body.account_id !== undefined) updateData.account_id = body.account_id;

        const { data, error } = await supabase.from("instagram_automations")
          .update(updateData)
          .eq("id", body.id)
          .eq("organization_id", orgId)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, automation: data });
      }

      case "automations/delete": {
        if (!body.id) return jsonResponse({ error: "id is required" }, 400);
        const { error } = await supabase.from("instagram_automations")
          .delete()
          .eq("id", body.id)
          .eq("organization_id", orgId);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      case "automations/toggle": {
        if (!body.id) return jsonResponse({ error: "id is required" }, 400);

        let newValue: boolean;
        if (body.is_enabled !== undefined) {
          newValue = body.is_enabled;
        } else {
          const { data: current } = await supabase.from("instagram_automations")
            .select("is_enabled")
            .eq("id", body.id)
            .eq("organization_id", orgId)
            .single();
          if (!current) return jsonResponse({ error: "Automation not found" }, 404);
          newValue = !current.is_enabled;
        }

        const { data, error } = await supabase.from("instagram_automations")
          .update({ is_enabled: newValue, updated_at: new Date().toISOString() })
          .eq("id", body.id)
          .eq("organization_id", orgId)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, automation: data });
      }

      case "automations/list": {
        const page = body.page || 1;
        const perPage = Math.min(body.per_page || 20, 50);
        const offset = (page - 1) * perPage;

        const query = supabase.from("instagram_automations")
          .select("*, instagram_accounts(username, profile_picture_url)", { count: "exact" })
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + perPage - 1);

        const { data, error, count } = await query;
        if (error) throw error;
        return jsonResponse({ success: true, automations: data, total: count, page, per_page: perPage });
      }

      // ─── TEMPLATES ────────────────────────────────────────
      case "templates/create": {
        const { data, error } = await supabase.from("instagram_templates").insert({
          organization_id: orgId,
          name: body.name || "Novo Template",
          body: body.body || "",
          category: body.category || "general",
        }).select().single();

        if (error) throw error;
        return jsonResponse({ success: true, template: data });
      }

      case "templates/update": {
        if (!body.id) return jsonResponse({ error: "id is required" }, 400);

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) updateData.name = body.name;
        if (body.body !== undefined) updateData.body = body.body;
        if (body.category !== undefined) updateData.category = body.category;

        const { data, error } = await supabase.from("instagram_templates")
          .update(updateData)
          .eq("id", body.id)
          .eq("organization_id", orgId)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, template: data });
      }

      case "templates/delete": {
        if (!body.id) return jsonResponse({ error: "id is required" }, 400);
        const { error } = await supabase.from("instagram_templates")
          .delete()
          .eq("id", body.id)
          .eq("organization_id", orgId);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      case "templates/list": {
        const { data, error } = await supabase.from("instagram_templates")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return jsonResponse({ success: true, templates: data });
      }

      // ─── SIMULATE ─────────────────────────────────────────
      case "simulate": {
        if (!body.automation_id && !body.definition_json) {
          return jsonResponse({ error: "automation_id or definition_json required" }, 400);
        }

        let definition: Record<string, unknown>;

        if (body.automation_id) {
          const { data: auto } = await supabase.from("instagram_automations")
            .select("definition_json")
            .eq("id", body.automation_id)
            .eq("organization_id", orgId)
            .single();
          if (!auto) return jsonResponse({ error: "Automation not found" }, 404);
          definition = auto.definition_json as Record<string, unknown>;
        } else {
          definition = body.definition_json;
        }

        const mockText = body.mock_text || "Olá quero saber mais";
        const rawConditions = definition.conditions;
        const steps = (definition.steps as Array<Record<string, unknown>>) || [];

        // Normalize conditions: support both array and object format
        const conditionsArray = Array.isArray(rawConditions) ? rawConditions : (rawConditions ? [rawConditions] : []);
        const firstCondition = conditionsArray[0] as Record<string, unknown> || {};
        const keywords = (firstCondition.keywords as string[]) || [];
        const matchType = (firstCondition.match_type || firstCondition.match_mode) as string || "contains";
        let matches = true;

        if (matchType === "ai_intent") {
          const intentDesc = firstCondition.ai_intent_description as string;
          if (intentDesc) {
            try {
              const { callAI } = await import("../_shared/ai-client.ts");
              const result = await callAI({
                organizationId: orgId,
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  { role: "system", content: `Você é um classificador de intenção. Analise a mensagem do usuário e determine se ela corresponde à intenção descrita. Responda APENAS "SIM" ou "NÃO", sem explicações.` },
                  { role: "user", content: `Intenção a detectar: "${intentDesc}"\n\nMensagem do usuário: "${mockText}"\n\nA mensagem corresponde à intenção? Responda SIM ou NÃO.` },
                ],
                max_tokens: 5,
                temperature: 0,
              });
              const answer = (result.data?.choices?.[0]?.message?.content || "").trim().toUpperCase();
              matches = answer.startsWith("SIM");
            } catch (e) {
              console.error("[IG-Automations-API] AI intent simulation error:", e);
              matches = false;
            }
          }
        } else if (keywords.length > 0) {
          const lowerText = mockText.toLowerCase();
          switch (matchType) {
            case "exact":
              matches = keywords.some((k: string) => lowerText === k.toLowerCase());
              break;
            case "regex":
              matches = keywords.some((k: string) => {
                try { return new RegExp(k, "i").test(mockText); } catch { return false; }
              });
              break;
            default:
              matches = keywords.some((k: string) => lowerText.includes(k.toLowerCase()));
          }
        }

        const simulatedSteps = steps.map((step, i) => {
          const cfg = step.config as Record<string, unknown> | undefined;
          return {
            index: i,
            type: step.type,
            text: cfg?.message || step.text || step.message || null,
            would_execute: matches,
          };
        });

        return jsonResponse({
          success: true,
          matched: matches,
          steps: simulatedSteps,
          conditions_evaluated: { keywords, match_type: matchType, input: mockText },
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[IG-Automations-API] Error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});
