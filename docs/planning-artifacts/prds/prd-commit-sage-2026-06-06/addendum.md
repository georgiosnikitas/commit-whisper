# Addendum — PRD: commit-sage

Technical depth and downstream context that belongs in architecture/UX, not in the PRD's capability-level narrative.

---

## Technology leanings (advisory — architecture decides)

- **Retrieval mechanism — lean to `git clone` over REST/GraphQL API paging.** Rationale: with the no-retry posture (FR-3), the tool hard-stops on any rate-limit/transient provider error, so minimizing provider request volume is a design goal. A single `git clone` makes effectively one connection for the whole history and rarely trips rate limits; API paging fires many requests and is the primary thing that *triggers* the hard stop. Clone also yields changed-file metadata and full diffs locally and cheaply (helps Group E churn/hotspot metrics) and keeps analysis offline-capable after retrieval (§7). **Override only if a desired feature is technically unachievable via clone** — e.g. a metric that genuinely requires provider-only data not present in the git object graph (PR/review metadata, issue links beyond what commit messages carry). Such cases should be raised in architecture, not assumed. Affects FR-1, FR-3, §7, and Group E affordability.
- **Language/runtime:** Node.js (George's choice). No capability blocker.
- **CI distribution caveat:** Node normally needs a runtime present, awkward on ephemeral CI runners. Mitigation → ship a **self-contained single executable**. Options:
  - Node 20+ **Single Executable Applications (SEA)** — official.
  - `pkg` (Vercel) or `nexe` — mature bundlers.
  - `npx commit-sage` — fine for developers who already have Node, not for runtime-less CI.
  - (Bun's `--compile` is an alternative runtime that produces single binaries, if the team ever revisits the runtime choice.)
- **Likely library areas (not decisions):** a git access layer (libgit2 binding / simple-git / direct git plumbing), a charting lib for HTML (d3 / Chart.js / vega-lite) rendered to self-contained HTML, a templating engine for HTML/Markdown, and provider SDKs (OpenAI/Anthropic/Gemini/Ollama or a unified OpenAI-compatible client).

## Output architecture (confirmed product decision, mechanics for architecture)

- **Report JSON is canonical.** Pipeline: retrieve → analyze (Metrics) → narrate (AI) → assemble Report JSON → render (templates) → HTML / Markdown / Terminal.
- Rendered outputs must never re-run analysis or re-call the AI; they are pure functions of Report JSON. This guarantees all formats agree and makes runs diffable for trend deltas.

## AI grounding & privacy mechanics (for architecture)

- Only Metrics and derived summaries go to the LLM — not tokens, not raw file contents/diffs (to confirm).
- Grounding candidate enforcement: (a) system-prompt contract forbidding invented facts; (b) optional post-generation verification that numeric claims match Report JSON Metrics. Decision deferred (Open Question 5).
- Local path (Ollama) must keep all repo data on-machine — first-class privacy option, not a fallback.

## Metrics catalog — feasibility notes

Several metrics are `[ASSUMPTION]`-tagged pending a computability/cost pass (rebase tendency, long-lived branches, file survival/age, ownership-by-area, co-authorship trailers, issue-reference rate). The composite **overall hygiene score** (Group F) needs a transparent, defensible formula shown alongside its components. These are architecture-phase items; they do not change the PRD's capability shape.
