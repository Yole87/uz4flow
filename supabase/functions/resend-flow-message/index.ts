import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface ResendMessageRequest {
  session_id: string;
  message: string;
}

interface FlowSession {
  id: string;
  chat_id: string;
  instance_id: string;
  push_name: string | null;
  collected_data: Record<string, unknown>;
  user_id: string;
}

interface Integration {
  openbot_api_key_encrypted: string | null;
  openbot_inbound_url: string | null;
}

// Decrypt API key using shared encryption helper
async function decryptApiKey(encrypted: string): Promise<string> {
  return await decrypt(encrypted);
}

// Replace variables in message template
function replaceVariables(template: string, data: Record<string, unknown>, pushName: string | null): string {
  let result = template;
  
  // Replace {{pushName}} with actual push name
  result = result.replace(/\{\{pushName\}\}/gi, pushName || "");
  
  // Replace all collected data variables
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    if (typeof value === "object" && value !== null) {
      // Handle file objects
      const fileValue = value as { file_name?: string };
      result = result.replace(regex, fileValue.file_name || "arquivo");
    } else {
      result = result.replace(regex, String(value || ""));
    }
  }
  
  // Remove any remaining unreplaced variables
  result = result.replace(/\{\{[^}]+\}\}/g, "");
  
  return result.trim();
}

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

// Send message to OpenBot
async function sendToOpenBot(
  apiKey: string,
  phone: string,
  message: string,
): Promise<{ success: boolean; response?: unknown; error?: string }> {
  const maxRetries = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}: Sending message to ${phone}`);
      
      const response = await fetch(OPENBOT_SEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          phone,
          message,
          desativarFluxo: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `HTTP ${response.status}: ${errorText}`;
        console.error(`Attempt ${attempt} failed:`, lastError);
        
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      const responseData = await response.json();
      console.log("OpenBot response:", responseData);
      return { success: true, response: responseData };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`Attempt ${attempt} error:`, lastError);
      
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return { success: false, error: lastError };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { session_id, message }: ResendMessageRequest = await req.json();

    if (!session_id || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: "session_id and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing resend for session ${session_id} by user ${user.id}`);

    // Fetch session data - verify user owns it
    const { data: session, error: sessionError } = await supabase
      .from("flow_sessions")
      .select("id, chat_id, instance_id, push_name, collected_data, user_id")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      console.error("Session not found:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const typedSession = session as FlowSession;

    // Fetch user's integration settings
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("openbot_api_key_encrypted, openbot_inbound_url")
      .eq("user_id", user.id)
      .single();

    if (integrationError || !integration) {
      console.error("Integration not found:", integrationError);
      return new Response(
        JSON.stringify({ error: "OpenBot integration not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const typedIntegration = integration as Integration;

    if (!typedIntegration.openbot_api_key_encrypted || !typedIntegration.openbot_inbound_url) {
      return new Response(
        JSON.stringify({ error: "OpenBot API key or URL not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Decrypt API key
    const apiKey = await decryptApiKey(typedIntegration.openbot_api_key_encrypted);

    // Process collected_data
    const collectedData = typeof typedSession.collected_data === "object" && typedSession.collected_data !== null
      ? typedSession.collected_data
      : {};

    // Replace variables in message
    const processedMessage = replaceVariables(message, collectedData, typedSession.push_name);

    if (!processedMessage) {
      return new Response(
        JSON.stringify({ error: "Message is empty after processing" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Sending message to ${typedSession.chat_id}: ${processedMessage}`);

    // Send message via OpenBot
    const result = await sendToOpenBot(
      apiKey,
      typedSession.chat_id,
      processedMessage,
    );

    if (!result.success) {
      console.error("Failed to send message:", result.error);
      return new Response(
        JSON.stringify({ error: `Failed to send message: ${result.error}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Message sent successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message sent successfully",
        processed_message: processedMessage,
        openbot_response: result.response,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
