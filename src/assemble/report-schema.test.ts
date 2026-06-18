import { describe, it, expect } from "vitest";

import { ReportSchema, ProvenanceSchema, MetricSchema, SCHEMA_VERSION } from "./report-schema.js";

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

  it("rejects an explanation carrying an unknown key on read-back (strict boundary)", () => {
    const report = {
      schemaVersion: SCHEMA_VERSION,
      degraded: false,
      analysis: ANALYSIS,
      narrative: {
        summary: NARRATIVE.summary,
        explanation: NARRATIVE.explanation,
        coaching: NARRATIVE.coaching,
        explanations: {
          "a-commit-volume": { explanation: "e", goodBehaviours: [], needsImprovement: [], suggestions: [], welded: "nope" },
        },
      },
    };
    expect(ReportSchema.safeParse(report).success).toBe(false);
  });

  it("accepts a confidence self-assessment under narrative, and rejects a bad level / unknown key (strict)", () => {
    const base = {
      schemaVersion: SCHEMA_VERSION,
      degraded: false,
      analysis: ANALYSIS,
      narrative: {
        summary: NARRATIVE.summary,
        explanation: NARRATIVE.explanation,
        coaching: NARRATIVE.coaching,
        confidence: { level: "low", rationale: "Grounding 30%.", escalation: "Set COMMIT_WHISPER_PROVIDER." },
      },
    };
    expect(ReportSchema.safeParse(base).success).toBe(true);
    const badLevel = { ...base, narrative: { ...base.narrative, confidence: { level: "unsure", rationale: "x" } } };
    expect(ReportSchema.safeParse(badLevel).success).toBe(false);
    const unknownKey = { ...base, narrative: { ...base.narrative, confidence: { level: "high", rationale: "x", oops: 1 } } };
    expect(ReportSchema.safeParse(unknownKey).success).toBe(false);
  });

  it("enforces the escalation-iff-low invariant on read-back", () => {
    const wrap = (confidence: unknown) => ({
      schemaVersion: SCHEMA_VERSION,
      degraded: false,
      analysis: ANALYSIS,
      narrative: { summary: NARRATIVE.summary, explanation: NARRATIVE.explanation, coaching: NARRATIVE.coaching, confidence },
    });
    // low WITHOUT escalation → rejected; non-low WITH escalation → rejected.
    expect(ReportSchema.safeParse(wrap({ level: "low", rationale: "r" })).success).toBe(false);
    expect(ReportSchema.safeParse(wrap({ level: "high", rationale: "r", escalation: "e" })).success).toBe(false);
    // low WITH escalation → accepted; high WITHOUT → accepted.
    expect(ReportSchema.safeParse(wrap({ level: "low", rationale: "r", escalation: "e" })).success).toBe(true);
    expect(ReportSchema.safeParse(wrap({ level: "high", rationale: "r" })).success).toBe(true);
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

describe("ProvenanceSchema (FR-17)", () => {
  const PROVENANCE = {
    repo: { name: "payments-api", target: "https://github.com/acme/payments-api", source: "remote", branch: "main" },
    scale: { totalCommits: 1204, analyzedCommits: 100, contributors: 87 },
    ai: { provider: "anthropic", model: "claude-sonnet-4" },
    run: { generatedAt: "2026-06-12T00:00:00Z", toolVersion: "1.0.8" },
    entitlement: { tier: "free", commitCap: 100 },
  };

  it("round-trips a full provenance subtree on a report", () => {
    const report = { schemaVersion: SCHEMA_VERSION, degraded: false, analysis: ANALYSIS, narrative: NARRATIVE, provenance: PROVENANCE };
    const parsed = ReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.provenance).toEqual(PROVENANCE);
  });

  it("accepts a report with NO provenance (the subtree is optional — back-compat)", () => {
    const report = { schemaVersion: SCHEMA_VERSION, degraded: false, analysis: ANALYSIS };
    expect(ReportSchema.safeParse(report).success).toBe(true);
  });

  it("accepts a minimal provenance — every group is independently optional", () => {
    expect(ProvenanceSchema.safeParse({}).success).toBe(true);
    expect(ProvenanceSchema.safeParse({ run: { generatedAt: "2026-06-12T00:00:00Z", toolVersion: "1.0.8" } }).success).toBe(true);
    expect(ProvenanceSchema.safeParse({ entitlement: { tier: "unlimited" } }).success).toBe(true);
  });

  it("rejects an unknown key at the provenance root (strict read-back boundary)", () => {
    expect(ProvenanceSchema.safeParse({ ...PROVENANCE, extra: 1 }).success).toBe(false);
  });

  it("rejects an unknown key inside a nested group (strict at every level)", () => {
    expect(ProvenanceSchema.safeParse({ repo: { ...PROVENANCE.repo, token: "leak" } }).success).toBe(false);
    expect(ProvenanceSchema.safeParse({ scale: { ...PROVENANCE.scale, oops: 1 } }).success).toBe(false);
    expect(ProvenanceSchema.safeParse({ ai: { ...PROVENANCE.ai, key: "sk-secret" } }).success).toBe(false);
  });

  it("requires repo.name / repo.target / repo.source when repo is present", () => {
    expect(ProvenanceSchema.safeParse({ repo: { name: "x", target: "x", source: "local" } }).success).toBe(true);
    expect(ProvenanceSchema.safeParse({ repo: { name: "x", source: "local" } }).success).toBe(false); // missing target
    expect(ProvenanceSchema.safeParse({ repo: { name: "x", target: "x", source: "elsewhere" } }).success).toBe(false); // bad source
  });

  it("rejects a provider / tier outside the closed vocabulary", () => {
    expect(ProvenanceSchema.safeParse({ ai: { provider: "deepseek", model: "m" } }).success).toBe(false);
    expect(ProvenanceSchema.safeParse({ entitlement: { tier: "enterprise" } }).success).toBe(false);
  });

  it("rejects a non-finite numeric scale value (would JSON.stringify to null)", () => {
    expect(ProvenanceSchema.safeParse({ scale: { totalCommits: Number.NaN } }).success).toBe(false);
    expect(ProvenanceSchema.safeParse({ scale: { analyzedCommits: Infinity } }).success).toBe(false);
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
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      expect(MetricSchema.safeParse({ id: "x", group: "A", title: "t", status: "computed", value }).success).toBe(false);
    }
    // A nested non-finite number is rejected just the same.
    const nested = { id: "x", group: "A", title: "t", status: "computed", value: { perMonth: { "2024-01": Infinity } } };
    expect(MetricSchema.safeParse(nested).success).toBe(false);
  });
});
