import { describe, it, expect, vi } from "vitest";
import type { generateObject as sdkGenerateObject, LanguageModel } from "ai";

import { generateNarrative, generateExplanations, generateGroupExplanations, buildExplanationsRecord } from "./generate.js";
import { NarrativeSchema, ExplanationBatchSchema, type MetricExplanationEntry } from "./schema.js";
import type { Analysis } from "../analyze/engine.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 },
    { id: "a-commit-cadence", group: "A", title: "Cadence", status: "not_available", reason: "Too few commits." },
  ],
};

/** A multi-group corpus: Group A (1), Group B (1), Group C (1) → three per-group batches. */
const MULTI: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 },
    { id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: 1 },
    { id: "c-conventional", group: "C", title: "Conventional commits", status: "not_available", reason: "n/a" },
  ],
};

/** A canned batch tagging one entry per metric id (the model's per-group output). */
const batchFor = (...ids: string[]) => ({
  explanations: ids.map((metricId) => ({
    metricId,
    explanation: `meaning of ${metricId}`,
    goodBehaviours: [],
    needsImprovement: [],
    suggestions: [`improve ${metricId}`],
  })),
});

/** A fake generateObject that returns a per-group batch derived from the prompt's metric ids. */
const groupFakeFromPrompt = (calls: GenerateObjectArgs[]) =>
  vi.fn((opts: GenerateObjectArgs) => {
    calls.push(opts);
    const ids = ["a-commit-volume", "b-bus-factor", "c-conventional"].filter((id) => opts.prompt.includes(id));
    return Promise.resolve({ object: batchFor(...ids) });
  }) as unknown as typeof sdkGenerateObject;

const CANNED_NARRATIVE = {
  summary: {
    headline: "Steady activity.",
    overview: "Three commits in the window.",
    keyFindings: ["Low volume", "Single contributor"],
  },
  explanation: { paragraphs: ["The cadence is low but consistent."] },
  coaching: {
    introduction: "A short plan to grow throughput safely.",
    chapters: [{ theme: "Cadence", steps: ["Commit in smaller, more frequent increments"] }],
    closingSummary: "Focus on smaller, frequent commits first.",
  },
};

const fakeModel = {} as LanguageModel;

interface GenerateObjectArgs {
  schema: unknown;
  temperature: unknown;
  prompt: string;
  model: unknown;
}

describe("generateNarrative", () => {
  it("binds the NarrativeSchema, pins temperature 0, sends the metrics-only prompt, and returns the object", async () => {
    const calls: GenerateObjectArgs[] = [];
    const fakeGenerateObject = vi.fn((opts: GenerateObjectArgs) => {
      calls.push(opts);
      return Promise.resolve({ object: CANNED_NARRATIVE });
    }) as unknown as typeof sdkGenerateObject;

    const narrative = await generateNarrative(fakeModel, ANALYSIS, { generateObject: fakeGenerateObject });

    expect(narrative).toEqual(CANNED_NARRATIVE);
    expect(NarrativeSchema.safeParse(narrative).success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].schema).toBe(NarrativeSchema);
    expect(calls[0].temperature).toBe(0);
    expect(calls[0].prompt).toContain("a-commit-volume"); // metrics-only prompt wired through
  });
});

const ENTRY = (over: Partial<MetricExplanationEntry> = {}): MetricExplanationEntry => ({
  metricId: "a-commit-volume",
  explanation: "Low but steady.",
  goodBehaviours: ["Consistent"],
  needsImprovement: [],
  suggestions: ["Commit smaller"],
  ...over,
});

