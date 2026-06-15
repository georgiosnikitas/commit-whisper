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
  it("no key ⇒ resolved Free, and the validator is NEVER called (AC2)", async () => {
    const v = recordingValidator({ valid: true, status: "active" });
    const resolution = await resolveEntitlement({ validate: v.validate });
    expect(resolution).toEqual({ kind: "resolved", entitlement: { tier: "free", commitCap: 100 } });
    expect(v.calls).toHaveLength(0);
  });

  it("a valid key ⇒ resolved with the mapped paid entitlement (no cap)", async () => {
    const v = recordingValidator({ valid: true, status: "active", variantName: "Unlimited" });
    const resolution = await resolveEntitlement({ licenseKey: "LIC", validate: v.validate });
    expect(resolution).toEqual({ kind: "resolved", entitlement: { tier: "unlimited" } });
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

  it("an invalid / unreachable validation ⇒ unverified, carrying the validator's reason (AC1/AC2)", async () => {
    const invalid = recordingValidator({ valid: false, status: "error", error: "unreachable" });
    expect(await resolveEntitlement({ licenseKey: "LIC", validate: invalid.validate })).toEqual({
      kind: "unverified",
      reason: "unreachable",
    });
  });

  it("a valid:false with no error message ⇒ unverified with a fallback reason", async () => {
    const invalid = recordingValidator({ valid: false, status: "inactive" });
    const resolution = await resolveEntitlement({ licenseKey: "LIC", validate: invalid.validate });
    expect(resolution.kind).toBe("unverified");
    if (resolution.kind === "unverified") {
      expect(resolution.reason).not.toBe("");
    }
  });

  it("a valid:false with an EMPTY / whitespace error ⇒ unverified with the fallback (never a blank reason)", async () => {
    const blank = recordingValidator({ valid: false, status: "inactive", error: "   " });
    const resolution = await resolveEntitlement({ licenseKey: "LIC", validate: blank.validate });
    expect(resolution).toEqual({ kind: "unverified", reason: "Your license could not be verified." });
  });

  it("an empty-string key ⇒ resolved Free, no validate call", async () => {
    const v = recordingValidator({ valid: true, status: "active" });
    expect(await resolveEntitlement({ licenseKey: "", validate: v.validate })).toEqual({
      kind: "resolved",
      entitlement: { tier: "free", commitCap: 100 },
    });
    expect(v.calls).toHaveLength(0);
  });

  it("a throwing validate ⇒ unverified (the gate never throws — the shell owns the decision)", async () => {
    const validate: LicenseValidator = async () => {
      throw new Error("boom");
    };
    const resolution = await resolveEntitlement({ licenseKey: "LIC", validate });
    expect(resolution.kind).toBe("unverified");
  });

  it("a throwing readInstanceId ⇒ unverified (the gate never throws)", async () => {
    const v = recordingValidator({ valid: true, status: "active", variantName: "Unlimited" });
    const resolution = await resolveEntitlement({
      licenseKey: "LIC",
      validate: v.validate,
      readInstanceId: async () => {
        throw new Error("disk error");
      },
    });
    expect(resolution.kind).toBe("unverified");
  });
});
