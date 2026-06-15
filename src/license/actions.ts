/**
 * The license action orchestrators (Story 7.2) — activate + deactivate.
 *
 * These compose the Lemon Squeezy `activate`/`deactivate` calls with the local
 * cache write/clear into a single, UI-agnostic outcome the interactive screens
 * render. They never collect input and never touch a real network or disk — the
 * client + persistence are injected — so they are fully unit-testable.
 *
 * Activate caches `{ instanceId, licenseKey }` on success (so a one-time
 * activation resolves the paid tier on later runs). Deactivate frees the
 * activation and clears the cache. A second-device activation is refused by the
 * server (activation-limit), surfaced verbatim as `{ ok: false, reason }`.
 */

import type { Tier } from "../config/run-config.js";
import type { LicenseActivator, LicenseDeactivator } from "./lemonsqueezy.js";
import { tierForVariantName } from "./tiers.js";

export type ActivationOutcome = { ok: true; tier: Tier } | { ok: false; reason: string };

export interface ActivateDeps {
  licenseKey: string;
  instanceName: string;
  activate: LicenseActivator;
  persist: (cache: { instanceId: string; licenseKey: string }) => Promise<void>;
}

/**
 * Activate a license on this device: validate/activate online, then cache the
 * instance id + key. A blank key, or a server refusal (incl. the Single-device
 * activation-limit), returns `{ ok: false, reason }` and persists NOTHING.
 */
export async function activateLicense(deps: ActivateDeps): Promise<ActivationOutcome> {
  const licenseKey = deps.licenseKey.trim();
  if (licenseKey === "") {
    return { ok: false, reason: "Enter your license key." };
  }
  const result = await deps.activate({ licenseKey, instanceName: deps.instanceName });
  if (!result.activated || result.instanceId === undefined || result.instanceId === "") {
    return { ok: false, reason: result.error ?? "Activation failed — check the key and try again." };
  }
  try {
    await deps.persist({ instanceId: result.instanceId, licenseKey });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "write failed";
    return {
      ok: false,
      reason: `Activated online, but couldn't save it on this device (${detail}). Set COMMIT_SAGE_LICENSE_KEY so it applies on your next run — do NOT re-activate (that would use another device slot).`,
    };
  }
  return { ok: true, tier: tierForVariantName(result.variantName) };
}

export type DeactivationOutcome = { ok: true } | { ok: false; reason: string };

export interface DeactivateDeps {
  licenseKey?: string;
  instanceId?: string;
  deactivate: LicenseDeactivator;
  clear: () => Promise<void>;
}

/**
 * Deactivate this device's activation: free it server-side, then clear the local
 * cache (so the license can move). A missing key or instance, or a server
 * refusal, returns `{ ok: false, reason }` and clears NOTHING.
 */
export async function deactivateLicense(deps: DeactivateDeps): Promise<DeactivationOutcome> {
  if (deps.licenseKey === undefined || deps.licenseKey === "") {
    return { ok: false, reason: "No license key found — set COMMIT_SAGE_LICENSE_KEY, then re-run." };
  }
  if (deps.instanceId === undefined || deps.instanceId === "") {
    return { ok: false, reason: "No activation found on this device." };
  }
  const result = await deps.deactivate({ licenseKey: deps.licenseKey, instanceId: deps.instanceId });
  if (!result.deactivated) {
    return { ok: false, reason: result.error ?? "Deactivation failed — try again." };
  }
  try {
    await deps.clear();
  } catch (err) {
    const detail = err instanceof Error ? err.message : "write failed";
    return {
      ok: false,
      reason: `Freed online, but couldn't clear the local cache (${detail}). Remove ~/.commit-sage/license.json to finish.`,
    };
  }
  return { ok: true };
}
