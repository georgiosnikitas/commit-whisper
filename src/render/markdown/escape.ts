/**
 * Markdown escaping helpers (Story 4.3 — FR-7, FR-13).
 *
 * Two deliberate postures (see the story's escaping decision):
 *   - `escapeCell` — for STRUCTURED / data interpolations (metric titles, values,
 *     series labels = repo FILE PATHS, reasons, text-bar/Mermaid labels): collapse
 *     whitespace, then escape the Markdown-structure-breaking + raw-HTML characters
 *     so a hostile file path or value can never break a table/diagram or inject raw
 *     HTML into the shareable artifact (OWASP A03, in the Markdown surface).
 *   - `inlineProse` — for narrative text embedded in a single bullet/heading line:
 *     collapse newlines so one bullet stays one diff-able line, WITHOUT
 *     emphasis-escaping (narrative is meant to be Markdown prose).
 *
 * Pure + deterministic: text in, text out.
 */

/** Collapse runs of whitespace (incl. newlines/tabs) to a single space, trimmed. */
function collapseWhitespace(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

/**
 * The structure-breaking + raw-HTML characters escaped in a structured cell, in
 * application order. Backslash is FIRST so the backslashes introduced by the later
 * escapes are not themselves re-escaped.
 */
const CELL_ESCAPES: ReadonlyArray<readonly [string, string]> = [
  ["\\", "\\\\"],
  ["`", "\\`"],
  ["*", String.raw`\*`],
  ["_", String.raw`\_`],
  ["|", String.raw`\|`],
  ["[", String.raw`\[`],
  ["]", String.raw`\]`],
  ["<", "&lt;"],
  [">", "&gt;"],
];

/**
 * Escape a STRUCTURED / data value for safe interpolation into a table cell,
 * text-bar, heading, or label: collapse whitespace, then neutralize the Markdown
 * structure + raw-HTML characters.
 */
export function escapeCell(text: string): string {
  let out = collapseWhitespace(text);
  for (const [from, to] of CELL_ESCAPES) {
    out = out.replaceAll(from, to);
  }
  return out;
}

/**
 * Normalize narrative prose for a single bullet/heading line: collapse newlines to
 * spaces (one diff-able line) WITHOUT emphasis-escaping. Block prose (paragraphs)
 * is rendered directly, not through this.
 */
export function inlineProse(text: string): string {
  return collapseWhitespace(text);
}
