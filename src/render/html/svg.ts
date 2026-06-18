/**
 * Pure inline-SVG chart primitives (Story 4.2; axed + polished — 2026-06-18).
 *
 * Each function is a deterministic `data → SVG string` transform with REAL axes:
 * value gridlines + tick labels, category labels, and (radar) component labels —
 * the same information Chart.js surfaces, but as pure SVG. Uniform scaling
 * (`xMidYMid meet`) keeps the text crisp; coordinates are rounded so the report
 * is byte-stable and snapshot-testable in Node with no browser. Every chart is
 * `role="img"` with an `aria-label`; the mandatory `<table>` data fallback (see
 * `charts.ts`) still carries the full data.
 *
 * Inline SVG (not a canvas) is this story's deliberate choice (ADR): determinism,
 * testability, self-containment, and a no-JS floor with zero dependencies.
 */

/** A labelled numeric data point — the universal series shape the charts consume. */
export interface Point {
  label: string;
  value: number;
}

/** The gauge keeps a compact fixed box (it has no axes). */
const GAUGE_W = 100;
const GAUGE_H = 40;

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

/** A short, deterministic id derived from a label (FNV-1a → base36) for unique gradient ids. */
function hashId(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.codePointAt(i) ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** The max of a series' values (finite-guarded, floored at 0); `0` for empty. */
function maxValue(values: readonly number[]): number {
  let max = 0;
  for (const raw of values) {
    const v = safe(raw);
    if (v > max) max = v;
  }
  return max;
}

/** A compact, locale-independent number label. */
function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Prettify a raw series key into a short axis label (ISO month/week → name; path → basename). */
function tickLabel(raw: string): string {
  const month = /^(\d{4})-(\d{2})$/.exec(raw);
  if (month) {
    const mi = Number(month[2]);
    if (mi >= 1 && mi <= 12) return MONTHS[mi - 1];
  }
  const week = /^(\d{4})-W(\d{2})$/.exec(raw);
  if (week) return `W${week[2]}`;
  const slash = raw.lastIndexOf("/");
  const base = slash >= 0 ? raw.slice(slash + 1) : raw;
  return base.length > 16 ? `${base.slice(0, 15)}…` : base;
}

/** A "nice" axis step (1/2/5 × 10^k) for ~`n` divisions of `range`. */
function niceStep(range: number, n: number): number {
  if (range <= 0) return 1;
  const raw = range / n;
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  let nf: number;
  if (f < 1.5) nf = 1;
  else if (f < 3) nf = 2;
  else if (f < 7) nf = 5;
  else nf = 10;
  return nf * 10 ** exp;
}

/** Value-axis ticks from 0 to a nice ceiling ≥ max. */
function valueTicks(max: number): { ticks: number[]; top: number } {
  const m = max <= 0 ? 1 : max;
  const step = niceStep(m, 4);
  const top = Math.max(step, Math.ceil(m / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return { ticks, top };
}

/** Open an SVG root with a viewBox + an accessible label (uniform scaling by default). */
function open(label: string, extraClass: string, viewBox: string, par = "xMidYMid meet"): string {
  return `<svg class="chart-svg ${extraClass}" viewBox="${viewBox}" preserveAspectRatio="${par}" role="img" aria-label="${esc(label)}">`;
}

/** A minimal empty chart (the data table still carries the data). */
function empty(label: string, extraClass: string): string {
  return `${open(label, extraClass, "0 0 640 240")}</svg>`;
}

/** A vertical area-fade gradient (accent → transparent) keyed to a unique id. */
function areaGradient(id: string): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="grad-area-top"/><stop offset="1" class="grad-area-bottom"/></linearGradient></defs>`;
}

/** A linear accent→accent-2 gradient keyed to a unique id (direction configurable). */
function fillGradient(id: string, vertical: boolean): string {
  const dir = vertical ? `x1="0" y1="0" x2="0" y2="1"` : `x1="0" y1="0" x2="1" y2="0"`;
  return `<defs><linearGradient id="${id}" ${dir}><stop offset="0" class="grad-fill-1"/><stop offset="1" class="grad-fill-2"/></linearGradient></defs>`;
}

/** A smooth cubic-Bézier path `d` through the points (Catmull-Rom → Bézier, tension 1/6). */
function smoothPath(coords: ReadonlyArray<readonly [number, number]>): string {
  if (coords.length === 1) {
    const [x, y] = coords[0];
    return `M ${r(x)} ${r(y)}`;
  }
  let d = `M ${r(coords[0][0])} ${r(coords[0][1])}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : coords.length - 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${r(c1x)} ${r(c1y)}, ${r(c2x)} ${r(c2y)}, ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

/** A rect with the two TOP corners rounded (a vertical bar), as a path. */
function roundedTopRect(x: number, y: number, w: number, h: number, rad: number, gradId: string): string {
  if (h <= 0 || w <= 0) return "";
  const k = Math.min(rad, w / 2, h);
  const d = `M ${r(x)} ${r(y + h)} L ${r(x)} ${r(y + k)} Q ${r(x)} ${r(y)} ${r(x + k)} ${r(y)} L ${r(x + w - k)} ${r(y)} Q ${r(x + w)} ${r(y)} ${r(x + w)} ${r(y + k)} L ${r(x + w)} ${r(y + h)} Z`;
  return `<path class="bar" d="${d}" fill="url(#${gradId})"/>`;
}

/** A rect with the two RIGHT corners rounded (a horizontal bar), as a path. */
function roundedRightRect(x: number, y: number, w: number, h: number, rad: number, gradId: string): string {
  if (h <= 0 || w <= 0) return "";
  const k = Math.min(rad, h / 2, w);
  const d = `M ${r(x)} ${r(y)} L ${r(x + w - k)} ${r(y)} Q ${r(x + w)} ${r(y)} ${r(x + w)} ${r(y + k)} L ${r(x + w)} ${r(y + h - k)} Q ${r(x + w)} ${r(y + h)} ${r(x + w - k)} ${r(y + h)} L ${r(x)} ${r(y + h)} Z`;
  return `<path class="bar" d="${d}" fill="url(#${gradId})"/>`;
}

/** Horizontal value gridlines + left-hand tick labels (shared by line + vertical bars). */
function valueGrid(ticks: readonly number[], top: number, x0: number, x1: number, y0: number, y1: number): string {
  return ticks
    .map((t) => {
      const y = r(y1 - (t / top) * (y1 - y0));
      return `<line class="chart-grid" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/><text class="chart-tick" x="${x0 - 6}" y="${r(y + 3.5)}" text-anchor="end">${esc(fmtNum(t))}</text>`;
    })
    .join("");
}

/** A smooth, gradient line with an area fill + value gridlines + month/category x-axis labels. */
export function svgLine(series: readonly Point[], label: string): string {
  if (series.length === 0) return empty(label, "chart-line");
  const id = hashId(label);
  const areaId = `cw-area-${id}`;
  const strokeId = `cw-stroke-${id}`;
  const W = 640;
  const H = 240;
  const mL = 46;
  const mR = 16;
  const mT = 14;
  const mB = 30;
  const x0 = mL;
  const x1 = W - mR;
  const y0 = mT;
  const y1 = H - mB;
  const { ticks, top } = valueTicks(maxValue(series.map((p) => p.value)));
  const xAt = (i: number): number => (series.length === 1 ? (x0 + x1) / 2 : x0 + (i / (series.length - 1)) * (x1 - x0));
  const yAt = (v: number): number => y1 - (Math.max(0, safe(v)) / top) * (y1 - y0);
  const coords = series.map((p, i) => [r(xAt(i)), r(yAt(p.value))] as [number, number]);
  const line = smoothPath(coords);
  const last = coords.at(-1)!;
  const area = `${line} L ${r(last[0])} ${y1} L ${r(coords[0][0])} ${y1} Z`;
  const every = series.length > 12 ? Math.ceil(series.length / 12) : 1;
  const xLabels = series
    .map((p, i) => (i % every === 0 ? `<text class="chart-label" x="${r(xAt(i))}" y="${H - 10}" text-anchor="middle">${esc(tickLabel(p.label))}</text>` : ""))
    .join("");
  const dot = coords.length === 1 ? `<circle class="chart-dot" cx="${r(coords[0][0])}" cy="${r(coords[0][1])}" r="4"/>` : "";
  const viewBox = `0 0 ${W} ${H}`;
  return `${open(label, "chart-line", viewBox)}${areaGradient(areaId)}${fillGradient(strokeId, false)}${valueGrid(ticks, top, x0, x1, y0, y1)}<line class="chart-axis" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}"/><path class="chart-area" d="${area}" fill="url(#${areaId})"/><path class="chart-stroke" d="${line}" fill="none" stroke="url(#${strokeId})" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dot}${xLabels}</svg>`;
}

/** A tiny axis-free sparkline (scalar-in-range trends) — stretches to its small inline box. */
export function svgSparkline(series: readonly Point[], label: string): string {
  if (series.length === 0) return empty(label, "chart-sparkline");
  const id = hashId(label);
  const areaId = `cw-spark-area-${id}`;
  const strokeId = `cw-spark-${id}`;
  const W = 120;
  const H = 32;
  const pad = 3;
  const top = valueTicks(maxValue(series.map((p) => p.value))).top;
  const step = series.length === 1 ? 0 : W / (series.length - 1);
  const coords = series.map((p, i) => [r(i * step), r(H - pad - (Math.max(0, safe(p.value)) / top) * (H - 2 * pad))] as [number, number]);
  const line = smoothPath(coords);
  const last = coords.at(-1)!;
  const area = `${line} L ${r(last[0])} ${H} L ${r(coords[0][0])} ${H} Z`;
  const viewBox = `0 0 ${W} ${H}`;
  return `${open(label, "chart-sparkline", viewBox, "none")}${areaGradient(areaId)}${fillGradient(strokeId, false)}<path class="chart-area" d="${area}" fill="url(#${areaId})"/><path class="chart-stroke" d="${line}" fill="none" stroke="url(#${strokeId})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

/** Vertical rounded gradient bars + value gridlines + category x-axis labels. */
export function svgBars(series: readonly Point[], label: string): string {
  if (series.length === 0) return empty(label, "chart-bars");
  const id = `cw-bar-${hashId(label)}`;
  const W = 640;
  const H = 240;
  const mL = 46;
  const mR = 16;
  const mT = 14;
  const mB = 30;
  const x0 = mL;
  const x1 = W - mR;
  const y0 = mT;
  const y1 = H - mB;
  const { ticks, top } = valueTicks(maxValue(series.map((p) => p.value)));
  const slot = (x1 - x0) / series.length;
  const barW = Math.min(slot * 0.62, 64);
  const rad = Math.min(barW / 2, 6);
  const bars = series
    .map((p, i) => {
      const h = (Math.max(0, safe(p.value)) / top) * (y1 - y0);
      const x = x0 + i * slot + (slot - barW) / 2;
      return roundedTopRect(x, y1 - h, barW, h, rad, id);
    })
    .join("");
  const xLabels = series
    .map((p, i) => `<text class="chart-label" x="${r(x0 + i * slot + slot / 2)}" y="${H - 10}" text-anchor="middle">${esc(tickLabel(p.label))}</text>`)
    .join("");
  const viewBox = `0 0 ${W} ${H}`;
  return `${open(label, "chart-bars", viewBox)}${fillGradient(id, true)}${valueGrid(ticks, top, x0, x1, y0, y1)}<line class="chart-axis" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}"/>${bars}${xLabels}</svg>`;
}

/** Horizontal rounded gradient bars (hotspots / Pareto) + value x-axis + category y-axis labels. */
export function svgHBars(series: readonly Point[], label: string): string {
  if (series.length === 0) return empty(label, "chart-hbars");
  const id = `cw-hbar-${hashId(label)}`;
  const n = series.length;
  const rowH = 30;
  const mL = 150;
  const mR = 22;
  const mT = 14;
  const mB = 30;
  const W = 640;
  const H = mT + n * rowH + mB;
  const x0 = mL;
  const x1 = W - mR;
  const y0 = mT;
  const y1 = H - mB;
  const { ticks, top } = valueTicks(maxValue(series.map((p) => p.value)));
  const grid = ticks
    .map((t) => {
      const x = r(x0 + (t / top) * (x1 - x0));
      return `<line class="chart-grid" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/><text class="chart-tick" x="${x}" y="${H - 10}" text-anchor="middle">${esc(fmtNum(t))}</text>`;
    })
    .join("");
  const barH = rowH * 0.6;
  const bars = series
    .map((p, i) => {
      const w = (Math.max(0, safe(p.value)) / top) * (x1 - x0);
      const y = y0 + i * rowH + (rowH - barH) / 2;
      return roundedRightRect(x0, y, w, barH, Math.min(barH / 2, 5), id);
    })
    .join("");
  const yLabels = series
    .map((p, i) => `<text class="chart-label" x="${x0 - 8}" y="${r(y0 + i * rowH + rowH / 2 + 3.5)}" text-anchor="end">${esc(tickLabel(p.label))}</text>`)
    .join("");
  const viewBox = `0 0 ${W} ${H}`;
  return `${open(label, "chart-hbars", viewBox)}${fillGradient(id, false)}${grid}<line class="chart-axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}"/>${bars}${yLabels}</svg>`;
}

/**
 * A mini bar gauge: a track + a gradient fill proportional to `value/max`
 * (clamped 0..1), for a scalar-in-range metric (e.g. a 0–100 share/score).
 */
export function svgGauge(value: number, max: number, label: string): string {
  const id = `cw-gauge-${hashId(label)}`;
  const denom = max <= 0 ? 1 : max;
  const t = Math.min(1, Math.max(0, safe(value) / denom));
  const y = r(GAUGE_H / 2 - 4);
  const viewBox = `0 0 ${GAUGE_W} ${GAUGE_H}`;
  return `${open(label, "chart-gauge", viewBox, "none")}${fillGradient(id, false)}<rect class="gauge-track" x="0" y="${y}" width="${GAUGE_W}" height="8" rx="4"/><rect class="gauge-fill" x="0" y="${y}" width="${r(t * GAUGE_W)}" height="8" rx="4" fill="url(#${id})"/></svg>`;
}

/**
 * A radar over component points (Group F scores, 0..max each) with concentric
 * grid rings, radial axes, a gradient-filled data area, vertex dots, AND a text
 * label at each axis tip (the component names) — the same legend Chart.js shows.
 */
export function svgRadar(points: readonly Point[], max: number, label: string): string {
  if (points.length < 3) {
    // A radar needs ≥3 axes; fall back to bars (the table still has the data).
    return svgBars(points, label).replace("chart-bars", "chart-radar");
  }
  const id = `cw-radar-${hashId(label)}`;
  const denom = max <= 0 ? 1 : max;
  const W = 300;
  const H = 230;
  const cx = W / 2;
  const cy = 108;
  const radius = 72;
  const n = points.length;
  const angle = (i: number): number => (Math.PI * 2 * i) / n - Math.PI / 2;
  const ringFor = (factor: number): string => {
    const pts = points.map((_, i) => `${r(cx + Math.cos(angle(i)) * radius * factor)},${r(cy + Math.sin(angle(i)) * radius * factor)}`).join(" ");
    return `<polygon class="radar-grid" points="${pts}"/>`;
  };
  const rings = [0.25, 0.5, 0.75, 1].map(ringFor).join("");
  const axes = points
    .map((_, i) => `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${r(cx + Math.cos(angle(i)) * radius)}" y2="${r(cy + Math.sin(angle(i)) * radius)}"/>`)
    .join("");
  const dataCoords = points.map((p, i) => {
    const t = Math.min(1, Math.max(0, safe(p.value) / denom));
    return [r(cx + Math.cos(angle(i)) * radius * t), r(cy + Math.sin(angle(i)) * radius * t)] as const;
  });
  const dataPts = dataCoords.map(([x, y]) => `${x},${y}`).join(" ");
  const dots = dataCoords.map(([x, y]) => `<circle class="radar-dot" cx="${x}" cy="${y}" r="2.4"/>`).join("");
  const labels = points
    .map((p, i) => {
      const lx = cx + Math.cos(angle(i)) * (radius + 16);
      const ly = cy + Math.sin(angle(i)) * (radius + 16);
      let anchor: string;
      if (lx > cx + 1) anchor = "start";
      else if (lx < cx - 1) anchor = "end";
      else anchor = "middle";
      const name = p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label;
      return `<text class="radar-label" x="${r(lx)}" y="${r(ly + 3)}" text-anchor="${anchor}">${esc(name)}</text>`;
    })
    .join("");
  const viewBox = `0 0 ${W} ${H}`;
  return `${open(label, "chart-radar", viewBox)}${fillGradient(id, true)}${rings}${axes}<polygon class="radar-area" points="${dataPts}" fill="url(#${id})"/>${dots}${labels}</svg>`;
}

/**
 * A circular progress gauge (full-ring) with the value as center text — the
 * radial-gauge Chart.js shows for a 0–100 share/score. A track ring + a
 * gradient-stroked value arc (via `stroke-dasharray`) + a big centered number.
 */
export function svgRadialGauge(value: number, max: number, label: string): string {
  const id = `cw-rgauge-${hashId(label)}`;
  const denom = max <= 0 ? 1 : max;
  const t = Math.min(1, Math.max(0, safe(value) / denom));
  const cx = 100;
  const cy = 100;
  const rr = 74;
  const circ = 2 * Math.PI * rr;
  const dash = r(t * circ);
  const center = `${fmtNum(Math.round(safe(value) * 100) / 100)}${max === 100 ? "%" : ""}`;
  return `${open(label, "chart-radialgauge", "0 0 200 200")}${fillGradient(id, false)}<circle class="gauge-ring-track" cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke-width="20"/><circle class="gauge-ring-fill" cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="url(#${id})" stroke-width="20" stroke-linecap="round" stroke-dasharray="${dash} ${r(circ)}" transform="rotate(-90 ${cx} ${cy})"/><text class="gauge-value" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central">${esc(center)}</text></svg>`;
}

/**
 * A doughnut over a distribution series with a side legend (label · share%) — the
 * doughnut Chart.js shows for ownership/composition. Each segment is one ring
 * `<circle>` positioned by `stroke-dasharray`/`stroke-dashoffset` (deterministic).
 */
export function svgDonut(series: readonly Point[], label: string): string {
  if (series.length === 0) return empty(label, "chart-donut");
  const total = series.reduce((sum, p) => sum + Math.max(0, safe(p.value)), 0);
  if (total <= 0) return empty(label, "chart-donut");
  const cx = 100;
  const cy = 100;
  const rOuter = 82;
  const rInner = 50;
  let cum = 0;
  const segments = series
    .map((p, i) => {
      const frac = Math.max(0, safe(p.value)) / total;
      const a0 = ((-90 + cum * 360) * Math.PI) / 180;
      const a1 = ((-90 + (cum + frac) * 360) * Math.PI) / 180;
      cum += frac;
      if (frac <= 0) {
        return ""; // an empty slice draws nothing (kept in the legend only)
      }
      // A 100% slice is a degenerate arc (start === end) — draw a full annulus instead.
      if (frac >= 0.999) {
        const ring = `M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter} Z M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner} Z`;
        return `<path class="donut-seg slice-${i % 6}" d="${ring}"/>`;
      }
      const large = frac > 0.5 ? 1 : 0;
      const x0o = r(cx + rOuter * Math.cos(a0));
      const y0o = r(cy + rOuter * Math.sin(a0));
      const x1o = r(cx + rOuter * Math.cos(a1));
      const y1o = r(cy + rOuter * Math.sin(a1));
      const x1i = r(cx + rInner * Math.cos(a1));
      const y1i = r(cy + rInner * Math.sin(a1));
      const x0i = r(cx + rInner * Math.cos(a0));
      const y0i = r(cy + rInner * Math.sin(a0));
      const d = `M ${x0o} ${y0o} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i} Z`;
      return `<path class="donut-seg slice-${i % 6}" d="${d}"/>`;
    })
    .join("");
  const legend = series
    .map((p, i) => {
      const pct = Math.round((Math.max(0, safe(p.value)) / total) * 100);
      const y = 44 + i * 24;
      return `<rect class="slice-${i % 6}" x="200" y="${y}" width="13" height="13" rx="3"/><text class="donut-label" x="220" y="${y + 11}">${esc(tickLabel(p.label))} · ${pct}%</text>`;
    })
    .join("");
  return `${open(label, "chart-donut", "0 0 360 200")}${segments}${legend}</svg>`;
}
