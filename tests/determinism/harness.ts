/**
 * Determinism harness (Story 1.5 — AC2).
 *
 * The byte-identical proof for the metrics engine: serialize an `Analysis` with
 * `JSON.stringify` and compare strings. `assertDeterministic` runs a thunk twice
 * and asserts identical serialization; `assertOrderIndependent` proves the
 * `[committerDate, sha]` total order by shuffling the input commits and asserting
 * the serialized `Analysis` is unchanged.
 */

import { expect } from "vitest";

import type { RepoHistory } from "../../src/retrieve/retrieve.port.js";
import type { AnalysisContext } from "../../src/analyze/model.js";
import type { Analysis } from "../../src/analyze/engine.js";
import { analyze } from "../../src/analyze/engine.js";

/** Stable serialization of an `Analysis` — the byte-identical comparison key. */
export function serializeAnalysis(analysis: Analysis): string {
  return JSON.stringify(analysis);
}

/** Run twice; assert the two serialized analyses are byte-identical. */
export function assertDeterministic(run: () => Analysis): void {
  const first = serializeAnalysis(run());
  const second = serializeAnalysis(run());
  expect(second).toBe(first);
}

/** A deterministic shuffle (seeded) — reorders without depending on Math.random. */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Assert the analysis is identical regardless of input commit order (total-order proof). */
export function assertOrderIndependent(history: RepoHistory, ctx: AnalysisContext): void {
  const baseline = serializeAnalysis(analyze(history, ctx));
  for (const seed of [1, 7, 42, 1000]) {
    const shuffled: RepoHistory = { ...history, commits: seededShuffle(history.commits, seed) };
    expect(serializeAnalysis(analyze(shuffled, ctx))).toBe(baseline);
  }
}
