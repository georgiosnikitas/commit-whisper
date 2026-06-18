/**
 * The Lemon Squeezy License API client (Story 7.1 validate · Story 7.2 activate /
 * deactivate).
 *
 * Runs at startup (validate) and from the interactive license screens (activate /
 * deactivate). It uses the global `fetch` (no SDK — a leaner SEA binary; the
 * store-management surface is not bundled) and transmits ONLY the license key
 * plus, per call, a single device identifier (`instance_id` / `instance_name`) —
 * NEVER repository data, metrics, or config (privacy by construction: every
 * request body is a closed two-key form).
 *
 * The client NEVER throws and NEVER logs the key: a network / timeout / HTTP
 * failure resolves to a `{ valid|activated|deactivated: false, error }` result
 * and the caller (gate / orchestrator) decides policy. The key is scrubbed from
 * any returned error message.
 */

import { stripTrailingSlashes } from "../shared/url.js";

const DEFAULT_API_BASE = "https://api.lemonsqueezy.com";
const DEFAULT_TIMEOUT_MS = 8000;

interface ClientDeps {
  fetchImpl?: typeof fetch;
  apiBase?: string;
  timeoutMs?: number;
}

/** A `POST` result: the parsed JSON on success, or a user-safe error (key scrubbed). */
type PostResult = { ok: true; json: unknown } | { ok: false; error: string };

/**
 * POST a closed form body to the License API. Shared by validate / activate /
 * deactivate. NEVER throws: a non-ok response or a network / timeout / JSON
 * failure resolves to `{ ok: false, error }` with the key scrubbed.
 */
async function postForm(
  doFetch: typeof fetch,
  url: string,
  body: URLSearchParams,
  timeoutMs: number,
  key: string,
): Promise<PostResult> {
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { ok: false, error: `License server responded with HTTP ${res.status}.` };
    }
    return { ok: true, json: await res.json() };
  } catch (err) {
    // Scrub the key defensively in case a fetch impl embeds the body in its message.
    const detail = (err instanceof Error ? err.message : "unknown error").split(key).join("***");
    return { ok: false, error: `License server is unreachable: ${detail}` };
  }
}

/** The normalized result of a Lemon Squeezy license validation. */
export interface LicenseValidation {
  valid: boolean;
  status: string;
  variantName?: string;
  variantId?: number;
  /** Device-activation cap. `1` ⇒ Single-device; `null` / `0` / `> 1` ⇒ unlimited devices. */
  activationLimit?: number | null;
  activationUsage?: number;
  error?: string;
}

/** Validate a license key (with an optional cached instance id as the device identifier). */
export type LicenseValidator = (input: {
  licenseKey: string;
  instanceId?: string;
}) => Promise<LicenseValidation>;

/** The Lemon Squeezy validate-response shape we read (a tolerant subset). */
interface LemonSqueezyValidateResponse {
  valid?: boolean;
  error?: string | null;
  license_key?: { status?: string; activation_limit?: number | null; activation_usage?: number };
  meta?: { variant_id?: number; variant_name?: string };
}

/** Map a parsed Lemon Squeezy response to our normalized `LicenseValidation`. */
function mapValidate(json: LemonSqueezyValidateResponse): LicenseValidation {
  return {
    valid: json.valid === true,
    status: json.license_key?.status ?? (json.valid === true ? "active" : "invalid"),
    variantName: json.meta?.variant_name,
    variantId: json.meta?.variant_id,
    activationLimit: json.license_key?.activation_limit,
    activationUsage: json.license_key?.activation_usage,
    // Carry the server's refusal reason (e.g. "revoked"/"expired") so the gate can
    // surface it in the fail-closed / degrade message (Story 7.3); null → undefined.
    error: json.error ?? undefined,
  };
}

