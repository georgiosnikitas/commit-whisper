import { describe, it, expect } from "vitest";

import { buildNarrativePrompt } from "./prompt.js";
import type { Analysis } from "../analyze/engine.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume over time", status: "computed", value: { perMonth: { "2024-01": 3 } } },
    { id: "a-commit-cadence", group: "A", title: "Commit frequency / cadence", status: "not_available", reason: "Too few commits." },
  ],
};

describe("buildNarrativePrompt", () => {
  it("includes the metric ids, titles, and statuses", () => {
    const prompt = buildNarrativePrompt(ANALYSIS);
    expect(prompt).toContain("a-commit-volume");
    expect(prompt).toContain("Commit frequency / cadence");
    expect(prompt).toContain("not_available");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("names all three narrative parts and the Coaching structure", () => {
    const prompt = buildNarrativePrompt(ANALYSIS);
    expect(prompt).toContain("Summary");
    expect(prompt).toContain("Explanation");
    expect(prompt).toContain("Coaching");
    // The Coaching structure (introduction → themed chapters of prioritized steps → closing).
    expect(prompt.toLowerCase()).toContain("introduction");
    expect(prompt.toLowerCase()).toContain("chapter");
    expect(prompt.toLowerCase()).toContain("prioritized");
  });

  it("instructs plain-language, team-level, grounded prose", () => {
    const prompt = buildNarrativePrompt(ANALYSIS).toLowerCase();
    expect(prompt).toContain("plain language");
    expect(prompt).toContain("team level"); // never per-developer ranking
    expect(prompt).toContain("ground");
  });

  it("only contains data present in the analysis (privacy: no RepoHistory leakage)", () => {
    // A raw commit message / diff sentinel that lives in RepoHistory but never in Analysis.
    const SECRET_DIFF = "TOP_SECRET_RAW_DIFF_LINE_+password=hunter2";
    const prompt = buildNarrativePrompt(ANALYSIS);
    expect(prompt).not.toContain(SECRET_DIFF);
    expect(prompt).not.toContain("password");
    // The prompt is a pure function of analysis.metrics — serializes exactly them.
    expect(prompt).toContain(JSON.stringify(ANALYSIS.metrics, null, 2));
  });
});
