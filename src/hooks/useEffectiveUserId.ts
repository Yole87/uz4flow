import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getImpersonatedOrgId } from "@/hooks/useImpersonation";

/**
 * Resolves the effective user_id for queries on tables that use user_id (not organization_id).
 * In impersonation mode, returns the owner_user_id of the impersonated organization.
 * In normal mode, returns the current authenticated user's id.
 */
export function useEffectiveUserId() {
  const { user } = useAuth();
  const impersonatedOrgId = getImpersonatedOrgId();

  const { data: ownerUserId, isLoading } = useQuery({
    queryKey: ["effective-user-id", impersonatedOrgId],
    queryFn: async () => {
      if (!impersonatedOrgId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("owner_user_id")
        .eq("id", impersonatedOrgId)
        .maybeSingle();
      if (error) throw error;
      return data?.owner_user_id ?? null;
    },
    enabled: !!impersonatedOrgId,
    staleTime: 1000 * 60 * 10,
  });

  const effectiveUserId = impersonatedOrgId
    ? ownerUserId ?? null
    : user?.id ?? null;

  return {
    effectiveUserId,
    isLoading: impersonatedOrgId ? isLoading : false,
  };
}
