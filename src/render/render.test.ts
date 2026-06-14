import { describe, it, expect } from "vitest";

import { renderFormat, serializeReportJson, DEFAULT_OUTPUT_BASENAME, FILE_EXTENSION } from "./render.js";
import { parseReport } from "../assemble/report.js";
import type { Report, ReportAnalysis, ReportNarrative } from "../assemble/report-schema.js";

const ANALYSIS: ReportAnalysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { total: 42 } },
    { id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: { busFactor: 2 } },
  ],
};

const NARRATIVE: ReportNarrative = {
  summary: { headline: "A steady repo.", overview: "Forty-two commits.", keyFindings: ["Low volume"] },
  explanation: { paragraphs: ["Cadence is low but consistent."] },
  coaching: { introduction: "A short plan.", chapters: [{ theme: "Hygiene", steps: ["Adopt Conventional Commits"] }], closingSummary: "Start with hygiene." },
};

function report(over: Partial<Report>): Report {
  return { schemaVersion: "1.0.0", degraded: false, analysis: ANALYSIS, ...over };
}

describe("serializeReportJson", () => {
  it("round-trips through parseReport (the canonical read-back)", () => {
    const showpiece = report({ narrative: NARRATIVE });
    const json = serializeReportJson(showpiece);
    expect(parseReport(json)).toEqual(showpiece);
  });

  it("is deterministic — two serializations are byte-identical", () => {
    const r = report({ narrative: NARRATIVE });
    expect(serializeReportJson(r)).toBe(serializeReportJson(r));
  });

  it("is pretty-printed and ends with a trailing newline", () => {
    const json = serializeReportJson(report({}));
    expect(json.endsWith("\n")).toBe(true);
    expect(json).toContain('"schemaVersion": "1.0.0"'); // 2-space indent
  });

  it("a substrate report carries analysis but no narrative key", () => {
    const json = serializeReportJson(report({ degraded: true }));
    const parsed = parseReport(json);
    expect(parsed.analysis.metrics.length).toBe(2);
    expect(parsed.narrative).toBeUndefined();
  });
});

describe("renderFormat", () => {
  const showpiece = report({ narrative: NARRATIVE });

  it("routes terminal → the terminal report text", () => {
    expect(renderFormat(showpiece, "terminal")).toContain("commit-sage");
  });

  it("routes html → a self-contained HTML document", () => {
    expect(renderFormat(showpiece, "html").startsWith("<!doctype html>")).toBe(true);
  });

  it("routes markdown → the Markdown document", () => {
    const out = renderFormat(showpiece, "markdown");
    expect(out.startsWith("# commit-sage")).toBe(true);
    expect(out).toContain("## Summary");
  });

  it("routes json → the canonical Report JSON", () => {
    const out = renderFormat(showpiece, "json");
    expect(out).toBe(serializeReportJson(showpiece));
    expect(parseReport(out)).toEqual(showpiece);
  });

  it("renders a substrate report in every format without a narrative", () => {
    const substrate = report({ degraded: true });
    expect(renderFormat(substrate, "terminal")).toContain("commit-sage");
    expect(renderFormat(substrate, "html")).toContain("<!doctype html>");
    expect(renderFormat(substrate, "markdown")).toContain("# commit-sage");
    expect(renderFormat(substrate, "json")).toContain('"degraded": true');
  });
});

describe("default-path building blocks", () => {
  it("exposes the basename + per-format extensions", () => {
    expect(DEFAULT_OUTPUT_BASENAME).toBe("commit-sage-report");
    expect(FILE_EXTENSION.html).toBe("html");
    expect(FILE_EXTENSION.markdown).toBe("md");
    expect(FILE_EXTENSION.json).toBe("json");
  });
});
