import { describe, it, expect, vi } from "vitest";

import { preflightProvider } from "./preflight.js";
import type { NarrateConfig } from "./narrate.port.js";
import { Secret } from "../shared/secret.js";

function cfg(overrides: Partial<NarrateConfig> = {}): NarrateConfig {
  return { aiMode: "auto", provider: "gemini", llmModel: "m", aiKey: new Secret("dummy"), ...overrides };
}

function fakeFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return vi.fn((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(impl(input instanceof Request ? input.url : String(input), init)),
  ) as typeof fetch;
}

describe("preflightProvider", () => {
  it("gemini 200 → reachable", async () => {
    const res = await preflightProvider(cfg(), { fetchImpl: fakeFetch(() => new Response("{}", { status: 200 })) });
    expect(res).toEqual({ reachable: true });
  });

  it("gemini 401 → not reachable with an auth reason", async () => {
    const res = await preflightProvider(cfg(), { fetchImpl: fakeFetch(() => new Response("", { status: 401 })) });
    expect(res.reachable).toBe(false);
    expect((res as { reason: string }).reason).toMatch(/Authentication/i);
  });

  it("gemini fetch throws (ECONNREFUSED) → not reachable with a reason", async () => {
    const res = await preflightProvider(cfg(), {
      fetchImpl: fakeFetch(() => {
        throw new Error("ECONNREFUSED");
      }),
    });
    expect(res.reachable).toBe(false);
    expect((res as { reason: string }).reason).toContain("ECONNREFUSED");
  });

  it("ollama tags 200 → reachable, and normalizes a trailing slash in the base URL", async () => {
    let seenUrl = "";
    const res = await preflightProvider(cfg({ provider: "ollama", llmBaseUrl: "http://localhost:11434/" }), {
      fetchImpl: fakeFetch((url) => {
        seenUrl = url;
        return new Response("{}", { status: 200 });
      }),
    });
    expect(res).toEqual({ reachable: true });
    expect(seenUrl).toBe("http://localhost:11434/api/tags"); // no double slash
  });

  it("aiMode off → reachable WITHOUT any fetch call", async () => {
    const fetchSpy = fakeFetch(() => new Response("", { status: 200 }));
    const res = await preflightProvider(cfg({ aiMode: "off" }), { fetchImpl: fetchSpy });
    expect(res).toEqual({ reachable: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("gemini with no key → not reachable (configured vs reachable)", async () => {
    const fetchSpy = fakeFetch(() => new Response("", { status: 200 }));
    const res = await preflightProvider(cfg({ aiKey: undefined }), { fetchImpl: fetchSpy });
    expect(res.reachable).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the gemini key in the x-goog-api-key HEADER, never in the URL", async () => {
    let seenUrl = "";
    let seenHeaders: HeadersInit | undefined;
    await preflightProvider(cfg({ aiKey: new Secret("dummy-123") }), {
      fetchImpl: fakeFetch((url, init) => {
        seenUrl = url;
        seenHeaders = init?.headers;
        return new Response("{}", { status: 200 });
      }),
    });
    expect(seenUrl).not.toContain("dummy-123"); // key NOT in the URL
    expect(seenUrl).not.toContain("key=");
    expect((seenHeaders as Record<string, string>)["x-goog-api-key"]).toBe("dummy-123");
  });

  it("scrubs the key from a failure reason if a fetch error echoes it", async () => {
    const res = await preflightProvider(cfg({ aiKey: new Secret("sk-leaky-key") }), {
      fetchImpl: fakeFetch(() => {
        throw new Error("connect failed to https://host/?key=sk-leaky-key");
      }),
    });
    expect(res.reachable).toBe(false);
    expect((res as { reason: string }).reason).not.toContain("sk-leaky-key");
    expect((res as { reason: string }).reason).toContain("***");
  });

  it("aborts a hung probe via the injected timeout", async () => {
    const res = await preflightProvider(cfg(), {
      timeoutMs: 5,
      fetchImpl: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted")));
        })) as unknown as typeof fetch,
    });
    expect(res.reachable).toBe(false);
  });
});
