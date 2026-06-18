import { describe, it, expect } from "vitest";

import { renderHtml, escapeHtml, HTML_DEGRADED_BANNER, HTML_METRICS_ONLY_NOTE } from "./html-renderer.js";
import type { Report, ReportAnalysis, ReportNarrative, ReportProvenance } from "../../assemble/report-schema.js";

const ANALYSIS: ReportAnalysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { total: 42 } },
    { id: "a-commit-cadence", group: "A", title: "Commit cadence", status: "not_available", reason: "Too few commits." },
    { id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: 2 },
    { id: "f-hygiene-score", group: "F", title: "Hygiene score", status: "computed", value: 81 },
  ],
};

const NARRATIVE: ReportNarrative = {
  summary: {
    headline: "A steady, healthy repository.",
    overview: "Forty-two commits across one month show consistent activity.",
    keyFindings: ["Low overall volume", "Single active author"],
  },
  explanation: { paragraphs: ["The cadence is low but consistent.", "Ownership is concentrated."] },
  coaching: {
    introduction: "A short plan to tighten a few practices.",
    chapters: [{ theme: "Commit-message hygiene", steps: ["Adopt Conventional Commits", "Avoid one-word messages"] }],
    closingSummary: "Start with commit-message hygiene this week.",
  },
  explanations: {
    "a-commit-volume": { explanation: "Volume is steady.", goodBehaviours: ["Consistent cadence"], needsImprovement: [], suggestions: ["Keep it up"] },
  },
  confidence: { level: "high", rationale: "Grounding 100%, explanation coverage 92%, 0% of metrics not available." },
};

function report(over: Partial<Report>): Report {
  return { schemaVersion: "1.0.0", degraded: false, analysis: ANALYSIS, ...over };
}

const showpiece = (): string => renderHtml(report({ narrative: NARRATIVE }));

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;");
  });

  it("escapes & first so existing entities are not double-decoded", () => {
    expect(escapeHtml("a < b && c")).toBe("a &lt; b &amp;&amp; c");
  });
});

