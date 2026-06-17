import { describe, it, expect } from "vitest";

import { finalizeRunConfig, type FinalizeContext } from "./gaps.js";
import type { PartialRunConfig, Provenance } from "./run-config.js";
import { MissingRequiredConfigError } from "../shared/errors.js";

const ctx: FinalizeContext = {
  interactive: false,
  analysisTimestamp: "2026-06-13T00:00:00.000Z",
  entitlement: { tier: "free" },
};

/** A merged partial with the always-present defaulted fields (post-merge state). */
function base(overrides: PartialRunConfig = {}): PartialRunConfig {
  return {
    repoTarget: "/repo",
    branch: { kind: "head" },
    timezone: "UTC",
    noMerges: false,
    outputFormats: ["terminal"],
    aiMode: "off",
    ...overrides,
  };
}

describe("finalizeRunConfig — success", () => {
  it("returns a frozen RunConfig carrying injected fields and provenance", () => {
    const provenance: Provenance = { repoTarget: "default", aiMode: "default" };
    const cfg = finalizeRunConfig(base(), provenance, ctx);
    expect(cfg.repoTarget).toBe("/repo");
    expect(cfg.aiMode).toBe("off");
    expect(cfg.analysisTimestamp).toBe("2026-06-13T00:00:00.000Z");
    expect(cfg.entitlement).toEqual({ tier: "free" });
    expect(cfg.provenance).toEqual(provenance);
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(() => {
      (cfg as { repoTarget: string }).repoTarget = "/elsewhere";
    }).toThrow(TypeError);
  });

  it("aiMode off relaxes the AI cluster (provider/model/baseUrl not required)", () => {
    expect(() => finalizeRunConfig(base({ aiMode: "off" }), {}, ctx)).not.toThrow();
  });
});

describe("finalizeRunConfig — required-missing throws typed error (never a prompt)", () => {
  it("throws MissingRequiredConfigError (exit 3) when repoTarget is missing", () => {
    const partial = base();
    delete partial.repoTarget;
    expect(() => finalizeRunConfig(partial, {}, ctx)).toThrow(MissingRequiredConfigError);
    try {
      finalizeRunConfig(partial, {}, ctx);
    } catch (e) {
      expect((e as MissingRequiredConfigError).exitCode).toBe(3);
      expect((e as MissingRequiredConfigError).field).toBe("repoTarget");
      expect((e as MissingRequiredConfigError).message).toContain("COMMIT_WHISPER_REPO");
    }
  });

  it("requires provider + llmModel when aiMode !== off", () => {
    expect(() => finalizeRunConfig(base({ aiMode: "auto" }), {}, ctx)).toThrow(
      MissingRequiredConfigError,
    );
    expect(() =>
      finalizeRunConfig(base({ aiMode: "required", provider: "openai", llmModel: "gpt-5" }), {}, ctx),
    ).not.toThrow();
  });

  it("requires llmBaseUrl for ollama and openai-compatible providers", () => {
    expect(() =>
      finalizeRunConfig(base({ aiMode: "auto", provider: "ollama", llmModel: "llama3" }), {}, ctx),
    ).toThrow(MissingRequiredConfigError);
    expect(() =>
      finalizeRunConfig(
        base({ aiMode: "auto", provider: "ollama", llmModel: "llama3", llmBaseUrl: "https://x" }),
        {},
        ctx,
      ),
    ).not.toThrow();
  });

  it("does NOT require llmBaseUrl for openai (a hosted provider)", () => {
    expect(() =>
      finalizeRunConfig(base({ aiMode: "auto", provider: "openai", llmModel: "gpt-5" }), {}, ctx),
    ).not.toThrow();
  });

  it("names the missing field's env var in the error message", () => {
    try {
      finalizeRunConfig(base({ aiMode: "required" }), {}, ctx);
      expect.unreachable();
    } catch (e) {
      expect((e as MissingRequiredConfigError).field).toBe("provider");
      expect((e as MissingRequiredConfigError).message).toContain("COMMIT_WHISPER_PROVIDER");
    }
  });
});
