import { describe, it, expect } from "vitest";

import { renderMarkdown, MD_DEGRADED_BANNER, MD_METRICS_ONLY_NOTE } from "./markdown-renderer.js";
import type { Report, ReportAnalysis, ReportNarrative } from "../../assemble/report-schema.js";

const ANALYSIS: ReportAnalysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { perMonth: { "2024-01": 18, "2024-02": 24, "2024-03": 12 } } },
    { id: "a-commit-cadence", group: "A", title: "Commit cadence", status: "not_available", reason: "Too few commits." },
    { id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: { busFactor: 2 } },
    { id: "e-most-changed", group: "E", title: "Most changed files", status: "computed", value: [{ path: "src/app.ts", changes: 40 }, { path: "src/util.ts", changes: 12 }] },
    { id: "f-hygiene-score", group: "F", title: "Hygiene score", status: "computed", value: { score: 81 } },
  ],
};

const NARRATIVE: ReportNarrative = {
  summary: { headline: "A steady, healthy repository.", overview: "Forty-two commits across three months.", keyFindings: ["Low overall volume", "Single active author"] },
  explanation: { paragraphs: ["The cadence is low but consistent.", "Ownership is concentrated."] },
  coaching: {
    introduction: "A short plan to tighten a few practices.",
    chapters: [{ theme: "Commit-message hygiene", steps: ["Adopt Conventional Commits", "Avoid one-word messages"] }],
    closingSummary: "Start with commit-message hygiene this week.",
  },
  explanations: {
    "a-commit-volume": { explanation: "Volume is steady.", goodBehaviours: ["Consistent cadence"], needsImprovement: [], suggestions: ["Keep it up"] },
  },
  confidence: { level: "high", rationale: "Grounding 100%, explanation coverage 92%." },
};

function report(over: Partial<Report>): Report {
  return { schemaVersion: "1.0.0", degraded: false, analysis: ANALYSIS, ...over };
}

const showpiece = (): string => renderMarkdown(report({ narrative: NARRATIVE }));

describe("renderMarkdown — narrative-first showpiece (AC3)", () => {
  const out = showpiece();

  it("starts with the title and ends with a trailing newline", () => {
    expect(out.startsWith("# commit-whisper")).toBe(true);
    expect(out.endsWith("\n")).toBe(true);
  });

  it("renders the bands narrative-first: Summary → Explanation → Coaching → Metrics", () => {
    const iSummary = out.indexOf("## Summary");
    const iExplanation = out.indexOf("## Explanation");
    const iCoaching = out.indexOf("## Coaching");
    const iMetrics = out.indexOf("## Metrics");
    expect(iSummary).toBeGreaterThan(0);
    expect(iExplanation).toBeGreaterThan(iSummary);
    expect(iCoaching).toBeGreaterThan(iExplanation);
    expect(iMetrics).toBeGreaterThan(iCoaching); // story before evidence
  });

  it("surfaces confidence as the WORD, not a glyph", () => {
    expect(out).toContain("**Confidence:** high — Grounding 100%, explanation coverage 92%.");
    expect(out).not.toMatch(/Confidence.*[●◐▲○]/); // glyphs are reserved for health bands
  });

  it("renders the headline as a blockquote and key findings as bullets", () => {
    expect(out).toContain("> A steady, healthy repository.");
    expect(out).toContain("- Low overall volume");
  });

  it("renders Coaching as themed chapters with prioritized step bullets + an italic closing", () => {
    expect(out).toContain("### 1. Commit-message hygiene");
    expect(out).toContain("- Adopt Conventional Commits");
    expect(out).toContain("_Start with commit-message hygiene this week._");
  });
});

describe("renderMarkdown — text-only visuals (AC1)", () => {
  const out = showpiece();

  it("includes a fenced text-bar group-overview block (no vertical bar chart)", () => {
    expect(out).toContain("```");
    expect(out).not.toContain("mermaid");
    expect(out).not.toContain("xychart-beta");
  });

  it("includes an ASCII sparkline beside a time-series metric heading", () => {
    expect(out).toMatch(/`[▁▂▃▄▅▆▇█]+`/);
  });

  it("includes a text-bar table for a distribution metric (with the file path)", () => {
    expect(out).toContain("█");
    expect(out).toContain("src/app.ts");
  });

  it("embeds no binary image / data URI / network asset", () => {
    expect(out).not.toContain("![");
    expect(out).not.toContain("data:image");
    expect(out).not.toContain("http://");
    expect(out).not.toContain("https://");
  });
});

