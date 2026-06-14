/**
 * Pure output-target planner (Story 4.4 — FR-13, AC3).
 *
 * Turns the resolved `(outputFormats, outputPath?)` selection into the concrete
 * list of `{ format, destination }` targets the pipeline writes:
 *   - `terminal` is always stdout-native (never a file);
 *   - a file format (`html`/`markdown`/`json`) goes to `-` ⇒ stdout, an explicit
 *     path ⇒ that file (only when EXACTLY ONE file format is selected — a single
 *     `--output` cannot address several files), or otherwise its default
 *     `./commit-sage-report.{ext}`.
 * Pure + deterministic (targets in the de-duped format order); the ambiguous
 * "one path, many files" misuse is a typed `UsageError` (exit 2), never a silent
 * guess. `render/` may import `shared/errors` (correct layering).
 */

import type { OutputFormat } from "../config/run-config.js";
import { UsageError } from "../shared/errors.js";
import { DEFAULT_OUTPUT_BASENAME, FILE_EXTENSION } from "./render.js";

/** Where a rendered format is written. */
export type OutputDestination = { kind: "stdout" } | { kind: "file"; path: string };

/** One planned output: a format paired with its resolved destination. */
export interface OutputTarget {
  format: OutputFormat;
  destination: OutputDestination;
}

/** The file formats (terminal is stdout-native and excluded). */
const FILE_FORMATS = new Set<OutputFormat>(["html", "markdown", "json"]);

/** De-dupe while preserving first-seen order. */
function dedupe(formats: readonly OutputFormat[]): OutputFormat[] {
  const seen = new Set<OutputFormat>();
  const out: OutputFormat[] = [];
  for (const format of formats) {
    if (!seen.has(format)) {
      seen.add(format);
      out.push(format);
    }
  }
  return out;
}

/** The default artifact path for a file format (`./commit-sage-report.{ext}`). */
function defaultPath(format: "html" | "markdown" | "json"): string {
  return `${DEFAULT_OUTPUT_BASENAME}.${FILE_EXTENSION[format]}`;
}

/**
 * Plan the concrete write targets for the selected formats + optional path.
 * Throws `UsageError` when an explicit (non-`-`) path is given alongside more than
 * one file format — a single path cannot address several files.
 */
export function planOutputs(formats: readonly OutputFormat[], outputPath?: string): OutputTarget[] {
  const ordered = dedupe(formats);
  const fileFormatCount = ordered.filter((format) => FILE_FORMATS.has(format)).length;
  const hasExplicitPath = outputPath !== undefined && outputPath !== "-";
  if (hasExplicitPath && fileFormatCount > 1) {
    throw new UsageError(
      `--output cannot be used with multiple file formats (${ordered.filter((f) => FILE_FORMATS.has(f)).join(", ")}). ` +
        "Omit it to use the default ./commit-sage-report.{html,md,json} paths, or select a single file format.",
    );
  }
  return ordered.map((format) => ({ format, destination: resolveDestination(format, outputPath) }));
}

/** Resolve one format's destination (terminal ⇒ stdout; file ⇒ `-`/path/default). */
function resolveDestination(format: OutputFormat, outputPath: string | undefined): OutputDestination {
  if (format === "terminal") {
    return { kind: "stdout" };
  }
  if (outputPath === "-") {
    return { kind: "stdout" };
  }
  if (outputPath !== undefined) {
    return { kind: "file", path: outputPath };
  }
  return { kind: "file", path: defaultPath(format) };
}
