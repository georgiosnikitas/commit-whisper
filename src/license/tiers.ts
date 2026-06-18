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
 * Resolve the tier from a license variant name (the name-only heuristic, used as
 * a fallback when no usable activation limit is present).
 * `unlimited`/`automation` → Unlimited; `single`/`device` → Single-device; an
 * unknown or absent variant on a valid key → Single-device (a valid key is at
 * least Single-device).
 */
export function tierForVariantName(variantName?: string): Tier {
  const name = (variantName ?? "").toLowerCase();
  if (/unlimited|automation/.test(name)) {
    return "unlimited";
  }
  if (/single|device/.test(name)) {
    return "single-device";
  }
  return "single-device";
}

/**
 * Resolve the tier from a license's signals (shared by validate + activate). The
 * server's `activation_limit` is the AUTHORITATIVE device-count signal and wins
 * when present: exactly `1` ⇒ Single-device; `null` / `0` / `> 1` ⇒ Unlimited
 * (Lemon Squeezy encodes "unlimited devices" as a blank limit → `null`). Only
 * when no usable limit is reported do we fall back to the fragile variant-name
 * heuristic (e.g. a single-variant product whose name is "Default").
 */
export function tierForLicense(input: { variantName?: string; activationLimit?: number | null }): Tier {
  const limit = input.activationLimit;
  if (limit === undefined) {
    // No usable limit reported — fall back to the variant-name heuristic.
    return tierForVariantName(input.variantName);
  }
  // `null` / `0` / `> 1` all mean "no single-device cap" ⇒ Unlimited; exactly 1 ⇒ Single-device.
  return limit === 1 ? "single-device" : "unlimited";
}

/**
 * Resolve the tier from a validation. An invalid validation → `free` (defensive;
 * the gate already routes failures to Free). A valid key maps by its signals
 * (activation limit first, then variant name).
 */
export function tierForValidation(v: LicenseValidation): Tier {
  if (!v.valid) {
    return "free";
  }
  return tierForLicense({ variantName: v.variantName, activationLimit: v.activationLimit });
}

/** The entitlement for a tier — Free carries the 100-commit cap; paid tiers are uncapped. A fresh object per call. */
export function entitlementForTier(tier: Tier): Entitlement {
  if (tier === "free") {
    return { tier: "free", commitCap: FREE_TIER_COMMIT_CAP };
  }
  return { tier };
}
