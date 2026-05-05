import { createClient } from "npm:@supabase/supabase-js@2";
import { encrypt, decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



// Browserless v2 base URL for testing
const BROWSERLESS_BASE_URL = "https://production-sfo.browserless.io";

// Google Places API base URL for testing
const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText";

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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Admin client for database operations
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's organization (owner-first, then member)
    let organizationId: string | null = null;

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
      organizationId = orgMember?.organization_id ?? null;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Organização não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, apiKey, useStealthMode, useResidentialProxy, provider } = body;

    console.log(`[manage-prospect-provider] Action: ${action}, Org: ${organizationId}`);

    switch (action) {
      case "get": {
        // Get current provider configuration
        const { data: providerData } = await adminClient
          .from("prospect_providers")
          .select("*")
          .eq("organization_id", organizationId)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            data: providerData || {
              active_provider: "gmaps",
              browserless_configured: false,
              browserless_api_key_masked: null,
              browserless_last_test_at: null,
              google_places_configured: false,
              google_places_api_key_masked: null,
              google_places_last_test_at: null,
              preferred_provider: "scraping",
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "save-browserless": {
        if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
          return new Response(
            JSON.stringify({ success: false, error: "API Key inválida" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const trimmedKey = apiKey.trim();
        const encryptedKey = await encrypt(trimmedKey);
        const masked = "••••••••" + trimmedKey.slice(-4);

        // Upsert provider record
        const { error: upsertError } = await adminClient
          .from("prospect_providers")
          .upsert(
            {
              organization_id: organizationId,
              browserless_api_key_encrypted: encryptedKey,
              browserless_api_key_masked: masked,
              browserless_configured: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id" }
          );

        if (upsertError) {
          console.error("[manage-prospect-provider] Upsert error:", upsertError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao salvar a chave" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Chave Browserless salva com sucesso",
            masked_key: masked,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "test-browserless": {
        // Get the saved key
        const { data: providerData } = await adminClient
          .from("prospect_providers")
          .select("browserless_api_key_encrypted")
          .eq("organization_id", organizationId)
          .single();

        if (!providerData?.browserless_api_key_encrypted) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhuma chave configurada" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const decryptedKey = await decrypt(providerData.browserless_api_key_encrypted);

        // Test the key by making a simple API call
        try {
          const testResponse = await fetch(
            `${BROWSERLESS_BASE_URL}/function?token=${decryptedKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/javascript" },
              body: `export default async function({ page }) {
                return { success: true, timestamp: Date.now() };
              }`,
            }
          );

          if (!testResponse.ok) {
            const errorText = await testResponse.text();
            console.error("[manage-prospect-provider] Browserless test failed:", errorText);
            
            // Determine specific error message based on status code
            let errorMessage = "Erro ao conectar com Browserless";
            let shouldDisable = true;
            
            if (testResponse.status === 401 || testResponse.status === 403) {
              errorMessage = "Chave inválida ou expirada";
            } else if (testResponse.status === 429) {
              errorMessage = "Limite de requisições excedido. Aguarde alguns minutos ou verifique seu plano Browserless.";
              shouldDisable = false; // Don't disable on rate limit - key is valid
            } else if (testResponse.status === 402) {
              errorMessage = "Créditos Browserless esgotados. Verifique seu plano.";
            } else if (testResponse.status >= 500) {
              errorMessage = "Serviço Browserless temporariamente indisponível. Tente novamente.";
              shouldDisable = false; // Don't disable on server errors
            }
            
            // Update configured status only if key is invalid
            if (shouldDisable) {
              await adminClient
                .from("prospect_providers")
                .update({ browserless_configured: false })
                .eq("organization_id", organizationId);
            }

            return new Response(
              JSON.stringify({ success: false, error: errorMessage }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Update last test timestamp
          await adminClient
            .from("prospect_providers")
            .update({ 
              browserless_last_test_at: new Date().toISOString(),
              browserless_configured: true,
            })
            .eq("organization_id", organizationId);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Conexão com Browserless verificada com sucesso!",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (fetchError) {
          console.error("[manage-prospect-provider] Fetch error:", fetchError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro de conexão com Browserless" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "remove-browserless": {
        // Remove the browserless key
        const { error: updateError } = await adminClient
          .from("prospect_providers")
          .update({
            browserless_api_key_encrypted: null,
            browserless_api_key_masked: null,
            browserless_configured: false,
            browserless_last_test_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);

        if (updateError) {
          console.error("[manage-prospect-provider] Remove error:", updateError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao remover a chave" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Chave Browserless removida",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update-anti-block": {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        
        if (typeof useStealthMode === "boolean") {
          updates.use_stealth_mode = useStealthMode;
        }
        if (typeof useResidentialProxy === "boolean") {
          updates.use_residential_proxy = useResidentialProxy;
        }
        
        const { error: updateError } = await adminClient
          .from("prospect_providers")
          .update(updates)
          .eq("organization_id", organizationId);

        if (updateError) {
          console.error("[manage-prospect-provider] Anti-block update error:", updateError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao atualizar configurações" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Configurações anti-bloqueio atualizadas",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ Google Places API Actions ============

      case "save-google-places": {
        if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
          return new Response(
            JSON.stringify({ success: false, error: "API Key inválida" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const trimmedKey = apiKey.trim();
        const encryptedKey = await encrypt(trimmedKey);
        const masked = "••••••••" + trimmedKey.slice(-4);

        // Upsert provider record
        const { error: upsertError } = await adminClient
          .from("prospect_providers")
          .upsert(
            {
              organization_id: organizationId,
              google_places_api_key_encrypted: encryptedKey,
              google_places_api_key_masked: masked,
              google_places_configured: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id" }
          );

        if (upsertError) {
          console.error("[manage-prospect-provider] Google Places upsert error:", upsertError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao salvar a chave" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Chave Google Places API salva com sucesso",
            masked_key: masked,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "test-google-places": {
        // Get the saved key
        const { data: providerData } = await adminClient
          .from("prospect_providers")
          .select("google_places_api_key_encrypted")
          .eq("organization_id", organizationId)
          .single();

        if (!providerData?.google_places_api_key_encrypted) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhuma chave configurada" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const decryptedKey = await decrypt(providerData.google_places_api_key_encrypted);

        // Test the key by making a minimal API call
        try {
          const testResponse = await fetch(PLACES_API_URL, {
            method: "POST",
            headers: {
              "X-Goog-Api-Key": decryptedKey,
              "X-Goog-FieldMask": "places.id",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              textQuery: "teste",
              languageCode: "pt-BR",
              maxResultCount: 1,
            }),
          });

          if (!testResponse.ok) {
            const errorText = await testResponse.text();
            console.error("[manage-prospect-provider] Google Places test failed:", errorText);
            
            // Update configured status to false
            await adminClient
              .from("prospect_providers")
              .update({ google_places_configured: false })
              .eq("organization_id", organizationId);

            let errorMessage = "Erro ao conectar com Google Places API";
            if (testResponse.status === 401 || testResponse.status === 403) {
              // Parse error to check if it's a SERVICE_DISABLED issue
              try {
                const errorJson = JSON.parse(errorText);
                const isDisabled = errorJson?.error?.details?.some(
                  (d: Record<string, unknown>) => d?.reason === "SERVICE_DISABLED"
                );
                if (isDisabled) {
                  errorMessage = "A Places API (New) não está habilitada no seu projeto Google Cloud. Acesse o Google Cloud Console → APIs e Serviços → Biblioteca, busque por 'Places API (New)' e clique em 'Ativar'. Aguarde alguns minutos e tente novamente.";
                } else {
                  errorMessage = "Chave inválida. Verifique se a chave está correta e possui permissão para a Places API.";
                }
              } catch {
                errorMessage = "Chave inválida ou Places API não habilitada. Verifique no Google Cloud Console se a Places API (New) está ativada.";
              }
            } else if (testResponse.status === 429) {
              errorMessage = "Limite de requisições excedido. Aguarde alguns minutos e tente novamente.";
            }

            return new Response(
              JSON.stringify({ success: false, error: errorMessage }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Update last test timestamp
          await adminClient
            .from("prospect_providers")
            .update({ 
              google_places_last_test_at: new Date().toISOString(),
              google_places_configured: true,
            })
            .eq("organization_id", organizationId);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Conexão com Google Places API verificada com sucesso!",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (fetchError) {
          console.error("[manage-prospect-provider] Google Places fetch error:", fetchError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro de conexão com Google Places API" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "remove-google-places": {
        // Check if we need to switch provider
        const { data: currentProvider } = await adminClient
          .from("prospect_providers")
          .select("preferred_provider")
          .eq("organization_id", organizationId)
          .single();

        const updates: Record<string, unknown> = {
          google_places_api_key_encrypted: null,
          google_places_api_key_masked: null,
          google_places_configured: false,
          google_places_last_test_at: null,
          updated_at: new Date().toISOString(),
        };

        // If using places_api, switch back to scraping
        if (currentProvider?.preferred_provider === "places_api") {
          updates.preferred_provider = "scraping";
        }

        const { error: updateError } = await adminClient
          .from("prospect_providers")
          .update(updates)
          .eq("organization_id", organizationId);

        if (updateError) {
          console.error("[manage-prospect-provider] Remove Google Places error:", updateError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao remover a chave" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Chave Google Places API removida",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "set-preferred-provider": {
        if (!provider || !["scraping", "places_api"].includes(provider)) {
          return new Response(
            JSON.stringify({ success: false, error: "Provider inválido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate that the selected provider is configured
        const { data: providerData } = await adminClient
          .from("prospect_providers")
          .select("browserless_configured, google_places_configured")
          .eq("organization_id", organizationId)
          .single();

        if (provider === "scraping" && !providerData?.browserless_configured) {
          return new Response(
            JSON.stringify({ success: false, error: "Browserless não está configurado" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (provider === "places_api" && !providerData?.google_places_configured) {
          return new Response(
            JSON.stringify({ success: false, error: "Google Places API não está configurada" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await adminClient
          .from("prospect_providers")
          .update({
            preferred_provider: provider,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);

        if (updateError) {
          console.error("[manage-prospect-provider] Set provider error:", updateError);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao atualizar provider" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Provider atualizado para ${provider}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[manage-prospect-provider] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
