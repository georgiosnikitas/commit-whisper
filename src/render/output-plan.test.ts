import { describe, it, expect } from "vitest";

import { planOutputs, type OutputTarget } from "./output-plan.js";
import { UsageError } from "../shared/errors.js";
import type { OutputFormat } from "../config/run-config.js";

/** Shorthand: the destination of the target for a given format (or undefined). */
function dest(targets: OutputTarget[], format: OutputFormat): OutputTarget["destination"] | undefined {
  return targets.find((t) => t.format === format)?.destination;
}

describe("planOutputs", () => {
  it("terminal → stdout (never a file)", () => {
    expect(planOutputs(["terminal"])).toEqual([{ format: "terminal", destination: { kind: "stdout" } }]);
  });

  it("a single file format with no path → its default ./commit-sage-report.{ext}", () => {
    expect(dest(planOutputs(["html"]), "html")).toEqual({ kind: "file", path: "commit-sage-report.html" });
    expect(dest(planOutputs(["markdown"]), "markdown")).toEqual({ kind: "file", path: "commit-sage-report.md" });
    expect(dest(planOutputs(["json"]), "json")).toEqual({ kind: "file", path: "commit-sage-report.json" });
  });

  it("'-' means stdout for a file format", () => {
    expect(dest(planOutputs(["json"], "-"), "json")).toEqual({ kind: "stdout" });
  });

  it("one file format + an explicit path → that path", () => {
    expect(dest(planOutputs(["html"], "report.html"), "html")).toEqual({ kind: "file", path: "report.html" });
  });

  it("two file formats + one explicit path → a UsageError (ambiguous)", () => {
    expect(() => planOutputs(["html", "markdown"], "report")).toThrow(UsageError);
  });

  it("two file formats + '-' (stdout) is allowed (not a single-path ambiguity)", () => {
    const targets = planOutputs(["html", "json"], "-");
    expect(dest(targets, "html")).toEqual({ kind: "stdout" });
    expect(dest(targets, "json")).toEqual({ kind: "stdout" });
  });

  it("--format html,markdown,json (no path) → three default-named file targets", () => {
    const targets = planOutputs(["html", "markdown", "json"]);
    expect(targets.map((t) => t.destination)).toEqual([
      { kind: "file", path: "commit-sage-report.html" },
      { kind: "file", path: "commit-sage-report.md" },
      { kind: "file", path: "commit-sage-report.json" },
    ]);
  });

  it("terminal + a single file format: terminal=stdout, the file at its default", () => {
    const targets = planOutputs(["terminal", "json"], "report.json");
    expect(dest(targets, "terminal")).toEqual({ kind: "stdout" });
    expect(dest(targets, "json")).toEqual({ kind: "file", path: "report.json" });
  });

  it("terminal + an explicit path is NOT ambiguous (terminal is not a file format)", () => {
    const targets = planOutputs(["terminal", "html"], "out.html");
    expect(dest(targets, "html")).toEqual({ kind: "file", path: "out.html" });
  });

  it("de-dupes formats preserving first-seen order", () => {
    const targets = planOutputs(["json", "terminal", "json"]);
    expect(targets.map((t) => t.format)).toEqual(["json", "terminal"]);
  });
});
