---
title: "Product Brief: commit-sage"
status: final
created: 2026-06-06
updated: 2026-06-13
---

# Product Brief: commit-sage

> **Tagline:** *"I know what you did last commit."*
>
> *Reconciled 2026-06-13 with the finalized PRD, architecture, UX, and epics — this brief now reflects the product as planned and built.*

## Executive Summary

**commit-sage** is a terminal-native tool that turns impenetrable git history into a clear, narrated report. Existing tools already produce git statistics and graphs — but developers still can't *understand* them. commit-sage closes that comprehension gap: it retrieves a repository's commit history — from **GitHub, GitLab, or Bitbucket, or a local clone** — computes a thorough analysis, renders modern visualizations, and then uses AI to **explain the history in plain language** and **coach the reader toward better git practices** going forward. The AI narration is intrinsic: every run produces the explanation, never just raw numbers.

The need is one of scale. A single developer — and certainly a team, company, or engineering manager — can maintain many repositories on remote git servers, each carrying a history far too long for any human to read end to end. commit-sage reads what no human can, and hands back a story plus a path to improvement. Because it lives in the terminal, it runs wherever developers already work and slots directly into CI/CD for repeatable, automated analysis.

commit-sage is sold as a perpetual, one-time purchase across three tiers: a **free** on-ramp, a **single-device** tier ($10) for the individual developer, and an **unlimited-devices/automation** tier ($100) for multi-machine, team, and CI/CD use. It is positioned as **developer-owned insight** — the developer learns how to improve; the engineering manager sees team and repository *health* to help teams shore up weaknesses and confirm strengths — never a surveillance scoreboard.

## The Problem

Git history is where a project's true story lives — and almost nobody can read it.

- **The data exists; the understanding doesn't.** Tools like git-quick-stats, gitstats, and Hercules emit contributor counts, churn charts, and activity graphs. Developers look at them and shrug: the numbers don't translate into *"what happened here and what should I do differently."* Visualization without explanation is noise.
- **History outscales human attention.** A long-lived repository can hold tens of thousands of commits. Multiply that by the many repositories a developer, team, or manager is responsible for, and reading the history manually becomes impossible. The information is technically available and practically inaccessible.
- **Onboarding pays the tax.** Every new hire inherits this unreadable history and must reconstruct context by hand — slow, lossy, and repeated for every person and every repo.
- **Bad habits compound silently.** Vague commit messages, chaotic branching, and inconsistent workflow accumulate over years. No one gets feedback because no one is reading, and the cost surfaces later as confusion, risk, and rework.

The status quo forces a bad trade: stare at charts you don't understand, or ignore your history entirely. Both lose the lessons the history contains.

## The Solution

commit-sage is a command-line tool that produces a complete, readable report from a git repository in one run.

1. **Retrieve** — point it at a repository — a **local clone**, or a **remote on GitHub, GitLab, or Bitbucket** (private repos via a token read from the environment) — and it reads the commit history.
2. **Analyze** — it computes a thorough, deterministic analysis across the history (contributors, cadence, message quality, branching/merge patterns, hotspots, evolution over time): roughly thirty metrics organized into six groups.
3. **Visualize** — it renders modern, clean graphs of those patterns — an overview chart per group plus a right-sized visual on every individual metric.
4. **Explain (the differentiator)** — AI turns the analysis into a plain-language narrative: *what* the history shows, *why* it looks this way, and what it means.
5. **Coach** — it gives concrete, step-by-step guidance for working properly with git going forward: better commit messages, a sounder branching strategy, and general best practices, grounded in what this repository's own history reveals.

**The AI step is not optional.** Every run narrates — there is no metrics-only mode; analysing the history and explaining it are a single act. The Free tier still costs nothing because a local **Ollama** model is a zero-cost AI provider, so "AI required" needs no spend and keeps all data on-machine.

You run it two ways, both terminal-native. A bare `commit-sage` in an interactive terminal opens a guided **launchpad menu** — the product's single interactive entry point; passing **any argument** runs a strict, fully scriptable **single-shot** that never prompts and slots directly into CI/CD, repeatable as history grows. Secrets — the git token and the LLM key — are read **only from environment variables**, never prompted or stored. Each run emits **one canonical Report JSON** (the single source of truth) and renders it into **HTML, Markdown, terminal, or JSON**, several at once if you like; the rich HTML report carries the per-group and per-metric visuals.

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
- **Conversion:** free-tier users with long histories / many repos upgrade to a paid tier — targeting at least 5%.
- **Trust:** the AI narrative is accurate and useful — low rate of "that's wrong" feedback. A hallucinated history destroys trust, so accuracy is a first-class success metric.
- **Advocacy:** users recommend it (critical, since perpetual licensing makes revenue new-customer-driven).

## Scope

**In for v1:**

