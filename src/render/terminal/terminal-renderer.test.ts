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
        escalation: "Confidence is low — re-run with a stronger model. Set COMMIT_WHISPER_PROVIDER and COMMIT_WHISPER_LLM_MODEL (currently gemini/m) to a more capable provider/model.",
      },
    };
    const out = renderTerminal(report({ narrative, degraded: false }), { color: false });
    expect(out).toContain("Confidence: LOW");
    expect(out).toContain("⚠ Confidence is low");
    expect(out).toContain("COMMIT_WHISPER_PROVIDER");
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

describe("renderTerminal — masthead provenance (FR-17 parity)", () => {
  const PROVENANCE: Report["provenance"] = {
    repo: { name: "payments-api", target: "github.com/acme/payments-api", source: "remote", branch: "main" },
    scale: { totalCommits: 1234, analyzedCommits: 100, contributors: 3 },
    ai: { provider: "openai", model: "gpt-4o" },
    run: { generatedAt: "2026-06-18T09:30:00.000Z", toolVersion: "1.2.3" },
    entitlement: { tier: "free", commitCap: 100 },
  };

  it("renders the provenance chip line and the Free-tier cap line under the wordmark", () => {
    const out = renderTerminal(report({ narrative: NARRATIVE, provenance: PROVENANCE }), { color: false });
    expect(out).toContain("payments-api · main · 1,234 commits · 3 contributors · analyzed 2026-06-18");
    expect(out).toContain("Free · 100 of 1,234 commits analyzed");
  });

  it("omits the cap line on a paid tier and shows just the wordmark with no provenance", () => {
    const paid = renderTerminal(report({ narrative: NARRATIVE, provenance: { ...PROVENANCE, entitlement: { tier: "unlimited" } } }), { color: false });
    expect(paid).not.toContain("Free ·");
    const none = renderTerminal(report({ narrative: NARRATIVE }), { color: false });
    expect(none.startsWith("commit-whisper")).toBe(true);
    expect(none.split("\n")[1]).toBe(""); // no chip line directly under the wordmark when provenance is absent
  });
});

describe("renderTerminal — group structure + four-facet explanations (parity)", () => {
  const NARRATIVE_WITH_FACETS: ReportNarrative = {
    ...NARRATIVE,
    explanations: {
      "a-commit-volume": {
        explanation: "Volume is steady across the window.",
        goodBehaviours: ["Consistent cadence", "No long gaps"],
        needsImprovement: ["Few commits on weekends"],
        suggestions: ["Spread work earlier in the week"],
      },
    },
  };

  const out = renderTerminal(report({ narrative: NARRATIVE_WITH_FACETS, degraded: false }), { color: false });

  it("renders the Metrics heading and the group header with id, title, and description", () => {
    expect(out).toContain("Metrics");
    expect(out).toContain("A · Activity & Cadence");
    expect(out).toContain("How the project moves over time.");
  });

  it("renders the health band (glyph + word) on a metric", () => {
    expect(out).toMatch(/Commit volume {2}[●◐▲○] (ok|watch|risk|n\/a)/);
  });

  it("renders the four-facet bullets in the fixed order for a metric with an explanation", () => {
    const iValue = out.indexOf("• Value");
    const iMeaning = out.indexOf("• What it means");
    const iStrengths = out.indexOf("• Strengths");
    const iNeeds = out.indexOf("• Needs improvement");
    const iSuggestions = out.indexOf("• Suggestions");
    expect(iValue).toBeGreaterThanOrEqual(0);
    expect(iMeaning).toBeGreaterThan(iValue);
    expect(iStrengths).toBeGreaterThan(iMeaning);
    expect(iNeeds).toBeGreaterThan(iStrengths);
    expect(iSuggestions).toBeGreaterThan(iNeeds);
    expect(out).toContain("Volume is steady across the window.");
    expect(out).toContain("- Consistent cadence");
    expect(out).toContain("- Spread work earlier in the week");
  });

  it("shows an em-dash for an empty facet list", () => {
    const noFacets: ReportNarrative = {
      ...NARRATIVE,
      explanations: {
        "a-commit-volume": { explanation: "Steady.", goodBehaviours: [], needsImprovement: [], suggestions: [] },
      },
    };
    const o = renderTerminal(report({ narrative: noFacets }), { color: false });
    expect(o).toContain("• Strengths — —");
  });

  it("renders the Value bullet with the not-available reason for an uncomputed metric", () => {
    expect(out).toContain("• Value — not available — Too few commits.");
  });
});

describe("renderTerminal — structured Value rendering (no raw JSON arrays)", () => {
  const STRUCTURED: ReportAnalysis = {
    metrics: [
      { id: "b-bus", group: "B", title: "Bus factor", status: "computed", value: { busFactor: 2 } },
      {
        id: "e-most",
        group: "E",
        title: "Most changed files",
        status: "computed",
        value: [
          { path: "src/app.ts", changes: 40 },
          { path: "src/util.ts", changes: 12 },
        ],
      },
    ],
  };

  const out = renderTerminal(report({ analysis: STRUCTURED, degraded: false }), { color: false });

  it("renders an array value as a labeled list, not a raw JSON dump", () => {
    expect(out).not.toContain('[{"path"');
    expect(out).toContain("- src/app.ts: 40");
    expect(out).toContain("- src/util.ts: 12");
  });

  it("renders a single-field object value inline", () => {
    expect(out).toContain("• Value — 2");
  });
});

describe("renderTerminal — nested Value rendering (no raw JSON blobs)", () => {
  const NESTED: ReportAnalysis = {
    metrics: [
      {
        id: "e-churn-over-time",
        group: "E",
        title: "Churn rate over time",
        status: "computed",
        value: {
          perMonth: {
            "2026-05": { additions: 100, deletions: 20, churn: 120, commitCount: 4 },
            "2026-06": { additions: 49404, deletions: 6116, churn: 55520, commitCount: 12 },
          },
          totalChurn: 55640,
        },
      },
      {
        id: "f-strengths-weaknesses",
        group: "F",
        title: "Hygiene strengths & weaknesses",
        status: "computed",
        value: {
          strengths: [{ name: "Message Quality", subScore: 91.81 }],
          weaknesses: [{ name: "Churn Stability", subScore: 40 }],
        },
      },
    ],
  };

  const out = renderTerminal(report({ analysis: NESTED, degraded: false }), { color: false });

  it("collapses a time-bucket of objects to a labeled tree, not raw JSON", () => {
    expect(out).not.toContain('"additions"');
    expect(out).not.toContain('{"perMonth"');
    expect(out).toContain("- perMonth");
    expect(out).toContain("- 2026-06: 55520");
    expect(out).toContain("- totalChurn: 55640");
  });

  it("flattens strengths/weaknesses score lists to name: score lines", () => {
    expect(out).toContain("- strengths");
    expect(out).toContain("- Message Quality: 91.81");
    expect(out).toContain("- Churn Stability: 40");
  });
});

