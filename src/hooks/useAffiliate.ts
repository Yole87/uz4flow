import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface AffiliateRecord {
  id: string;
  user_id: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  commission_percent: number | null;
  min_payout: number | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  bank_holder_name: string | null;
  bank_holder_document: string | null;
  pix_key_type: string | null;
  pix_key: string | null;
  terms_version: number | null;
  terms_accepted_at: string | null;
  created_at: string;
  approved_at: string | null;
}

export function useAffiliate() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["affiliate", user?.id],
    queryFn: async (): Promise<AffiliateRecord | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AffiliateRecord) || null;
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });
}

export interface AffiliateSettings {
  id: string;
  default_commission_percent: number;
  min_payout: number;
  tax_percent: number;
  grace_period_days: number;
  attribution_window_days: number;
  payout_processing_hours: number;
  current_terms_version: number;
  program_enabled: boolean;
  commission_type: "recurring" | "one_time";
  payout_day_of_month: number;
  approval_sla_hours: number;
  allow_self_referral: boolean;
  allow_paid_traffic_on_brand: boolean;
  kit_url: string | null;
}

export const AFFILIATE_SETTINGS_DEFAULTS: AffiliateSettings = {
  id: "",
  default_commission_percent: 20,
  min_payout: 50,
  tax_percent: 6,
  grace_period_days: 8,
  attribution_window_days: 30,
  payout_processing_hours: 72,
  current_terms_version: 1,
  program_enabled: true,
  commission_type: "recurring",
  payout_day_of_month: 10,
  approval_sla_hours: 48,
  allow_self_referral: false,
  allow_paid_traffic_on_brand: false,
  kit_url: null,
};

export function useAffiliateSettings() {
  return useQuery({
    queryKey: ["affiliate-settings"],
    queryFn: async (): Promise<AffiliateSettings> => {
      try {
        const { data, error } = await supabase
          .from("affiliate_settings")
          .select("*")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data) return AFFILIATE_SETTINGS_DEFAULTS;
        return { ...AFFILIATE_SETTINGS_DEFAULTS, ...(data as any) } as AffiliateSettings;
      } catch {
        return AFFILIATE_SETTINGS_DEFAULTS;
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAffiliateStats(affiliateId?: string) {
  return useQuery({
    queryKey: ["affiliate-stats", affiliateId],
    queryFn: async () => {
      if (!affiliateId) return null;
      const [clicks, referrals, commissions] = await Promise.all([
        supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliateId),
        supabase.from("affiliate_referrals").select("id, current_status, plan_id, first_payment_at").eq("affiliate_id", affiliateId),
        supabase.from("affiliate_commissions").select("commission_amount, status").eq("affiliate_id", affiliateId),
      ]);

      const refs = (referrals.data || []) as any[];
      const comms = (commissions.data || []) as any[];

      const totalClicks = clicks.count || 0;
      const totalSignups = refs.length;
      const activePaying = refs.filter((r) => r.current_status === "active").length;
      const conversionRate = totalClicks > 0 ? (activePaying / totalClicks) * 100 : 0;

      const pendingAmount = comms
        .filter((c) => c.status === "pending_grace")
        .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
      const availableAmount = comms
        .filter((c) => c.status === "available")
        .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
      const paidAmount = comms
        .filter((c) => c.status === "paid")
        .reduce((s, c) => s + Number(c.commission_amount || 0), 0);

      return {
        totalClicks,
        totalSignups,
        activePaying,
        conversionRate,
        pendingAmount,
        availableAmount,
        paidAmount,
      };
    },
    enabled: !!affiliateId,
    staleTime: 1000 * 30,
  });
}