describe("renderHtml — self-containment (AC1)", () => {
  const out = showpiece();

  it("is a single self-contained HTML document", () => {
    expect(out.startsWith("<!doctype html>")).toBe(true);
    expect(out).toContain("<html lang=\"en\">");
    expect(out.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("inlines all CSS and references no external assets (no CDN/network)", () => {
    expect(out).toContain("<style>");
    expect(out).not.toContain("<link");
    // Story 4.2 adds a tiny INLINE disclosure script — self-containment forbids
    // external/network refs, not inline JS.
    expect(out).not.toContain("<script src");
    expect(out).not.toContain("src=\"http");
    expect(out).not.toContain("href=\"http");
    expect(out).not.toContain("@import");
  });

  it("stays within the ~1 MB weight budget", () => {
    expect(Buffer.byteLength(out, "utf8")).toBeLessThan(1_000_000);
  });
});

describe("renderHtml — narrative-first band order (AC2)", () => {
  const out = showpiece();

  it("renders masthead → Summary → Explanation → Coaching → metric groups, in order", () => {
    const iMast = out.indexOf("<h1>commit-whisper</h1>");
    const iSummary = out.indexOf('id="summary"');
    const iExplanation = out.indexOf('id="explanation"');
    const iCoaching = out.indexOf('id="coaching"');
    const iFirstGroup = out.indexOf('id="group-a"');
    expect(iMast).toBeGreaterThanOrEqual(0);
    expect(iSummary).toBeGreaterThan(iMast);
    expect(iExplanation).toBeGreaterThan(iSummary);
    expect(iCoaching).toBeGreaterThan(iExplanation);
    expect(iFirstGroup).toBeGreaterThan(iCoaching); // story before evidence
  });

  it("renders the narrative content (headline, a coaching step) before any metric group", () => {
    const iHeadline = out.indexOf("A steady, healthy repository.");
    const iStep = out.indexOf("Adopt Conventional Commits");
    const iGroup = out.indexOf('id="group-a"');
    expect(iHeadline).toBeLessThan(iGroup);
    expect(iStep).toBeLessThan(iGroup);
  });
});

describe("renderHtml — TOC, anchors, searchable text (AC3)", () => {
  const out = showpiece();

  it("provides a TOC linking the narrative + the present group anchors", () => {
    expect(out).toContain('href="#summary"');
    expect(out).toContain('href="#explanation"');
    expect(out).toContain('href="#coaching"');
    // The fixture has metrics in groups A, B, F → only those are linked (no dead anchors).
    for (const g of ["a", "b", "f"]) {
      expect(out).toContain(`href="#group-${g}"`);
    }
  });

  it("has matching target ids for every anchor", () => {
    for (const id of ["summary", "explanation", "coaching", "group-a", "group-b", "group-f"]) {
      expect(out).toContain(`id="${id}"`);
    }
  });

  it("never links a Metric Group the page does not render (no dead anchors)", () => {
    // The fixture has no C/D/E metrics → the TOC must not link #group-c/d/e.
    for (const g of ["c", "d", "e"]) {
      expect(out).not.toContain(`href="#group-${g}"`);
      expect(out).not.toContain(`id="group-${g}"`);
    }
    // Every TOC group link has a matching section id.
    const linked = [...out.matchAll(/href="#(group-[a-f])"/g)].map((m) => m[1]);
    for (const id of linked) {
      expect(out).toContain(`id="${id}"`);
    }
  });

  it("renders content as plain searchable text (browser find works)", () => {
    expect(out).toContain("Single active author"); // a key finding, verbatim
    expect(out).toContain("Commit volume"); // a metric title
    expect(out).toContain("Too few commits."); // a not_available reason
  });

  it("lists all six group anchors when every group has a metric", () => {
    const fullAnalysis: ReportAnalysis = {
      metrics: (["A", "B", "C", "D", "E", "F"] as const).map((g) => ({
        id: `${g.toLowerCase()}-x`,
        group: g,
        title: `${g} metric`,
        status: "computed" as const,
        value: 1,
      })),
    };
    const full = renderHtml(report({ analysis: fullAnalysis, narrative: NARRATIVE }));
    for (const g of ["a", "b", "c", "d", "e", "f"]) {
      expect(full).toContain(`href="#group-${g}"`);
      expect(full).toContain(`id="group-${g}"`);
    }
  });
});

describe("renderHtml — accessibility floor (AC4)", () => {
  const out = showpiece();

  it("has exactly one <h1>", () => {
    expect(out.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("declares language, charset, and a responsive viewport", () => {
    expect(out).toContain("<html lang=\"en\">");
    expect(out).toContain('<meta charset="utf-8">');
    expect(out).toContain('name="viewport"');
  });

  it("provides a skip link to the main content", () => {
    expect(out).toContain('class="skip-link" href="#main"');
    expect(out).toContain('id="main"');
  });

  it("uses semantic landmarks", () => {
    expect(out).toContain("<header");
    expect(out).toContain("<nav");
    expect(out).toContain("<main");
    expect(out).toContain("<footer");
  });

  it("includes reduced-motion and color-scheme media queries", () => {
    expect(out).toContain("prefers-reduced-motion");
    expect(out).toContain("prefers-color-scheme");
  });
});

describe("renderHtml — security / escaping", () => {
  it("escapes dangerous markup in narrative and metric values", () => {
    const malicious: ReportNarrative = {
      ...NARRATIVE,
      summary: { headline: "<script>alert(1)</script>", overview: "ok", keyFindings: ['" onmouseover="x'] },
    };
    const evilMetric: ReportAnalysis = {
      metrics: [{ id: "x", group: "A", title: "<img src=x onerror=alert(2)>", status: "computed", value: "</style><script>1</script>" }],
    };
    const out = renderHtml(report({ analysis: evilMetric, narrative: malicious }));
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).not.toContain("<img src=x onerror=");
    expect(out).not.toContain("</style><script>1</script>");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain("&lt;img src=x onerror=alert(2)&gt;");
    // The malicious metric VALUE is rendered, escaped (positive assertion).
    expect(out).toContain("&lt;/style&gt;&lt;script&gt;1&lt;/script&gt;");
  });
});

describe("renderHtml — metric grouping + four-facet join", () => {
  const out = showpiece();

  it("renders groups in A→F order and omits empty groups", () => {
    const iA = out.indexOf('id="group-a"');
    const iB = out.indexOf('id="group-b"');
    const iF = out.indexOf('id="group-f"');
    expect(iA).toBeGreaterThanOrEqual(0);
    expect(iB).toBeGreaterThan(iA);
    expect(iF).toBeGreaterThan(iB);
    // No metrics in groups C/D/E → those sections are omitted.
    expect(out).not.toContain('id="group-c"');
    expect(out).not.toContain('id="group-d"');
    expect(out).not.toContain('id="group-e"');
  });

  it("joins a metric's four-facet explanation by id", () => {
    expect(out).toContain("Volume is steady."); // explanations["a-commit-volume"].explanation
    expect(out).toContain("Consistent cadence"); // a goodBehaviours entry
    expect(out).toContain("Good behaviours");
    expect(out).toContain("Suggestions");
  });

  it("renders a computed headline stat and a not_available reason", () => {
    expect(out).toContain('class="metric-stat">42</span>'); // headline stat derived from {total:42}
    expect(out).toContain("Too few commits.");
  });
});

describe("renderHtml — substrate path (no narrative)", () => {
  it("a metrics-only report has no narrative bands and the neutral note", () => {
    const out = renderHtml(report({ degraded: false })); // no narrative
    expect(out).toContain(HTML_METRICS_ONLY_NOTE);
    expect(out).not.toContain('id="summary"');
    expect(out).not.toContain('id="coaching"');
    expect(out).not.toContain(HTML_DEGRADED_BANNER);
    // Metric groups still render, with their anchors.
    expect(out).toContain('id="group-a"');
    expect(out).not.toContain('href="#summary"'); // TOC omits narrative anchors
  });

  it("a degraded report carries the loud banner", () => {
    const out = renderHtml(report({ degraded: true }));
    expect(out).toContain(HTML_DEGRADED_BANNER);
    expect(out).not.toContain(HTML_METRICS_ONLY_NOTE);
    expect(out).toContain('id="group-a"');
  });
});

describe("renderHtml — charts, health bands, disclosure (Story 4.2)", () => {
  // A fixture with genuinely chartable shapes: a Group-A timeseries, a Group-B
  // scalar (bus factor 2 → watch), and a not_available metric (→ n/a band).
  const CHARTABLE: ReportAnalysis = {
    metrics: [
      { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { perMonth: { "2024-01": 18, "2024-02": 24 } } },
      { id: "a-commit-cadence", group: "A", title: "Commit cadence", status: "not_available", reason: "Too few commits." },
      { id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: { busFactor: 2 } },
    ],
  };
  const out = renderHtml(report({ analysis: CHARTABLE, narrative: NARRATIVE }));

  it("renders a group-overview chart-panel before the metric cards in each group", () => {
    const iPanel = out.indexOf('class="chart-panel"');
    const iCard = out.indexOf('class="metric-card"');
    expect(iPanel).toBeGreaterThanOrEqual(0);
    expect(iCard).toBeGreaterThan(iPanel); // chart first, then the cards
    expect(out).toContain("<svg"); // an inline-SVG chart (no canvas)
    expect(out).not.toContain("<canvas"); // ADR: inline SVG, not Chart.js canvas
  });

  it("renders a health band (glyph + text label, never color alone) on each metric card", () => {
    expect(out).toContain('class="health health-');
    expect(out).toContain("health-glyph");
    expect(out).toMatch(/health-(ok|watch|risk|na)/);
    expect(out).toContain("watch"); // bus factor 2 → watch
    expect(out).toContain("n/a"); // the not_available metric
  });

  it("renders metric cards as <details open> (no-JS = expanded) + the disclosure script", () => {
    expect(out).toContain('<details class="metric-card"');
    expect(out).toContain(" open>"); // open by default → no-JS shows everything
    expect(out).toContain("<script>"); // the inline disclosure script
    expect(out).toContain('data-health="ok"'); // cards expose their health status (ADR H4: the script no longer collapses ok cards)
  });

  it("every chart carries an accessible data-table fallback (never a chart alone)", () => {
    expect(out).toContain('class="data-table"');
    expect(out).toContain("<table>");
    expect(out).toContain("Show data table");
  });

  it("keeps escaping through the new visuals/tables and stays self-contained < 1 MB", () => {
    const evil: ReportAnalysis = {
      metrics: [{ id: "e-most-changed", group: "E", title: "Most changed", status: "computed", value: { topFiles: [{ path: "<img onerror=alert(1)>", touchCount: 9, churn: 9 }] } }],
    };
    const evilOut = renderHtml(report({ analysis: evil, narrative: NARRATIVE }));
    expect(evilOut).not.toContain("<img onerror=alert(1)>");
    expect(evilOut).toContain("&lt;img onerror=alert(1)&gt;"); // escaped in the data table
    expect(Buffer.byteLength(out, "utf8")).toBeLessThan(1_000_000);
  });
});

describe("renderHtml — provenance masthead chips + footer (FR-17)", () => {
  const PROVENANCE: ReportProvenance = {
    repo: { name: "payments-api", target: "https://github.com/acme/payments-api", source: "remote", branch: "main" },
    scale: { totalCommits: 1204, analyzedCommits: 100, contributors: 87 },
    ai: { provider: "anthropic", model: "claude-sonnet-4" },
    run: { generatedAt: "2026-06-12T00:00:00Z", toolVersion: "1.0.8" },
    entitlement: { tier: "free", commitCap: 100 },
  };

  it("renders the masthead chip row — name · branch · N commits · C contributors · analyzed <date>", () => {
    const out = renderHtml(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    expect(out).toContain('class="prov-chips"');
    expect(out).toContain('<span class="prov-chip">payments-api</span>');
    expect(out).toContain('<span class="prov-chip">main</span>');
    expect(out).toContain('<span class="prov-chip">1,204 commits</span>'); // deterministic thousands grouping
    expect(out).toContain('<span class="prov-chip">87 contributors</span>');
    expect(out).toContain('<span class="prov-chip">analyzed 2026-06-12</span>'); // date component only
  });

  it("renders the footer chips — commit-whisper v<ver> · schemaVersion 1.0.0 · <provider>/<model> · <timestamp>", () => {
    const out = renderHtml(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    expect(out).toContain("Generated by commit-whisper v1.0.8 · schemaVersion 1.0.0 · anthropic/claude-sonnet-4 · 2026-06-12T00:00:00Z");
  });

  it("renders the Free-tier cap line 'Free · X of N commits analyzed'", () => {
    const out = renderHtml(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    expect(out).toContain('class="cap-line"');
    expect(out).toContain("Free · 100 of 1,204 commits analyzed");
  });

  it("degrades the cap line to 'Free · X commits analyzed' when the total is absent", () => {
    const provenance: ReportProvenance = { entitlement: { tier: "free", commitCap: 100 }, scale: { analyzedCommits: 100 } };
    const out = renderHtml(report({ narrative: NARRATIVE, provenance }));
    expect(out).toContain("Free · 100 commits analyzed");
    expect(out).not.toContain("100 of");
  });

  it("a paid tier (no commit cap) renders NO cap line", () => {
    const provenance: ReportProvenance = { ...PROVENANCE, entitlement: { tier: "unlimited" } };
    const out = renderHtml(report({ narrative: NARRATIVE, provenance }));
    expect(out).not.toContain('class="cap-line"');
    expect(out).not.toContain("Free ·");
  });

  it("a --no-ai report (no ai subtree) renders NO provider/model footer chip", () => {
    const provenance: ReportProvenance = { repo: PROVENANCE.repo, scale: PROVENANCE.scale, run: PROVENANCE.run, entitlement: PROVENANCE.entitlement };
    const out = renderHtml(report({ narrative: NARRATIVE, provenance }));
    expect(out).not.toContain("anthropic/");
    expect(out).toContain("Generated by commit-whisper v1.0.8 · schemaVersion 1.0.0 · 2026-06-12T00:00:00Z");
  });

  it("provenance ABSENT → masthead + footer still render cleanly (back-compat: no chips, no dangling separators, no 'undefined')", () => {
    const out = renderHtml(report({ narrative: NARRATIVE }));
    expect(out).toContain("<h1>commit-whisper</h1>");
    expect(out).toContain("<footer");
    expect(out).toContain("Generated by commit-whisper · schemaVersion 1.0.0"); // the original, version-free footer
    expect(out).not.toContain('class="prov-chips"');
    expect(out).not.toContain('class="cap-line"');
    expect(out).not.toContain("undefined");
  });

  it("renders the chips on a substrate (metrics-only) report too — provenance is independent of narration", () => {
    const provenance: ReportProvenance = { repo: PROVENANCE.repo, scale: PROVENANCE.scale };
    const out = renderHtml(report({ degraded: false, provenance })); // no narrative → substrate
    expect(out).toContain(HTML_METRICS_ONLY_NOTE);
    expect(out).toContain('<span class="prov-chip">payments-api</span>');
    expect(out).toContain('<span class="prov-chip">1,204 commits</span>');
  });

  it("escapes a malicious repo name / branch in the masthead chips (OWASP A03)", () => {
    const provenance: ReportProvenance = {
      repo: { name: "<b>evil</b>", target: "https://h/x", source: "remote", branch: '"><img onerror=alert(7)>' },
    };
    const out = renderHtml(report({ narrative: NARRATIVE, provenance }));
    expect(out).not.toContain("<b>evil</b>");
    expect(out).not.toContain("<img onerror=alert(7)>");
    expect(out).toContain("&lt;b&gt;evil&lt;/b&gt;");
    expect(out).toContain("&quot;&gt;&lt;img onerror=alert(7)&gt;");
  });

  it("is a pure function and provenance never leaks into the metric-group rendering (determinism)", () => {
    const withProv = renderHtml(report({ narrative: NARRATIVE, provenance: PROVENANCE }));
    const withoutProv = renderHtml(report({ narrative: NARRATIVE }));
    // Same input → byte-identical output (purity).
    expect(renderHtml(report({ narrative: NARRATIVE, provenance: PROVENANCE }))).toBe(withProv);
    // The <main> metric-groups block is byte-identical with vs without provenance.
    const mainOf = (html: string): string => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    expect(mainOf(withProv)).toBe(mainOf(withoutProv));
  });
});

