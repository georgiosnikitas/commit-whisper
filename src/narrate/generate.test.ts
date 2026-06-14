import { describe, it, expect, vi } from "vitest";
import type { generateObject as sdkGenerateObject, LanguageModel } from "ai";

import { generateNarrative } from "./generate.js";
import { NarrativeSchema } from "./schema.js";
import type { Analysis } from "../analyze/engine.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 },
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
