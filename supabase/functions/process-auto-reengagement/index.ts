import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface QueueItem {
  id: string;
  session_id: string;
  user_id: string;
  config_id: string;
  scheduled_for: string;
  status: string;
  attempt_count: number;
}

interface ReengagementConfig {
  id: string;
  flow_id: string;
  user_id: string;
  is_enabled: boolean;
  delay_minutes: number;
  template_id: string | null;
  custom_message: string | null;
  max_attempts: number;
}

interface FlowSession {
  id: string;
  chat_id: string;
  instance_id: string;
  push_name: string | null;
  collected_data: Record<string, unknown>;
  flow_id: string;
}

interface MessageTemplate {
  id: string;
  content: string;
}

interface Integration {
  openbot_api_key_encrypted: string | null;
  openbot_inbound_url: string | null;
}

// Decrypt API key using shared encryption helper
async function decryptApiKey(encrypted: string): Promise<string> {
  return await decrypt(encrypted);
}

// Replace variables in text
function replaceVariables(text: string, session: FlowSession): string {
  let result = text
    .replace(/\{\{pushName\}\}/g, session.push_name || "")
    .replace(/\{\{chatId\}\}/g, session.chat_id || "")
    .replace(/\{\{instanceId\}\}/g, session.instance_id || "");
  
  // Replace collected data variables
  if (session.collected_data) {
    for (const [key, value] of Object.entries(session.collected_data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(regex, String(value || ""));
    }
  }
  
  return result;
}

const OPENBOT_SEND_URL = "https://api.digitalbotia.com.br/sendWebhook";

// Send message to OpenBot
async function sendToOpenBot(
  payload: Record<string, unknown>,
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(OPENBOT_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return { success: true };
      }
      
      const errorText = await response.text();
      console.error(`OpenBot request failed (attempt ${attempt}): ${response.status} - ${errorText}`);
      
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      } else {
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
    } catch (error) {
      console.error(`OpenBot request error (attempt ${attempt}):`, error);
      
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      } else {
        return { success: false, error: String(error) };
      }
    }
  }
  
  return { success: false, error: "Max retries exceeded" };
}

