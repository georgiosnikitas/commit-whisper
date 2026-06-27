import { describe, it, expect, afterEach } from "vitest";

import { resolveModel } from "./provider.js";
import { generateNarrative } from "./generate.js";
import type { Analysis } from "../analyze/engine.js";
import type { NarrateConfig } from "./narrate.port.js";
import { NarrationError } from "../shared/errors.js";
import { Secret } from "../shared/secret.js";

function cfg(overrides: Partial<NarrateConfig> = {}): NarrateConfig {
  return {
    aiMode: "auto",
    provider: "gemini",
    llmModel: "gemini-2.5-flash",
    aiKey: new Secret("dummy-key-not-real"),
    ...overrides,
  };
}

describe("resolveModel — every provider resolves to a LanguageModel (no network call)", () => {
  it("gemini → a model from a key", () => {
    expect(resolveModel(cfg({ provider: "gemini" }))).toBeDefined();
  });

  it("openai → a model from a key (base URL optional)", () => {
    expect(resolveModel(cfg({ provider: "openai", llmModel: "gpt-4o" }))).toBeDefined();
  });

  it("anthropic → a model from a key (base URL optional)", () => {
    expect(resolveModel(cfg({ provider: "anthropic", llmModel: "claude-3-5-sonnet" }))).toBeDefined();
  });

  it("openai-compatible → a model from a base URL (key optional)", () => {
    expect(
      resolveModel(cfg({ provider: "openai-compatible", llmModel: "local-model", llmBaseUrl: "https://api.example.test/v1", aiKey: undefined })),
    ).toBeDefined();
  });

  it("ollama → a model with no key and the default local base URL", () => {
    expect(resolveModel(cfg({ provider: "ollama", llmModel: "llama3", aiKey: undefined, llmBaseUrl: undefined }))).toBeDefined();
  });

  it("ollama → a model with a custom base URL", () => {
    expect(
      resolveModel(cfg({ provider: "ollama", llmModel: "llama3", aiKey: undefined, llmBaseUrl: "https://ollama.local:11434/" })),
    ).toBeDefined();
  });
});

describe("resolveModel — missing model is an error for every provider", () => {
  for (const provider of ["gemini", "openai", "anthropic", "openai-compatible", "ollama"] as const) {
    it(`${provider}: missing model → NarrationError (exit 6) naming COMMIT_WHISPER_LLM_MODEL`, () => {
      try {
        resolveModel(cfg({ provider, llmModel: undefined, llmBaseUrl: "https://x.test/v1" }));
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(NarrationError);
        expect((e as NarrationError).exitCode).toBe(6);
        expect((e as NarrationError).message).toContain("COMMIT_WHISPER_LLM_MODEL");
      }
    });
  }
});

describe("resolveModel — key required for hosted providers, naming the native env var", () => {
  const cases: ReadonlyArray<[NarrateConfig["provider"], string]> = [
    ["gemini", "GOOGLE_GENERATIVE_AI_API_KEY"],
    ["openai", "OPENAI_API_KEY"],
    ["anthropic", "ANTHROPIC_API_KEY"],
  ];
  for (const [provider, envVar] of cases) {
    it(`${provider}: missing key → NarrationError naming ${envVar}`, () => {
      try {
        resolveModel(cfg({ provider, llmModel: "m", aiKey: undefined }));
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(NarrationError);
        expect((e as NarrationError).exitCode).toBe(6);
        expect((e as NarrationError).message).toContain(envVar);
      }
    });
  }
});

describe("resolveModel — base URL rules", () => {
  it("openai-compatible with no base URL → NarrationError naming COMMIT_WHISPER_LLM_BASE_URL", () => {
    try {
      resolveModel(cfg({ provider: "openai-compatible", llmModel: "m", llmBaseUrl: undefined, aiKey: undefined }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(NarrationError);
      expect((e as NarrationError).message).toContain("COMMIT_WHISPER_LLM_BASE_URL");
    }
  });

  it("openai-compatible with a base URL and no key resolves (key is optional)", () => {
    expect(
      resolveModel(cfg({ provider: "openai-compatible", llmModel: "m", llmBaseUrl: "https://x.test/v1", aiKey: undefined })),
    ).toBeDefined();
  });

  it("openai-compatible with a blank/whitespace base URL is treated as unset → NarrationError", () => {
    for (const blank of ["", "   "]) {
      expect(() =>
        resolveModel(cfg({ provider: "openai-compatible", llmModel: "m", llmBaseUrl: blank, aiKey: undefined })),
      ).toThrow(NarrationError);
    }
  });

  it("ollama with a base URL already ending in /v1 does not double the suffix", () => {
    // A broken /v1/v1 path would 404 at generation; the suffix must be idempotent.
    expect(
      resolveModel(cfg({ provider: "ollama", llmModel: "llama3", aiKey: undefined, llmBaseUrl: "http://localhost:11434/v1" })),
    ).toBeDefined();
    expect(
      resolveModel(cfg({ provider: "ollama", llmModel: "llama3", aiKey: undefined, llmBaseUrl: "http://localhost:11434/v1/" })),
    ).toBeDefined();
  });
});

describe("resolveModel — no provider configured", () => {
  it("undefined provider → NarrationError naming COMMIT_WHISPER_PROVIDER", () => {
    try {
      resolveModel(cfg({ provider: undefined }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(NarrationError);
      expect((e as NarrationError).message).toContain("COMMIT_WHISPER_PROVIDER");
    }
  });
});

describe("resolveModel — openai-compatible drives structured outputs (the bound schema reaches the model)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** A minimal analysis — just enough to build the narrative prompt. */
  const ANALYSIS: Analysis = {
    metrics: [{ id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 }],
  };

  /** The slice of the captured outgoing request body this test asserts on. */
  type CapturedBody = {
    response_format?: { type?: string; json_schema?: { strict?: boolean; schema?: unknown } };
  };

  /** Stub global fetch with a schema-shaped OpenAI chat-completion, capturing the request body. */
  function stubFetch(capture: { body?: CapturedBody }): void {
    globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capture.body = JSON.parse(init?.body as string) as CapturedBody;
      const content = JSON.stringify({
        summary: { headline: "h", overview: "o", keyFindings: ["a"] },
        explanation: { paragraphs: ["p"] },
        coaching: { introduction: "i", chapters: [{ theme: "t", steps: ["s"] }], closingSummary: "c" },
      });
      return new Response(
        JSON.stringify({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: "openai.gpt-5.4",
          choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
  }

  it("sends the bound schema as a NON-strict json_schema response format (not the schema-less json_object)", async () => {
    const capture: { body?: CapturedBody } = {};
    stubFetch(capture);

    const model = resolveModel(
      cfg({ provider: "openai-compatible", llmModel: "openai.gpt-5.4", llmBaseUrl: "https://api.example.test/v1", aiKey: undefined }),
    );
    await generateNarrative(model, ANALYSIS);

    // Structured outputs ON ⇒ the schema is actually sent. The prior bug dropped
    // it to `{ type: "json_object" }`, leaving the model unguided → the
    // "Narrative unavailable — metrics-only" degrade.
    expect(capture.body?.response_format?.type).toBe("json_schema");
    expect(capture.body?.response_format?.json_schema?.schema).toBeDefined();
    // …but NON-strict: strict mode 400s on our `min(1)` (minLength/minItems) schemas.
    expect(capture.body?.response_format?.json_schema?.strict).toBe(false);
  });
});

