/**
 * Pure inline-SVG chart primitives (Story 4.2).
 *
 * Each function is a deterministic `data → SVG string` transform: a fixed
 * `viewBox`, rounded coordinates, color via `currentColor` / CSS classes
 * (theme-aware, AA), and NO animation / clock / randomness — so the report is
 * byte-stable for identical input and snapshot-testable in Node with no browser.
 * Every chart is `role="img"` with an `aria-label` (the screen-reader text); the
 * mandatory `<table>` data fallback (see `charts.ts`) carries the full data.
 *
 * Inline SVG (not a canvas) is this story's deliberate choice (see the story
 * ADR): determinism, testability, self-containment, and a no-JS floor with zero
 * dependencies.
 */

/** A labelled numeric data point — the universal series shape the charts consume. */
export interface Point {
  label: string;
  value: number;
}

const VIEW_W = 100;
const VIEW_H = 40;

/** A finite number, or 0 — guards every coordinate against NaN/±Infinity. */
function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** Round to 2 decimals so coordinates are stable and compact. */
function r(n: number): number {
  return Math.round(safe(n) * 100) / 100;
}

/** Escape the SVG-significant characters in an attribute/text value. */
function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** The min/max of a series' values (finite-guarded); `[0, 0]` for an empty series. */
function extent(values: readonly number[]): [number, number] {
  if (values.length === 0) {
    return [0, 0];
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const raw of values) {
    const v = safe(raw);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Open an SVG root with a fixed viewBox + an accessible label. */
function open(label: string, extraClass: string): string {
  return `<svg class="chart-svg ${extraClass}" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">`;
}

/** A minimal empty chart (the data table still carries the data). */
function empty(label: string, extraClass: string): string {
  return `${open(label, extraClass)}</svg>`;
}

/** Map a value onto the inverted SVG y-axis (top=max), within `[pad, H-pad]`. */
function yScale(value: number, min: number, max: number, pad = 2): number {
  const span = max - min;
  if (span === 0) {
    return VIEW_H / 2; // flat — draw at mid
  }
  const t = (safe(value) - min) / span;
  return VIEW_H - pad - t * (VIEW_H - 2 * pad);
}

/** A polyline over the series (time-series / trend). */
export function svgLine(series: readonly Point[], label: string): string {
  if (series.length === 0) {
    return empty(label, "chart-line");
  }
  const values = series.map((p) => safe(p.value));
  const [min, max] = extent(values);
  const step = series.length === 1 ? 0 : VIEW_W / (series.length - 1);
  const points = series
    .map((p, i) => `${r(i * step)},${r(yScale(p.value, min, max))}`)
    .join(" ");
  return `${open(label, "chart-line")}<polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${points}"/></svg>`;
}

/** A tiny sparkline — a line with no axes, for scalar-in-range trends. */
export function svgSparkline(series: readonly Point[], label: string): string {
  return svgLine(series, label).replace("chart-line", "chart-sparkline");
}

/** Vertical bars (distribution / histogram / stacked categories). */
export function svgBars(series: readonly Point[], label: string): string {
  if (series.length === 0) {
    return empty(label, "chart-bars");
  }
  const values = series.map((p) => safe(p.value));
  const [, max] = extent(values);
  const top = max <= 0 ? 1 : max;
  const slot = VIEW_W / series.length;
  const barW = slot * 0.7;
  const bars = series
    .map((p, i) => {
      const h = (Math.max(0, safe(p.value)) / top) * (VIEW_H - 2);
      const x = i * slot + (slot - barW) / 2;
      const y = VIEW_H - h;
      return `<rect class="bar" x="${r(x)}" y="${r(y)}" width="${r(barW)}" height="${r(h)}"/>`;
    })
    .join("");
  return `${open(label, "chart-bars")}${bars}</svg>`;
}

/** Horizontal bars (hotspots / Pareto) — labels live in the data table. */
export function svgHBars(series: readonly Point[], label: string): string {
  if (series.length === 0) {
    return empty(label, "chart-hbars");
  }
  const values = series.map((p) => safe(p.value));
  const [, max] = extent(values);
  const top = max <= 0 ? 1 : max;
  const slot = VIEW_H / series.length;
  const barH = slot * 0.7;
  const bars = series
    .map((p, i) => {
      const w = (Math.max(0, safe(p.value)) / top) * VIEW_W;
      const y = i * slot + (slot - barH) / 2;
      return `<rect class="bar" x="0" y="${r(y)}" width="${r(w)}" height="${r(barH)}"/>`;
    })
    .join("");
  return `${open(label, "chart-hbars")}${bars}</svg>`;
}

/**
 * A mini bar gauge: a track + a fill proportional to `value/max` (clamped 0..1),
 * for a scalar-in-range metric (e.g. a 0–100 share/score).
 */
export function svgGauge(value: number, max: number, label: string): string {
  const denom = max <= 0 ? 1 : max;
  const t = Math.min(1, Math.max(0, safe(value) / denom));
  return `${open(label, "chart-gauge")}<rect class="gauge-track" x="0" y="${r(VIEW_H / 2 - 4)}" width="${VIEW_W}" height="8" rx="4"/><rect class="gauge-fill" x="0" y="${r(VIEW_H / 2 - 4)}" width="${r(t * VIEW_W)}" height="8" rx="4"/></svg>`;
}

/** A radar polygon over component points (Group F component scores, 0..max each). */
export function svgRadar(points: readonly Point[], max: number, label: string): string {
  if (points.length < 3) {
    // A radar needs ≥3 axes; fall back to bars (the table still has the data).
    return svgBars(points, label).replace("chart-bars", "chart-radar");
  }
  const denom = max <= 0 ? 1 : max;
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  const radius = VIEW_H / 2 - 2;
  const n = points.length;
  const coords = points
    .map((p, i) => {
      const t = Math.min(1, Math.max(0, safe(p.value) / denom));
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return `${r(cx + Math.cos(angle) * radius * t)},${r(cy + Math.sin(angle) * radius * t)}`;
    })
    .join(" ");
  return `${open(label, "chart-radar")}<polygon class="radar-area" points="${coords}"/></svg>`;
}