describe("renderMarkdown — facets as bullets, bands, not_available (AC2)", () => {
  const out = showpiece();

  it("renders the four facets as bold-label bullets, NEVER a wide table", () => {
    expect(out).toContain("- **Value** — ");
    expect(out).toContain("- **What it means** — Volume is steady.");
    expect(out).toContain("- **Strengths**");
    expect(out).toContain("  - Consistent cadence"); // a nested list item
    expect(out).toContain("- **Needs improvement** — —"); // empty facet → em-dash
    expect(out).not.toContain("| What it means |"); // not a 2-column facet table
  });

  it("shows each health band as a shape glyph + word (never color alone)", () => {
    expect(out).toContain("◐ watch"); // bus factor 2
    expect(out).toContain("● ok"); // hygiene 81
    expect(out).toContain("○ n/a"); // the not_available metric
  });

  it("a not_available metric still gets a heading, band, and reason — visual omitted", () => {
    expect(out).toContain("#### Commit cadence  ○ n/a");
    expect(out).toContain("- **Value** — _not available — Too few commits._");
  });
});

describe("renderMarkdown — substrate: degraded vs metrics-only (AC3)", () => {
  it("a degraded substrate leads with the banner blockquote + stub headings + — confidence", () => {
    const out = renderMarkdown(report({ degraded: true }));
    expect(out.startsWith(MD_DEGRADED_BANNER)).toBe(true); // the first line of the file
    expect(out).toContain("**Confidence:** —");
    expect(out).toContain("## Summary\n\n_Narrative unavailable — showing raw analysis._");
    expect(out).toContain("## Metrics"); // metrics render in full
    expect(out).not.toContain("- **What it means**"); // but no facet bullets
  });

  it("a metrics-only substrate is calm: no banner, no stubs, a quiet footer note", () => {
    const out = renderMarkdown(report({ degraded: false }));
    expect(out).not.toContain(MD_DEGRADED_BANNER);
    expect(out).not.toContain("## Summary"); // no stub narrative headings
    expect(out).toContain("## Metrics");
    expect(out).toContain(MD_METRICS_ONLY_NOTE);
  });
});

describe("renderMarkdown — security & determinism", () => {
  it("escapes a hostile metric value/label so it breaks neither a table nor the document", () => {
    const evil: ReportAnalysis = {
      metrics: [{ id: "e-most-changed", group: "E", title: "Most changed", status: "computed", value: [{ path: "<img onerror=alert(1)>|x", changes: 9 }] }],
    };
    const out = renderMarkdown(report({ analysis: evil, narrative: NARRATIVE }));
    expect(out).not.toContain("<img onerror=alert(1)>");
    expect(out).toContain("&lt;img onerror=alert(1)&gt;");
  });

  it("is a pure function — two renders of the same Report are byte-identical", () => {
    expect(showpiece()).toBe(showpiece());
  });
});

describe("renderMarkdown — masthead provenance (FR-17 parity with HTML)", () => {
  const PROVENANCE: Report["provenance"] = {
    repo: { name: "payments-api", target: "github.com/acme/payments-api", source: "remote", branch: "main" },
    scale: { totalCommits: 1234, analyzedCommits: 100, contributors: 3 },
    ai: { provider: "openai", model: "gpt-4o" },
    run: { generatedAt: "2026-06-18T09:30:00.000Z", toolVersion: "1.2.3" },
    entitlement: { tier: "free", commitCap: 100 },
  };

  it("puts the repo name in the title", () => {
    const out = renderMarkdown(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    expect(out.startsWith("# commit-whisper — payments-api")).toBe(true);
  });

  it("renders the provenance chip line: repo · branch · commits · contributors · analyzed date", () => {
    const out = renderMarkdown(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    expect(out).toContain("_payments-api · main · 1,234 commits · 3 contributors · analyzed 2026-06-18_");
  });

  it("renders the Free-tier cap line (X of N commits analyzed)", () => {
    const out = renderMarkdown(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    expect(out).toContain("Free · 100 of 1,234 commits analyzed");
  });

  it("appends the FR-17 footer facts: version · provider/model · timestamp", () => {
    const out = renderMarkdown(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    expect(out).toContain("Generated by commit-whisper v1.2.3 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-18T09:30:00.000Z");
  });

  it("omits the cap line on a paid tier and renders cleanly with provenance absent", () => {
    const paid = renderMarkdown(report({ narrative: NARRATIVE, provenance: { ...PROVENANCE, entitlement: { tier: "unlimited" } } }));
    expect(paid).not.toContain("Free ·");
    const none = renderMarkdown(report({ narrative: NARRATIVE }));
    expect(none.startsWith("# commit-whisper\n")).toBe(true); // no repo name, no chip line
  });
});

