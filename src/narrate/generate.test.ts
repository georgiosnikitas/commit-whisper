import { describe, it, expect, vi } from "vitest";
import type { generateObject as sdkGenerateObject, LanguageModel } from "ai";

import { generateSummary } from "./generate.js";
import { SummarySchema } from "./schema.js";
import type { Analysis } from "../analyze/engine.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 },
  ],
};

const CANNED_SUMMARY = {
  headline: "Steady activity.",
  overview: "Three commits in the window.",
  keyFindings: ["Low volume", "Single contributor"],
};

const fakeModel = {} as LanguageModel;

interface GenerateObjectArgs {
  schema: unknown;
  temperature: unknown;
  prompt: string;
  model: unknown;
}

describe("generateSummary", () => {
  it("binds the SummarySchema, pins temperature 0, sends the metrics-only prompt, and returns the object", async () => {
    const calls: GenerateObjectArgs[] = [];
    const fakeGenerateObject = vi.fn((opts: GenerateObjectArgs) => {
      calls.push(opts);
      return Promise.resolve({ object: CANNED_SUMMARY });
    }) as unknown as typeof sdkGenerateObject;

    const summary = await generateSummary(fakeModel, ANALYSIS, { generateObject: fakeGenerateObject });

    expect(summary).toEqual(CANNED_SUMMARY);
    expect(SummarySchema.safeParse(summary).success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].schema).toBe(SummarySchema);
    expect(calls[0].temperature).toBe(0);
    expect(calls[0].prompt).toContain("a-commit-volume"); // metrics-only prompt wired through
  });
});
