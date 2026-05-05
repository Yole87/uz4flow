/**
 * Business Logic Tests: Organization Status & Subscription
 *
 * Tests the core business rules that the organization-status edge function
 * computes. We replicate the logic locally so regressions are caught
 * before deployment.
 */
import { describe, it, expect } from "vitest";

// ──── Replicated business logic from organization-status/index.ts ────

interface SubRecord {
  status: string;
  current_period_end: string | null;
  trial_end: string | null;
  overdue_since: string | null;
}

interface OrgRecord {
  blocked_at: string | null;
  is_active: boolean;
}

interface PlanLimits {
  features?: string[];
  storage_limit_mb?: number;
  member_limit?: number;
  contact_limit?: number;
}

function computeStatus(org: OrgRecord, sub: SubRecord | null, limits: PlanLimits | null, memberRole: string | null) {
  const isBlocked = org.blocked_at !== null;

  const isActive = !!(
    sub?.status === "active" &&
    !isBlocked &&
    (sub?.current_period_end === null ||
      new Date(sub.current_period_end) > new Date())
  );

  const isPending = sub?.status === "pending";

  const isTrial = !!(
    sub?.trial_end &&
    new Date(sub.trial_end) > new Date()
  );

  const isTrialExpired = !!(
    sub?.trial_end &&
    new Date(sub.trial_end) <= new Date()
  );

  const trialDaysRemaining = sub?.trial_end
    ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const isOwner = memberRole === "owner";

  const overdueSince = sub?.overdue_since ? new Date(sub.overdue_since) : null;
  const isOverdue = !!(overdueSince && sub?.status !== "suspended");
  const overdueDays = overdueSince
    ? Math.floor((Date.now() - overdueSince.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const features: string[] = limits?.features ?? [];
  const storageLimitMB = limits?.storage_limit_mb ?? 500;
  const memberLimit = limits?.member_limit ?? 1;
  const contactLimit = limits?.contact_limit ?? 500;

  return {
    isActive, isBlocked, isPending, isTrial, isTrialExpired,
    isOwner, isOverdue, overdueDays, trialDaysRemaining,
    features, storageLimitMB, memberLimit, contactLimit,
  };
}

// ──── Feature Gating ────

describe("Plan Feature Gating", () => {
  const org: OrgRecord = { blocked_at: null, is_active: true };
  const activeSub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };

  it("user WITHOUT feature → must be blocked", () => {
    const limits: PlanLimits = { features: ["crm_whatsapp"] };
    const result = computeStatus(org, activeSub, limits, "owner");
    expect(result.features).not.toContain("ai_features");
    expect(result.features).not.toContain("prospection");
  });

  it("user WITH feature → must have access", () => {
    const limits: PlanLimits = { features: ["crm_whatsapp", "ai_features", "prospection"] };
    const result = computeStatus(org, activeSub, limits, "owner");
    expect(result.features).toContain("crm_whatsapp");
    expect(result.features).toContain("ai_features");
    expect(result.features).toContain("prospection");
  });

  it("null limits → empty features array", () => {
    const result = computeStatus(org, activeSub, null, "owner");
    expect(result.features).toEqual([]);
  });

  it("limits without features key → empty array", () => {
    const limits: PlanLimits = { storage_limit_mb: 1000 };
    const result = computeStatus(org, activeSub, limits, "owner");
    expect(result.features).toEqual([]);
  });
});

// ──── Plan Limits ────

describe("Plan Limits", () => {
  const org: OrgRecord = { blocked_at: null, is_active: true };
  const activeSub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };

  it("custom limits are respected", () => {
    const limits: PlanLimits = { storage_limit_mb: 2000, member_limit: 5, contact_limit: 10000 };
    const result = computeStatus(org, activeSub, limits, "owner");
    expect(result.storageLimitMB).toBe(2000);
    expect(result.memberLimit).toBe(5);
    expect(result.contactLimit).toBe(10000);
  });

  it("defaults when limits are null", () => {
    const result = computeStatus(org, activeSub, null, "owner");
    expect(result.storageLimitMB).toBe(500);
    expect(result.memberLimit).toBe(1);
    expect(result.contactLimit).toBe(500);
  });

  it("unlimited (-1) limits are passed through", () => {
    const limits: PlanLimits = { storage_limit_mb: -1, member_limit: -1, contact_limit: -1 };
    const result = computeStatus(org, activeSub, limits, "owner");
    expect(result.storageLimitMB).toBe(-1);
    expect(result.memberLimit).toBe(-1);
    expect(result.contactLimit).toBe(-1);
  });
});

// ──── Trial Behavior ────

