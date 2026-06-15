import { describe, it, expect } from "vitest";

import { readAiKey, readEnvDiagnostics, readGitToken, readEnvLayer, readLicenseKey } from "./env.js";
import { Secret } from "../shared/secret.js";

describe("readEnvLayer", () => {
  it("returns an empty layer for empty env", () => {
    expect(readEnvLayer({})).toEqual({});
  });

  it("maps each non-secret COMMIT_WHISPER_* var to its field with coercion", () => {
    const layer = readEnvLayer({
      COMMIT_WHISPER_REPO: "/repo",
      COMMIT_WHISPER_BRANCH: "main",
      COMMIT_WHISPER_START_DATE: "2024-01-01",
      COMMIT_WHISPER_END_DATE: "2024-12-31",
      COMMIT_WHISPER_TZ: "Europe/Athens",
      COMMIT_WHISPER_AUTHOR: "alice",
      COMMIT_WHISPER_MAX_COMMITS: "250",
      COMMIT_WHISPER_NO_MERGES: "true",
      COMMIT_WHISPER_FORMAT: "html,json",
      COMMIT_WHISPER_OUT: "out.json",
      COMMIT_WHISPER_AI_MODE: "required",
      COMMIT_WHISPER_PROVIDER: "openai",
      COMMIT_WHISPER_LLM_BASE_URL: "http://localhost:11434",
      COMMIT_WHISPER_LLM_MODEL: "gpt-5",
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
    expect(readEnvLayer({ COMMIT_WHISPER_BRANCH: "all" }).branch).toEqual({ kind: "all" });
  });

  it("treats COMMIT_WHISPER_NO_AI truthy as aiMode off (overriding AI_MODE)", () => {
    expect(readEnvLayer({ COMMIT_WHISPER_NO_AI: "1", COMMIT_WHISPER_AI_MODE: "auto" }).aiMode).toBe("off");
    expect(readEnvLayer({ COMMIT_WHISPER_NO_AI: "0", COMMIT_WHISPER_AI_MODE: "auto" }).aiMode).toBe("auto");
  });

  it("omits fields with invalid coercions instead of throwing", () => {
    const layer = readEnvLayer({
      COMMIT_WHISPER_MAX_COMMITS: "not-a-number",
      COMMIT_WHISPER_NO_MERGES: "maybe",
      COMMIT_WHISPER_FORMAT: "bogus",
      COMMIT_WHISPER_PROVIDER: "unknown",
      COMMIT_WHISPER_AI_MODE: "loud",
    });
    expect(layer.maxCommits).toBeUndefined();
    expect(layer.noMerges).toBeUndefined();
    expect(layer.outputFormats).toBeUndefined();
    expect(layer.provider).toBeUndefined();
    expect(layer.aiMode).toBeUndefined();
  });

  it("omits negative or zero maxCommits", () => {
    expect(readEnvLayer({ COMMIT_WHISPER_MAX_COMMITS: "0" }).maxCommits).toBeUndefined();
    expect(readEnvLayer({ COMMIT_WHISPER_MAX_COMMITS: "-5" }).maxCommits).toBeUndefined();
  });

  it("treats blank/whitespace values as unset", () => {
    expect(readEnvLayer({ COMMIT_WHISPER_REPO: "   " }).repoTarget).toBeUndefined();
  });

  it("keeps only valid output formats from a mixed list", () => {
    expect(readEnvLayer({ COMMIT_WHISPER_FORMAT: "html,bogus,terminal" }).outputFormats).toEqual([
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

  it("returns undefined for ollama / undefined provider (no key needed)", () => {
    expect(readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "x" }, "ollama")).toBeUndefined();
    expect(readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "x" }, undefined)).toBeUndefined();
  });

  it("reads each provider's native env var (Story 3.6)", () => {
    expect(readAiKey({ OPENAI_API_KEY: "o-key" }, "openai")?.reveal()).toBe("o-key");
    expect(readAiKey({ ANTHROPIC_API_KEY: "a-key" }, "anthropic")?.reveal()).toBe("a-key");
    // openai-compatible reuses the OpenAI-native var (optional).
    expect(readAiKey({ OPENAI_API_KEY: "c-key" }, "openai-compatible")?.reveal()).toBe("c-key");
    // The right var only: an openai run does not pick up the anthropic var.
    expect(readAiKey({ ANTHROPIC_API_KEY: "a" }, "openai")).toBeUndefined();
  });

  it("wraps the key in a Secret (not the raw string)", () => {
    const key = readAiKey({ OPENAI_API_KEY: "o-key" }, "openai");
    expect(key).toBeInstanceOf(Secret);
  });

  it("treats a blank key as unset", () => {
    expect(readAiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "   " }, "gemini")).toBeUndefined();
    expect(readAiKey({ OPENAI_API_KEY: "  " }, "openai")).toBeUndefined();
  });
});

