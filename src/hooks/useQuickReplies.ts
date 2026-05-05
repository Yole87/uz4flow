import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type QuickReplyMediaType = "text" | "audio" | "image" | "video" | "document";

export interface QuickReply {
  id: string;
  organization_id: string;
  title: string;
  content: string | null;
  category: string | null;
  media_type: QuickReplyMediaType;
  media_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  applies_to_all_instances: boolean;
  /** When applies_to_all_instances is false, list of instance ids it is restricted to */
  instance_ids: string[];
}

// Limits per media type (per organization)
export const QUICK_REPLY_LIMITS: Record<QuickReplyMediaType, number> = {
  text: 30,
  audio: 5,
  image: 15,
  video: 5,
  document: 5,
};

const BUCKET = "quick-reply-media";
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

/**
 * Fetch all quick replies for the org plus their instance bindings.
 * Pass `instanceFilter` to restrict client-side to ones applicable to a
 * given instance (or "all" / undefined to return everything).
 */
export function useQuickReplies(instanceFilter?: string | null) {
  const { data: org } = useUserOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = org?.id;

  const query = useQuery({
    queryKey: ["quick-replies", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("quick_replies" as any)
        .select("*, quick_reply_instances(instance_id)")
        .eq("organization_id", orgId)
        .order("media_type")
        .order("title");
      if (error) throw error;
      type RawRow = QuickReply & { quick_reply_instances?: { instance_id: string }[] };
      return ((data || []) as unknown as RawRow[]).map((row) => ({
        ...row,
        instance_ids: (row.quick_reply_instances || []).map((r) => r.instance_id),
      })) as QuickReply[];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const all = query.data || [];
  const quickReplies = instanceFilter
    ? all.filter((qr) => qr.applies_to_all_instances || qr.instance_ids.includes(instanceFilter))
    : all;

  const uploadFile = async (file: File): Promise<{ url: string; path: string }> => {
    if (!orgId) throw new Error("Organização não encontrada");
    if (file.size > MAX_FILE_SIZE) throw new Error("Arquivo excede 16MB");

    const ext = file.name.split(".").pop() || "bin";
    const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !signed) throw signErr || new Error("Falha ao gerar URL");

    return { url: signed.signedUrl, path };
  };

  /** Replace the link rows for a given quick reply */
  const syncInstanceLinks = async (
    quickReplyId: string,
    appliesToAll: boolean,
    instanceIds: string[],
  ) => {
    // Always wipe existing links
    await supabase
      .from("quick_reply_instances" as any)
      .delete()
      .eq("quick_reply_id", quickReplyId);

    if (!appliesToAll && instanceIds.length > 0) {
      const rows = instanceIds.map((id) => ({
        quick_reply_id: quickReplyId,
        instance_id: id,
      }));
      const { error } = await supabase.from("quick_reply_instances" as any).insert(rows);
      if (error) throw error;
    }
  };

  const createMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      content?: string;
      category?: string;
      media_type: QuickReplyMediaType;
      file?: File;
      applies_to_all_instances?: boolean;
      instance_ids?: string[];
    }) => {
      if (!orgId || !user) throw new Error("Não autenticado");

      const currentCount = all.filter((qr) => qr.media_type === input.media_type).length;
      if (currentCount >= QUICK_REPLY_LIMITS[input.media_type]) {
        throw new Error(
          `Limite atingido: máximo ${QUICK_REPLY_LIMITS[input.media_type]} respostas do tipo ${input.media_type}`,
        );
      }

      let media_url: string | null = null;
      let file_name: string | null = null;
      let mime_type: string | null = null;
      let file_size: number | null = null;

      if (input.media_type !== "text") {
        if (!input.file) throw new Error("Arquivo obrigatório para mídia");
        const { url } = await uploadFile(input.file);
        media_url = url;
        file_name = input.file.name;
        mime_type = input.file.type;
        file_size = input.file.size;
      }

      const appliesToAll = input.applies_to_all_instances !== false;
      const { data: inserted, error } = await supabase
        .from("quick_replies" as any)
        .insert({
          organization_id: orgId,
          title: input.title,
          content: input.content || (input.media_type === "text" ? "" : null),
          category: input.category || null,
          media_type: input.media_type,
          media_url,
          file_name,
          mime_type,
          file_size,
          created_by: user.id,
          applies_to_all_instances: appliesToAll,
        })
        .select("id")
        .single();
      if (error) throw error;

      await syncInstanceLinks(
        (inserted as unknown as { id: string }).id,
        appliesToAll,
        input.instance_ids || [],
      );

      if (media_url) {
        supabase.rpc("recalculate_org_storage", { p_org_id: orgId }).then(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-replies", orgId] });
      toast.success("Resposta rápida criada");
    },
    onError: (err: Error) => toast.error(err?.message || "Erro ao criar resposta rápida"),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      content?: string;
      category?: string;
      applies_to_all_instances?: boolean;
      instance_ids?: string[];
    }) => {
      const appliesToAll = input.applies_to_all_instances !== false;
      const { error } = await supabase
        .from("quick_replies" as any)
        .update({
          title: input.title,
          content: input.content ?? null,
          category: input.category || null,
          applies_to_all_instances: appliesToAll,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;

      await syncInstanceLinks(input.id, appliesToAll, input.instance_ids || []);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-replies", orgId] });
      toast.success("Resposta rápida atualizada");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (qr: QuickReply) => {
      if (qr.media_url && qr.media_type !== "text") {
        try {
          const m = qr.media_url.match(/quick-reply-media\/([^?]+)/);
          if (m && m[1]) await supabase.storage.from(BUCKET).remove([m[1]]);
        } catch {
          // ignore
        }
      }
      const { error } = await supabase.from("quick_replies" as any).delete().eq("id", qr.id);
      if (error) throw error;
      if (orgId) {
        supabase.rpc("recalculate_org_storage", { p_org_id: orgId }).then(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-replies", orgId] });
      toast.success("Resposta rápida excluída");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  return {
    quickReplies,
    allQuickReplies: all,
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/** Hook to list selectable instances (WhatsApp + Instagram) for the org. */
export function useSelectableInstances() {
  const { data: org } = useUserOrganization();
  return useQuery({
    queryKey: ["selectable-instances", org?.id],
    queryFn: async () => {
      if (!org?.id) return [] as { id: string; name: string; provider: string }[];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name, provider")
        .eq("organization_id", org.id)
        .in("provider", ["baileys", "meta_official", "instagram_dm"])
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as { id: string; name: string; provider: string }[];
    },
    enabled: !!org?.id,
  });
}
