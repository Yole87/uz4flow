import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { subscribeImpersonationChanges } from "@/hooks/useImpersonation";

const IMPERSONATION_KEY = "impersonatedOrgId";

// Reactive subscription to impersonation toggles, both same-tab (via the
// useImpersonation external store) and cross-tab (via storage events).
function getImpersonationSnapshot() {
  return typeof window !== "undefined"
    ? sessionStorage.getItem(IMPERSONATION_KEY)
    : null;
}

export function useUserOrganization(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const enabled = options?.enabled ?? true;
  const impersonatedOrgId = useSyncExternalStore(
    subscribeImpersonationChanges,
    getImpersonationSnapshot,
    () => null
  );

  return useQuery({
    queryKey: ["user-organization", user?.id, impersonatedOrgId],
    queryFn: async () => {
      if (!user) return null;

      // SUPPORT MODE: when impersonating, ALWAYS return the impersonated org.
      // Never silently fall back to the operator's own org — that would mask
      // a stale session and cause cross-tenant writes.
      if (impersonatedOrgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("id, name, slug, message_signature_enabled")
          .eq("id", impersonatedOrgId)
          .maybeSingle();
        return org ?? null;
      }

      // Try to get organization where user is owner first
      const { data: ownedOrg } = await supabase
        .from("organizations")
        .select("id, name, slug, message_signature_enabled")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (ownedOrg) return ownedOrg;

      // Otherwise check organization membership
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id, organizations(id, name, slug, message_signature_enabled)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.organizations) {
        return membership.organizations;
      }

      return null;
    },
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