async function processQueueItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  item: QueueItem
): Promise<{ success: boolean; error?: string }> {
  console.log("Processing queue item:", item.id, "session:", item.session_id);
  
  try {
    // Get the config
    const { data: config, error: configError } = await supabase
      .from("auto_reengagement_config")
      .select("*")
      .eq("id", item.config_id)
      .single();
    
    if (configError || !config) {
      console.error("Config not found:", configError);
      return { success: false, error: "Config not found" };
    }
    
    const reengagementConfig = config as ReengagementConfig;
    
    // Check if max attempts reached
    if (item.attempt_count >= reengagementConfig.max_attempts) {
      console.log("Max attempts reached for item:", item.id);
      await supabase
        .from("auto_reengagement_queue")
        .update({
          status: "cancelled",
          processed_at: new Date().toISOString(),
          error_message: "Máximo de tentativas atingido",
        })
        .eq("id", item.id);
      return { success: true };
    }
    
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("flow_sessions")
      .select("id, chat_id, instance_id, push_name, collected_data, flow_id")
      .eq("id", item.session_id)
      .single();
    
    if (sessionError || !session) {
      console.error("Session not found:", sessionError);
      return { success: false, error: "Session not found" };
    }
    
    const flowSession = session as FlowSession;
    
    // Get message content
    let messageContent: string;
    
    if (reengagementConfig.template_id) {
      const { data: template, error: templateError } = await supabase
        .from("message_templates")
        .select("id, content")
        .eq("id", reengagementConfig.template_id)
        .single();
      
      if (templateError || !template) {
        console.error("Template not found:", templateError);
        // Fallback to custom message or skip
        if (reengagementConfig.custom_message) {
          messageContent = reengagementConfig.custom_message;
        } else {
          return { success: false, error: "Template not found and no fallback message" };
        }
      } else {
        messageContent = (template as MessageTemplate).content;
      }
    } else if (reengagementConfig.custom_message) {
      messageContent = reengagementConfig.custom_message;
    } else {
      return { success: false, error: "No message configured" };
    }
    
    // Get integration for OpenBot credentials
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("openbot_api_key_encrypted, openbot_inbound_url")
      .eq("user_id", item.user_id)
      .single();
    
    if (integrationError || !integration) {
      console.error("Integration not found:", integrationError);
      return { success: false, error: "Integration not found" };
    }
    
    const userIntegration = integration as Integration;
    
    if (!userIntegration.openbot_api_key_encrypted || !userIntegration.openbot_inbound_url) {
      return { success: false, error: "OpenBot not configured" };
    }
    
    // Prepare message with variables
    const finalMessage = replaceVariables(messageContent, flowSession);
    const phone = flowSession.chat_id.replace(/\D/g, "");
    
    const openbotPayload = {
      apiKey: await decryptApiKey(userIntegration.openbot_api_key_encrypted),
      phone,
      message: finalMessage,
      desativarFluxo: true, // Don't start a new flow
    };
    
    console.log("Sending reengagement message to:", phone);
    
    const result = await sendToOpenBot(openbotPayload);
    
    // Update queue item
    if (result.success) {
      await supabase
        .from("auto_reengagement_queue")
        .update({
          status: "sent",
          processed_at: new Date().toISOString(),
          attempt_count: item.attempt_count + 1,
        })
        .eq("id", item.id);
      
      console.log("Reengagement message sent successfully for session:", item.session_id);
    } else {
      // Check if we should retry
      const newAttemptCount = item.attempt_count + 1;
      
      if (newAttemptCount >= reengagementConfig.max_attempts) {
        await supabase
          .from("auto_reengagement_queue")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
            attempt_count: newAttemptCount,
            error_message: result.error,
          })
          .eq("id", item.id);
      } else {
        // Schedule retry in 5 minutes
        const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await supabase
          .from("auto_reengagement_queue")
          .update({
            scheduled_for: retryAt,
            attempt_count: newAttemptCount,
            error_message: result.error,
          })
          .eq("id", item.id);
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error processing queue item:", error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate cron secret
  const cronSecret = Deno.env.get("AUTO_REENGAGEMENT_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (!cronSecret || providedSecret !== cronSecret) {
    console.error("Invalid or missing cron secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(supabaseUrl, supabaseServiceKey) as SupabaseClient<any>;

  try {
    const now = new Date().toISOString();
    
    // Fetch pending queue items where scheduled_for <= now
    const { data: queueItems, error: fetchError } = await supabase
      .from("auto_reengagement_queue")
      .select("id, session_id, user_id, config_id, scheduled_for, status, attempt_count")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(50); // Process max 50 items per execution
    
    if (fetchError) {
      console.error("Error fetching queue items:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch queue items" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log("No pending items in queue");
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: "No pending items" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`Processing ${queueItems.length} queue items`);

    const { getOrgFeatures } = await import("../_shared/getOrgFeatures.ts");
    
    let successCount = 0;
    let failCount = 0;
    
    // Process items sequentially to avoid overwhelming OpenBot
    for (const item of queueItems as QueueItem[]) {
      // Feature gate: look up org from the config's user
      const { data: config } = await supabase
        .from("auto_reengagement_config")
        .select("user_id")
        .eq("id", item.config_id)
        .single();

      if (config?.user_id) {
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", config.user_id)
          .single();

        if (membership?.organization_id) {
          const features = await getOrgFeatures(supabase, membership.organization_id);
          if (!features.includes("followup") && !features.includes("automations")) {
            console.log(`[reengagement] Org ${membership.organization_id} lacks feature, skipping item ${item.id}`);
            continue;
          }
        }
      }

      const result = await processQueueItem(supabase, item);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Small delay between items
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    
    console.log(`Processed: ${successCount} success, ${failCount} failed`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      processed: queueItems.length,
      success_count: successCount,
      fail_count: failCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Error in process-auto-reengagement:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
