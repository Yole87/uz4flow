import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useLia, type LiaMessage, type GuidedStep } from "@/components/lia/LiaProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lia-chat`;

function parseGuidedSteps(content: string): GuidedStep[] | null {
  const match = content.match(/```guided_steps\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed?.steps && Array.isArray(parsed.steps)) {
      return parsed.steps;
    }
  } catch {}
  return null;
}

export function useLiaChat() {
  const { messages, setMessages, isStreaming, setIsStreaming, setGuidedSteps, setCurrentGuidedIndex, setIsOpen } = useLia();
  const { toast } = useToast();
  const location = useLocation();

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isStreaming) return;

      const userMsg: LiaMessage = { role: "user", content: input.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      let assistantSoFar = "";
      const allMessages = [...messages, userMsg];

      try {
        // Get real JWT and organization for authenticated log access
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const userId = sessionData?.session?.user?.id;

        // Fetch organization on-demand (avoids hook ordering issues)
        let organizationId: string | null = null;
        if (userId) {
          const { data: ownedOrg } = await supabase
            .from("organizations")
            .select("id")
            .eq("owner_user_id", userId)
            .limit(1)
            .maybeSingle();
          if (ownedOrg) {
            organizationId = ownedOrg.id;
          } else {
            const { data: membership } = await supabase
              .from("organization_members")
              .select("organization_id")
              .eq("user_id", userId)
              .limit(1)
              .maybeSingle();
            if (membership) organizationId = membership.organization_id;
          }
        }

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            currentRoute: location.pathname,
            organizationId,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Erro de conexão" }));
          toast({ title: "Erro", description: err.error || "Falha ao enviar mensagem", variant: "destructive" });
          setIsStreaming(false);
          return;
        }

        if (!resp.body) {
          setIsStreaming(false);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                  }
                  return [...prev, { role: "assistant", content: assistantSoFar }];
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remaining
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                  }
                  return [...prev, { role: "assistant", content: assistantSoFar }];
                });
              }
            } catch {}
          }
        }

        // Check for guided steps
        const steps = parseGuidedSteps(assistantSoFar);
        if (steps) {
          setGuidedSteps(steps);
          setCurrentGuidedIndex(0);
          setIsOpen(false);
        }
      } catch (e) {
        console.error("LIA chat error:", e);
        toast({ title: "Erro", description: "Não foi possível conectar à LIA", variant: "destructive" });
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, setMessages, setIsStreaming, toast, location.pathname, setGuidedSteps, setCurrentGuidedIndex, setIsOpen]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem("lia-chat-messages");
  }, [setMessages]);

  return { sendMessage, clearChat, messages, isStreaming };
}
