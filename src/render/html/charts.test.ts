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
  const VOLUME: Metric = {
    id: "a-commit-volume",
    group: "A",
    title: "Commit volume over time",
    status: "computed",
    value: { perMonth: { "2024-01": 3, "2024-02": 7 }, perWeek: { "2024-W01": 2, "2024-W02": 5 } },
  };
  const CONTRIBUTORS: Metric = { id: "b-contributor-count", group: "B", title: "Contributor count", status: "computed", value: { total: 7, active: 5, activeWindowDays: 90 } };
  const MSG_LENGTH: Metric = { id: "c-message-length-distribution", group: "C", title: "Message length distribution", status: "computed", value: { subjectLength: { min: 10, median: 40, mean: 42, p90: 70, max: 110 } } };

  it("renders a figure + caption + SVG + a mandatory data-table fallback (never a chart alone)", () => {
    const out = groupOverviewPanel("A", [VOLUME, NA]);
    expect(out).toContain("<figure class=\"chart-panel\"");
    expect(out).toContain("<figcaption>");
    expect(out).toContain("<svg");
    expect(out).toContain("data-table");
    expect(out).toContain("<table>");
  });

  it("uses each group's bound chart type (A → line, B → donut, C → bars)", () => {
    expect(groupOverviewPanel("A", [VOLUME])).toContain("chart-line");
    expect(groupOverviewPanel("B", [CONTRIBUTORS])).toContain("chart-donut");
    expect(groupOverviewPanel("C", [MSG_LENGTH])).toContain("chart-bars");
  });

  it("renders the group's two bound charts when their source metrics are present", () => {
    const out = groupOverviewPanel("A", [VOLUME]);
    expect(out).toContain("chart-cells two");
    expect(out).toContain("chart-line"); // monthly volume
    expect(out).toContain("chart-bars"); // weekly cadence
  });

  it("keeps a single chart when only one bound chart has data", () => {
    const monthlyOnly: Metric = { id: "a-commit-volume", group: "A", title: "Commit volume over time", status: "computed", value: { perMonth: { "2024-01": 3, "2024-02": 7 } } };
    const out = groupOverviewPanel("A", [monthlyOnly, NA]);
    expect(out).not.toContain("chart-cells two");
    expect(out).toContain("chart-line");
  });

  it("renders a caption + note (no SVG) when the group's bound metrics are absent", () => {
    const out = groupOverviewPanel("A", [SCALAR, NA]); // neither id matches the Group A plan
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

  it("a scalar-in-range metric with several fields → bars of all the values (no gauge, no fake trend line)", () => {
    const multi: Metric = { id: "b-contribution-distribution", group: "B", title: "Contribution distribution", status: "computed", value: { authorCount: 2, giniCommits: 0.45, topCommitSharePct: 94.7, top3CommitSharePct: 100 } };
    const out = metricVisual(multi);
    expect(out).toContain("chart-bars");
    expect(out).not.toContain("metric-number");
    expect(out).not.toContain("chart-gauge");
    expect(out).not.toContain("chart-sparkline");
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
