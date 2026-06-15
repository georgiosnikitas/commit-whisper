/**
 * The entitlement gate (Story 7.1) — resolves the effective `Entitlement` at
 * startup, before any analysis or rendering.
 *
 * Rules:
 *   - No license key ⇒ the Free entitlement, with NO network call (AC2).
 *   - A key ⇒ validate online (at most ONE call), transmitting only the key +
 *     the cached instance id (the device identifier, AC3), and map the result
 *     to the paid tier.
 *   - A failed / invalid / unreachable validation ⇒ the Free entitlement (the
 *     Story 7.1 safe baseline: no paid features, never blocks). The headless
 *     fail-closed (exit 8) vs interactive degrade-with-notice SPLIT is 7.3 —
 *     this gate is the extension point.
 *
 * Only the resolved `Entitlement` leaves this module; the license key never
 * enters `RunConfig`, `--show-config`, or any log.
 */

import type { Entitlement } from "../config/run-config.js";
import type { LicenseValidator } from "./lemonsqueezy.js";
import { entitlementForTier, FREE_ENTITLEMENT, tierForValidation } from "./tiers.js";

export interface EntitlementGateDeps {
  /** The license key (env-read). Absent ⇒ Free, no call. */
  licenseKey?: string;
  /** The online validator (injected; the real one hits the Lemon Squeezy API). */
  validate: LicenseValidator;
  /** Read the cached activation-instance id (the device identifier). */
  readInstanceId?: () => Promise<string | undefined>;
}

/** Resolve the effective entitlement (validate-only; Free is offline). */
export async function resolveEntitlement(deps: EntitlementGateDeps): Promise<Entitlement> {
  // An absent OR empty key ⇒ no call ⇒ Free (AC2). The default `readLicenseKey`
  // already maps "" → undefined, but guard here so the gate makes no pointless call.
  if (deps.licenseKey === undefined || deps.licenseKey === "") {
    return FREE_ENTITLEMENT;
  }
  // The gate must NEVER throw — a failed read/validate degrades to Free so the
  // run continues and the launchpad always opens (the 7.1 baseline; 7.3 adds the
  // headless fail-closed split). The default collaborators don't throw, but a
  // misbehaving injected one (or a future disk/network change) must not escape.
  try {
    const instanceId = deps.readInstanceId === undefined ? undefined : await deps.readInstanceId();
    const validation = await deps.validate({ licenseKey: deps.licenseKey, instanceId });
    return validation.valid ? entitlementForTier(tierForValidation(validation)) : FREE_ENTITLEMENT;
  } catch {
    return FREE_ENTITLEMENT;
  }
}