/** Resolve the `{ doFetch, apiBase, timeoutMs }` triple from the client deps. */
function resolveClient(deps: ClientDeps): { doFetch: typeof fetch; apiBase: string; timeoutMs: number } {
  return {
    doFetch: deps.fetchImpl ?? fetch,
    apiBase: stripTrailingSlashes(deps.apiBase ?? DEFAULT_API_BASE),
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

/**
 * Build a `LicenseValidator` bound to the Lemon Squeezy License API. The request
 * body carries EXACTLY `license_key` (+ `instance_id` when provided) — no other
 * field is ever added (the privacy invariant). The key is never logged or echoed
 * into the returned `error`.
 */
export function createLemonSqueezyValidator(deps: ClientDeps = {}): LicenseValidator {
  const { doFetch, apiBase, timeoutMs } = resolveClient(deps);
  return async ({ licenseKey, instanceId }) => {
    const body = new URLSearchParams({ license_key: licenseKey });
    if (instanceId !== undefined && instanceId !== "") {
      body.set("instance_id", instanceId);
    }
    const result = await postForm(doFetch, `${apiBase}/v1/licenses/validate`, body, timeoutMs, licenseKey);
    if (!result.ok) {
      return { valid: false, status: "error", error: result.error };
    }
    return mapValidate(result.json as LemonSqueezyValidateResponse);
  };
}

// ── Activate (Story 7.2) ────────────────────────────────────────────────────

/** The normalized result of a Lemon Squeezy license activation. */
export interface LicenseActivation {
  activated: boolean;
  instanceId?: string;
  variantName?: string;
  variantId?: number;
  /** Device-activation cap. `1` ⇒ Single-device; `null` / `0` / `> 1` ⇒ unlimited devices. */
  activationLimit?: number | null;
  error?: string;
}

/** Activate a license key against a named device instance. */
export type LicenseActivator = (input: {
  licenseKey: string;
  instanceName: string;
}) => Promise<LicenseActivation>;

/** The Lemon Squeezy activate-response shape we read (a tolerant subset). */
interface LemonSqueezyActivateResponse {
  activated?: boolean;
  error?: string | null;
  license_key?: { activation_limit?: number | null };
  instance?: { id?: string; name?: string };
  meta?: { variant_id?: number; variant_name?: string };
}

/**
 * Build a `LicenseActivator`. The request body carries EXACTLY `license_key` +
 * `instance_name` (the device label). A non-ok response (e.g. the Single-device
 * activation-limit, AC3) maps to `{ activated: false, error }`. Never throws.
 */
export function createLemonSqueezyActivator(deps: ClientDeps = {}): LicenseActivator {
  const { doFetch, apiBase, timeoutMs } = resolveClient(deps);
  return async ({ licenseKey, instanceName }) => {
    const body = new URLSearchParams({ license_key: licenseKey, instance_name: instanceName });
    const result = await postForm(doFetch, `${apiBase}/v1/licenses/activate`, body, timeoutMs, licenseKey);
    if (!result.ok) {
      return { activated: false, error: result.error };
    }
    const json = result.json as LemonSqueezyActivateResponse;
    return {
      activated: json.activated === true,
      instanceId: json.instance?.id,
      variantName: json.meta?.variant_name,
      variantId: json.meta?.variant_id,
      activationLimit: json.license_key?.activation_limit,
      error: json.error ?? undefined,
    };
  };
}

// ── Deactivate (Story 7.2) ──────────────────────────────────────────────────

/** The normalized result of a Lemon Squeezy license deactivation. */
export interface LicenseDeactivation {
  deactivated: boolean;
  error?: string;
}

/** Deactivate a license key's activation instance (frees it to move devices). */
export type LicenseDeactivator = (input: {
  licenseKey: string;
  instanceId: string;
}) => Promise<LicenseDeactivation>;

/** The Lemon Squeezy deactivate-response shape we read (a tolerant subset). */
interface LemonSqueezyDeactivateResponse {
  deactivated?: boolean;
  error?: string | null;
}

/**
 * Build a `LicenseDeactivator`. The request body carries EXACTLY `license_key` +
 * `instance_id`. A non-ok response maps to `{ deactivated: false, error }`.
 * Never throws.
 */
export function createLemonSqueezyDeactivator(deps: ClientDeps = {}): LicenseDeactivator {
  const { doFetch, apiBase, timeoutMs } = resolveClient(deps);
  return async ({ licenseKey, instanceId }) => {
    const body = new URLSearchParams({ license_key: licenseKey, instance_id: instanceId });
    const result = await postForm(doFetch, `${apiBase}/v1/licenses/deactivate`, body, timeoutMs, licenseKey);
    if (!result.ok) {
      return { deactivated: false, error: result.error };
    }
    const json = result.json as LemonSqueezyDeactivateResponse;
    return { deactivated: json.deactivated === true, error: json.error ?? undefined };
  };
}
