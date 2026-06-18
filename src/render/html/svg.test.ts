import { describe, it, expect } from "vitest";

import { svgLine, svgBars, svgHBars, svgSparkline, svgGauge, svgRadar, svgDonut, svgRadialGauge, type Point } from "./svg.js";

const SERIES: Point[] = [
  { label: "2024-01", value: 3 },
  { label: "2024-02", value: 7 },
  { label: "2024-03", value: 5 },
];

describe("svg primitives", () => {
  it("each primitive returns an accessible role=img SVG", () => {
    const fns = [
      svgLine(SERIES, "line"),
      svgBars(SERIES, "bars"),
      svgHBars(SERIES, "hbars"),
      svgSparkline(SERIES, "spark"),
      svgGauge(62, 100, "gauge"),
      svgRadar([...SERIES, { label: "d", value: 2 }], 10, "radar"),
      svgDonut(SERIES, "donut"),
      svgRadialGauge(41, 100, "rgauge"),
    ];
    for (const svg of fns) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain('role="img"');
      expect(svg).toContain("aria-label=");
      expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    }
  });

  it("is deterministic — two calls are byte-identical", () => {
    expect(svgLine(SERIES, "x")).toBe(svgLine(SERIES, "x"));
    expect(svgBars(SERIES, "x")).toBe(svgBars(SERIES, "x"));
  });

  it("renders an empty/degenerate series as a minimal valid SVG (no NaN coords)", () => {
    for (const svg of [svgLine([], "e"), svgBars([], "e"), svgHBars([], "e"), svgRadar([], 10, "e")]) {
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).not.toContain("NaN");
    }
  });

  it("guards a flat series and non-finite values (no NaN/Infinity in coords)", () => {
    const flat = svgLine([{ label: "a", value: 5 }, { label: "b", value: 5 }], "flat");
    expect(flat).not.toContain("NaN");
    const bad = svgBars([{ label: "a", value: Number.NaN }, { label: "b", value: 3 }], "bad");
    expect(bad).not.toContain("NaN");
    expect(bad).not.toContain("Infinity");
  });

  it("escapes the aria-label", () => {
    expect(svgLine(SERIES, '<script>"&')).toContain("&lt;script&gt;&quot;&amp;");
  });

  it("svgGauge clamps the fill to 0..max", () => {
    expect(svgGauge(200, 100, "g")).toContain('width="100"'); // over-max clamps to the track width
    expect(svgGauge(-5, 100, "g")).not.toMatch(/="-/); // negative clamps to 0 — no negative attribute value
    expect(svgGauge(-5, 100, "g")).toContain('class="gauge-fill" x="0" y="16" width="0"');
  });

  it("svgRadialGauge shows the value as % center text and clamps the arc", () => {
    expect(svgRadialGauge(41, 100, "r")).toContain(">41%<");
    expect(svgRadialGauge(200, 100, "r")).not.toContain("NaN");
    expect(svgRadialGauge(-5, 100, "r")).not.toContain("NaN");
    expect(svgRadialGauge(41, 100, "r")).toBe(svgRadialGauge(41, 100, "r")); // deterministic
  });

  it("svgDonut renders one segment per slice with a legend, and is safe for degenerate input", () => {
    const donut = svgDonut(SERIES, "d");
    expect((donut.match(/class="donut-seg/g) ?? [])).toHaveLength(SERIES.length);
    expect(donut).toContain("donut-label");
    expect(donut).not.toContain("NaN");
    expect(svgDonut([], "d")).toContain("</svg>"); // empty → minimal valid svg
    expect(svgDonut([{ label: "a", value: 0 }], "d")).not.toContain("NaN"); // zero total → no divide-by-zero
  });
});
