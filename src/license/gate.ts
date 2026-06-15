/**
 * The entitlement gate (Story 7.1 · fail-closed/degrade split Story 7.3) —
 * resolves the effective license outcome at startup, before any analysis or
 * rendering.
 *
 * The gate reports FACTS, not policy: it returns a discriminated
 * `EntitlementResolution`. The CLI shell applies the headless-vs-interactive
 * POLICY (headless ⇒ fail closed with exit 8; interactive ⇒ degrade to Free
 * with a notice) — the gate itself never throws and knows nothing of
 * `LicenseError`, exit codes, or the capability gate.
 *
 * Rules:
 *   - No license key ⇒ `resolved` Free, with NO network call (7.1 AC2). A
 *     keyless run is legitimately Free — NEVER "unverified" (so a keyless CI
 *     run does not fail closed).
 *   - A key ⇒ validate online (at most ONE call), transmitting only the key +
 *     the cached instance id (the device identifier, AC3), and map a `valid`
 *     result to the paid tier (`resolved`).
 *   - A `valid: false` / unreachable / transient / thrown validation ⇒
 *     `unverified` (a key was supplied but could not be confirmed). The shell
 *     decides whether that fails closed (headless) or degrades (interactive).
 *
 * Only the resolved `Entitlement` leaves this module; the license key never
 * enters `RunConfig`, `--show-config`, or any log.
 */

import type { Entitlement } from "../config/run-config.js";
import type { LicenseValidator } from "./lemonsqueezy.js";
import { entitlementForTier, FREE_ENTITLEMENT, tierForValidation } from "./tiers.js";

export interface EntitlementGateDeps {
  /** The license key (env-read). Absent ⇒ resolved Free, no call. */
  licenseKey?: string;
  /** The online validator (injected; the real one hits the Lemon Squeezy API). */
  validate: LicenseValidator;
  /** Read the cached activation-instance id (the device identifier). */
  readInstanceId?: () => Promise<string | undefined>;
}

/**
 * The gate's outcome (Story 7.3). `resolved` carries the effective entitlement
 * (Free for a keyless run, or the mapped paid tier for a valid key). `unverified`
 * means a key WAS supplied but could not be confirmed (invalid / revoked /
 * unreachable / transient / a thrown collaborator) — the shell turns that into a
 * headless fail-closed (exit 8) or an interactive degrade-to-Free.
 */
export type EntitlementResolution =
  | { kind: "resolved"; entitlement: Entitlement }
  | { kind: "unverified"; reason: string };

/** The fallback reason when the server refuses without a message, or a collaborator throws. */
const UNVERIFIED_FALLBACK = "Your license could not be verified.";

/**
 * Normalize a server error into a non-empty reason. A missing, empty, or
 * whitespace-only message falls back (so the fail-closed/degrade message is
 * never blank or double-spaced).
 */
function reasonFrom(error?: string): string {
  const trimmed = error?.trim();
  return trimmed === undefined || trimmed === "" ? UNVERIFIED_FALLBACK : trimmed;
}

/** Resolve the license outcome (validate-only; a keyless run is offline Free). */
export async function resolveEntitlement(deps: EntitlementGateDeps): Promise<EntitlementResolution> {
  // An absent OR empty key ⇒ no call ⇒ resolved Free (7.1 AC2). The default
  // `readLicenseKey` already maps "" → undefined, but guard here so the gate
  // makes no pointless call — and so a keyless run is `resolved`, never
  // `unverified` (a keyless headless run must NOT fail closed).
  if (deps.licenseKey === undefined || deps.licenseKey === "") {
    return { kind: "resolved", entitlement: FREE_ENTITLEMENT };
  }
  // The gate NEVER throws — it reports `unverified` so the shell owns the
  // fail-closed-vs-degrade decision. The 7.1 validator already maps a non-ok /
  // timeout / network error to `{ valid: false, error }`; the catch covers a
  // misbehaving injected collaborator (or a future disk/network change).
  try {
    const instanceId = deps.readInstanceId === undefined ? undefined : await deps.readInstanceId();
    const validation = await deps.validate({ licenseKey: deps.licenseKey, instanceId });
    if (validation.valid) {
      return { kind: "resolved", entitlement: entitlementForTier(tierForValidation(validation)) };
    }
    return { kind: "unverified", reason: reasonFrom(validation.error) };
  } catch {
    return { kind: "unverified", reason: UNVERIFIED_FALLBACK };
  }
}
