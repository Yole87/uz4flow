import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-client.ts";



serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();
  
  try {
    const { contact_id, notes: providedNotes } = await req.json();

    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: "contact_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Require caller JWT
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Caller-scoped client (RLS enforced)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate access to contact via RLS — cross-tenant returns null → generic 404
    const { data: ownedContact, error: accessErr } = await userClient
      .from("contacts")
      .select("id, organization_id")
      .eq("id", contact_id)
      .maybeSingle();

    if (accessErr || !ownedContact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Service-role client for downstream processing (already authorized above)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the contact with metadata using service role (we already validated access)
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select(`
        id,
        name,
        phone,
        metadata
      `)
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      console.error("Error fetching contact:", contactError);
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all conversations for this contact
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contact_id)
      .order("created_at", { ascending: false });

    if (convError) {
      console.error("Error fetching conversations:", convError);
    }

    // Get messages from all conversations (last 30 total)
    let allMessages: { content: string; direction: string; timestamp: string }[] = [];
    
    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id);
      
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("content, direction, timestamp")
        .in("conversation_id", conversationIds)
        .order("timestamp", { ascending: true })
        .limit(30);
      
      if (msgError) {
        console.error("Error fetching messages:", msgError);
      } else {
        allMessages = messages || [];
      }
    }

    // Get notes from metadata or provided notes
    const metadata = contact.metadata as Record<string, unknown> | null;
    const notes = providedNotes || (metadata?.notes as string) || "";

    // Build conversation context for AI
    const conversationText = allMessages
      .map((msg: { direction: string; content: string }) => 
        `${msg.direction === "inbound" ? "Cliente" : "Atendente"}: ${msg.content || "[mídia]"}`
      )
      .join("\n");

    let analysisResult;

    // organization_id resolved from RLS-validated query above
    const contactOrgId = ownedContact.organization_id;

    if (allMessages.length > 0) {
      // Use AI for real analysis with faster model
      try {
        console.log(`[analyze-conversation] Starting AI analysis for contact ${contact_id}, messages: ${allMessages.length}`);
        
        const aiResult = await callAI({
          organizationId: contactOrgId,
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Você é um analista de CRM especializado em conversas de WhatsApp. 
Analise a conversa e retorne APENAS um JSON válido (sem markdown) com a seguinte estrutura:
{
  "summary": "Resumo em 1-2 frases do que o cliente deseja",
  "sentiment": "positive" | "negative" | "neutral",
  "suggested_reply": "Uma sugestão de resposta para o atendente",
  "next_action": "Próximo passo recomendado",
  "interest_level": "high" | "medium" | "low"
}

Seja conciso e direto. Foque no contexto mais recente.`,
            },
            {
              role: "user",
              content: `Analise esta conversa de WhatsApp com ${contact.name || contact.phone}:

${conversationText}${notes ? `\n\n[Notas do Atendente]: ${notes}` : ""}`,
            },
          ],
        });

        if (!aiResult.ok) {
          if (aiResult.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (aiResult.status === 402) {
            return new Response(
              JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error(`AI error: ${aiResult.status}`);
        }

        const content = aiResult.data?.choices?.[0]?.message?.content;

        if (content) {
          // Try to parse the AI response as JSON
          try {
            analysisResult = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
          } catch {
            // If parsing fails, create a structured response from the text
            analysisResult = {
              summary: content.substring(0, 200),
              sentiment: "neutral",
              suggested_reply: "Responder ao cliente com mais informações.",
              next_action: "Acompanhar conversa",
              interest_level: "medium",
            };
          }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[analyze-conversation] AI analysis completed in ${duration}ms`);
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
        // Fall back to mock analysis
      }
    }

    // Fallback mock analysis if AI fails or no messages
    if (!analysisResult) {
      analysisResult = {
        summary: allMessages.length > 0 
          ? "Cliente demonstrou interesse em nossos produtos/serviços."
          : "Sem mensagens para analisar.",
        sentiment: "neutral",
        suggested_reply: "Olá! Como posso ajudá-lo hoje?",
        next_action: "Aguardar resposta do cliente",
        interest_level: "medium",
        analyzed_at: new Date().toISOString(),
      };
    }

    // Add timestamp
    analysisResult.analyzed_at = new Date().toISOString();

    // Save analysis to contact
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ ai_analysis: analysisResult })
      .eq("id", contact_id);

    if (updateError) {
      console.error("Error updating contact:", updateError);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[analyze-conversation] Total execution time: ${totalDuration}ms`);

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-conversation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
