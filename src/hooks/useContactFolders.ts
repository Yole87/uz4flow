import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { toast } from "sonner";

export interface ContactFolder {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  icon: string;
  order_index: number;
  created_at: string;
}

export function useContactFolders() {
  const { data: organization } = useUserOrganization();

  return useQuery({
    queryKey: ["contact-folders", organization?.id],
    queryFn: async (): Promise<ContactFolder[]> => {
      if (!organization?.id) return [];
      const { data, error } = await (supabase as any)
        .from("contact_folders")
        .select("*")
        .eq("organization_id", organization.id)
        .order("order_index", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as ContactFolder[];
    },
    enabled: !!organization?.id,
  });
}

/** Returns a Map<contactId, folderId[]> for the org's contact ids passed in. */
export function useContactFolderMap(contactIds: string[]) {
  const { data: organization } = useUserOrganization();
  const ids = [...contactIds].sort();

  return useQuery({
    queryKey: ["contact-folder-map", organization?.id, ids.join(",")],
    queryFn: async (): Promise<Map<string, string[]>> => {
      const map = new Map<string, string[]>();
      if (!organization?.id || ids.length === 0) return map;
      const { data, error } = await (supabase as any)
        .from("contact_folder_members")
        .select("contact_id, folder_id")
        .eq("organization_id", organization.id)
        .in("contact_id", ids);
      if (error) throw error;
      for (const row of (data || []) as { contact_id: string; folder_id: string }[]) {
        const arr = map.get(row.contact_id) || [];
        arr.push(row.folder_id);
        map.set(row.contact_id, arr);
      }
      return map;
    },
    enabled: !!organization?.id && ids.length > 0,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();

  return useMutation({
    mutationFn: async (input: { name: string; color?: string; icon?: string }) => {
      if (!organization?.id) throw new Error("Sem organização");
      const { data, error } = await (supabase as any)
        .from("contact_folders")
        .insert({
          organization_id: organization.id,
          name: input.name.trim(),
          color: input.color || "#6366f1",
          icon: input.icon || "Folder",
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContactFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-folders"] });
      toast.success("Pasta criada!");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao criar pasta"),
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: string; icon?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.color !== undefined) patch.color = input.color;
      if (input.icon !== undefined) patch.icon = input.icon;
      const { error } = await (supabase as any)
        .from("contact_folders")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-folders"] });
      toast.success("Pasta atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar pasta"),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("contact_folders")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-folders"] });
      queryClient.invalidateQueries({ queryKey: ["contact-folder-map"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-by-folder"] });
      toast.success("Pasta removida");
    },
    onError: () => toast.error("Erro ao remover pasta"),
  });
}

export function useAssignContactsToFolder() {
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  return useMutation({
    mutationFn: async (input: { folderId: string; contactIds: string[] }) => {
      if (!organization?.id) throw new Error("Sem organização");
      if (input.contactIds.length === 0) return;
      const rows = input.contactIds.map((cid) => ({
        organization_id: organization.id,
        folder_id: input.folderId,
        contact_id: cid,
      }));
      const { error } = await (supabase as any)
        .from("contact_folder_members")
        .upsert(rows, { onConflict: "folder_id,contact_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contact-folder-map"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-by-folder"] });
      toast.success(`${vars.contactIds.length} contato(s) movido(s) para a pasta`);
    },
    onError: () => toast.error("Erro ao mover contatos"),
  });
}

export function useRemoveContactsFromFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { folderId: string; contactIds: string[] }) => {
      if (input.contactIds.length === 0) return;
      const { error } = await (supabase as any)
        .from("contact_folder_members")
        .delete()
        .eq("folder_id", input.folderId)
        .in("contact_id", input.contactIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-folder-map"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-by-folder"] });
      toast.success("Removido da pasta");
    },
    onError: () => toast.error("Erro ao remover da pasta"),
  });
}

/** Get contact ids belonging to a specific folder (for filtering). */
export function useContactsInFolder(folderId: string | null) {
  const { data: organization } = useUserOrganization();
  return useQuery({
    queryKey: ["contacts-by-folder", organization?.id, folderId],
    queryFn: async (): Promise<Set<string>> => {
      if (!organization?.id || !folderId) return new Set();
      const { data, error } = await (supabase as any)
        .from("contact_folder_members")
        .select("contact_id")
        .eq("organization_id", organization.id)
        .eq("folder_id", folderId);
      if (error) throw error;
      return new Set(((data || []) as { contact_id: string }[]).map((r) => r.contact_id));
    },
    enabled: !!organization?.id && !!folderId,
  });
}
