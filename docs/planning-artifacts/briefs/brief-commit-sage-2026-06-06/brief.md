---
title: "Product Brief: commit-sage"
status: final
created: 2026-06-06
updated: 2026-06-06
---

# Product Brief: commit-sage

> **Tagline:** *"I know what you did last commit."*
>
> `[ASSUMPTION]` tags mark inferences to confirm. `[OPEN]` tags mark deliberate, unresolved decisions parked for the PRD.

## Executive Summary

**commit-sage** is a terminal-native tool that turns impenetrable git history into a clear, narrated report. Existing tools already produce git statistics and graphs — but developers still can't *understand* them. commit-sage closes that comprehension gap: it retrieves the commit history from any git remote, analyzes it, renders modern visualizations, and then uses AI to **explain the history in plain language** and **coach the reader toward better git practices** going forward.

The need is one of scale. A single developer — and certainly a team, company, or engineering manager — can maintain many repositories on remote git servers, each carrying a history far too long for any human to read end to end. commit-sage reads what no human can, and hands back a story plus a path to improvement. Because it lives in the terminal, it runs wherever developers already work and slots directly into CI/CD for repeatable, automated analysis.

commit-sage is sold as a perpetual, one-time purchase across three tiers: a **free** on-ramp, a **single-device** tier ($2.99) for the individual developer, and an **unlimited-devices/automation** tier ($100) for multi-machine, team, and CI/CD use. It is positioned as **developer-owned insight** — the developer learns how to improve; the engineering manager sees team and repository *health* to help teams shore up weaknesses and confirm strengths — never a surveillance scoreboard.

## The Problem

Git history is where a project's true story lives — and almost nobody can read it.

- **The data exists; the understanding doesn't.** Tools like git-quick-stats, gitstats, and Hercules emit contributor counts, churn charts, and activity graphs. Developers look at them and shrug: the numbers don't translate into *"what happened here and what should I do differently."* Visualization without explanation is noise.
- **History outscales human attention.** A long-lived repository can hold tens of thousands of commits. Multiply that by the many repositories a developer, team, or manager is responsible for, and reading the history manually becomes impossible. The information is technically available and practically inaccessible.
- **Onboarding pays the tax.** Every new hire inherits this unreadable history and must reconstruct context by hand — slow, lossy, and repeated for every person and every repo.
- **Bad habits compound silently.** Vague commit messages, chaotic branching, and inconsistent workflow accumulate over years. No one gets feedback because no one is reading, and the cost surfaces later as confusion, risk, and rework.

The status quo forces a bad trade: stare at charts you don't understand, or ignore your history entirely. Both lose the lessons the history contains.

## The Solution

commit-sage is a command-line tool that produces a complete, readable report from a git remote in one run.

1. **Retrieve** — point it at a git remote repository (any server) and it pulls the commit history.
2. **Analyze** — it computes a thorough analysis across the history (contributors, cadence, message quality, branching/merge patterns, hotspots, evolution over time). `[ASSUMPTION]` exact metric set to be defined in the PRD.
3. **Visualize** — it renders modern, clean graphs of those patterns.
4. **Explain (the differentiator)** — AI turns the analysis and graphs into a plain-language narrative: *what* the history shows, *why* it looks this way, and what it means.
5. **Coach** — it gives concrete, step-by-step guidance for working properly with git going forward: better commit messages, a sounder branching strategy, and general best practices, grounded in what this repository's own history reveals.

The same run works on demand or automated in CI/CD — repeatable as history grows.

## What Makes This Different

The market splits into three camps, and commit-sage sits in the whitespace between them:

- **OSS git-stats tools** (git-quick-stats, gitstats, Hercules, onefetch) give graphs and numbers — but **zero explanation**. They *are* the comprehension problem.
- **Commercial engineering-intelligence platforms** (LinearB, Swarmia, GitClear, Jellyfish, Pluralsight Flow) sell per-seat manager dashboards of team metrics — not a plain-language history narrative, and not git-practice coaching.
- **AI git tools** (aicommits, OpenCommit, Copilot) write your *next* commit message — none explain your *past* history.

commit-sage is the only one that fuses **retrospective explanation** (today: only crude stats) with **prescriptive coaching** (today: nonexistent), delivered in the terminal. The differentiator is comprehension and guidance, not more data.

**First mover in real whitespace.** No tool does this today — commit-sage is the first to explain git history in plain language and coach better practices from it. That is the advantage: define the category, set the standard for explanation quality, and win the user base before anyone else arrives. The honest caveat: the barrier is execution and focus, not secret technology, so a determined competitor (including GitHub/Copilot) could eventually follow. We stay ahead by being first, staying dedicated and terminal-native, and making the explanation and coaching genuinely excellent.

