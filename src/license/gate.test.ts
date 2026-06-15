import { describe, it, expect } from "vitest";

import { resolveEntitlement } from "./gate.js";
import type { LicenseValidation, LicenseValidator } from "./lemonsqueezy.js";

/** A validator that records its calls and returns a canned validation. */
function recordingValidator(result: LicenseValidation) {
  const calls: { licenseKey: string; instanceId?: string }[] = [];
  const validate: LicenseValidator = async (input) => {
    calls.push(input);
    return result;
  };
  return { validate, calls };
}

describe("resolveEntitlement", () => {
  it("no key ⇒ Free, and the validator is NEVER called (AC2)", async () => {
    const v = recordingValidator({ valid: true, status: "active" });
    const entitlement = await resolveEntitlement({ validate: v.validate });
    expect(entitlement).toEqual({ tier: "free", commitCap: 100 });
    expect(v.calls).toHaveLength(0);
  });

  it("a valid key ⇒ the mapped paid entitlement (no cap)", async () => {
    const v = recordingValidator({ valid: true, status: "active", variantName: "Unlimited" });
    const entitlement = await resolveEntitlement({ licenseKey: "LIC", validate: v.validate });
    expect(entitlement).toEqual({ tier: "unlimited" });
    expect(v.calls).toHaveLength(1);
  });

  it("passes the cached instance id (device identifier) to validate (AC3)", async () => {
    const v = recordingValidator({ valid: true, status: "active", variantName: "Single Device" });
    await resolveEntitlement({
      licenseKey: "LIC",
      validate: v.validate,
      readInstanceId: async () => "inst-7",
    });
    expect(v.calls[0]).toEqual({ licenseKey: "LIC", instanceId: "inst-7" });
  });

  it("an absent instance id ⇒ validate called with instanceId undefined", async () => {
    const v = recordingValidator({ valid: true, status: "active", variantName: "Single Device" });
    await resolveEntitlement({ licenseKey: "LIC", validate: v.validate, readInstanceId: async () => undefined });
    expect(v.calls[0]).toEqual({ licenseKey: "LIC", instanceId: undefined });
  });

  it("an invalid / unreachable validation ⇒ Free (the 7.1 degrade baseline)", async () => {
    const invalid = recordingValidator({ valid: false, status: "error", error: "unreachable" });
    expect(await resolveEntitlement({ licenseKey: "LIC", validate: invalid.validate })).toEqual({
      tier: "free",
      commitCap: 100,
    });
  });

  it("an empty-string key ⇒ Free, no validate call", async () => {
    const v = recordingValidator({ valid: true, status: "active" });
    expect(await resolveEntitlement({ licenseKey: "", validate: v.validate })).toEqual({
      tier: "free",
      commitCap: 100,
    });
    expect(v.calls).toHaveLength(0);
  });

  it("a throwing validate degrades to Free (the gate never throws — launchpad must open)", async () => {
    const validate: LicenseValidator = async () => {
      throw new Error("boom");
    };
    expect(await resolveEntitlement({ licenseKey: "LIC", validate })).toEqual({ tier: "free", commitCap: 100 });
  });

  it("a throwing readInstanceId degrades to Free (the gate never throws)", async () => {
    const v = recordingValidator({ valid: true, status: "active", variantName: "Unlimited" });
    const entitlement = await resolveEntitlement({
      licenseKey: "LIC",
      validate: v.validate,
      readInstanceId: async () => {
        throw new Error("disk error");
      },
    });
    expect(entitlement).toEqual({ tier: "free", commitCap: 100 });
  });
});