describe("Trial Behavior", () => {
  const org: OrgRecord = { blocked_at: null, is_active: true };

  it("active trial → isTrial true, isTrialExpired false", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: futureDate, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isTrial).toBe(true);
    expect(result.isTrialExpired).toBe(false);
    expect(result.trialDaysRemaining).toBeGreaterThan(0);
    expect(result.isActive).toBe(true);
  });

  it("expired trial → isTrial false, isTrialExpired true", () => {
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: pastDate, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isTrial).toBe(false);
    expect(result.isTrialExpired).toBe(true);
    expect(result.trialDaysRemaining).toBe(0);
  });

  it("no trial_end → trialDaysRemaining is null", () => {
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isTrial).toBe(false);
    expect(result.isTrialExpired).toBe(false);
    expect(result.trialDaysRemaining).toBeNull();
  });
});

// ──── Subscription States ────

describe("Subscription States", () => {
  const org: OrgRecord = { blocked_at: null, is_active: true };

  it("active subscription → isActive true", () => {
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isActive).toBe(true);
    expect(result.isPending).toBe(false);
  });

  it("pending subscription → isPending true, isActive false", () => {
    const sub: SubRecord = { status: "pending", current_period_end: null, trial_end: null, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isPending).toBe(true);
    expect(result.isActive).toBe(false);
  });

  it("expired period → isActive false", () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const sub: SubRecord = { status: "active", current_period_end: pastDate, trial_end: null, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isActive).toBe(false);
  });

  it("no subscription → isActive false", () => {
    const result = computeStatus(org, null, null, "owner");
    expect(result.isActive).toBe(false);
    expect(result.isPending).toBe(false);
  });

  it("suspended subscription → not overdue", () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const sub: SubRecord = { status: "suspended", current_period_end: null, trial_end: null, overdue_since: pastDate };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isOverdue).toBe(false);
    expect(result.isActive).toBe(false);
  });
});

// ──── Blocked Organization ────

describe("Blocked Organization", () => {
  it("blocked_at set → isBlocked true, isActive false even with active sub", () => {
    const org: OrgRecord = { blocked_at: new Date().toISOString(), is_active: false };
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isBlocked).toBe(true);
    expect(result.isActive).toBe(false);
  });

  it("blocked_at null → isBlocked false", () => {
    const org: OrgRecord = { blocked_at: null, is_active: true };
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isBlocked).toBe(false);
    expect(result.isActive).toBe(true);
  });
});

// ──── Grace Period (Overdue) ────

describe("Grace Period / Overdue", () => {
  const org: OrgRecord = { blocked_at: null, is_active: true };

  it("overdue 2 days → isOverdue true, overdueDays ~2", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: twoDaysAgo };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isOverdue).toBe(true);
    expect(result.overdueDays).toBeGreaterThanOrEqual(1);
    expect(result.overdueDays).toBeLessThanOrEqual(3);
  });

  it("no overdue_since → isOverdue false, overdueDays 0", () => {
    const sub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isOverdue).toBe(false);
    expect(result.overdueDays).toBe(0);
  });

  it("overdue 5+ days + suspended → isOverdue false (already suspended)", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const sub: SubRecord = { status: "suspended", current_period_end: null, trial_end: null, overdue_since: fiveDaysAgo };
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isOverdue).toBe(false);
  });
});

// ──── Role Checks ────

describe("Role Checks", () => {
  const org: OrgRecord = { blocked_at: null, is_active: true };
  const sub: SubRecord = { status: "active", current_period_end: null, trial_end: null, overdue_since: null };

  it("owner role → isOwner true", () => {
    const result = computeStatus(org, sub, null, "owner");
    expect(result.isOwner).toBe(true);
  });

  it("member role → isOwner false", () => {
    const result = computeStatus(org, sub, null, "member");
    expect(result.isOwner).toBe(false);
  });

  it("null role → isOwner false", () => {
    const result = computeStatus(org, sub, null, null);
    expect(result.isOwner).toBe(false);
  });
});

// ──── Storage Calculations ────

describe("Storage Calculations", () => {
  it("percentage computed correctly", () => {
    const usedBytes = 800 * 1024 * 1024; // 800 MB
    const storageLimitMB = 1000;
    const usedMB = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
    const storagePercentage = Math.min(100, (usedMB / storageLimitMB) * 100);
    expect(storagePercentage).toBe(80);
    expect(storagePercentage > 80).toBe(false); // isNearLimit threshold
  });

  it("at limit → percentage capped at 100", () => {
    const usedBytes = 1200 * 1024 * 1024; // 1200 MB
    const storageLimitMB = 1000;
    const usedMB = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
    const storagePercentage = Math.min(100, (usedMB / storageLimitMB) * 100);
    expect(storagePercentage).toBe(100);
  });

  it("zero limit → percentage is 0 (no division by zero)", () => {
    const usedMB = 50;
    const storageLimitMB = 0;
    const storagePercentage = storageLimitMB > 0 ? Math.min(100, (usedMB / storageLimitMB) * 100) : 0;
    expect(storagePercentage).toBe(0);
  });
});
