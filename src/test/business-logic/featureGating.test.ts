/**
 * Business Logic Tests: Feature Gating (hasFeature / LimitAlert)
 *
 * Tests that the hasFeature function correctly gates access
 * based on plan features array.
 */
import { describe, it, expect } from "vitest";

// Replicated from useOrganizationLimits
function hasFeature(features: string[], feature: string): boolean {
  return features.includes(feature);
}

// Replicated from getOrgFeatures (edge function shared helper)
function getOrgFeatures(
  subStatus: string | null,
  planLimits: Record<string, unknown> | null
): string[] {
  if (!subStatus || subStatus !== "active") return [];
  if (!planLimits) return [];
  return (planLimits.features as string[]) ?? [];
}

// ──── hasFeature ────

describe("hasFeature", () => {
  it("returns true when feature exists in plan", () => {
    const features = ["crm_whatsapp", "pipeline", "followup", "automations"];
    expect(hasFeature(features, "crm_whatsapp")).toBe(true);
    expect(hasFeature(features, "automations")).toBe(true);
  });

  it("returns false when feature is NOT in plan", () => {
    const features = ["crm_whatsapp"];
    expect(hasFeature(features, "ai_features")).toBe(false);
    expect(hasFeature(features, "prospection")).toBe(false);
    expect(hasFeature(features, "whitelabel")).toBe(false);
  });

  it("empty features → always false", () => {
    expect(hasFeature([], "crm_whatsapp")).toBe(false);
  });
});

// ──── getOrgFeatures (edge function helper) ────

describe("getOrgFeatures (edge function gating)", () => {
  it("active subscription + features → returns features", () => {
    const limits = { features: ["crm_whatsapp", "ai_features"] };
    const result = getOrgFeatures("active", limits);
    expect(result).toEqual(["crm_whatsapp", "ai_features"]);
  });

  it("inactive subscription → returns empty array", () => {
    const limits = { features: ["crm_whatsapp", "ai_features"] };
    expect(getOrgFeatures("pending", limits)).toEqual([]);
    expect(getOrgFeatures("cancelled", limits)).toEqual([]);
    expect(getOrgFeatures("suspended", limits)).toEqual([]);
    expect(getOrgFeatures(null, limits)).toEqual([]);
  });

  it("active subscription + null limits → returns empty", () => {
    expect(getOrgFeatures("active", null)).toEqual([]);
  });

  it("active subscription + no features key → returns empty", () => {
    expect(getOrgFeatures("active", { storage_limit_mb: 500 })).toEqual([]);
  });
});

// ──── Plan tier scenarios ────

describe("Plan Tier Feature Sets", () => {
  const starterFeatures = ["crm_whatsapp", "pipeline", "followup", "basic_support"];
  const proFeatures = [...starterFeatures, "automations", "prospection", "analytics", "priority_support"];
  const businessFeatures = [...proFeatures, "ai_features", "api_access"];
  const enterpriseFeatures = [...businessFeatures, "mcp_gateway", "whitelabel", "dedicated_support"];

  it("Starter → no AI, no prospection, no API", () => {
    expect(hasFeature(starterFeatures, "ai_features")).toBe(false);
    expect(hasFeature(starterFeatures, "prospection")).toBe(false);
    expect(hasFeature(starterFeatures, "api_access")).toBe(false);
    expect(hasFeature(starterFeatures, "crm_whatsapp")).toBe(true);
  });

  it("Pro → has prospection, no AI", () => {
    expect(hasFeature(proFeatures, "prospection")).toBe(true);
    expect(hasFeature(proFeatures, "automations")).toBe(true);
    expect(hasFeature(proFeatures, "ai_features")).toBe(false);
  });

  it("Business → has AI and API", () => {
    expect(hasFeature(businessFeatures, "ai_features")).toBe(true);
    expect(hasFeature(businessFeatures, "api_access")).toBe(true);
    expect(hasFeature(businessFeatures, "mcp_gateway")).toBe(false);
  });

  it("Enterprise → has everything", () => {
    expect(hasFeature(enterpriseFeatures, "mcp_gateway")).toBe(true);
    expect(hasFeature(enterpriseFeatures, "whitelabel")).toBe(true);
    expect(hasFeature(enterpriseFeatures, "dedicated_support")).toBe(true);
    expect(hasFeature(enterpriseFeatures, "crm_whatsapp")).toBe(true);
  });
});

// ──── Downgrade scenario ────

describe("Downgrade behavior", () => {
  it("downgraded plan loses higher-tier features", () => {
    // User had Business, downgraded to Pro
    const proFeatures = ["crm_whatsapp", "pipeline", "followup", "automations", "prospection", "analytics"];
    expect(hasFeature(proFeatures, "ai_features")).toBe(false);
    expect(hasFeature(proFeatures, "api_access")).toBe(false);
  });

  it("suspended subscription → edge function returns no features", () => {
    const limits = { features: ["crm_whatsapp", "ai_features", "prospection"] };
    const result = getOrgFeatures("suspended", limits);
    expect(result).toEqual([]);
  });
});
