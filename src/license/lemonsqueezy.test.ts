import { describe, it, expect } from "vitest";

import { createLemonSqueezyValidator } from "./lemonsqueezy.js";

/** A fake `fetch` that records the request and returns a canned JSON response. */
function fakeFetch(response: { ok: boolean; status?: number; json?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.json ?? {},
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

/** Read the form body of the recorded request as a plain object. */
function bodyParams(init: RequestInit): Record<string, string> {
  const body = init.body as URLSearchParams;
  return Object.fromEntries(body.entries());
}

describe("createLemonSqueezyValidator", () => {
  it("POSTs to /v1/licenses/validate with only the license key (privacy — AC3)", async () => {
    const { fetchImpl, calls } = fakeFetch({ ok: true, json: { valid: true } });
    await createLemonSqueezyValidator({ fetchImpl })({ licenseKey: "LIC-KEY" });
    expect(calls[0]!.url).toBe("https://api.lemonsqueezy.com/v1/licenses/validate");
    expect(calls[0]!.init.method).toBe("POST");
    expect(bodyParams(calls[0]!.init)).toEqual({ license_key: "LIC-KEY" });
  });

  it("includes the instance id (device identifier) when provided — and nothing else", async () => {
    const { fetchImpl, calls } = fakeFetch({ ok: true, json: { valid: true } });
    await createLemonSqueezyValidator({ fetchImpl })({ licenseKey: "LIC-KEY", instanceId: "inst-1" });
    expect(bodyParams(calls[0]!.init)).toEqual({ license_key: "LIC-KEY", instance_id: "inst-1" });
  });

  it("maps a valid response (status + variant)", async () => {
    const { fetchImpl } = fakeFetch({
      ok: true,
      json: {
        valid: true,
        license_key: { status: "active", activation_limit: 1, activation_usage: 1 },
        meta: { variant_id: 42, variant_name: "Single Device" },
      },
    });
    const result = await createLemonSqueezyValidator({ fetchImpl })({ licenseKey: "k" });
    expect(result).toEqual({
      valid: true,
      status: "active",
      variantName: "Single Device",
      variantId: 42,
      activationLimit: 1,
      activationUsage: 1,
    });
  });

  it("maps a non-ok HTTP response to invalid (never throws)", async () => {
    const { fetchImpl } = fakeFetch({ ok: false, status: 404 });
    const result = await createLemonSqueezyValidator({ fetchImpl })({ licenseKey: "k" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTP 404");
  });

  it("maps a thrown fetch (network/timeout) to invalid, scrubbing the key", async () => {
    const fetchImpl = (async () => {
      throw new Error("connect ECONNREFUSED for key LIC-SECRET");
    }) as unknown as typeof fetch;
    const result = await createLemonSqueezyValidator({ fetchImpl })({ licenseKey: "LIC-SECRET" });
    expect(result.valid).toBe(false);
    expect(result.status).toBe("error");
    expect(result.error).not.toContain("LIC-SECRET"); // key scrubbed from the message
  });

  it("respects a custom apiBase (trimming a trailing slash)", async () => {
    const { fetchImpl, calls } = fakeFetch({ ok: true, json: { valid: true } });
    await createLemonSqueezyValidator({ fetchImpl, apiBase: "https://example.test/" })({ licenseKey: "k" });
    expect(calls[0]!.url).toBe("https://example.test/v1/licenses/validate");
  });
});
