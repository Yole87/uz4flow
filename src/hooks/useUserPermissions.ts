import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { hasPermission, mergeWithTree, type PermissionsObject } from "@/lib/permissionsCatalog";
import { getImpersonatedOrgId } from "@/hooks/useImpersonation";

interface UseUserPermissionsResult {
  isOwner: boolean;
  permissions: PermissionsObject | null;
  allowedInstances: string[] | null; // null = todas; [] = nenhuma
  can: (menu: string, action: string) => boolean;
  isLoading: boolean;
}

/**
 * Hook central de permissões.
 * - Owners da organização (e admin_master/impersonação) recebem acesso total.
 * - Membros da equipe (team_members) usam permissions do team_profile vinculado.
 */
export function useUserPermissions(): UseUserPermissionsResult {
  const { user } = useAuth();
  const { data: organization, isLoading: orgLoading } = useUserOrganization();
  const impersonating = !!getImpersonatedOrgId();

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id, organization?.id, impersonating],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return null;

      // Owner check
      const { data: org } = await supabase
        .from("organizations")
        .select("owner_user_id")
        .eq("id", organization.id)
        .maybeSingle();
      const isOwner = org?.owner_user_id === user.id || impersonating;

      if (isOwner) {
        return { isOwner: true, permissions: null, allowedInstances: null };
      }

      // Membro da equipe → busca perfil
      const { data: member } = await supabase
        .from("team_members")
        .select("team_profile_id, team_profiles(permissions)")
        .eq("organization_id", organization.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const rawPerms = (member as any)?.team_profiles?.permissions;
      const merged = mergeWithTree(rawPerms);
      const instancesScope: string[] | undefined = merged?.crm?.instances_scope;
      const allowedInstances =
        Array.isArray(instancesScope) && instancesScope.length > 0 ? instancesScope : null;

      return { isOwner: false, permissions: merged, allowedInstances };
    },
    enabled: !!user?.id && !!organization?.id,
    staleTime: 1000 * 60 * 5,
  });

  const can = useMemo(() => {
    return (menu: string, action: string) => {
      if (!data) return false;
      if (data.isOwner) return true;
      return hasPermission(data.permissions, menu, action);
    };
  }, [data]);

  return {
    isOwner: data?.isOwner ?? false,
    permissions: data?.permissions ?? null,
    allowedInstances: data?.allowedInstances ?? null,
    can,
    isLoading: orgLoading || isLoading,
  };
}
