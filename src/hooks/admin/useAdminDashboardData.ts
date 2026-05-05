import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardFiltersState {
  start: string; // ISO
  end: string; // ISO
  compareStart?: string;
  compareEnd?: string;
  organizationId?: string | null;
  compareEnabled: boolean;
}

export interface AdminDashboardData {
  meta: {
    start: string;
    end: string;
    compareStart?: string;
    compareEnd?: string;
    organizationId: string | null;
    buckets: string[];
  };
  revenue: {
    mrr: number;
    arr: number;
    arpu: number;
    ltv: number;
    revenueRecognized: number;
    revenuePrev: number;
    revenuePctChange: number | null;
    refundRate: number;
    totalRefunded: number;
    pastDue: number;
    suspended: number;
    revenueByDay: Record<string, number>;
    revenueByDayPrev: Record<string, number>;
  };
  acquisition: {
    newSignups: number;
    newSignupsPrev: number;
    signupsPctChange: number | null;
    newPaying: number;
    conversionFreeToPaid: number;
    pendingLeads: number;
    organicSignups: number;
    affiliateSignups: number;
    couponSignups: number;
    signupsByDay: Record<string, number>;
  };
  retention: {
    churnRate: number;
    cancelledCount: number;
    mrrLost: number;
    nrr: number;
    trialsExpiring: number;
    avgLifetimeDays: number;
    cancelByDay: Record<string, number>;
    newSubsByDay: Record<string, number>;
  };
  engagement: {
    messagesCount: number;
    activeConversations: number;
    contactsCreated: number;
    avgDau: number;
    mau: number;
    stickiness: number;
    topOrgsByMessages: Array<{ id: string; name: string; count: number }>;
    messagesByDay: Record<string, number>;
    dauByDay: Record<string, number>;
  };
  ai: {
    flowSessionsCount: number;
    activeFlows: number;
    evalsCount: number;
    evalsPositiveRate: number;
    reengagements: number;
    flowSessionsByDay: Record<string, number>;
  };
  voice: {
    total: number;
    completed: number;
    failed: number;
    answerRate: number;
    avgDuration: number;
    cost: number;
    campaignsActive: number;
    byDay: Record<string, { completed: number; failed: number; other: number }>;
  };
  prospection: {
    searchesCount: number;
    leadsFound: number;
    resultsCount: number;
    importedCount: number;
    conversedCount: number;
    importRate: number;
    conversionToConv: number;
    topOrgsByLeads: Array<{ id: string; name: string; count: number }>;
  };
  instagram: {
    events: number;
    leads: number;
    accountsActive: number;
  };
  affiliates: {
    clicks: number;
    signups: number;
    paidConversions: number;
    clickToCustomer: number;
    totalCommissions: number;
    topAffiliates: Array<{ id: string; code: string; total: number }>;
  };
  infra: {
    totalStorageBytes: number;
    topStorageOrgs: Array<{ id: string; name: string; bytes: number }>;
    webhookErrors24h: number;
    notifSuccess: number;
    notifFailed: number;
  };
  insights: {
    atRiskClients: Array<{ id: string; name: string; current: number; previous: number; dropPct: number }>;
    championClients: Array<{ id: string; name: string; current: number; previous: number; growthPct: number }>;
    successCases: Array<{ id: string; name: string; messages: number; plan: string }>;
  };
}

export function useAdminDashboardData(filters: DashboardFiltersState) {
  return useQuery<AdminDashboardData>({
    queryKey: ["admin-dashboard-metrics", filters],
    queryFn: async () => {
      const body = {
        start: filters.start,
        end: filters.end,
        compareStart: filters.compareEnabled ? filters.compareStart : undefined,
        compareEnd: filters.compareEnabled ? filters.compareEnd : undefined,
        organizationId: filters.organizationId ?? null,
      };
      const { data, error } = await supabase.functions.invoke(
        "admin-dashboard-metrics",
        { body },
      );
      if (error) throw error;
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      return data as AdminDashboardData;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
