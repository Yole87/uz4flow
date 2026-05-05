import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useActiveVoiceCall(contactId: string | null) {
  return useQuery({
    queryKey: ["active-voice-call", contactId],
    queryFn: async () => {
      if (!contactId) return null;

      const { data, error } = await supabase
        .from("voice_calls")
        .select("id, status, created_at, call_type, call_reason, vapi_call_id")
        .eq("contact_id", contactId)
        .in("status", ["pending", "ringing", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
    staleTime: 1500,
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | null | undefined)?.status;
      return status && ["pending", "ringing", "in_progress"].includes(status) ? 3000 : false;
    },
  });
}
