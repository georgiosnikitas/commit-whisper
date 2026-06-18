import { describe, it, expect } from "vitest";

import { entitlementForTier, FREE_ENTITLEMENT, tierForLicense, tierForValidation, tierForVariantName } from "./tiers.js";
import type { LicenseValidation } from "./lemonsqueezy.js";

function valid(variantName?: string): LicenseValidation {
  return { valid: true, status: "active", variantName };
}

describe("tierForVariantName", () => {
  it("maps variant names to tiers (unlimited/automation, single/device, else single-device)", () => {
    expect(tierForVariantName("Unlimited")).toBe("unlimited");
    expect(tierForVariantName("Automation")).toBe("unlimited");
    expect(tierForVariantName("Single Device")).toBe("single-device");
    expect(tierForVariantName("Mystery")).toBe("single-device");
    expect(tierForVariantName()).toBe("single-device");
  });

  it("maps the real product variants (Commit Stage Single → single-device, Commit Stage Unlimited → unlimited)", () => {
    expect(tierForVariantName("Commit Stage Single")).toBe("single-device");
    expect(tierForVariantName("Commit Stage Unlimited")).toBe("unlimited");
  });
});

describe("tierForLicense", () => {
  it("the activation limit is authoritative: exactly 1 ⇒ single-device", () => {
    expect(tierForLicense({ activationLimit: 1 })).toBe("single-device");
    // The limit wins even when the variant name says otherwise.
    expect(tierForLicense({ variantName: "Unlimited", activationLimit: 1 })).toBe("single-device");
  });

  it("a null / 0 / >1 activation limit ⇒ unlimited (no single-device cap)", () => {
    expect(tierForLicense({ activationLimit: null })).toBe("unlimited");
    expect(tierForLicense({ activationLimit: 0 })).toBe("unlimited");
    expect(tierForLicense({ activationLimit: 5 })).toBe("unlimited");
    // A generic "Default" variant (single-variant LS product) still resolves to unlimited.
    expect(tierForLicense({ variantName: "Default", activationLimit: null })).toBe("unlimited");
  });

  it("falls back to the variant-name heuristic when no limit is reported", () => {
    expect(tierForLicense({ variantName: "Unlimited" })).toBe("unlimited");
    expect(tierForLicense({ variantName: "Single Device" })).toBe("single-device");
    expect(tierForLicense({})).toBe("single-device");
  });
});

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
    expect(tierForValidation(valid())).toBe("single-device");
  });

  it("maps an invalid validation to free (defensive)", () => {
    expect(tierForValidation({ valid: false, status: "invalid" })).toBe("free");
  });

  it("prefers the activation limit over the variant name (null limit ⇒ unlimited)", () => {
    expect(tierForValidation({ valid: true, status: "active", variantName: "Default", activationLimit: null })).toBe(
      "unlimited",
    );
    expect(tierForValidation({ valid: true, status: "active", variantName: "Unlimited", activationLimit: 1 })).toBe(
      "single-device",
    );
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