describe("readGitToken (Story 5.2)", () => {
  it("reads COMMIT_WHISPER_GIT_TOKEN with precedence over the host fallbacks", () => {
    expect(readGitToken({ COMMIT_WHISPER_GIT_TOKEN: "primary", GITHUB_TOKEN: "gh" })?.reveal()).toBe("primary");
  });

  it("falls back GITHUB_TOKEN → GITLAB_TOKEN → BITBUCKET_TOKEN in order", () => {
    expect(readGitToken({ GITHUB_TOKEN: "gh" })?.reveal()).toBe("gh");
    expect(readGitToken({ GITLAB_TOKEN: "gl" })?.reveal()).toBe("gl");
    expect(readGitToken({ BITBUCKET_TOKEN: "bb" })?.reveal()).toBe("bb");
    expect(readGitToken({ GITLAB_TOKEN: "gl", BITBUCKET_TOKEN: "bb" })?.reveal()).toBe("gl");
  });

  it("is undefined when no token var is set, and ignores a blank value", () => {
    expect(readGitToken({})).toBeUndefined();
    expect(readGitToken({ COMMIT_WHISPER_GIT_TOKEN: "   " })).toBeUndefined();
  });

  it("wraps the token in a Secret that redacts everywhere (never leaks)", () => {
    const token = readGitToken({ COMMIT_WHISPER_GIT_TOKEN: "ghp_supersecret" });
    expect(token).toBeInstanceOf(Secret);
    expect(String(token)).toBe("***");
    expect(JSON.stringify({ token })).toBe('{"token":"***"}');
    expect(token?.reveal()).toBe("ghp_supersecret"); // only via the explicit accessor
  });
});

describe("readEnvDiagnostics (Story 6.3)", () => {
  it("names the provider's key var with its presence, plus the git token row", () => {
    const diags = readEnvDiagnostics({ OPENAI_API_KEY: "sk-x" }, "openai");
    expect(diags).toEqual([
      { name: "OPENAI_API_KEY", set: true },
      { name: "COMMIT_WHISPER_GIT_TOKEN", set: false, note: "only needed for private remotes" },
    ]);
  });

  it("maps each cloud provider to its native key var", () => {
    expect(readEnvDiagnostics({}, "anthropic")[0]).toEqual({ name: "ANTHROPIC_API_KEY", set: false });
    expect(readEnvDiagnostics({}, "gemini")[0]).toEqual({ name: "GOOGLE_GENERATIVE_AI_API_KEY", set: false });
  });

  it("honors the gemini GEMINI_API_KEY alias for the set flag", () => {
    expect(readEnvDiagnostics({ GEMINI_API_KEY: "g" }, "gemini")[0]).toEqual({
      name: "GOOGLE_GENERATIVE_AI_API_KEY",
      set: true,
    });
  });

  it("omits the AI-key row for local Ollama (no key needed)", () => {
    const diags = readEnvDiagnostics({}, "ollama");
    expect(diags.map((d) => d.name)).toEqual(["COMMIT_WHISPER_GIT_TOKEN"]);
  });

  it("names OPENAI_API_KEY (with real presence) when no provider is configured", () => {
    expect(readEnvDiagnostics({ OPENAI_API_KEY: "sk" }, undefined)[0]).toEqual({
      name: "OPENAI_API_KEY",
      set: true,
    });
    expect(readEnvDiagnostics({}, undefined)[0]).toEqual({ name: "OPENAI_API_KEY", set: false });
  });

  it("reports the git token row set when any git token var is present (incl. fallback)", () => {
    const gitRow = readEnvDiagnostics({ GITHUB_TOKEN: "gh" }, "ollama").at(-1);
    expect(gitRow).toEqual({ name: "COMMIT_WHISPER_GIT_TOKEN", set: true, note: "only needed for private remotes" });
  });

  it("never includes a secret value — names + booleans only", () => {
    const serialized = JSON.stringify(readEnvDiagnostics({ OPENAI_API_KEY: "sk-supersecret" }, "openai"));
    expect(serialized).not.toContain("sk-supersecret");
  });
});

describe("readLicenseKey (Story 7.1)", () => {
  it("reads COMMIT_WHISPER_LICENSE_KEY, trimmed", () => {
    expect(readLicenseKey({ COMMIT_WHISPER_LICENSE_KEY: "  LIC-123  " })).toBe("LIC-123");
  });

  it("is undefined when unset or blank", () => {
    expect(readLicenseKey({})).toBeUndefined();
    expect(readLicenseKey({ COMMIT_WHISPER_LICENSE_KEY: "   " })).toBeUndefined();
  });
});
