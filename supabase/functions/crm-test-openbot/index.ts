import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";



Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    const { api_key, instance_id } = body;
    
    // Fixed URL - constant
    const sendUrl = "https://api.digitalbotia.com.br/sendWebhook";

    // Check if user is admin_master (bypass org membership check)
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin_master")
      .maybeSingle();

    let organizationId: string | null = null;

    if (adminRole) {
      // Admin: resolve org from instance_id in request body
      if (instance_id) {
        const { data: inst } = await supabase
          .from("instances")
          .select("organization_id")
          .eq("id", instance_id)
          .maybeSingle();
        if (inst) {
          organizationId = inst.organization_id;
        }
      }
      // Fallback: try organization_members anyway (admin might be in an org)
      if (!organizationId) {
        const { data: orgMember } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (orgMember) organizationId = orgMember.organization_id;
      }
    } else {
      // Normal user: standard organization_members lookup
      const { data: orgMember, error: orgError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (orgError || !orgMember) {
        console.error("Org error:", orgError);
        return new Response(
          JSON.stringify({ success: false, error: "Organização não encontrada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      organizationId = orgMember.organization_id;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Organização não encontrada. Forneça instance_id no corpo da requisição." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalApiKey = api_key;
    let resolvedInstanceId: string | null = null;

    // If no API key provided, try to get from any instance with API Key
    if (!finalApiKey) {
      const { data: instances, error: instancesError } = await supabase
        .from("instances")
        .select("id, openbot_api_key_encrypted, openbot_instance_id")
        .eq("organization_id", organizationId)
        .not("openbot_api_key_encrypted", "is", null)
        .limit(1);

      if (instancesError || !instances || instances.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma instância com API Key configurada. Edite a instância para adicionar uma API Key." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        finalApiKey = await decrypt(instances[0].openbot_api_key_encrypted);
      } catch (decryptError) {
        console.error("Decrypt error:", decryptError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao descriptografar API Key salva" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!resolvedInstanceId && instances[0].openbot_instance_id) {
        resolvedInstanceId = instances[0].openbot_instance_id;
      }
    }

    // If we have an instance_id (DB record), resolve the openbot_instance_id from it
    if (instance_id && !resolvedInstanceId) {
      const { data: inst } = await supabase
        .from("instances")
        .select("openbot_instance_id, openbot_api_key_encrypted")
        .eq("id", instance_id)
        .maybeSingle();
      if (inst?.openbot_instance_id) {
        resolvedInstanceId = inst.openbot_instance_id;
      }
      // Also get API key from this specific instance if not provided
      if (!finalApiKey && inst?.openbot_api_key_encrypted) {
        try {
          finalApiKey = await decrypt(inst.openbot_api_key_encrypted);
        } catch (e) {
          console.error("Decrypt error for instance:", e);
        }
      }
    }

    console.log(`[crm-test-openbot] Testing connection to: ${sendUrl}, instanceId: ${resolvedInstanceId}`);

    // Make test request to OpenBot
    const testPayload: Record<string, unknown> = {
      apiKey: finalApiKey,
      phone: "5500000000000", // Invalid test number
      message: "🧪 Teste de conexão - CRM OpenFlow",
      desativarFluxo: true,
    };

    if (resolvedInstanceId) {
      testPayload.instanceId = resolvedInstanceId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text();
      console.log(`[crm-test-openbot] Response status: ${response.status}, body: ${responseText.substring(0, 200)}`);

      // OpenBot typically returns 200 for successful API calls
      // Even with invalid phone, if API key is valid, it should return 200 or a specific error
      if (response.ok) {
        // Check if there are instances configured with openbot_instance_id
        const { data: instances } = await supabase
          .from("instances")
          .select("id, name, openbot_instance_id")
          .eq("organization_id", organizationId);

        const hasConfiguredInstance = instances?.some(i => i.openbot_instance_id);

        if (!hasConfiguredInstance && instances && instances.length > 0) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "API conectada! O ID da instância será configurado automaticamente na primeira mensagem recebida.",
              warning: "auto_config_pending"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Conexão estabelecida com sucesso!" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse error response
      let errorMessage = `OpenBot retornou ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        if (responseText) {
          errorMessage = responseText.substring(0, 100);
        }
      }

      // Provide user-friendly error messages (only override if no specific error from API)
      if (response.status === 400 && errorMessage === `OpenBot retornou ${response.status}`) {
        errorMessage = "API Key inválida ou formato incorreto";
      } else if (response.status === 401) {
        errorMessage = "API Key não autorizada";
      } else if (response.status >= 500 && errorMessage === `OpenBot retornou ${response.status}`) {
        errorMessage = `Erro interno do OpenBot (${response.status})`;
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (fetchError) {
      clearTimeout(timeout);
      console.error("[crm-test-openbot] Fetch error:", fetchError);

      let errorMessage = "Erro de conexão com OpenBot";
      if (fetchError.name === "AbortError") {
        errorMessage = "OpenBot não respondeu a tempo (timeout 10s)";
      } else if (fetchError.message?.includes("fetch")) {
        errorMessage = "Não foi possível conectar à URL - verifique o endereço";
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("[crm-test-openbot] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
