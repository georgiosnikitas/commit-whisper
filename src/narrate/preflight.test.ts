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

describe("preflightProvider — full BYOK breadth (Story 3.6)", () => {
  it("openai: GET {base}/models 200 with the key in an Authorization HEADER → reachable", async () => {
    let seenUrl = "";
    let seenHeaders: Record<string, string> | undefined;
    const res = await preflightProvider(cfg({ provider: "openai", aiKey: new Secret("sk-openai-123") }), {
      fetchImpl: fakeFetch((url, init) => {
        seenUrl = url;
        seenHeaders = init?.headers as Record<string, string>;
        return new Response("{}", { status: 200 });
      }),
    });
    expect(res).toEqual({ reachable: true });
    expect(seenUrl).toBe("https://api.openai.com/v1/models"); // vendor default base URL
    expect(seenUrl).not.toContain("sk-openai-123"); // key NOT in the URL
    expect(seenHeaders?.Authorization).toBe("Bearer sk-openai-123");
  });

  it("openai: a custom base URL is used (trailing slash trimmed)", async () => {
    let seenUrl = "";
    await preflightProvider(cfg({ provider: "openai", aiKey: new Secret("k"), llmBaseUrl: "https://proxy.test/v1/" }), {
      fetchImpl: fakeFetch((url) => {
        seenUrl = url;
        return new Response("{}", { status: 200 });
      }),
    });
    expect(seenUrl).toBe("https://proxy.test/v1/models");
  });

  it("openai: missing key → not reachable, no fetch", async () => {
    const fetchSpy = fakeFetch(() => new Response("{}", { status: 200 }));
    const res = await preflightProvider(cfg({ provider: "openai", aiKey: undefined }), { fetchImpl: fetchSpy });
    expect(res.reachable).toBe(false);
    expect((res as { reason: string }).reason).toContain("OPENAI_API_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("anthropic: GET {base}/models with x-api-key + anthropic-version headers → reachable", async () => {
    let seenUrl = "";
    let seenHeaders: Record<string, string> | undefined;
    const res = await preflightProvider(cfg({ provider: "anthropic", aiKey: new Secret("sk-ant-123") }), {
      fetchImpl: fakeFetch((url, init) => {
        seenUrl = url;
        seenHeaders = init?.headers as Record<string, string>;
        return new Response("{}", { status: 200 });
      }),
    });
    expect(res).toEqual({ reachable: true });
    expect(seenUrl).toBe("https://api.anthropic.com/v1/models");
    expect(seenUrl).not.toContain("sk-ant-123");
    expect(seenHeaders?.["x-api-key"]).toBe("sk-ant-123");
    expect(seenHeaders?.["anthropic-version"]).toBe("2023-06-01");
  });

  it("anthropic: 403 → auth-failed reason", async () => {
    const res = await preflightProvider(cfg({ provider: "anthropic", aiKey: new Secret("k") }), {
      fetchImpl: fakeFetch(() => new Response("", { status: 403 })),
    });
    expect(res.reachable).toBe(false);
    expect((res as { reason: string }).reason).toMatch(/Authentication/i);
  });

  it("openai-compatible: GET {base}/models with a key → reachable, key in header", async () => {
    let seenUrl = "";
    let seenHeaders: Record<string, string> | undefined;
    const res = await preflightProvider(
      cfg({ provider: "openai-compatible", aiKey: new Secret("sk-c"), llmBaseUrl: "https://custom.test/v1/" }),
      {
        fetchImpl: fakeFetch((url, init) => {
          seenUrl = url;
          seenHeaders = init?.headers as Record<string, string> | undefined;
          return new Response("{}", { status: 200 });
        }),
      },
    );
    expect(res).toEqual({ reachable: true });
    expect(seenUrl).toBe("https://custom.test/v1/models");
    expect(seenHeaders?.Authorization).toBe("Bearer sk-c");
  });

  it("openai-compatible: no key → reachable with NO auth header (key optional)", async () => {
    let seenHeaders: HeadersInit | undefined;
    const res = await preflightProvider(
      cfg({ provider: "openai-compatible", aiKey: undefined, llmBaseUrl: "https://custom.test/v1" }),
      {
        fetchImpl: fakeFetch((_url, init) => {
          seenHeaders = init?.headers;
          return new Response("{}", { status: 200 });
        }),
      },
    );
    expect(res).toEqual({ reachable: true });
    expect(seenHeaders).toBeUndefined();
  });

  it("openai-compatible: missing base URL → not reachable, no fetch", async () => {
    const fetchSpy = fakeFetch(() => new Response("{}", { status: 200 }));
    const res = await preflightProvider(cfg({ provider: "openai-compatible", aiKey: undefined, llmBaseUrl: undefined }), {
      fetchImpl: fetchSpy,
    });
    expect(res.reachable).toBe(false);
    expect((res as { reason: string }).reason).toContain("COMMIT_SAGE_LLM_BASE_URL");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("openai-compatible: a blank/whitespace base URL is treated as unset (no relative-URL fetch)", async () => {
    const fetchSpy = fakeFetch(() => new Response("{}", { status: 200 }));
    const res = await preflightProvider(cfg({ provider: "openai-compatible", aiKey: undefined, llmBaseUrl: "   " }), {
      fetchImpl: fetchSpy,
    });
    expect(res.reachable).toBe(false);
    expect((res as { reason: string }).reason).toContain("COMMIT_SAGE_LLM_BASE_URL");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("openai: a blank base URL falls back to the vendor default (not a relative URL)", async () => {
    let seenUrl = "";
    await preflightProvider(cfg({ provider: "openai", aiKey: new Secret("k"), llmBaseUrl: "" }), {
      fetchImpl: fakeFetch((url) => {
        seenUrl = url;
        return new Response("{}", { status: 200 });
      }),
    });
    expect(seenUrl).toBe("https://api.openai.com/v1/models");
  });
});
