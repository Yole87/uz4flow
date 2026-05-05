import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { encrypt, decrypt } from "../_shared/encryption.ts";

// ── Valid models per provider ──
const VALID_MODELS: Record<string, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
};

const DEFAULT_MODEL: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-5-mini",
};

function maskKey(key: string): string {
  if (!key || key.length < 10) return "***configurada***";
  return key.substring(0, 6) + "..." + key.substring(key.length - 4);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const svcClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: member } = await svcClient
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return new Response(JSON.stringify({ error: "Organization not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = member.organization_id;

  const { data: org } = await svcClient
    .from("organizations")
    .select("owner_user_id")
    .eq("id", orgId)
    .single();

  const { data: isAdmin } = await svcClient.rpc("is_admin_master");

  if (org?.owner_user_id !== user.id && !isAdmin) {
    return new Response(JSON.stringify({ error: "Only organization owners can manage AI config" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (req.method === "GET") {
      const { data: config } = await svcClient
        .from("organization_ai_configs")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!config) {
        return new Response(JSON.stringify({ config: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mask whichever key is set for the active provider
      const provider = config.provider || "gemini";
      const encryptedKey = provider === "openai"
        ? config.openai_api_key_encrypted
        : config.gemini_api_key_encrypted;

      let maskedKey: string | null = null;
      if (encryptedKey) {
        try {
          const decrypted = await decrypt(encryptedKey);
          maskedKey = maskKey(decrypted);
        } catch {
          maskedKey = "***configurada***";
        }
      }

      return new Response(JSON.stringify({
        config: {
          id: config.id,
          organization_id: config.organization_id,
          provider,
          has_key: !!encryptedKey,
          has_gemini_key: !!config.gemini_api_key_encrypted,
          has_openai_key: !!config.openai_api_key_encrypted,
          masked_key: maskedKey,
          default_model: config.default_model,
          is_active: config.is_active,
          created_at: config.created_at,
          updated_at: config.updated_at,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      if (action === "save") {
        const { api_key, default_model, is_active, provider } = body;

        // Determine effective provider for this save operation
        let effectiveProvider: string | null = null;
        if (provider !== undefined) {
          if (!["gemini", "openai"].includes(provider)) {
            return new Response(JSON.stringify({ error: "Provider inválido. Use 'gemini' ou 'openai'." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          effectiveProvider = provider;
        } else {
          // Look up current provider for context (key save / model save)
          const { data: existing } = await svcClient
            .from("organization_ai_configs")
            .select("provider")
            .eq("organization_id", orgId)
            .maybeSingle();
          effectiveProvider = existing?.provider || "gemini";
        }

        const updateData: Record<string, unknown> = {
          organization_id: orgId,
          updated_at: new Date().toISOString(),
        };

        if (provider !== undefined) {
          updateData.provider = provider;
          // When switching provider, reset default_model to that provider's default
          // unless an explicit default_model is also being sent in the same call
          if (default_model === undefined) {
            updateData.default_model = DEFAULT_MODEL[provider];
          }
        }

        if (api_key !== undefined && api_key !== null && api_key !== "") {
          if (typeof api_key !== "string" || api_key.trim().length < 10) {
            return new Response(JSON.stringify({ error: "Chave API inválida. Deve ter pelo menos 10 caracteres." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const encrypted = await encrypt(api_key.trim());
          if (effectiveProvider === "openai") {
            updateData.openai_api_key_encrypted = encrypted;
          } else {
            updateData.gemini_api_key_encrypted = encrypted;
          }
        }

        if (default_model !== undefined) {
          const validForProvider = VALID_MODELS[effectiveProvider!] || [];
          if (!validForProvider.includes(default_model)) {
            return new Response(JSON.stringify({
              error: `Modelo inválido para o provedor ${effectiveProvider}.`,
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          updateData.default_model = default_model;
        }

        if (is_active !== undefined) {
          updateData.is_active = is_active;
        }

        const { error: upsertError } = await svcClient
          .from("organization_ai_configs")
          .upsert(updateData, { onConflict: "organization_id" });

        if (upsertError) {
          console.error("[manage-ai-config] Upsert error:", upsertError);
          return new Response(JSON.stringify({ error: "Erro ao salvar configuração" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "test") {
        let apiKey: string | undefined = body.api_key;
        let testProvider: string = body.provider;

        if (!apiKey || !testProvider) {
          const { data: config } = await svcClient
            .from("organization_ai_configs")
            .select("provider, gemini_api_key_encrypted, openai_api_key_encrypted")
            .eq("organization_id", orgId)
            .maybeSingle();

          if (!config) {
            return new Response(JSON.stringify({ error: "Nenhuma configuração encontrada" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          testProvider = testProvider || config.provider || "gemini";
          if (!apiKey) {
            const enc = testProvider === "openai"
              ? config.openai_api_key_encrypted
              : config.gemini_api_key_encrypted;
            if (!enc) {
              return new Response(JSON.stringify({ error: `Nenhuma chave ${testProvider} configurada para testar` }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            apiKey = await decrypt(enc);
          }
        }

        try {
          let testResponse: Response;
          let extractContent: (data: any) => string;

          if (testProvider === "openai") {
            testResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey!.trim()}`,
              },
              body: JSON.stringify({
                model: "gpt-5-mini",
                messages: [{ role: "user", content: "Responda apenas: OK" }],
                max_completion_tokens: 10,
              }),
            });
            extractContent = (data) => data?.choices?.[0]?.message?.content || "";
          } else {
            testResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey!.trim()}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: "Responda apenas: OK" }] }],
                  generationConfig: { maxOutputTokens: 10 },
                }),
              }
            );
            extractContent = (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }

          if (!testResponse.ok) {
            const errText = await testResponse.text();
            console.error(`[manage-ai-config] Test failed (${testProvider}):`, testResponse.status, errText.substring(0, 300));

            const errorMessages: Record<number, string> = {
              400: "Requisição inválida. Verifique a chave API.",
              401: "Chave API inválida ou expirada.",
              403: "Chave API sem permissão.",
              404: "Modelo não encontrado.",
              429: "Limite de requisições atingido. Tente novamente em alguns minutos.",
            };

            return new Response(JSON.stringify({
              success: false,
              error: errorMessages[testResponse.status] || `Erro ${testResponse.status} ao testar a API.`,
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const testData = await testResponse.json();
          const testContent = extractContent(testData);

          return new Response(JSON.stringify({
            success: true,
            message: `Conexão bem-sucedida! Resposta: "${(testContent || "OK").trim()}"`,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[manage-ai-config] Test error:", e);
          return new Response(JSON.stringify({
            success: false,
            error: "Erro de conexão. Verifique sua chave API e tente novamente.",
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (action === "delete") {
        await svcClient
          .from("organization_ai_configs")
          .delete()
          .eq("organization_id", orgId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[manage-ai-config] Error:", error);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