- CLI tool that reads commit history from a **local repository or a remote on GitHub, GitLab, or Bitbucket** (private remotes via an environment-variable token).
- Thorough, deterministic history analysis (~30 metrics in six groups) + modern graph rendering (a per-group overview chart plus a per-metric visual).
- AI narrative explanation of the history — **produced on every run** (there is no metrics-only mode).
- AI step-by-step git-practice guidance (commit messages, branching, best practices).
- **One canonical Report JSON** rendered to **HTML, Markdown, terminal, or JSON** (multi-select in a single run) — **no central web portal**.
- Execution model: terminal-native, with a **guided launchpad** for interactive use and a **strict single-shot** for scripts and CI/CD automation; secrets are environment-variable-only.
- Free tier plus two paid tiers (single-device and unlimited-devices/automation), enforced by **online license validation** (Lemon Squeezy) — see **Monetization** for tier details, pricing, and the licensing model.
- **Bring-your-own AI:** the user supplies their own API key / model endpoint. Supported providers: **Ollama** (local — keeps commit data on-machine for privacy-sensitive orgs), **OpenAI**, **Gemini**, **Anthropic**, and any **OpenAI-compatible** endpoint.

**Explicitly out (by design):**

- Per-developer ranking / surveillance dashboards — out permanently.
- A central web portal / hosted SaaS dashboard — out; the deliverable is the tool's own output.
- A metrics-only / skip-AI mode — out by design; narration is intrinsic to every run.
- Self-hosted or generic git servers beyond GitHub, GitLab, and Bitbucket — not planned for v1.

**Design questions resolved in planning:** the exact output formats, the full metric catalog, AI execution, the online-licensing model, and the interaction model are now locked in the PRD, architecture, and UX specs — this brief reflects those decisions rather than deferring them.

## Monetization

- **Model:** perpetual, one-time purchase (no subscription). Three tiers.
- **Free:** capped at the 100 most-recent commits — enough to prove value, gated where long histories begin (the exact pain commit-sage solves). The funnel. Includes a voluntary Buy Me a Coffee support link.
- **Single-device ($10):** one device, with unlimited runs, repositories, and remote servers. An impulse-priced yes for the individual developer.
- **Unlimited-devices/automation ($100):** any number of devices plus CI/CD automation — for teams and the manager-of-many-teams buyer with many repositories and long histories. Where the real value, and the real revenue, concentrates.
- **AI cost is the user's, not ours:** inference runs on the user's own API key (bring-your-own), so commit-sage carries no per-use cost and the perpetual price stays pure margin after the sale.
- **Licensing is online (Lemon Squeezy):** the two paid tiers are sold and enforced through **Lemon Squeezy** — *activate / validate / deactivate*. Single-device is bound to one device server-side via a Lemon Squeezy *activation instance* (movable by deactivating, no repurchase); Unlimited permits many activations, including headless/CI runners (which *validate* against an existing instance rather than re-activate). It remains a **perpetual one-time purchase**, but paid-tier validation is an **online check at startup**, so the blanket "works fully offline" promise no longer holds. The check transmits only the license key and a device id — **never repository data** — so the **privacy** guarantee (local Ollama ⇒ nothing leaves the machine) and the **no-central-portal** positioning both still stand (Lemon Squeezy is a third-party checkout/licensing service, not a commit-sage portal).
- **Pricing strategy — adoption-first:** as a first mover with zero marginal cost per sale and word-of-mouth-driven growth, the $10 single-device tier is priced to spread and own the category while still signalling a real tool (not a throwaway); the $100 tier is the value-capture SKU. The $10 point also pays its own way operationally: at roughly $9 net it comfortably funds the online activate/validate/deactivate licensing machinery that a $2.99 sale (~$2.30 net) could barely justify. Land low and raise later — raising prices is easy, cutting is painful.
- **Tradeoff (acknowledged):** perpetual revenue is new-customer-driven, so funnel and word-of-mouth matter more than with subscriptions. A possible future lever — paid major-version upgrades — is parked, not committed.
- **Cannibalization (accepted, bounded):** because Single-device grants unlimited repos and servers, a small team could buy several Single-device licenses instead of Unlimited — but the arbitrage breaks even around **ten devices** ($100 ÷ $10) and still forgoes multiple devices under one license and CI/CD automation, so the pressure is real but bounded. Prices are **final** at $10 / $100 — a **10×** gap — with no additional mid tier planned.

## Vision

commit-sage becomes the default way developers and teams *understand* their git history — the tool you point at any unfamiliar repository to instantly know its story and how to make it healthier. It starts as a terminal report for one developer and one repo, and grows into the comprehension-and-coaching layer over git for whole teams: automated health checks in every pipeline, faster onboarding into any codebase, and git practices that measurably improve over time — because, for the first time, someone (something) actually read the whole history and explained it.
