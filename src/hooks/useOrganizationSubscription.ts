import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getOrganizationStatus, type OrganizationStatusResponse } from "@/services/organization.service";
import { getImpersonatedOrgId } from "@/hooks/useImpersonation";

export function useOrganizationSubscription() {
  const { user } = useAuth();
  const impersonatedOrgId = getImpersonatedOrgId();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["organization-status", user?.id, impersonatedOrgId],
    queryFn: () => getOrganizationStatus(impersonatedOrgId),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  // loading is true when user exists but query hasn't resolved yet
  const loading = !!user && isLoading;

  return {
    organization: data?.organization ?? null,
    subscription: data?.subscription ?? null,
    plan: data?.plan ?? null,
    isActive: data?.isActive ?? false,
    isBlocked: data?.isBlocked ?? false,
    isPending: data?.isPending ?? false,
    isTrial: data?.isTrial ?? false,
    isTrialExpired: data?.isTrialExpired ?? false,
    isOwner: data?.isOwner ?? false,
    isOverdue: data?.isOverdue ?? false,
    overdueDays: data?.overdueDays ?? 0,
    trialDaysRemaining: data?.trialDaysRemaining ?? null,
    features: data?.features ?? [],
    storageLimitMB: data?.storageLimitMB ?? 500,
    memberLimit: data?.memberLimit ?? 1,
    contactLimit: data?.contactLimit ?? 500,
    dataRetentionDays: data?.dataRetentionDays ?? 0,
    storageUsedMB: data?.storageUsedMB ?? 0,
    storageUsedBytes: data?.storageUsedBytes ?? 0,
    storagePercentage: data?.storagePercentage ?? 0,
    isNearLimit: data?.isNearLimit ?? false,
    isAtLimit: data?.isAtLimit ?? false,
    fileCount: data?.fileCount ?? 0,
    loading,
    error: error ? (error instanceof Error ? error.message : "Erro ao carregar dados da assinatura") : null,
    refetch: async () => { await refetch(); },
  };
}

export type { OrganizationStatusResponse };
