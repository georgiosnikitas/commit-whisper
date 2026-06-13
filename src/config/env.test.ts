import { describe, it, expect } from "vitest";

import { readAiKey, readEnvLayer } from "./env.js";

describe("readEnvLayer", () => {
  it("returns an empty layer for empty env", () => {
    expect(readEnvLayer({})).toEqual({});
  });

  it("maps each non-secret COMMIT_SAGE_* var to its field with coercion", () => {
    const layer = readEnvLayer({
      COMMIT_SAGE_REPO: "/repo",
      COMMIT_SAGE_BRANCH: "main",
      COMMIT_SAGE_START_DATE: "2024-01-01",
      COMMIT_SAGE_END_DATE: "2024-12-31",
      COMMIT_SAGE_TZ: "Europe/Athens",
      COMMIT_SAGE_AUTHOR: "alice",
      COMMIT_SAGE_MAX_COMMITS: "250",
      COMMIT_SAGE_NO_MERGES: "true",
      COMMIT_SAGE_FORMAT: "html,json",
      COMMIT_SAGE_OUT: "out.json",
      COMMIT_SAGE_AI_MODE: "required",
      COMMIT_SAGE_PROVIDER: "openai",
      COMMIT_SAGE_LLM_BASE_URL: "http://localhost:11434",
      COMMIT_SAGE_LLM_MODEL: "gpt-5",
    });
    expect(layer).toEqual({
      repoTarget: "/repo",
      branch: { kind: "named", name: "main" },
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      timezone: "Europe/Athens",
      authorFilter: "alice",
      maxCommits: 250,
      noMerges: true,
      outputFormats: ["html", "json"],
      outputPath: "out.json",
      aiMode: "required",
      provider: "openai",
      llmBaseUrl: "http://localhost:11434",
      llmModel: "gpt-5",
    });
  });

  it("parses branch=all to the all sentinel", () => {
    expect(readEnvLayer({ COMMIT_SAGE_BRANCH: "all" }).branch).toEqual({ kind: "all" });
  });

  it("treats COMMIT_SAGE_NO_AI truthy as aiMode off (overriding AI_MODE)", () => {
    expect(readEnvLayer({ COMMIT_SAGE_NO_AI: "1", COMMIT_SAGE_AI_MODE: "auto" }).aiMode).toBe("off");
    expect(readEnvLayer({ COMMIT_SAGE_NO_AI: "0", COMMIT_SAGE_AI_MODE: "auto" }).aiMode).toBe("auto");
  });

  it("omits fields with invalid coercions instead of throwing", () => {
    const layer = readEnvLayer({
      COMMIT_SAGE_MAX_COMMITS: "not-a-number",
      COMMIT_SAGE_NO_MERGES: "maybe",
      COMMIT_SAGE_FORMAT: "bogus",
      COMMIT_SAGE_PROVIDER: "unknown",
      COMMIT_SAGE_AI_MODE: "loud",
    });
    expect(layer.maxCommits).toBeUndefined();
    expect(layer.noMerges).toBeUndefined();
    expect(layer.outputFormats).toBeUndefined();
    expect(layer.provider).toBeUndefined();
    expect(layer.aiMode).toBeUndefined();
  });

  it("omits negative or zero maxCommits", () => {
    expect(readEnvLayer({ COMMIT_SAGE_MAX_COMMITS: "0" }).maxCommits).toBeUndefined();
    expect(readEnvLayer({ COMMIT_SAGE_MAX_COMMITS: "-5" }).maxCommits).toBeUndefined();
  });

  it("treats blank/whitespace values as unset", () => {
    expect(readEnvLayer({ COMMIT_SAGE_REPO: "   " }).repoTarget).toBeUndefined();
  });

  it("keeps only valid output formats from a mixed list", () => {
    expect(readEnvLayer({ COMMIT_SAGE_FORMAT: "html,bogus,terminal" }).outputFormats).toEqual([
      "html",
      "terminal",
    ]);
  });
});

describe("readAiKey", () => {
  it("reads the gemini native var and wraps it in a redacting Secret", () => {
    const key = readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "g-native" }, "gemini");
    expect(key?.reveal()).toBe("g-native");
    expect(String(key)).toBe("***"); // redaction holds
  });

  it("accepts GEMINI_API_KEY as the alias when the native var is unset", () => {
    expect(readAiKey({ GEMINI_API_KEY: "g-alias" }, "gemini")?.reveal()).toBe("g-alias");
  });

  it("prefers the native var over the alias when both are set", () => {
    expect(
      readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "native", GEMINI_API_KEY: "alias" }, "gemini")?.reveal(),
    ).toBe("native");
  });

  it("returns undefined for gemini when no key is set", () => {
    expect(readAiKey({}, "gemini")).toBeUndefined();
  });

  it("returns undefined for ollama / undefined / not-yet-supported providers", () => {
    expect(readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "x" }, "ollama")).toBeUndefined();
    expect(readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "x" }, undefined)).toBeUndefined();
    expect(readAiKey({ OPENAI_API_KEY: "x" }, "openai")).toBeUndefined(); // Story 3.6 seam
  });

  it("treats a blank key as unset", () => {
    expect(readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "   " }, "gemini")).toBeUndefined();
  });
});
