import { describe, it, expect, vi } from "vitest";
import type { generateObject as sdkGenerateObject, LanguageModel } from "ai";

import { generateNarrative, generateExplanations, buildExplanationsRecord } from "./generate.js";
import { NarrativeSchema, ExplanationBatchSchema, type MetricExplanationEntry } from "./schema.js";
import type { Analysis } from "../analyze/engine.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 },
    { id: "a-commit-cadence", group: "A", title: "Cadence", status: "not_available", reason: "Too few commits." },
  ],
};

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

describe("generateExplanations", () => {
  it("binds the ExplanationBatchSchema, pins temperature 0, sends the explanations prompt, and keys by id", async () => {
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

    const record = await generateExplanations(fakeModel, ANALYSIS, { generateObject: fakeGenerateObject });

    expect(calls).toHaveLength(1);
    expect(calls[0].schema).toBe(ExplanationBatchSchema);
    expect(calls[0].temperature).toBe(0);
    expect(calls[0].prompt).toContain("a-commit-cadence");
    // Keyed by id in insertion order, covering every analysis metric (AC1), incl. the not_available one (AC2).
    expect(Object.keys(record)).toEqual(["a-commit-volume", "a-commit-cadence"]);
    expect(record["a-commit-cadence"].explanation).toContain("Could not be computed");
    // metricId is stripped from the stored value (the key carries it).
    expect(record["a-commit-volume"]).not.toHaveProperty("metricId");
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
