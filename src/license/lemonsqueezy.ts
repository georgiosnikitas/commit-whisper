/**
 * The Lemon Squeezy License API client (Story 7.1) — `validate` only.
 *
 * Validation runs at startup for a paid tier. It uses the global `fetch` (no
 * SDK — a leaner SEA binary; the store-management surface is not bundled) and
 * transmits ONLY the license key and, when an activation instance is cached, its
 * instance id (the device identifier) — NEVER repository data, metrics, or
 * config (privacy by construction: the request body is a closed two-key form).
 *
 * The client NEVER throws and NEVER logs the key: a network / timeout / HTTP
 * failure resolves to `{ valid: false, status: "error" }` and the entitlement
 * gate (`gate.ts`) decides policy. `activate` / `deactivate` are Story 7.2.
 */

const DEFAULT_API_BASE = "https://api.lemonsqueezy.com";
const DEFAULT_TIMEOUT_MS = 8000;

/** The normalized result of a Lemon Squeezy license validation. */
export interface LicenseValidation {
  valid: boolean;
  status: string;
  variantName?: string;
  variantId?: number;
  activationLimit?: number;
  activationUsage?: number;
  error?: string;
}

/** Validate a license key (with an optional cached instance id as the device identifier). */
export type LicenseValidator = (input: {
  licenseKey: string;
  instanceId?: string;
}) => Promise<LicenseValidation>;

interface ValidatorDeps {
  fetchImpl?: typeof fetch;
  apiBase?: string;
  timeoutMs?: number;
}

/** The Lemon Squeezy validate-response shape we read (a tolerant subset). */
interface LemonSqueezyValidateResponse {
  valid?: boolean;
  error?: string | null;
  license_key?: { status?: string; activation_limit?: number; activation_usage?: number };
  meta?: { variant_id?: number; variant_name?: string };
}

/** Map a parsed Lemon Squeezy response to our normalized `LicenseValidation`. */
function mapResponse(json: LemonSqueezyValidateResponse): LicenseValidation {
  return {
    valid: json.valid === true,
    status: json.license_key?.status ?? (json.valid === true ? "active" : "invalid"),
    variantName: json.meta?.variant_name,
    variantId: json.meta?.variant_id,
    activationLimit: json.license_key?.activation_limit,
    activationUsage: json.license_key?.activation_usage,
  };
}

/**
 * Build a `LicenseValidator` bound to the Lemon Squeezy License API. The request
 * body carries EXACTLY `license_key` (+ `instance_id` when provided) — no other
 * field is ever added (the AC3 privacy invariant). The key is never logged or
 * echoed into the returned `error`.
 */
export function createLemonSqueezyValidator(deps: ValidatorDeps = {}): LicenseValidator {
  const doFetch = deps.fetchImpl ?? fetch;
  const apiBase = (deps.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, "");
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async ({ licenseKey, instanceId }) => {
    const body = new URLSearchParams({ license_key: licenseKey });
    if (instanceId !== undefined && instanceId !== "") {
      body.set("instance_id", instanceId);
    }
    try {
      const res = await doFetch(`${apiBase}/v1/licenses/validate`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        return { valid: false, status: "error", error: `License server responded with HTTP ${res.status}.` };
      }
      return mapResponse((await res.json()) as LemonSqueezyValidateResponse);
    } catch (err) {
      // Scrub the key defensively in case a fetch impl embeds the body in its message.
      const detail = (err instanceof Error ? err.message : "unknown error").split(licenseKey).join("***");
      return { valid: false, status: "error", error: `License server is unreachable: ${detail}` };
    }
  };
}