## Who This Serves

- **The solo developer (primary, free → single-device tier).** Wants to understand a repo's history fast and learn how to work with git better. Success: *"I finally understand what this history is telling me, and I know my next improvement."*
- **The development team (unlimited-devices/automation tier).** Shared comprehension and consistent git practices across people and repositories; faster onboarding into unfamiliar history. Success: new members get productive sooner; habits visibly improve.
- **The engineering / IT manager — part of the team, not above it (unlimited-devices/automation tier).** Cares about **git repository health** to help teams get better at their weaknesses and confirm their strengths. Success: a clear, improvement-oriented view of health and risk across many repositories — explicitly *not* a per-developer surveillance scoreboard.

> **Positioning guardrail:** developer-owned insight first. Manager value is framed as team-level *health, risk, and improvement*, never individual ranking. This is deliberate — it protects the product from the documented backlash against developer-productivity surveillance.

## Success Criteria

- **Comprehension:** after reading the report, a user can accurately recount their repository's story and name a concrete next improvement. This is the core promise — if it lands, the product works.
- **Repeat use:** users run it more than once per repo and/or wire it into CI/CD — proof it's a painkiller, not a one-time novelty.
- **Conversion:** free-tier users with long histories / many repos upgrade to a paid tier. `[OPEN]` target conversion rate TBD.
- **Trust:** the AI narrative is accurate and useful — low rate of "that's wrong" feedback. A hallucinated history destroys trust, so accuracy is a first-class success metric.
- **Advocacy:** users recommend it (critical, since perpetual licensing makes revenue new-customer-driven).

## Scope

**In for v1:**

- CLI tool that connects to a git remote and retrieves commit history.
- Thorough history analysis + modern graph rendering.
- AI narrative explanation of the history.
- AI step-by-step git-practice guidance (commit messages, branching, best practices).
- The tool's own report as output — **no central web portal**. `[OPEN]` exact output format defined in the PRD.
- CI/CD-friendly execution (terminal-native and automatable).
- Free tier plus two paid tiers (single-device and unlimited-devices/automation) — see **Monetization** for tier details and pricing.
- **Bring-your-own AI:** the user supplies their own API key / model endpoint. Supported providers: **Ollama** (local/offline — keeps commit data on-machine for privacy-sensitive orgs), **OpenAI**, **Gemini**, **Anthropic**, and any **OpenAI-compatible** endpoint.

**Explicitly out (by design):**

- Per-developer ranking / surveillance dashboards — out permanently.
- A central web portal / hosted SaaS dashboard — out; the deliverable is the tool's own output.

**Key open design questions to resolve in the PRD:**

- `[OPEN]` Exact output format(s) of the report.
- `[OPEN]` Exact analysis metric set and which graphs are rendered.

## Monetization

- **Model:** perpetual, one-time purchase (no subscription). Three tiers.
- **Free:** capped by the number of most-recent commit messages analyzed — enough to prove value, gated where long histories begin (the exact pain commit-sage solves). The funnel.
- **Single-device ($2.99):** one device, with unlimited runs, repositories, and remote servers. An impulse-priced yes for the individual developer.
- **Unlimited-devices/automation ($100):** any number of devices plus CI/CD automation — for teams and the manager-of-many-teams buyer with many repositories and long histories. Where the real value, and the real revenue, concentrates.
- **AI cost is the user's, not ours:** inference runs on the user's own API key (bring-your-own), so commit-sage carries no per-use cost and the perpetual price stays pure margin after the sale.
- **Pricing strategy — adoption-first:** as a first mover with zero marginal cost per sale and word-of-mouth-driven growth, the $2.99 single-device tier is priced to spread and own the category; the $100 tier is the value-capture SKU. Land low and raise later — raising prices is easy, cutting is painful.
- **Tradeoff (acknowledged):** perpetual revenue is new-customer-driven, so funnel and word-of-mouth matter more than with subscriptions. A possible future lever — paid major-version upgrades — is parked, not committed.
- `[OPEN]` Prices ($2.99 / $100) are a starting point, not yet validated — confirm against real willingness to pay. The gap between the two paid tiers is wide; a mid team tier may eventually be warranted.

## Vision

commit-sage becomes the default way developers and teams *understand* their git history — the tool you point at any unfamiliar repository to instantly know its story and how to make it healthier. It starts as a terminal report for one developer and one repo, and grows into the comprehension-and-coaching layer over git for whole teams: automated health checks in every pipeline, faster onboarding into any codebase, and git practices that measurably improve over time — because, for the first time, someone (something) actually read the whole history and explained it.
