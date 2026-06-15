/**
 * Per-format render dispatch + canonical Report-JSON serializer (Story 4.4 — FR-12, FR-13).
 *
 * The single seam that turns the one in-memory `Report` into any selected output
 * format's string — `terminal` / `html` / `markdown` via the three pure renderers,
 * `json` via the canonical serializer. Every branch is a pure `Report → string`
 * transform (no clock/I/O/random), so a run can emit several formats from the SAME
 * report with no re-analysis and no second LLM call, and each format is byte-stable
 * for identical input. `render/` is `no-console` and writes nothing — the CLI shell
 * writes the returned strings to stdout / files.
 */

import type { OutputFormat } from "../config/run-config.js";
import type { Report } from "../assemble/report-schema.js";
import { renderTerminal } from "./terminal/terminal-renderer.js";
import { renderHtml } from "./html/html-renderer.js";
import { renderMarkdown } from "./markdown/markdown-renderer.js";

/** The default basename for a written report artifact (no extension). */
export const DEFAULT_OUTPUT_BASENAME = "commit-whisper-report";

/** The file extension per file-format (terminal is stdout-native, never a file). */
export const FILE_EXTENSION: Record<"html" | "markdown" | "json", string> = {
  html: "html",
  markdown: "md",
  json: "json",
};

/**
 * Serialize the canonical Report JSON: pretty-printed with a stable key order
 * (the assembled report's order + the byte-stable `analysis`), plus a trailing
 * newline. Deterministic and diff-stable; round-trips through `parseReport`.
 */
export function serializeReportJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Render the report in a single output format (pure dispatch over the closed enum). */
export function renderFormat(report: Report, format: OutputFormat): string {
  switch (format) {
    case "terminal":
      return renderTerminal(report);
    case "html":
      return renderHtml(report);
    case "markdown":
      return renderMarkdown(report);
    case "json":
      return serializeReportJson(report);
    default:
      return assertNeverFormat(format);
  }
}

/** Compile-time exhaustiveness guard: a new `OutputFormat` becomes a type error here. */
function assertNeverFormat(format: never): never {
  throw new Error(`Unhandled output format: ${JSON.stringify(format)}`);
}
