import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";

/**
 * Returns the set of Instagram User IDs (ig_user_id) connected to the
 * current organization. Useful for detecting when an inbound DM came
 * from another internal account of the same owner — those contacts
 * should be flagged as "Conta interna" instead of looking like leads.
 */
export function useInternalIgAccounts() {
  const { data: organization } = useUserOrganization();

  return useQuery({
    queryKey: ["internal-ig-accounts", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return new Set<string>();
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("ig_user_id")
        .eq("organization_id", organization.id);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.ig_user_id).filter(Boolean));
    },
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5,
  });
}
