import { describe, it, expect } from "vitest";

import {
  renderTerminal,
  DEGRADED_BANNER,
  METRICS_ONLY_NOTE,
} from "./terminal-renderer.js";
import type { Report, ReportAnalysis, ReportNarrative } from "../../assemble/report-schema.js";

const ANALYSIS: ReportAnalysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { total: 3 } },
    { id: "a-commit-cadence", group: "A", title: "Commit cadence", status: "not_available", reason: "Too few commits." },
  ],
};

const NARRATIVE: ReportNarrative = {
  summary: {
    headline: "A steady, healthy repository.",
    overview: "Three commits across one month show low but consistent activity.",
    keyFindings: ["Low overall volume", "Single active author"],
  },
  explanation: {
    paragraphs: ["The cadence is low but consistent across the window."],
  },
  coaching: {
    introduction: "A short plan to grow throughput safely.",
    chapters: [{ theme: "Commit-message hygiene", steps: ["Adopt Conventional Commits"] }],
    closingSummary: "Start with commit-message hygiene this week.",
  },
};

function report(over: Partial<Report>): Report {
  return { schemaVersion: "1.0.0", degraded: false, analysis: ANALYSIS, ...over };
}

describe("renderTerminal — showpiece", () => {
  const out = renderTerminal(report({ narrative: NARRATIVE, degraded: false }), { color: false });

  it("includes the narrative bands (headline, overview, key findings)", () => {
    expect(out).toContain("A steady, healthy repository.");
    expect(out).toContain("Three commits across one month");
    expect(out).toContain("Low overall volume");
    expect(out).toContain("Single active author");
  });

  it("renders exactly three labeled parts in order: Summary, Explanation, Coaching", () => {
    const iSummary = out.indexOf("Summary");
    const iExplanation = out.indexOf("Explanation");
    const iCoaching = out.indexOf("Coaching");
    expect(iSummary).toBeGreaterThanOrEqual(0);
    expect(iExplanation).toBeGreaterThan(iSummary);
    expect(iCoaching).toBeGreaterThan(iExplanation);
  });

  it("renders the Explanation paragraphs and the structured Coaching report", () => {
    expect(out).toContain("The cadence is low but consistent across the window.");
    expect(out).toContain("A short plan to grow throughput safely."); // coaching introduction
    expect(out).toContain("Commit-message hygiene"); // chapter theme
    expect(out).toContain("Adopt Conventional Commits"); // a prioritized step
    expect(out).toContain("Start with commit-message hygiene this week."); // closing summary
  });

  it("includes the metrics table alongside the narrative", () => {
    expect(out).toContain("Commit volume");
    expect(out).toContain("Commit cadence");
  });

  it("carries no substrate banner or note", () => {
    expect(out).not.toContain(DEGRADED_BANNER);
    expect(out).not.toContain(METRICS_ONLY_NOTE);
  });

  it("renders no confidence band when the narrative has no confidence (back-compat)", () => {
    expect(out).not.toContain("Confidence:");
  });
});

describe("renderTerminal — confidence band (Story 3.5)", () => {
  it("surfaces a high-confidence level and rationale, no escalation", () => {
    const narrative: ReportNarrative = {
      ...NARRATIVE,
      confidence: { level: "high", rationale: "Grounding 100%, explanation coverage 100%, 0% of metrics not available." },
    };
    const out = renderTerminal(report({ narrative, degraded: false }), { color: false });
    expect(out).toContain("Confidence: HIGH");
    expect(out).toContain("Grounding 100%");
    expect(out).not.toContain("⚠");
  });

  it("surfaces a LOW confidence with the escalation prominently (AC3)", () => {
    const narrative: ReportNarrative = {
      ...NARRATIVE,
      confidence: {
        level: "low",
        rationale: "Grounding 30%, explanation coverage 40%, 50% of metrics not available.",
        escalation: "Confidence is low — re-run with a stronger model. Set COMMIT_SAGE_PROVIDER and COMMIT_SAGE_LLM_MODEL (currently gemini/m) to a more capable provider/model.",
      },
    };
    const out = renderTerminal(report({ narrative, degraded: false }), { color: false });
    expect(out).toContain("Confidence: LOW");
    expect(out).toContain("⚠ Confidence is low");
    expect(out).toContain("COMMIT_SAGE_PROVIDER");
  });
});

describe("renderTerminal — substrate", () => {
  it("a degraded report carries the loud ⚠ banner and the metrics, but no narrative", () => {
    const out = renderTerminal(report({ degraded: true }), { color: false });
    expect(out).toContain(DEGRADED_BANNER);
    expect(out).toContain("⚠ Narrative unavailable");
    expect(out).toContain("Commit volume");
    expect(out).not.toContain("A steady, healthy repository.");
    expect(out).not.toContain(METRICS_ONLY_NOTE);
  });

  it("an intentional metrics-only report carries the neutral note (no ⚠ banner)", () => {
    const out = renderTerminal(report({ degraded: false }), { color: false });
    expect(out).toContain(METRICS_ONLY_NOTE);
    expect(out).not.toContain(DEGRADED_BANNER);
    expect(out).toContain("Commit cadence");
  });

  it("renders the not_available reason for an unavailable metric", () => {
    const out = renderTerminal(report({ degraded: false }), { color: false });
    expect(out).toContain("Too few commits.");
  });
});

describe("renderTerminal — color discipline", () => {
  it("emits no ANSI escapes when color is forced off (headless-identical text)", () => {
    const out = renderTerminal(report({ degraded: true }), { color: false });
    expect(out).not.toMatch(/\u001b\[/);
  });

  it("emits ANSI escapes when color is forced on", () => {
    const out = renderTerminal(report({ degraded: true }), { color: true });
    expect(out).toMatch(/\u001b\[/);
  });

  it("produces identical text content with color on vs off once ANSI is stripped", () => {
    const colored = renderTerminal(report({ narrative: NARRATIVE }), { color: true });
    const plain = renderTerminal(report({ narrative: NARRATIVE }), { color: false });
    expect(colored.replace(/\u001b\[[0-9;]*m/g, "")).toBe(plain);
  });
});

describe("renderTerminal — empty analysis", () => {
  it("states no metrics were computed rather than crashing", () => {
    const out = renderTerminal(report({ analysis: { metrics: [] }, degraded: false }), { color: false });
    expect(out).toContain("No metrics computed.");
  });
});
