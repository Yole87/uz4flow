import { useOrganizationSubscription } from "./useOrganizationSubscription";
import { useAffiliate } from "./useAffiliate";

/**
 * Returns true when the authenticated user is an "affiliate-only" account:
 * has an `affiliates` record but no `organizations`/subscription.
 * Used to gate the sidebar so they only see the Afiliados area.
 */
export function useIsAffiliateOnly() {
  const { organization, loading: orgLoading } = useOrganizationSubscription();
  const { data: affiliate, isLoading: affLoading } = useAffiliate();

  const loading = orgLoading || affLoading;
  const isAffiliateOnly = !loading && !organization && !!affiliate;

  return { isAffiliateOnly, loading };
}
