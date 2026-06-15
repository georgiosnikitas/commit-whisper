import { describe, it, expect } from "vitest";

import {
  createLemonSqueezyActivator,
  createLemonSqueezyDeactivator,
  createLemonSqueezyValidator,
} from "./lemonsqueezy.js";

/** A fake `fetch` that records the request and returns a canned JSON response. */
function fakeFetch(response: { ok: boolean; status?: number; json?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
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
    expect(calls[0].url).toBe("https://api.lemonsqueezy.com/v1/licenses/validate");
    expect(calls[0].init.method).toBe("POST");
    expect(bodyParams(calls[0].init)).toEqual({ license_key: "LIC-KEY" });
  });

  it("includes the instance id (device identifier) when provided — and nothing else", async () => {
    const { fetchImpl, calls } = fakeFetch({ ok: true, json: { valid: true } });
    await createLemonSqueezyValidator({ fetchImpl })({ licenseKey: "LIC-KEY", instanceId: "inst-1" });
    expect(bodyParams(calls[0].init)).toEqual({ license_key: "LIC-KEY", instance_id: "inst-1" });
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

  it("surfaces the server's refusal reason on a valid:false (so the gate can show it) (Story 7.3)", async () => {
    const { fetchImpl } = fakeFetch({
      ok: true,
      json: { valid: false, error: "license has been revoked", license_key: { status: "inactive" } },
    });
    const result = await createLemonSqueezyValidator({ fetchImpl })({ licenseKey: "k" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("license has been revoked");
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
    expect(calls[0].url).toBe("https://example.test/v1/licenses/validate");
  });
});

describe("createLemonSqueezyActivator (Story 7.2)", () => {
  it("POSTs to /v1/licenses/activate with only license_key + instance_name", async () => {
    const { fetchImpl, calls } = fakeFetch({ ok: true, json: { activated: true, instance: { id: "inst-9" } } });
    await createLemonSqueezyActivator({ fetchImpl })({ licenseKey: "LIC-KEY", instanceName: "my-laptop" });
    expect(calls[0].url).toBe("https://api.lemonsqueezy.com/v1/licenses/activate");
    expect(bodyParams(calls[0].init)).toEqual({ license_key: "LIC-KEY", instance_name: "my-laptop" });
  });

  it("maps a successful activation (instance id + variant)", async () => {
    const { fetchImpl } = fakeFetch({
      ok: true,
      json: { activated: true, instance: { id: "inst-9", name: "my-laptop" }, meta: { variant_id: 7, variant_name: "Single Device" } },
    });
    const result = await createLemonSqueezyActivator({ fetchImpl })({ licenseKey: "k", instanceName: "d" });
    expect(result).toEqual({ activated: true, instanceId: "inst-9", variantName: "Single Device", variantId: 7, error: undefined });
  });

  it("maps an activation-limit refusal (second device, AC3) to activated:false + the server message", async () => {
    const { fetchImpl } = fakeFetch({ ok: false, status: 400, json: { activated: false, error: "limit reached" } });
    const result = await createLemonSqueezyActivator({ fetchImpl })({ licenseKey: "k", instanceName: "d" });
    expect(result.activated).toBe(false);
    expect(result.error).toContain("HTTP 400");
  });

  it("maps a thrown fetch to activated:false, scrubbing the key", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED key LIC-SECRET");
    }) as unknown as typeof fetch;
    const result = await createLemonSqueezyActivator({ fetchImpl })({ licenseKey: "LIC-SECRET", instanceName: "d" });
    expect(result.activated).toBe(false);
    expect(result.error).not.toContain("LIC-SECRET");
  });
});

describe("createLemonSqueezyDeactivator (Story 7.2)", () => {
  it("POSTs to /v1/licenses/deactivate with only license_key + instance_id", async () => {
    const { fetchImpl, calls } = fakeFetch({ ok: true, json: { deactivated: true } });
    await createLemonSqueezyDeactivator({ fetchImpl })({ licenseKey: "LIC-KEY", instanceId: "inst-9" });
    expect(calls[0].url).toBe("https://api.lemonsqueezy.com/v1/licenses/deactivate");
    expect(bodyParams(calls[0].init)).toEqual({ license_key: "LIC-KEY", instance_id: "inst-9" });
  });

  it("maps a successful deactivation", async () => {
    const { fetchImpl } = fakeFetch({ ok: true, json: { deactivated: true } });
    const result = await createLemonSqueezyDeactivator({ fetchImpl })({ licenseKey: "k", instanceId: "i" });
    expect(result).toEqual({ deactivated: true, error: undefined });
  });

  it("maps a non-ok response to deactivated:false (never throws)", async () => {
    const { fetchImpl } = fakeFetch({ ok: false, status: 404 });
    const result = await createLemonSqueezyDeactivator({ fetchImpl })({ licenseKey: "k", instanceId: "i" });
    expect(result.deactivated).toBe(false);
    expect(result.error).toContain("HTTP 404");
  });
});
