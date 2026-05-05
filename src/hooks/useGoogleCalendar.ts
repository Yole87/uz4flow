import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "./useUserOrganization";
import { toast } from "sonner";

interface CreateEventParams {
  title: string;
  start_datetime: string;
  duration_minutes: number;
  description?: string;
  include_meet: boolean;
  conversation_id?: string;
  contact_name?: string;
}

function generateTraceId() {
  return `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function useGoogleCalendar() {
  const { data: org } = useUserOrganization();

  const { data: isConnected, isLoading: checkingConnection } = useQuery({
    queryKey: ["google-calendar-connection", org?.id],
    queryFn: async () => {
      if (!org?.id) return false;
      const { data } = await supabase
        .from("mcp_connections_safe" as any)
        .select("id, is_active")
        .eq("organization_id", org.id)
        .eq("provider", "google_calendar")
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!org?.id,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("No organization");

      const traceId = generateTraceId();
      // Store trace for post-callback diagnostics
      sessionStorage.setItem("gcal_trace_id", traceId);
      sessionStorage.setItem("gcal_trace_ts", Date.now().toString());

      // Use sanitized short redirect — never send full URL with tokens
      const redirectUrl = `${window.location.origin}/crm`;

      console.log(`[GCal-Connect] trace_id=${traceId} redirect_url=${redirectUrl}`);

      const { data, error } = await supabase.functions.invoke("google-calendar-oauth", {
        body: {
          organization_id: org.id,
          redirect_url: redirectUrl,
          trace_id: traceId,
        },
      });
      if (error) throw error;
      if (data?.url) {
        console.log(`[GCal-Connect] trace_id=${traceId} url_length=${data.url.length} state_length=${data.state_length ?? "?"}`);
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao conectar Google Calendar"),
  });

  const createEventMutation = useMutation({
    mutationFn: async (params: CreateEventParams) => {
      if (!org?.id) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("google-calendar-event", {
        body: { ...params, organization_id: org.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("Evento agendado com sucesso!"),
    onError: (err: Error) => toast.error(err.message || "Erro ao criar evento"),
  });

  return {
    isConnected: !!isConnected,
    checkingConnection,
    connect: connectMutation.mutate,
    connecting: connectMutation.isPending,
    createEvent: createEventMutation.mutateAsync,
    creating: createEventMutation.isPending,
  };
}
