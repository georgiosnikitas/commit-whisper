import { describe, it, expect } from "vitest";

import {
  sparkline,
  textBars,
  mermaidLabel,
  mermaidXychart,
  groupOverview,
  metricVisualMarkdown,
  GROUP_OVERVIEW_NONE,
} from "./visuals.js";
import type { SeriesPoint } from "../html/shape.js";
import type { ReportAnalysis } from "../../assemble/report-schema.js";

type Metric = ReportAnalysis["metrics"][number];

const RISING: SeriesPoint[] = [
  { label: "a", value: 1 },
  { label: "b", value: 5 },
  { label: "c", value: 9 },
];

describe("sparkline", () => {
  it("maps a rising series to ascending block glyphs", () => {
    const out = sparkline(RISING);
    expect(out.length).toBe(3);
    expect(out.startsWith("▁")).toBe(true); // the lowest
    expect(out.endsWith("█")).toBe(true); // the highest
  });

  it("an empty series is the empty string", () => {
    expect(sparkline([])).toBe("");
  });

  it("a flat (all-equal) series is a single mid glyph repeated — no NaN", () => {
    const out = sparkline([{ label: "a", value: 4 }, { label: "b", value: 4 }, { label: "c", value: 4 }]);
    expect(out).toBe("▅▅▅");
    expect(out).not.toContain("NaN");
  });

  it("a single point is safe", () => {
    expect(sparkline([{ label: "a", value: 7 }])).toBe("▅");
  });

  it("non-finite values are guarded (no NaN)", () => {
    const out = sparkline([{ label: "a", value: Number.NaN }, { label: "b", value: 5 }]);
    expect(out).not.toContain("NaN");
    expect(out.length).toBe(2);
  });
});

describe("textBars", () => {
  it("emits a fenced block, one row per point, with escaped label + the numeric value", () => {
    const out = textBars([{ label: "src/app.ts", value: 40 }, { label: "src/util.ts", value: 10 }]);
    expect(out.startsWith("```")).toBe(true);
    expect(out.endsWith("```")).toBe(true);
    expect(out).toContain("█"); // a bar
    expect(out).toContain("src/app.ts");
    expect(out).toContain("40");
  });

  it("escapes a hostile label so it cannot break the block", () => {
    const out = textBars([{ label: "a|b<i>", value: 3 }]);
    expect(out).not.toContain("<i>");
    expect(out).toContain("a\\|b&lt;i&gt;");
  });

  it("max ≤ 0 is safe (all-empty bars, no crash)", () => {
    const out = textBars([{ label: "a", value: 0 }, { label: "b", value: 0 }]);
    expect(out).toContain("░");
    expect(out).not.toContain("█");
  });

  it("an empty series is the empty string", () => {
    expect(textBars([])).toBe("");
  });
});

describe("mermaidLabel + mermaidXychart", () => {
  it("mermaidLabel strips the xychart array delimiters and collapses whitespace", () => {
    expect(mermaidLabel('a"b[c],d\ne')).toBe("a b c d e");
    expect(mermaidLabel("   ")).toBe("-");
  });

  it("mermaidXychart emits a fenced xychart-beta with sanitized labels + rounded values", () => {
    const out = mermaidXychart([{ label: "2024-01", value: 18.4 }, { label: "2024-02", value: 24 }], "Commits");
    expect(out.startsWith("```mermaid")).toBe(true);
    expect(out).toContain("xychart-beta");
    expect(out).toContain('title "Commits"');
    expect(out).toContain('x-axis ["2024-01", "2024-02"]');
    expect(out).toContain("bar [18.4, 24]");
  });

  it("an empty series is the empty string", () => {
    expect(mermaidXychart([], "x")).toBe("");
  });
});

describe("groupOverview", () => {
  it("a timeseries group → a Mermaid xychart", () => {
    const metrics: Metric[] = [{ id: "a-commit-volume", group: "A", title: "Volume", status: "computed", value: { perMonth: { "2024-01": 3, "2024-02": 7 } } }];
    expect(groupOverview("A", metrics)).toContain("```mermaid");
  });

  it("a distribution group → a fenced text-bar (not Mermaid)", () => {
    const metrics: Metric[] = [{ id: "e-most-changed", group: "E", title: "Hotspots", status: "computed", value: [{ path: "x.ts", changes: 9 }, { path: "y.ts", changes: 4 }] }];
    const out = groupOverview("E", metrics);
    expect(out).toContain("```");
    expect(out).not.toContain("mermaid");
    expect(out).toContain("█");
  });

  it("an all-scalar group → the no-chart note (never a degenerate chart)", () => {
    const metrics: Metric[] = [{ id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: { busFactor: 2 } }];
    expect(groupOverview("B", metrics)).toBe(GROUP_OVERVIEW_NONE);
  });
});

describe("metricVisualMarkdown — by shape", () => {
  it("timeseries → a backticked sparkline in the heading, no body", () => {
    const v = metricVisualMarkdown({ id: "a", group: "A", title: "x", status: "computed", value: { perMonth: { "2024-01": 1, "2024-02": 9 } } });
    expect(v.headingSuffix).toMatch(/^`[▁▂▃▄▅▆▇█]+`$/);
    expect(v.body).toBe("");
  });

  it("distribution → a text-bar body, no heading suffix", () => {
    const v = metricVisualMarkdown({ id: "e", group: "E", title: "x", status: "computed", value: [{ path: "a.ts", changes: 3 }, { path: "b.ts", changes: 1 }] });
    expect(v.headingSuffix).toBe("");
    expect(v.body).toContain("```");
  });

  it("scalar-in-range → a value/max bold stat", () => {
    const v = metricVisualMarkdown({ id: "f", group: "F", title: "x", status: "computed", value: { score: 81 } });
    expect(v.headingSuffix).toBe("**81/100**");
  });

  it("pure scalar (single numeric field) → a bold number", () => {
    const v = metricVisualMarkdown({ id: "b", group: "B", title: "x", status: "computed", value: { busFactor: 2 } });
    expect(v.headingSuffix).toBe("**2**");
  });

  it("pure scalar (bare number) → a bold number", () => {
    const v = metricVisualMarkdown({ id: "b", group: "B", title: "x", status: "computed", value: 5 });
    expect(v.headingSuffix).toBe("**5**");
  });

  it("a not_available metric → no visual", () => {
    const v = metricVisualMarkdown({ id: "a", group: "A", title: "x", status: "not_available", reason: "n/a" });
    expect(v).toEqual({ headingSuffix: "", body: "" });
  });
});
