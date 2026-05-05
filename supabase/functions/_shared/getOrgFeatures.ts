/**
 * Shared helper to fetch an organization's active plan features.
 * Used by automation edge functions to gate execution by plan.
 */
// deno-lint-ignore no-explicit-any
export async function getOrgFeatures(supabase: any, orgId: string): Promise<string[]> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!sub || sub.status !== "active") return [];

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("limits")
    .eq("id", sub.plan_id)
    .single();

  if (!plan?.limits) return [];

  const limits = plan.limits as Record<string, unknown>;
  return (limits.features as string[]) ?? [];
}
