import { useQuery } from "@tanstack/react-query";
import { getWebhookUrls } from "@/services/organization.service";
import { useAuth } from "@/lib/auth";

/**
 * Hook to fetch webhook URLs from the backend.
 * Replaces the old webhookUrls.ts frontend utility.
 */
export function useWebhookUrls() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["webhook-urls", user?.id],
    queryFn: () => getWebhookUrls(),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  return {
    urls: data?.urls ?? {},
    baseUrl: data?.baseUrl ?? "",
    loading: isLoading,
    error,
    getUrl: (service: string) => data?.urls?.[service] ?? "",
    getConnectorUrl: (token: string) => {
      const base = data?.baseUrl ?? "";
      return base ? `${base}/external-webhook?token=${token}` : "";
    },
  };
}
