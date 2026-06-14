import { describe, it, expect } from "vitest";

import { ReportSchema, MetricSchema, SCHEMA_VERSION } from "./report-schema.js";

const ANALYSIS = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { perMonth: { "2024-01": 3 } } },
    { id: "a-commit-cadence", group: "A", title: "Cadence", status: "not_available", reason: "Too few commits." },
  ],
};

const NARRATIVE = {
  summary: { headline: "h", overview: "o", keyFindings: ["k1", "k2"] },
  explanation: { paragraphs: ["p1"] },
  coaching: { introduction: "i", chapters: [{ theme: "t", steps: ["s"] }], closingSummary: "c" },
};

describe("ReportSchema", () => {
  it("parses a full report (with narrative)", () => {
    const report = { schemaVersion: SCHEMA_VERSION, degraded: false, analysis: ANALYSIS, narrative: NARRATIVE };
    expect(ReportSchema.safeParse(report).success).toBe(true);
  });

  it("parses a substrate report (no narrative)", () => {
    const report = { schemaVersion: SCHEMA_VERSION, degraded: true, analysis: ANALYSIS };
    expect(ReportSchema.safeParse(report).success).toBe(true);
  });

  it("requires schemaVersion to be exactly 1.0.0", () => {
    const report = { schemaVersion: "2.0.0", degraded: false, analysis: ANALYSIS };
    expect(ReportSchema.safeParse(report).success).toBe(false);
  });

  it("requires the degraded marker", () => {
    const report = { schemaVersion: SCHEMA_VERSION, analysis: ANALYSIS };
    expect(ReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects an unknown top-level key (strict contract)", () => {
    const report = { schemaVersion: SCHEMA_VERSION, degraded: false, analysis: ANALYSIS, extra: 1 };
    expect(ReportSchema.safeParse(report).success).toBe(false);
  });

  it("accepts the forward-compatible explanations map under narrative", () => {
    const report = {
      schemaVersion: SCHEMA_VERSION,
      degraded: false,
      analysis: ANALYSIS,
      narrative: {
        summary: NARRATIVE.summary,
        explanation: NARRATIVE.explanation,
        coaching: NARRATIVE.coaching,
        explanations: {
          "a-commit-volume": {
            explanation: "e",
            goodBehaviours: ["g"],
            needsImprovement: ["n"],
            suggestions: ["s"],
          },
        },
      },
    };
    expect(ReportSchema.safeParse(report).success).toBe(true);
  });

  it("rejects a narrative missing a required part (Explanation/Coaching)", () => {
    const report = {
      schemaVersion: SCHEMA_VERSION,
      degraded: false,
      analysis: ANALYSIS,
      narrative: { summary: NARRATIVE.summary },
    };
    expect(ReportSchema.safeParse(report).success).toBe(false);
  });
});

describe("MetricSchema", () => {
  it("rejects an unknown field on a metric envelope (no welding)", () => {
    const metric = { id: "x", group: "A", title: "t", status: "computed", value: 1, explanation: "welded!" };
    expect(MetricSchema.safeParse(metric).success).toBe(false);
  });

  it("accepts a not_available envelope with a reason", () => {
    expect(
      MetricSchema.safeParse({ id: "x", group: "B", title: "t", status: "not_available", reason: "r" }).success,
    ).toBe(true);
  });

  it("rejects a non-finite metric value (NaN/Infinity would JSON.stringify to null)", () => {
    // These are exactly the numbers that survive in memory but corrupt to `null`
    // on serialization — the read-back validation must refuse them up front.
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(MetricSchema.safeParse({ id: "x", group: "A", title: "t", status: "computed", value }).success).toBe(false);
    }
    // A nested non-finite number is rejected just the same.
    const nested = { id: "x", group: "A", title: "t", status: "computed", value: { perMonth: { "2024-01": Infinity } } };
    expect(MetricSchema.safeParse(nested).success).toBe(false);
  });
});
