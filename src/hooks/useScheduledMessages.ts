import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type ScheduledMessage = Database["public"]["Tables"]["scheduled_messages"]["Row"];
export type ScheduledMessageInsert = Database["public"]["Tables"]["scheduled_messages"]["Insert"];

export type ScheduledMediaType = "image" | "audio" | "video" | "document";

export interface CreateScheduledMessageInput {
  conversation_id: string;
  contact_id: string;
  organization_id: string;
  instance_id?: string | null;
  content?: string;
  scheduled_for: string; // ISO
  file?: File;
  media_type?: ScheduledMediaType;
}

const BUCKET = "message-media";

export function useScheduledMessages(conversationId?: string | null) {
  const qc = useQueryClient();
  const queryKey = ["scheduled_messages", conversationId];

  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .in("status", ["pending", "failed"])
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return data as ScheduledMessage[];
    },
  });

  // Realtime invalidation per conversation
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`scheduled_messages_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const createMutation = useMutation({
    mutationFn: async (input: CreateScheduledMessageInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      let media_url: string | null = null;
      let mime_type: string | null = null;
      let file_name: string | null = null;

      if (input.file) {
        if (input.file.size > 16 * 1024 * 1024) {
          throw new Error("Arquivo excede o limite de 16MB");
        }
        const ext = input.file.name.split(".").pop() || "bin";
        const path = `${input.organization_id}/scheduled/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, input.file, { contentType: input.file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        media_url = pub.publicUrl;
        mime_type = input.file.type || "application/octet-stream";
        file_name = input.file.name;
      }

      const insert: ScheduledMessageInsert = {
        organization_id: input.organization_id,
        conversation_id: input.conversation_id,
        contact_id: input.contact_id,
        instance_id: input.instance_id ?? null,
        created_by: userId,
        content: input.content || null,
        media_url,
        media_type: input.media_type ?? null,
        file_name,
        mime_type,
        scheduled_for: input.scheduled_for,
        status: "pending",
      };

      const { data, error } = await supabase
        .from("scheduled_messages")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      // Update org storage usage in real-time when media is attached
      if (media_url) {
        supabase.rpc("recalculate_org_storage", { p_org_id: input.organization_id }).then(() => {});
      }
      return data as ScheduledMessage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Mensagem agendada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao agendar");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; content?: string; scheduled_for?: string }) => {
      const { error } = await supabase
        .from("scheduled_messages")
        .update({
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.scheduled_for ? { scheduled_for: input.scheduled_for } : {}),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Agendamento atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_messages")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Agendamento cancelado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    messages,
    isLoading,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    cancel: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
}
