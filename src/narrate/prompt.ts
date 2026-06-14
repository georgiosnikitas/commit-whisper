/**
 * Privacy-safe Narrative prompt builder (Story 1.6 Summary → Story 3.1 full).
 *
 * Serializes ONLY the deterministic metric envelopes (`id`, `group`, `title`,
 * `status`, `value`, `reason`). Because the narrate stage receives only
 * `Analysis` — never `RepoHistory` — commit messages, file paths, raw diffs, and
 * the API key are structurally absent from the prompt. Privacy is enforced by
 * the call signature, not by filtering.
 */

import type { Analysis } from "../analyze/engine.js";

const INSTRUCTION = [
  "You are a senior engineering analyst writing for a repository's maintainers and their",
  "manager. Using ONLY the deterministic git metrics provided below, produce a three-part",
  "narrative with EXACTLY these parts, in order:",
  "(1) Summary — a TL;DR of the repository's story and the headline findings, for skimming.",
  "(2) Explanation — a plain-language interpretation of what the metrics show and WHY,",
  "evidence first and interpretation second.",
  "(3) Coaching — a STRUCTURED improvement report (not a flat list): an introduction framing",
  "the repository's current state and what the plan addresses, one or more themed chapters",
  "(each grouping related improvements — e.g. commit-message hygiene, branching discipline,",
  "churn/hotspots — with prescriptive, prioritized steps, most impactful first), and a closing",
  "summary naming the top priorities and recommended order of action.",
  "",
  "Rules: Write plain language with no unexplained jargon. Ground EVERY claim in the provided",
  "metrics — do not invent numbers, dates, contributors, or events; reference the repository's",
  'own metric values (e.g. "62% of commit messages are under 10 characters"). Metrics marked',
  '"not_available" must be acknowledged as not measurable, never guessed. Keep any',
  "manager-facing content at TEAM level (overall health and risk) — never rank or single out",
  "individual developers.",
].join(" ");

export function buildNarrativePrompt(analysis: Analysis): string {
  const metricsJson = JSON.stringify(analysis.metrics, null, 2);
  return `${INSTRUCTION}\n\nMetrics:\n${metricsJson}`;
}

const EXPLANATIONS_INSTRUCTION = [
  "You are a senior engineering analyst. Using ONLY the deterministic git metrics provided",
  "below, write a per-metric explanation for EVERY metric in the list. Return an array of",
  "entries; for each entry set `metricId` to that metric's exact `id` (anchoring), and cover",
  "all FOUR facets:",
  "(1) explanation — what this metric's value(s) MEAN for this repository;",
  "(2) goodBehaviours — the good behaviours the metric reveals (an explicit entry where",
  "notable, or an empty list where there are none);",
  "(3) needsImprovement — what needs improvement (an explicit entry where applicable, or an",
  "empty list where the metric is already healthy);",
  "(4) suggestions — concrete, prioritized suggestions to improve, referencing the repo's own",
  "metric values.",
  "",
  "Rules: Produce one entry per metric — do not skip any, and do not invent a `metricId` that",
  "is not in the list. For a metric whose status is \"not_available\", the explanation facet",
  "must state that it could NOT be computed and why (use its `reason`), with the other facets",
  "empty or noting it is not applicable. Anchor each explanation in its OWN metric; you may",
  "cross-reference another metric ONLY where that metric is in the list and the connection is",
  "genuinely informative. Write plain language with no unexplained jargon, ground every claim",
  "in the provided metrics (invent no numbers, dates, contributors, or events), and keep any",
  "manager-facing content at TEAM level — never rank or single out individual developers.",
].join(" ");

export function buildExplanationsPrompt(analysis: Analysis): string {
  const metricsJson = JSON.stringify(analysis.metrics, null, 2);
  return `${EXPLANATIONS_INSTRUCTION}\n\nMetrics:\n${metricsJson}`;
}
