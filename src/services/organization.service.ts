/**
 * Organization Service
 * 
 * API client for organization, subscription, and limits data.
 * All business logic (isActive, isTrial, etc.) is computed on the backend.
 */

import { invokeFunction } from "./api";

export interface OrganizationStatusResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    block_reason: string | null;
  } | null;
  subscription: {
    id: string;
    status: string;
    billing_cycle: string | null;
    current_period_end: string | null;
    current_period_start: string | null;
    trial_end: string | null;
    mp_subscription_id: string | null;
  } | null;
  plan: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    is_free: boolean | null;
    trial_days: number | null;
    limits: Record<string, unknown> | null;
  } | null;
  memberRole: string | null;
  isActive: boolean;
  isBlocked: boolean;
  isPending: boolean;
  isTrial: boolean;
  isTrialExpired: boolean;
  isOwner: boolean;
  isOverdue: boolean;
  overdueDays: number;
  trialDaysRemaining: number | null;
  features: string[];
  storageLimitMB: number;
  storageUsedMB: number;
  storageUsedBytes: number;
  storagePercentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  fileCount: number;
  memberLimit: number;
  contactLimit: number;
  dataRetentionDays: number;
}

/**
 * Fetch complete organization status from backend.
 * All subscription/limits/storage calculations happen server-side.
 */
export async function getOrganizationStatus(
  impersonateOrgId?: string | null
): Promise<OrganizationStatusResponse> {
  return invokeFunction<OrganizationStatusResponse>("organization-status", {
    action: "get-status",
    ...(impersonateOrgId ? { impersonate_org_id: impersonateOrgId } : {}),
  });
}

export interface WebhookUrlsResponse {
  baseUrl: string;
  urls: Record<string, string>;
}

/**
 * Fetch webhook URLs computed on the backend.
 */
export async function getWebhookUrls(): Promise<WebhookUrlsResponse> {
  return invokeFunction<WebhookUrlsResponse>("organization-status", {
    action: "get-webhook-urls",
  });
}
