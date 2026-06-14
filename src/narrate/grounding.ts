/**
 * Deterministic grounding verification pass (Story 3.4 — FR-9).
 *
 * A PURE, no-LLM, no-clock, no-I/O post-generation check: every numeric/factual
 * claim in the narrative prose must trace to a value present in the deterministic
 * `Analysis` (the catalog is the ground truth). A numeric token in the prose is
 * GROUNDED iff that number appears among the analysis's metric values; an
 * UNGROUNDED number (one that appears nowhere in the metrics) is an unsupported
 * claim — the sentence/bullet carrying it is REMOVED before the narrative is
 * assembled/rendered. The pass is reproducible and cannot itself hallucinate.
 *
 * It is CONSERVATIVE by construction — wrongly removing a valid claim is worse
 * than missing a borderline one — so the ground-truth set is generous (every
 * number anywhere in the metric envelopes + rounded forms + integers inside
 * date-bucket strings/keys) and prose numbers match on exact OR rounded forms.
 * Removal that would empty a `.min(1)` field is replaced with an HONEST
 * placeholder ("the available metrics do not support a specific claim here") —
 * the literal "says so rather than fabricating" — keeping the grounded narrative
 * valid against the strict Report read-back schema.
 *
 * The pass also yields a `GroundingReport` (total vs. ungrounded claim counts);
 * Story 3.5 consumes it for the confidence verification-pass-rate signal.
 */

import type { Analysis } from "../analyze/engine.js";
import type {
  Narrative,
  NarrativeParts,
  MetricExplanations,
  MetricExplanation,
  Chapter,
} from "./schema.js";

/** Honest "the metrics do not support a specific claim" text (AC3 — never fabricates). */
export const GROUNDING_PLACEHOLDER =
  "The available metrics do not support a specific claim here.";
/** A `.min(1)`-safe placeholder theme for a coaching chapter emptied by grounding. */
export const GROUNDING_PLACEHOLDER_THEME = "Grounded guidance";

/** Total numeric claims examined vs. those found ungrounded (Story 3.5 reads this). */
export interface GroundingReport {
  totalClaims: number;
  ungroundedClaims: number;
}

/** The grounded narrative plus the verification counts. */
export interface GroundingResult {
  narrative: Narrative;
  report: GroundingReport;
}

/** A mutable claim counter threaded through the (module-local) grounding walk. */
interface Counter {
  total: number;
  ungrounded: number;
}

/**
 * Number-like tokens for building the GROUND-TRUTH set: generous — every
 * integer/decimal run (incl. the components of a date bucket like "2024-01").
 * Over-collecting can only REDUCE false-positive removals.
 */
const SET_NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/g;

/**
 * Number-like tokens for extracting PROSE CLAIMS to verify: conservative — a
 * standalone figure ("62%", "999", "1,234"), but NOT a component of a date / time
 * / version / range (`2024-01-15`, `10:30`, `v2.3.5`, `3-5`), where a digit is
 * glued to another digit by `-` `:` `/` `.`. Removing a sentence for a date/time
 * component is a false positive (the worst outcome), so such components are not
 * flagged. A hyphen-compound like `999-contributor` is still a claim (the `-` is
 * not followed by a digit), so its number IS verified. The boundary lookarounds
 * also keep each token MAXIMAL (no backtracking into a partial number).
 */
const CLAIM_NUMBER_TOKEN = /(?<!\d)(?<!\d[.,:/-])\d[\d,]*(?:\.\d+)?(?!\d)(?![.,:/-]\d)/g;

/** Sentence boundary: terminal punctuation followed by whitespace. */
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/** Add `n`, its absolute value, and rounded forms to the grounded set. */
function addNumber(set: Set<number>, n: number): void {
  if (!Number.isFinite(n)) {
    return;
  }
  for (const v of [n, Math.abs(n)]) {
    set.add(v);
    set.add(Math.round(v));
    set.add(Math.floor(v));
    set.add(Math.ceil(v));
  }
}

/** Add every numeric token found in a string (date buckets, counts inside text). */
function addNumbersFromString(set: Set<number>, text: string): void {
  const matches = text.match(SET_NUMBER_TOKEN);
  if (matches === null) {
    return;
  }
  for (const token of matches) {
    addNumber(set, Number.parseFloat(token.replaceAll(",", "")));
  }
}

/** Recursively collect every grounded number from a JSON-ish metric value/envelope. */
function collectFrom(set: Set<number>, value: unknown): void {
  if (typeof value === "number") {
    addNumber(set, value);
  } else if (typeof value === "string") {
    addNumbersFromString(set, value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectFrom(set, item);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      addNumbersFromString(set, key); // date-bucket keys e.g. "2024-01", "2024-W24"
      collectFrom(set, child);
    }
  }
}

/**
 * The ground-truth number set: every number anywhere in the analysis metric
 * envelopes (values, keys, and integers inside strings), plus rounded forms.
 */
export function collectGroundedNumbers(analysis: Analysis): Set<number> {
  const set = new Set<number>();
  for (const metric of analysis.metrics) {
    collectFrom(set, metric);
  }
  return set;
}

