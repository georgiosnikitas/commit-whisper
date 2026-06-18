import { describe, it, expect } from "vitest";

import { groupOverviewPanel, metricVisual, dataTable } from "./charts.js";
import type { ReportAnalysis } from "../../assemble/report-schema.js";

type Metric = ReportAnalysis["metrics"][number];

const TIMESERIES: Metric = { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { perMonth: { "2024-01": 3, "2024-02": 7 } } };
const SCALAR: Metric = { id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: { busFactor: 2 } };
const RANGE: Metric = { id: "f-hygiene-score", group: "F", title: "Hygiene score", status: "computed", value: { score: 81 } };
const DIST: Metric = { id: "a-commit-size-distribution", group: "A", title: "Size distribution", status: "computed", value: { small: 10, medium: 5, large: 2 } };
const NA: Metric = { id: "a-commit-cadence", group: "A", title: "Cadence", status: "not_available", reason: "Too few commits." };

describe("dataTable", () => {
  it("renders an escaped table inside a details disclosure (the accessible fallback)", () => {
    const out = dataTable([{ label: "<b>x</b>", value: 3 }], "Value", "Cap & test");
    expect(out).toContain("<details class=\"data-table\" open>");
    expect(out).toContain("<table>");
    expect(out).toContain("&lt;b&gt;x&lt;/b&gt;"); // label escaped
    expect(out).toContain("Cap &amp; test"); // caption escaped
  });
});

describe("groupOverviewPanel", () => {
  it("renders a figure + caption + SVG + a mandatory data-table fallback (never a chart alone)", () => {
    const out = groupOverviewPanel("A", [TIMESERIES, NA]);
    expect(out).toContain("<figure class=\"chart-panel\"");
    expect(out).toContain("<figcaption>");
    expect(out).toContain("<svg");
    expect(out).toContain("data-table");
    expect(out).toContain("<table>");
  });

  it("uses the group's fixed chart type (A → line, B → donut, C → bars, F → radar)", () => {
    expect(groupOverviewPanel("A", [TIMESERIES])).toContain("chart-line");
    expect(groupOverviewPanel("B", [{ ...DIST, group: "B" }])).toContain("chart-donut");
    expect(groupOverviewPanel("C", [{ ...DIST, group: "C" }])).toContain("chart-bars");
  });

  it("renders a caption + note (no SVG) when no metric yields a chartable series", () => {
    const out = groupOverviewPanel("A", [SCALAR, NA]);
    expect(out).toContain("<figcaption>");
    expect(out).toContain("No chartable series");
    expect(out).not.toContain("<svg");
  });
});

describe("metricVisual — by shape", () => {
  it("a timeseries metric → an SVG line + data table", () => {
    const out = metricVisual(TIMESERIES);
    expect(out).toContain("chart-line");
    expect(out).toContain("data-table");
  });

  it("a distribution metric → SVG bars + data table", () => {
    expect(metricVisual(DIST)).toContain("chart-bars");
  });

  it("a scalar-in-range metric → a gauge + the number", () => {
    const out = metricVisual(RANGE);
    expect(out).toContain("chart-gauge");
    expect(out).toContain("metric-number");
    expect(out).toContain("81");
  });

  it("a pure scalar metric → no SVG (the card shows the bold stat)", () => {
    expect(metricVisual(SCALAR)).toBe("");
  });

  it("a not_available metric → no visual", () => {
    expect(metricVisual(NA)).toBe("");
  });

  it("a timeseries whose series is empty still renders a valid (empty) chart + table, no NaN", () => {
    const empty: Metric = { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { perMonth: {} } };
    const out = metricVisual(empty);
    expect(out).toContain("chart-line"); // shape detected as timeseries → line
    expect(out).toContain("data-table"); // the fallback is still present
    expect(out).not.toContain("NaN"); // no degenerate coordinate
  });
});
