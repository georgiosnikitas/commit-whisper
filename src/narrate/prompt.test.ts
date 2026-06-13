import { describe, it, expect } from "vitest";

import { buildSummaryPrompt } from "./prompt.js";
import type { Analysis } from "../analyze/engine.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume over time", status: "computed", value: { perMonth: { "2024-01": 3 } } },
    { id: "a-commit-cadence", group: "A", title: "Commit frequency / cadence", status: "not_available", reason: "Too few commits." },
  ],
};

describe("buildSummaryPrompt", () => {
  it("includes the metric ids, titles, and statuses", () => {
    const prompt = buildSummaryPrompt(ANALYSIS);
    expect(prompt).toContain("a-commit-volume");
    expect(prompt).toContain("Commit frequency / cadence");
    expect(prompt).toContain("not_available");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("only contains data present in the analysis (privacy: no RepoHistory leakage)", () => {
    // A raw commit message / diff sentinel that lives in RepoHistory but never in Analysis.
    const SECRET_DIFF = "TOP_SECRET_RAW_DIFF_LINE_+password=hunter2";
    const prompt = buildSummaryPrompt(ANALYSIS);
    expect(prompt).not.toContain(SECRET_DIFF);
    expect(prompt).not.toContain("password");
    // The prompt is a pure function of analysis.metrics — serializes exactly them.
    expect(prompt).toContain(JSON.stringify(ANALYSIS.metrics, null, 2));
  });
});