/** Parse the standalone numeric claim tokens out of a prose string (commas stripped). */
export function extractNumericTokens(text: string): number[] {
  const matches = text.match(CLAIM_NUMBER_TOKEN);
  if (matches === null) {
    return [];
  }
  return matches.map((token) => Number.parseFloat(token.replaceAll(",", "")));
}

/** A prose number is grounded iff it (or a rounded form) is in the ground-truth set. */
export function isGrounded(n: number, set: Set<number>): boolean {
  return (
    set.has(n) ||
    set.has(Math.round(n)) ||
    set.has(Math.floor(n)) ||
    set.has(Math.ceil(n))
  );
}

/** True iff `text` carries at least one ungrounded numeric token (also counts claims). */
function tallyAndDetect(text: string, set: Set<number>, counter: Counter): boolean {
  let hasUngrounded = false;
  for (const n of extractNumericTokens(text)) {
    counter.total += 1;
    if (!isGrounded(n, set)) {
      counter.ungrounded += 1;
      hasUngrounded = true;
    }
  }
  return hasUngrounded;
}

/**
 * Sentence-level grounding for a multi-sentence string: drop every sentence that
 * carries an ungrounded number; keep the rest verbatim. Returns the rejoined text
 * (possibly empty — the caller decides whether a placeholder is required).
 */
function groundProse(text: string, set: Set<number>, counter: Counter): string {
  const sentences = text.split(SENTENCE_SPLIT);
  const kept = sentences.filter((sentence) => !tallyAndDetect(sentence, set, counter));
  return kept.join(" ").trim();
}

/** Entry-level grounding for a bullet list: drop a bullet carrying an ungrounded number. */
function groundBullets(items: readonly string[], set: Set<number>, counter: Counter): string[] {
  return items.filter((item) => !tallyAndDetect(item, set, counter));
}

/** Ground a `.min(1)` string: a placeholder replaces it if grounding empties it. */
function groundRequiredProse(text: string, set: Set<number>, counter: Counter): string {
  const grounded = groundProse(text, set, counter);
  return grounded === "" ? GROUNDING_PLACEHOLDER : grounded;
}

/** Ground one coaching chapter; `null` when its steps are all removed (drop the chapter). */
function groundChapter(chapter: Chapter, set: Set<number>, counter: Counter): Chapter | null {
  const steps = groundBullets(chapter.steps, set, counter);
  if (steps.length === 0) {
    return null;
  }
  const theme = groundProse(chapter.theme, set, counter);
  return { theme: theme === "" ? GROUNDING_PLACEHOLDER_THEME : theme, steps };
}

/** Ground every per-metric explanation facet, keyed by id, in stable key order. */
function groundExplanations(
  explanations: MetricExplanations,
  set: Set<number>,
  counter: Counter,
): MetricExplanations {
  const grounded: Record<string, MetricExplanation> = {};
  for (const [id, facets] of Object.entries(explanations)) {
    grounded[id] = {
      explanation: groundRequiredProse(facets.explanation, set, counter),
      goodBehaviours: groundBullets(facets.goodBehaviours, set, counter),
      needsImprovement: groundBullets(facets.needsImprovement, set, counter),
      suggestions: groundBullets(facets.suggestions, set, counter),
    };
  }
  return grounded;
}

/**
 * Run the deterministic grounding pass over a generated narrative. Removes every
 * sentence/bullet carrying an ungrounded numeric claim, inserts honest placeholders
 * where removal would empty a `.min(1)` field, and reports the claim counts. Pure.
 */
export function groundNarrative(narrative: Narrative, analysis: Analysis): GroundingResult {
  const set = collectGroundedNumbers(analysis);
  const counter: Counter = { total: 0, ungrounded: 0 };

  const summary = {
    headline: groundRequiredProse(narrative.summary.headline, set, counter),
    overview: groundRequiredProse(narrative.summary.overview, set, counter),
    keyFindings: groundBullets(narrative.summary.keyFindings, set, counter),
  };

  const paragraphs = narrative.explanation.paragraphs
    .map((paragraph) => groundProse(paragraph, set, counter))
    .filter((paragraph) => paragraph !== "");
  const explanation = {
    paragraphs: paragraphs.length > 0 ? paragraphs : [GROUNDING_PLACEHOLDER],
  };

  const chapters = narrative.coaching.chapters
    .map((chapter) => groundChapter(chapter, set, counter))
    .filter((chapter): chapter is Chapter => chapter !== null);
  const coaching = {
    introduction: groundRequiredProse(narrative.coaching.introduction, set, counter),
    chapters:
      chapters.length > 0
        ? chapters
        : [{ theme: GROUNDING_PLACEHOLDER_THEME, steps: [GROUNDING_PLACEHOLDER] }],
    closingSummary: groundRequiredProse(narrative.coaching.closingSummary, set, counter),
  };

  const parts: NarrativeParts = { summary, explanation, coaching };
  const grounded: Narrative =
    narrative.explanations === undefined
      ? parts
      : { ...parts, explanations: groundExplanations(narrative.explanations, set, counter) };

  return { narrative: grounded, report: { totalClaims: counter.total, ungroundedClaims: counter.ungrounded } };
}
