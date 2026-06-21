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

const EXPLANATIONS = {
  "a-commit-volume": { explanation: "Low but steady.", goodBehaviours: ["Consistent"], needsImprovement: [], suggestions: ["Commit smaller"] },
};

/** A passing explanations generator for tests not exercising the explanations path. */
const okExplanations = async (): Promise<typeof EXPLANATIONS> => EXPLANATIONS;

function cfg(overrides: Partial<NarrateConfig> = {}): NarrateConfig {
  return { aiMode: "auto", provider: "gemini", llmModel: "m", aiKey: new Secret("dummy"), ...overrides };
}

/** A model stand-in; the injected `generate` ignores it, so its shape is irrelevant. */
const fakeModel = {} as LanguageModel;

describe("createNarrate", () => {
  it("aiMode off → skipped, without resolving a model or generating", async () => {
    const resolveModel = vi.fn();
    const generate = vi.fn();
    const generateExplanations = vi.fn();
    const outcome = await createNarrate({ resolveModel, generate, generateExplanations })(ANALYSIS, cfg({ aiMode: "off" }));
    expect(outcome).toEqual({ kind: "skipped" });
    expect(resolveModel).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(generateExplanations).not.toHaveBeenCalled();
  });

  it("happy path → narrated with the full narrative (three parts + per-metric explanations + confidence)", async () => {
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => NARRATIVE,
      generateExplanations: okExplanations,
    })(ANALYSIS, cfg());
    expect(outcome.kind).toBe("narrated");
    const narrative = (outcome as { narrative: { confidence?: { level: string; escalation?: string } } }).narrative;
    // The three parts + explanations are carried (grounding is a no-op on the number-free fixture).
    expect(narrative).toMatchObject({ ...NARRATIVE, explanations: EXPLANATIONS });
    // Story 3.5: a confidence self-assessment is computed (all grounded, full coverage → high).
    expect(narrative.confidence?.level).toBe("high");
    expect(narrative.confidence?.escalation).toBeUndefined();
  });

  it("emits monotonic progress events ending at completed === total (live narrative progress bar)", async () => {
    const events: Array<{ completed: number; total: number; label: string }> = [];
    const explWithProgress = async (
      _model: LanguageModel,
      _analysis: Analysis,
      deps?: { onGroup?: (group: "A" | "B" | "C" | "D" | "E" | "F") => void },
    ): Promise<typeof EXPLANATIONS> => {
      deps?.onGroup?.("A");
      return EXPLANATIONS;
    };
    await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => NARRATIVE,
      generateExplanations: explWithProgress,
    })(ANALYSIS, cfg(), (progress) => events.push(progress));

    // ANALYSIS has one Group (A): phases = narrative + 1 group + finalize = 3.
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0]).toMatchObject({ completed: 0, total: 3 });
    expect(events[0].label).toContain("gemini"); // "Connecting to gemini…"
    expect(events.some((e) => e.label.includes("Group A"))).toBe(true);
    // Monotonic non-decreasing completed, ending exactly at total.
    for (let i = 1; i < events.length; i++) {
      expect(events[i].completed).toBeGreaterThanOrEqual(events[i - 1].completed);
    }
    const last = events.at(-1)!;
    expect(last.completed).toBe(last.total);
    expect(last.total).toBe(3);
  });

  it("computes a LOW confidence with an escalation when generation fabricates claims (Story 3.5)", async () => {
    // ANALYSIS's only number is 3; the overview is all-fabricated → grounding empties it
    // (passRate 0) → low confidence with an escalation naming the config to change.
    const parts = {
      summary: { headline: "Healthy.", overview: "There were 999 reverts and 888 merges.", keyFindings: [] },
      explanation: { paragraphs: ["Steady cadence."] },
      coaching: { introduction: "A plan.", chapters: [{ theme: "Cadence", steps: ["Commit smaller"] }], closingSummary: "Done." },
    };
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => parts,
      generateExplanations: okExplanations,
    })(ANALYSIS, cfg({ provider: "gemini", llmModel: "gemini-2.0-flash" }));
    const narrative = (outcome as { narrative: { confidence?: { level: string; escalation?: string } } }).narrative;
    expect(narrative.confidence?.level).toBe("low");
    expect(narrative.confidence?.escalation).toContain("COMMIT_WHISPER_PROVIDER");
  });

  it("applies the deterministic grounding pass — a fabricated numeric claim is removed before returning (Story 3.4)", async () => {
    // ANALYSIS's only number is 3 (a-commit-volume value), so "999" is ungrounded.
    const parts = {
      summary: { headline: "Healthy.", overview: "The repo has 3 commits. It has 999 reverts.", keyFindings: ["A fabricated 999-contributor finding"] },
      explanation: { paragraphs: ["Steady cadence."] },
      coaching: { introduction: "A plan.", chapters: [{ theme: "Cadence", steps: ["Commit smaller"] }], closingSummary: "Done." },
    };
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => parts,
      generateExplanations: okExplanations,
    })(ANALYSIS, cfg());
    expect(outcome.kind).toBe("narrated");
    const narrative = (outcome as { narrative: typeof parts }).narrative;
    expect(narrative.summary.overview).toBe("The repo has 3 commits."); // grounded sentence kept, 999 sentence removed
    expect(narrative.summary.keyFindings).toEqual([]); // the fabricated 999 bullet dropped
  });

  it("auto + a throwing generate → degraded (fail open, no throw)", async () => {
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw new Error("provider exploded");
      },
      generateExplanations: okExplanations,
    })(ANALYSIS, cfg({ aiMode: "auto" }));
    expect(outcome.kind).toBe("degraded");
    expect((outcome as { reason: string }).reason).toContain("provider exploded");
  });

  it("auto + a throwing generateExplanations → degraded (whole narration fails open)", async () => {
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => NARRATIVE,
      generateExplanations: async () => {
        throw new Error("explanations batch failed");
      },
    })(ANALYSIS, cfg({ aiMode: "auto" }));
    expect(outcome.kind).toBe("degraded");
    expect((outcome as { reason: string }).reason).toContain("explanations batch failed");
  });

  it("auto + BOTH generations rejecting → degraded, with no unhandled rejection", async () => {
    // Promise.all attaches a handler to BOTH inputs, so the second rejection is
    // never unhandled (vitest fails the run on an unhandled rejection).
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw new Error("narrative failed");
      },
      generateExplanations: async () => {
        throw new Error("explanations failed");
      },
    })(ANALYSIS, cfg({ aiMode: "auto" }));
    expect(outcome.kind).toBe("degraded");
  });

  it("required + a throwing generate → throws NarrationError (exit 6)", async () => {
    const narrate = createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw new Error("provider exploded");
      },
      generateExplanations: okExplanations,
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
      generateExplanations: okExplanations,
    });
    await expect(narrate(ANALYSIS, cfg({ aiMode: "required" }))).rejects.toBe(inner);
  });

  it("scrubs the API key from the degraded reason if an SDK error echoes it", async () => {
    const outcome = await createNarrate({
      resolveModel: () => fakeModel,
      generate: async () => {
        throw new Error("provider rejected request with key sk-leaky-123");
      },
      generateExplanations: okExplanations,
    })(ANALYSIS, cfg({ aiMode: "auto", aiKey: new Secret("sk-leaky-123") }));
    expect(outcome.kind).toBe("degraded");
    expect((outcome as { reason: string }).reason).not.toContain("sk-leaky-123");
    expect((outcome as { reason: string }).reason).toContain("***");
  });
});
