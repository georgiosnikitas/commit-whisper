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

  it("includes the metrics table alongside the narrative", () => {
    expect(out).toContain("Commit volume");
    expect(out).toContain("Commit cadence");
  });

  it("carries no substrate banner or note", () => {
    expect(out).not.toContain(DEGRADED_BANNER);
    expect(out).not.toContain(METRICS_ONLY_NOTE);
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
