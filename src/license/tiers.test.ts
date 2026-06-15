import { describe, it, expect } from "vitest";

import { entitlementForTier, FREE_ENTITLEMENT, tierForValidation } from "./tiers.js";
import type { LicenseValidation } from "./lemonsqueezy.js";

function valid(variantName?: string): LicenseValidation {
  return { valid: true, status: "active", variantName };
}

describe("tierForValidation", () => {
  it("maps an unlimited / automation variant to unlimited", () => {
    expect(tierForValidation(valid("Unlimited"))).toBe("unlimited");
    expect(tierForValidation(valid("Automation Plan"))).toBe("unlimited");
  });

  it("maps a single-device variant to single-device", () => {
    expect(tierForValidation(valid("Single Device"))).toBe("single-device");
    expect(tierForValidation(valid("Per-device license"))).toBe("single-device");
  });

  it("maps a valid but unknown variant to single-device (a valid key is at least Single-device)", () => {
    expect(tierForValidation(valid("Mystery Plan"))).toBe("single-device");
    expect(tierForValidation(valid(undefined))).toBe("single-device");
  });

  it("maps an invalid validation to free (defensive)", () => {
    expect(tierForValidation({ valid: false, status: "invalid" })).toBe("free");
  });
});

describe("entitlementForTier", () => {
  it("free carries the 100-commit cap", () => {
    expect(entitlementForTier("free")).toEqual({ tier: "free", commitCap: 100 });
  });

  it("paid tiers are uncapped", () => {
    expect(entitlementForTier("single-device")).toEqual({ tier: "single-device" });
    expect(entitlementForTier("unlimited")).toEqual({ tier: "unlimited" });
  });

  it("returns a fresh object each call (the resolver deep-freezes it)", () => {
    expect(entitlementForTier("free")).not.toBe(entitlementForTier("free"));
  });
});

describe("FREE_ENTITLEMENT", () => {
  it("is the Free tier with the 100-commit cap", () => {
    expect(FREE_ENTITLEMENT).toEqual({ tier: "free", commitCap: 100 });
  });
});
