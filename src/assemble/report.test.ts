import { describe, it, expect } from "vitest";

import { assembleReport, parseReport, reportFromOutcome } from "./report.js";
import { SCHEMA_VERSION } from "./report-schema.js";
import type { Analysis } from "../analyze/engine.js";
import type { Narrative, NarrateOutcome } from "../narrate/narrate.port.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { perMonth: { "2024-01": 3 } } },
    { id: "a-commit-cadence", group: "A", title: "Cadence", status: "not_available", reason: "Too few commits." },
  ],
};

const NARRATIVE: Narrative = {
  summary: { headline: "Steady.", overview: "Two commits.", keyFindings: ["Low volume"] },
  explanation: { paragraphs: ["Low but consistent activity."] },
  coaching: { introduction: "A short plan.", chapters: [{ theme: "Cadence", steps: ["Commit smaller"] }], closingSummary: "Start with cadence." },
};

describe("assembleReport", () => {
  it("produces a 1.0.0 report with narrative present and degraded false", () => {
    const report = assembleReport({ analysis: ANALYSIS, narrative: NARRATIVE, degraded: false });
    expect(report.schemaVersion).toBe(SCHEMA_VERSION);
    expect(report.degraded).toBe(false);
    expect(report.narrative).toEqual(NARRATIVE);
  });

  it("omits the narrative subtree when none is supplied", () => {
    const report = assembleReport({ analysis: ANALYSIS, degraded: true });
    expect("narrative" in report).toBe(false);
    expect(report.degraded).toBe(true);
  });

  it("passes the analysis subtree through verbatim (no welding, deep-equal)", () => {
    const report = assembleReport({ analysis: ANALYSIS, narrative: NARRATIVE, degraded: false });
    expect(report.analysis).toEqual(ANALYSIS);
    // The metric envelope carries no AI explanation welded in.
    expect(report.analysis.metrics[0]).not.toHaveProperty("explanation");
  });

  it("does not mutate its inputs", () => {
    const analysisCopy = structuredClone(ANALYSIS);
    assembleReport({ analysis: ANALYSIS, narrative: NARRATIVE, degraded: false });
    expect(ANALYSIS).toEqual(analysisCopy);
  });

  it("carries the per-metric explanations map (keyed by id) verbatim, and it survives read-back", () => {
    const narrative: Narrative = {
      ...NARRATIVE,
      explanations: {
        "a-commit-volume": { explanation: "Low but steady.", goodBehaviours: ["Consistent"], needsImprovement: [], suggestions: ["Commit smaller"] },
        "a-commit-cadence": { explanation: "Could not be computed: too few commits.", goodBehaviours: [], needsImprovement: [], suggestions: [] },
      },
    };
    const report = assembleReport({ analysis: ANALYSIS, narrative, degraded: false });
    expect(report.narrative?.explanations).toEqual(narrative.explanations);
    // The metric envelope itself still carries no welded explanation (analysis stays byte-stable).
    expect(report.analysis.metrics[0]).not.toHaveProperty("explanation");
    // The explanations map round-trips through the strict Report read-back schema.
    const reparsed = parseReport(JSON.stringify(report));
    expect(reparsed.narrative?.explanations?.["a-commit-cadence"].explanation).toContain("Could not be computed");
  });

  it("carries the confidence self-assessment verbatim and it round-trips read-back (Story 3.5)", () => {
    const narrative: Narrative = {
      ...NARRATIVE,
      confidence: { level: "low", rationale: "Grounding 30%, explanation coverage 40%, 50% of metrics not available.", escalation: "Set COMMIT_WHISPER_PROVIDER and COMMIT_WHISPER_LLM_MODEL." },
    };
    const report = assembleReport({ analysis: ANALYSIS, narrative, degraded: false });
    expect(report.narrative?.confidence).toEqual(narrative.confidence);
    const reparsed = parseReport(JSON.stringify(report));
    expect(reparsed.narrative?.confidence?.level).toBe("low");
    expect(reparsed.narrative?.confidence?.escalation).toContain("COMMIT_WHISPER_PROVIDER");
  });

  it("owns a defensive copy: mutating the caller's input afterward cannot poison the report", () => {
    const analysis = structuredClone(ANALYSIS);
    const narrative = structuredClone(NARRATIVE);
    const report = assembleReport({ analysis, narrative, degraded: false });
    // The report must hold its own data, not alias the caller's.
    expect(report.analysis).not.toBe(analysis);
    expect(report.narrative).not.toBe(narrative);
    // A later mutation of the caller's objects leaves the assembled report untouched.
    analysis.metrics[0]!.title = "MUTATED";
    narrative.summary.headline = "MUTATED";
    expect(report.analysis.metrics[0]!.title).toBe("Commit volume");
    expect(report.narrative?.summary.headline).toBe("Steady.");
  });
});

describe("reportFromOutcome (intentional vs degraded)", () => {
  it("narrated → narrative present, degraded false", () => {
    const outcome: NarrateOutcome = { kind: "narrated", narrative: NARRATIVE };
    const report = reportFromOutcome(ANALYSIS, outcome);
    expect(report.narrative).toEqual(NARRATIVE);
    expect(report.degraded).toBe(false);
  });

  it("skipped → narrative absent, degraded false (intentional metrics-only)", () => {
    const report = reportFromOutcome(ANALYSIS, { kind: "skipped" });
    expect("narrative" in report).toBe(false);
    expect(report.degraded).toBe(false);
  });

  it("degraded → narrative absent, degraded true (fail-open)", () => {
    const report = reportFromOutcome(ANALYSIS, { kind: "degraded", reason: "provider down" });
    expect("narrative" in report).toBe(false);
    expect(report.degraded).toBe(true);
  });
});

describe("byte-stability + read-back validation (AC1)", () => {
  it("serializes the analysis subtree identically with and without narrative", () => {
    const withNarr = assembleReport({ analysis: ANALYSIS, narrative: NARRATIVE, degraded: false });
    const without = assembleReport({ analysis: ANALYSIS, degraded: false });
    expect(JSON.stringify(without.analysis)).toBe(JSON.stringify(withNarr.analysis));
  });

  it("the analysis subtree is byte-stable across two assemblies of identical input", () => {
    const a = assembleReport({ analysis: ANALYSIS, degraded: false });
    const b = assembleReport({ analysis: ANALYSIS, degraded: false });
    expect(JSON.stringify(a.analysis)).toBe(JSON.stringify(b.analysis));
  });

  it("round-trips through JSON.stringify → parseReport (schema accepts what the assembler emits)", () => {
    const report = assembleReport({ analysis: ANALYSIS, narrative: NARRATIVE, degraded: false });
    const roundTripped = parseReport(JSON.stringify(report));
    expect(roundTripped).toEqual(report);
  });

  it("round-trips a substrate report too", () => {
    const report = reportFromOutcome(ANALYSIS, { kind: "skipped" });
    expect(parseReport(JSON.stringify(report))).toEqual(report);
  });

  it("parseReport throws on a malformed report (read-back validation)", () => {
    expect(() => parseReport(JSON.stringify({ schemaVersion: "9.9.9", degraded: false, analysis: ANALYSIS }))).toThrow();
  });
});
