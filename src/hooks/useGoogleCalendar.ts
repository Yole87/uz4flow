import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
      const redirectUrl = `${window.location.origin}/agenda`;

      console.log(`[GCal-Connect] trace_id=${traceId} redirect_url=${redirectUrl}`);

      const { data, error } = await supabase.functions.invoke("google-calendar-oauth", {
        body: {
          organization_id: org.id,
          redirect_url: redirectUrl,
          trace_id: traceId,
        },
      });
      if (error) throw error;
      if (data?.error_code === "tenant_google_not_configured") {
        toast.error("Configure as credenciais do Google Calendar em Agenda → Configurações antes de conectar.");
        return;
      }
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

  const queryClient = useQueryClient();

  const listEventsMutation = useMutation({
    mutationFn: async (params: { start: string; end: string }) => {
      if (!org?.id) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("google-calendar-list", {
        body: { ...params, organization_id: org.id },
      });
      if (error) throw error;
      return data?.items ?? [];
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (event_id: string) => {
      if (!org?.id) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("google-calendar-delete", {
        body: { event_id, organization_id: org.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Evento excluído"),
    onError: (err: Error) => toast.error(err.message || "Erro ao excluir evento"),
  });

  const updateEventMutation = useMutation({
    mutationFn: async (params: { event_id: string } & CreateEventParams) => {
      if (!org?.id) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("google-calendar-update", {
        body: { ...params, organization_id: org.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Evento atualizado"),
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar evento"),
  });

  const { data: account } = useQuery({
    queryKey: ["google-calendar-account", org?.id],
    queryFn: async () => {
      if (!org?.id) return null;
      const { data, error } = await supabase.functions.invoke("google-calendar-account", {
        body: { organization_id: org.id },
      });
      if (error || data?.error) {
        console.error("[useGoogleCalendar] google-calendar-account failed:", error ?? data?.error);
        return null;
      }
      return (data ?? null) as { email: string | null; name: string | null; picture: string | null } | null;
    },
    enabled: !!org?.id && !!isConnected,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isConnected: !!isConnected,
    checkingConnection,
    accountEmail: account?.email ?? null,
    connect: connectMutation.mutate,
    connecting: connectMutation.isPending,
    createEvent: createEventMutation.mutateAsync,
    creating: createEventMutation.isPending,
    listEvents: listEventsMutation.mutateAsync,
    listingEvents: listEventsMutation.isPending,
    deleteEvent: deleteEventMutation.mutateAsync,
    deletingEvent: deleteEventMutation.isPending,
    updateEvent: updateEventMutation.mutateAsync,
    updatingEvent: updateEventMutation.isPending,
  };
}
