import { describe, it, expect, vi } from "vitest";
import type { LanguageModel } from "ai";

import { createNarrate } from "./narrate.js";
import type { NarrateConfig } from "./narrate.port.js";
import type { Analysis } from "../analyze/engine.js";
import { NarrationError } from "../shared/errors.js";
import { Secret } from "../shared/secret.js";

const ANALYSIS: Analysis = {
  metrics: [{ id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 }],
};

const NARRATIVE = {
  summary: { headline: "h", overview: "o", keyFindings: ["k"] },
  explanation: { paragraphs: ["p"] },
  coaching: { introduction: "i", chapters: [{ theme: "t", steps: ["s"] }], closingSummary: "c" },
};

function cfg(overrides: Partial<NarrateConfig> = {}): NarrateConfig {
  return { aiMode: "auto", provider: "gemini", llmModel: "m", aiKey: new Secret("dummy"), ...overrides };
}

/** A model stand-in; the injected `generate` ignores it, so its shape is irrelevant. */
const fakeModel = {} as LanguageModel;

describe("createNarrate", () => {
  it("aiMode off → skipped, without resolving a model or generating", async () => {
    const resolveModel = vi.fn();
    const generate = vi.fn();
    const outcome = await createNarrate({ resolveModel, generate })(ANALYSIS, cfg({ aiMode: "off" }));
    expect(outcome).toEqual({ kind: "skipped" });
    expect(resolveModel).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("happy path → narrated with the full three-part narrative", async () => {
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => NARRATIVE,
    })(ANALYSIS, cfg());
    expect(outcome).toEqual({ kind: "narrated", narrative: NARRATIVE });
  });

  it("auto + a throwing generate → degraded (fail open, no throw)", async () => {
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw new Error("provider exploded");
      },
    })(ANALYSIS, cfg({ aiMode: "auto" }));
    expect(outcome.kind).toBe("degraded");
    expect((outcome as { reason: string }).reason).toContain("provider exploded");
  });

  it("required + a throwing generate → throws NarrationError (exit 6)", async () => {
    const narrate = createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw new Error("provider exploded");
      },
    });
    await expect(narrate(ANALYSIS, cfg({ aiMode: "required" }))).rejects.toBeInstanceOf(NarrationError);
    await expect(narrate(ANALYSIS, cfg({ aiMode: "required" }))).rejects.toMatchObject({ exitCode: 6 });
  });

  it("required + unsupported provider (real resolveModel) → throws NarrationError", async () => {
    const narrate = createNarrate(); // real resolveModel
    await expect(narrate(ANALYSIS, cfg({ aiMode: "required", provider: "openai" }))).rejects.toBeInstanceOf(
      NarrationError,
    );
  });

  it("preserves a NarrationError's identity rather than double-wrapping", async () => {
    const inner = new NarrationError("specific narration failure");
    const narrate = createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw inner;
      },
    });
    await expect(narrate(ANALYSIS, cfg({ aiMode: "required" }))).rejects.toBe(inner);
  });

  it("scrubs the API key from the degraded reason if an SDK error echoes it", async () => {
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw new Error("provider rejected request with key sk-leaky-123");
      },
    })(ANALYSIS, cfg({ aiMode: "auto", aiKey: new Secret("sk-leaky-123") }));
    expect(outcome.kind).toBe("degraded");
    expect((outcome as { reason: string }).reason).not.toContain("sk-leaky-123");
    expect((outcome as { reason: string }).reason).toContain("***");
  });
});
