import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-client.ts";



/**
 * Transcribes audio from a URL using AI (Gemini) and updates the message metadata.
 * Called async (fire-and-forget) from crm-openbot-inbound after inserting an audio message.
 * 
 * Input: { message_id: string, audio_url: string, mime_type?: string }
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsOptions(req);
  if (preflightResponse) return preflightResponse;

  try {
    // ── Auth: require valid JWT (called internally by crm-openbot-inbound with service-role) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message_id, audio_url, mime_type } = await req.json();

    if (!message_id || !audio_url) {
      return new Response(
        JSON.stringify({ error: "message_id and audio_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[transcribe-audio] Starting transcription for message:", message_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get organization_id from message's conversation
    let organizationId: string | undefined;
    const { data: msgData } = await supabase
      .from("messages")
      .select("conversation_id, conversations!inner(contact_id, contacts!inner(organization_id))")
      .eq("id", message_id)
      .maybeSingle();
    if (msgData?.conversations) {
      const conv = msgData.conversations as any;
      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
      organizationId = contact?.organization_id;
    }

    // Get audio as base64
    let base64Data: string | null = null;
    let audioMime = mime_type || "audio/ogg";

    if (audio_url.startsWith("data:")) {
      const base64Match = audio_url.match(/^data:(.+?);base64,(.+)$/);
      if (base64Match) {
        audioMime = base64Match[1];
        base64Data = base64Match[2];
      }
    } else {
      try {
        const audioResponse = await fetch(audio_url);
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          base64Data = btoa(
            Array.from(new Uint8Array(audioBuffer))
              .map(b => String.fromCharCode(b))
              .join('')
          );
        } else {
          console.warn("[transcribe-audio] Failed to download audio:", audioResponse.status);
        }
      } catch (fetchErr) {
        console.warn("[transcribe-audio] Error downloading audio:", fetchErr);
      }
    }

    let transcript = "";

    if (base64Data) {
      // Determine format for input_audio
      let audioFormat = "ogg";
      if (audioMime.includes("mp3") || audioMime.includes("mpeg")) audioFormat = "mp3";
      else if (audioMime.includes("wav")) audioFormat = "wav";
      else if (audioMime.includes("mp4") || audioMime.includes("m4a")) audioFormat = "mp4";
      else if (audioMime.includes("webm")) audioFormat = "webm";

      console.log("[transcribe-audio] Trying input_audio format...");
      const aiResult = await callAI({
        organizationId,
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva EXATAMENTE e SOMENTE o que é dito no áudio.\nREGRAS OBRIGATÓRIAS:\n1. Retorne APENAS as palavras reais pronunciadas\n2. NÃO adicione, complete ou invente conteúdo\n3. NÃO interprete ou parafraseie\n4. Se o áudio tiver menos de 5 segundos, tenha CAUTELA EXTRA — retorne somente palavras que você ouviu com clareza\n5. Se não conseguir entender claramente, responda exatamente: Áudio inaudível\n6. Prefira retornar 'Áudio inaudível' a inventar palavras"
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Data,
                  format: audioFormat,
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
      });

      if (aiResult.ok) {
        transcript = aiResult.data?.choices?.[0]?.message?.content?.trim() || "";
        console.log("[transcribe-audio] input_audio success:", transcript.substring(0, 100));
      } else {
        console.warn("[transcribe-audio] input_audio failed:", aiResult.status, aiResult.error);

        // Strategy 2: Try image_url with public Storage URL (not data URL)
        if (!audio_url.startsWith("data:") && audio_url.startsWith("http")) {
          console.log("[transcribe-audio] Trying image_url with public URL...");
          const fallbackResult = await callAI({
            organizationId,
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Transcreva EXATAMENTE o que é dito no áudio. Retorne APENAS as palavras pronunciadas, nada mais. Se o áudio for muito curto ou inaudível, responda exatamente: 'Áudio inaudível'. NÃO invente ou complete frases."
                  },
                  {
                    type: "image_url",
                    image_url: { url: audio_url }
                  }
                ]
              }
            ],
            max_tokens: 2000,
          });

          if (fallbackResult.ok) {
            transcript = fallbackResult.data?.choices?.[0]?.message?.content?.trim() || "";
            console.log("[transcribe-audio] image_url public URL success:", transcript.substring(0, 100));
          } else {
            console.error("[transcribe-audio] image_url also failed:", fallbackResult.status, fallbackResult.error);
            transcript = "Transcrição indisponível";
          }
        } else {
          transcript = "Transcrição indisponível";
        }
      }
    } else {
      console.warn("[transcribe-audio] No audio content available for transcription");
      transcript = "Transcrição indisponível (áudio expirado)";
    }

    if (transcript) {
      const { data: msg } = await supabase
        .from("messages")
        .select("metadata")
        .eq("id", message_id)
        .single();

      const currentMetadata = (msg?.metadata as Record<string, unknown>) || {};
      
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          metadata: {
            ...currentMetadata,
            transcript,
            transcribed_at: new Date().toISOString(),
          }
        })
        .eq("id", message_id);

      if (updateError) {
        console.error("[transcribe-audio] Error updating message:", updateError);
      } else {
        console.log("[transcribe-audio] Message updated with transcript");
      }
    }

    return new Response(
      JSON.stringify({ success: true, transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[transcribe-audio] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