describe("generateExplanations — per-group batching (Story 3.3)", () => {
  it("makes one generateObject call per non-empty Group, each over only that group's metrics (AC1)", async () => {
    const calls: GenerateObjectArgs[] = [];
    const record = await generateExplanations(fakeModel, MULTI, { generateObject: groupFakeFromPrompt(calls) });

    // Three groups present (A, B, C) → three batches.
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.schema).toBe(ExplanationBatchSchema);
      expect(call.temperature).toBe(0);
    }
    // Each batch's prompt carries exactly ONE group's metric id (bounded response).
    const promptIds = calls.map((c) =>
      ["a-commit-volume", "b-bus-factor", "c-conventional"].filter((id) => c.prompt.includes(id)),
    );
    expect(promptIds.every((ids) => ids.length === 1)).toBe(true);
    // The merged record covers every metric across all groups, in Group-then-metric order.
    expect(Object.keys(record)).toEqual(["a-commit-volume", "b-bus-factor", "c-conventional"]);
  });

  it("skips groups with no metrics (no wasted call)", async () => {
    const calls: GenerateObjectArgs[] = [];
    // ANALYSIS has only Group A metrics → a single batch.
    await generateExplanations(fakeModel, ANALYSIS, { generateObject: groupFakeFromPrompt(calls) });
    expect(calls).toHaveLength(1);
  });

  it("degrades gracefully when a single group fails — other groups still carried (AC2)", async () => {
    // Reject exactly the Group B batch (detected by its metric id in the prompt).
    const fake = vi.fn((opts: GenerateObjectArgs) => {
      if (opts.prompt.includes("b-bus-factor")) {
        return Promise.reject(new Error("group B context overflow"));
      }
      const ids = ["a-commit-volume", "c-conventional"].filter((id) => opts.prompt.includes(id));
      return Promise.resolve({ object: batchFor(...ids) });
    }) as unknown as typeof sdkGenerateObject;

    const record = await generateExplanations(fakeModel, MULTI, { generateObject: fake });

    // Group B's metric is absent; A and C survive — the run did not fail.
    expect(Object.keys(record)).toEqual(["a-commit-volume", "c-conventional"]);
    expect(record).not.toHaveProperty("b-bus-factor");
  });

  it("returns an empty map (no throw) when EVERY group fails — the extreme of graceful degradation", async () => {
    const fake = vi.fn(() => Promise.reject(new Error("provider down"))) as unknown as typeof sdkGenerateObject;
    await expect(generateExplanations(fakeModel, MULTI, { generateObject: fake })).resolves.toEqual({});
  });

  it("returns an empty map without any call for an analysis with no metrics", async () => {
    const calls: GenerateObjectArgs[] = [];
    const record = await generateExplanations(fakeModel, { metrics: [] }, { generateObject: groupFakeFromPrompt(calls) });
    expect(record).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("merges in deterministic Group-then-metric order regardless of which batch resolves first (AC3)", async () => {
    // Resolve later groups FIRST to prove the merge order is fixed, not completion order.
    const delayFor = (prompt: string): number => {
      if (prompt.includes("c-conventional")) return 0;
      if (prompt.includes("b-bus-factor")) return 5;
      return 10;
    };
    const fake = vi.fn((opts: GenerateObjectArgs) => {
      const ids = ["a-commit-volume", "b-bus-factor", "c-conventional"].filter((id) => opts.prompt.includes(id));
      return new Promise((resolve) => setTimeout(() => resolve({ object: batchFor(...ids) }), delayFor(opts.prompt)));
    }) as unknown as typeof sdkGenerateObject;

    const record = await generateExplanations(fakeModel, MULTI, { generateObject: fake });
    expect(Object.keys(record)).toEqual(["a-commit-volume", "b-bus-factor", "c-conventional"]);
  });
});

describe("generateGroupExplanations — a single group's batch", () => {
  it("binds the ExplanationBatchSchema, pins temperature 0, sends the group prompt, and keys by id incl. not_available", async () => {
    const calls: GenerateObjectArgs[] = [];
    const batch = {
      explanations: [
        ENTRY({ metricId: "a-commit-volume" }),
        ENTRY({ metricId: "a-commit-cadence", explanation: "Could not be computed: too few commits.", goodBehaviours: [], needsImprovement: [], suggestions: [] }),
      ],
    };
    const fakeGenerateObject = vi.fn((opts: GenerateObjectArgs) => {
      calls.push(opts);
      return Promise.resolve({ object: batch });
    }) as unknown as typeof sdkGenerateObject;

    const record = await generateGroupExplanations(fakeModel, ANALYSIS, { generateObject: fakeGenerateObject });

    expect(calls).toHaveLength(1);
    expect(calls[0].schema).toBe(ExplanationBatchSchema);
    expect(calls[0].temperature).toBe(0);
    expect(calls[0].prompt).toContain("a-commit-cadence"); // metrics-only group prompt wired through
    expect(Object.keys(record)).toEqual(["a-commit-volume", "a-commit-cadence"]);
    expect(record["a-commit-cadence"].explanation).toContain("Could not be computed");
    expect(record["a-commit-volume"]).not.toHaveProperty("metricId"); // metricId stripped
  });
});

describe("buildExplanationsRecord — anchoring + determinism", () => {
  it("covers every metric in the analysis when the model returns one per metric (AC1, AC2)", () => {
    const record = buildExplanationsRecord(
      [ENTRY({ metricId: "a-commit-volume" }), ENTRY({ metricId: "a-commit-cadence" })],
      ANALYSIS,
    );
    expect(Object.keys(record)).toEqual(["a-commit-volume", "a-commit-cadence"]);
  });

  it("drops an entry whose metricId is not a metric in the analysis (AC3 anchoring)", () => {
    const record = buildExplanationsRecord(
      [ENTRY({ metricId: "a-commit-volume" }), ENTRY({ metricId: "z-hallucinated" })],
      ANALYSIS,
    );
    expect(Object.keys(record)).toEqual(["a-commit-volume"]); // ungrounded id dropped
  });

  it("keeps the FIRST occurrence of a duplicate metricId (deterministic)", () => {
    const record = buildExplanationsRecord(
      [ENTRY({ metricId: "a-commit-volume", explanation: "first" }), ENTRY({ metricId: "a-commit-volume", explanation: "second" })],
      ANALYSIS,
    );
    expect(record["a-commit-volume"].explanation).toBe("first");
  });

  it("strips metricId from each stored value", () => {
    const record = buildExplanationsRecord([ENTRY({ metricId: "a-commit-volume" })], ANALYSIS);
    expect(record["a-commit-volume"]).toEqual({
      explanation: "Low but steady.",
      goodBehaviours: ["Consistent"],
      needsImprovement: [],
      suggestions: ["Commit smaller"],
    });
  });
});
