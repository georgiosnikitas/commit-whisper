import { describe, it, expect } from "vitest";

import { activateLicense, deactivateLicense } from "./actions.js";
import type { LicenseActivation, LicenseActivator, LicenseDeactivation, LicenseDeactivator } from "./lemonsqueezy.js";

function fakeActivator(result: LicenseActivation) {
  const calls: { licenseKey: string; instanceName: string }[] = [];
  const activate: LicenseActivator = async (input) => {
    calls.push(input);
    return result;
  };
  return { activate, calls };
}

function fakeDeactivator(result: LicenseDeactivation) {
  const calls: { licenseKey: string; instanceId: string }[] = [];
  const deactivate: LicenseDeactivator = async (input) => {
    calls.push(input);
    return result;
  };
  return { deactivate, calls };
}

describe("activateLicense (Story 7.2)", () => {
  it("a successful activation persists {instanceId, licenseKey} and returns the tier", async () => {
    const act = fakeActivator({ activated: true, instanceId: "inst-1", variantName: "Unlimited" });
    const persisted: { instanceId: string; licenseKey: string }[] = [];
    const outcome = await activateLicense({
      licenseKey: "LIC",
      instanceName: "laptop",
      activate: act.activate,
      persist: async (c) => {
        persisted.push(c);
      },
    });
    expect(outcome).toEqual({ ok: true, tier: "unlimited" });
    expect(act.calls[0]).toEqual({ licenseKey: "LIC", instanceName: "laptop" });
    expect(persisted).toEqual([{ instanceId: "inst-1", licenseKey: "LIC" }]);
  });

  it("a second-device activation-limit refusal returns ok:false and persists nothing (AC3)", async () => {
    const act = fakeActivator({ activated: false, error: "activation limit reached" });
    const persisted: unknown[] = [];
    const outcome = await activateLicense({
      licenseKey: "LIC",
      instanceName: "laptop",
      activate: act.activate,
      persist: async (c) => {
        persisted.push(c);
      },
    });
    expect(outcome).toEqual({ ok: false, reason: "activation limit reached" });
    expect(persisted).toHaveLength(0);
  });

  it("a blank key returns ok:false and never calls activate", async () => {
    const act = fakeActivator({ activated: true, instanceId: "x" });
    const outcome = await activateLicense({
      licenseKey: "   ",
      instanceName: "laptop",
      activate: act.activate,
      persist: async () => {},
    });
    expect(outcome.ok).toBe(false);
    expect(act.calls).toHaveLength(0);
  });

  it("an activated:true with no instance id is treated as a failure (persists nothing)", async () => {
    const act = fakeActivator({ activated: true, instanceId: undefined });
    const persisted: unknown[] = [];
    const outcome = await activateLicense({
      licenseKey: "LIC",
      instanceName: "laptop",
      activate: act.activate,
      persist: async (c) => {
        persisted.push(c);
      },
    });
    expect(outcome.ok).toBe(false);
    expect(persisted).toHaveLength(0);
  });

  it("an activated:true with an empty-string instance id is treated as a failure (persists nothing)", async () => {
    const act = fakeActivator({ activated: true, instanceId: "" });
    const persisted: unknown[] = [];
    const outcome = await activateLicense({
      licenseKey: "LIC",
      instanceName: "laptop",
      activate: act.activate,
      persist: async (c) => {
        persisted.push(c);
      },
    });
    expect(outcome.ok).toBe(false);
    expect(persisted).toHaveLength(0);
  });

  it("a persist failure after a server-side activation reports the half-state and steers away from re-activating", async () => {
    const act = fakeActivator({ activated: true, instanceId: "inst-1", variantName: "Single-device" });
    const outcome = await activateLicense({
      licenseKey: "LIC",
      instanceName: "laptop",
      activate: act.activate,
      persist: async () => {
        throw new Error("ENOSPC: no space left on device");
      },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toContain("Activated online");
      expect(outcome.reason).toContain("ENOSPC");
      expect(outcome.reason).toContain("COMMIT_WHISPER_LICENSE_KEY");
    }
  });
});

describe("deactivateLicense (Story 7.2)", () => {
  it("a successful deactivation clears the cache and returns ok", async () => {
    const deact = fakeDeactivator({ deactivated: true });
    let cleared = false;
    const outcome = await deactivateLicense({
      licenseKey: "LIC",
      instanceId: "inst-1",
      deactivate: deact.deactivate,
      clear: async () => {
        cleared = true;
      },
    });
    expect(outcome).toEqual({ ok: true });
    expect(deact.calls[0]).toEqual({ licenseKey: "LIC", instanceId: "inst-1" });
    expect(cleared).toBe(true);
  });

  it("no key → ok:false naming the env var, no deactivate call", async () => {
    const deact = fakeDeactivator({ deactivated: true });
    const outcome = await deactivateLicense({
      instanceId: "inst-1",
      deactivate: deact.deactivate,
      clear: async () => {},
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toContain("COMMIT_WHISPER_LICENSE_KEY");
    }
    expect(deact.calls).toHaveLength(0);
  });

  it("no instance id → ok:false, no deactivate call", async () => {
    const deact = fakeDeactivator({ deactivated: true });
    const outcome = await deactivateLicense({
      licenseKey: "LIC",
      deactivate: deact.deactivate,
      clear: async () => {},
    });
    expect(outcome.ok).toBe(false);
    expect(deact.calls).toHaveLength(0);
  });

  it("a server deactivated:false → ok:false and does NOT clear the cache", async () => {
    const deact = fakeDeactivator({ deactivated: false, error: "no such instance" });
    let cleared = false;
    const outcome = await deactivateLicense({
      licenseKey: "LIC",
      instanceId: "inst-1",
      deactivate: deact.deactivate,
      clear: async () => {
        cleared = true;
      },
    });
    expect(outcome).toEqual({ ok: false, reason: "no such instance" });
    expect(cleared).toBe(false);
  });

  it("a clear failure after a server-side deactivation reports the half-state and names the cache file", async () => {
    const deact = fakeDeactivator({ deactivated: true });
    const outcome = await deactivateLicense({
      licenseKey: "LIC",
      instanceId: "inst-1",
      deactivate: deact.deactivate,
      clear: async () => {
        throw new Error("EACCES: permission denied");
      },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toContain("Freed online");
      expect(outcome.reason).toContain("EACCES");
      expect(outcome.reason).toContain("license.json");
    }
  });
});
