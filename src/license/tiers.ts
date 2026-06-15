/**
 * Tier mapping (Story 7.1): a Lemon Squeezy validation → the effective
 * `Entitlement {tier, commitCap?}` that rides the frozen `RunConfig`.
 *
 * The real variant→tier catalog is configured at the Lemon Squeezy product
 * level; this is the deterministic, testable resolver: a valid key is at least
 * Single-device, with `unlimited`/`automation` variants unlocking the Unlimited
 * tier. Free is the no-key path (resolved in `gate.ts`), carrying the 100-commit
 * cap; paid tiers are uncapped.
 */

import { FREE_TIER_COMMIT_CAP } from "../config/resolve-run-config.js";
import type { Entitlement, Tier } from "../config/run-config.js";
import type { LicenseValidation } from "./lemonsqueezy.js";

/** The Free entitlement — no key, no call, the 100-commit cap (single source of the cap). */
export const FREE_ENTITLEMENT: Entitlement = { tier: "free", commitCap: FREE_TIER_COMMIT_CAP };

/**
 * Resolve the tier from a validation. An invalid validation → `free` (defensive;
 * the gate already routes failures to Free). A valid key maps by `variantName`:
 * unlimited/automation → Unlimited, single/device → Single-device, an unknown
 * paid variant → Single-device (a valid key is at least Single-device).
 */
export function tierForValidation(v: LicenseValidation): Tier {
  if (!v.valid) {
    return "free";
  }
  const name = (v.variantName ?? "").toLowerCase();
  if (/unlimited|automation/.test(name)) {
    return "unlimited";
  }
  if (/single|device/.test(name)) {
    return "single-device";
  }
  return "single-device";
}

/** The entitlement for a tier — Free carries the 100-commit cap; paid tiers are uncapped. A fresh object per call. */
export function entitlementForTier(tier: Tier): Entitlement {
  if (tier === "free") {
    return { tier: "free", commitCap: FREE_TIER_COMMIT_CAP };
  }
  return { tier };
}
