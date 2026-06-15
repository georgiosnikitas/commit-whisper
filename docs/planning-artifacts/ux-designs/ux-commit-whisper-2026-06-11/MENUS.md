---
title: commit-whisper MENUS
status: draft
created: 2026-06-12
updated: 2026-06-15
---

commit-whisper MENUS
=================

This is the **composition** layer for the interactive (zero-argument, TTY) surface.
EXPERIENCE.md defines the interaction *rules* and DESIGN.md the visual *language*; this
document specifies the actual *screens* — their layout, states, ordering, and copy — so
Epic 6 (Interactive Experience) implements to a spec rather than improvising.

All sketches are illustrative wireframes (line-oriented, `@clack/prompts`-style), not
literal output. They encode structure and intent, not exact glyphs.

Sources
-------

- PRD FR-14 (interactive execution), FR-11 (AI required, providers), FR-16 (licensing), FR-2/FR-11 (env-only secrets).
- EXPERIENCE.md — Interaction Primitives, Component Patterns, State Patterns, Accessibility Floor.
- DESIGN.md — Menu / launchpad component, calm line-oriented posture, color/type tokens.

Principles (carried from EXPERIENCE/DESIGN)
-------------------------------------------

- **One interactive door.** These screens appear only for the bare zero-argument command in an interactive TTY. Any argument bypasses all of this (strict single-shot).
- **Calm, line-oriented, never a dashboard.** A quiet index of what the tool can do.
- **Every dead-end has a door.** Every problem state names the next action (a jump to the screen that fixes it).
- **Secrets stay in the environment.** No screen ever collects the git token or an LLM API key. Screens may *name* the required env var; they never accept its value. The **license key** is not a secret and *is* entered in-app (Activate).
- **Self-teaching.** Guided runs render the equivalent command live and echo it on completion.
- **Stream discipline.** All of this chrome is stderr; stdout stays clean for machine data.
- **Accessibility floor.** Fully keyboard-navigable; selection/state never by color alone (glyphs + text labels); a text-stated exit (Esc/quit, Ctrl-C) on every screen.

The Header Spine (readiness line)
---------------------------------

Every interactive screen opens with the same two-line header: the product line, then a
dim **readiness line** that mirrors the user's state so they always know *who they are,
whether they can run, and what "this repo" means* — without opening Status/doctor.

```
  commit-whisper · I know what you did last commit
  │
  ◇  <tier> · AI: <provider (model) | ⚠ not configured> · cwd: <path> (<branch>)
  │
```

- **Tier:** `Free` · `Single-device` · `Unlimited`.
- **AI:** `ollama (llama3)` when configured; `⚠ not configured` (with the warning glyph) when not.
- **cwd:** the inferred repository path + branch, or `— (not a git repo)` when cwd isn't one.
- The tagline appears in full on the bare interactive launchpad; it is **dropped** in argument-mode runs (where only the phase log / summary show).

> **The header opens every interactive screen.** In the sketches below, the launchpad and
> Analyze screens render it in full; the remaining sub-screen sketches **elide it for focus**,
> but it is always rendered first — persistent chrome, not a per-screen element.

Launchpad
---------

The top-level menu. Three groups, divider-separated, ordered by intent frequency:
**ACT** (the reason they're here) → **ORIENT** (configure / diagnose / learn) →
**LICENSE** (state-dependent). Each row carries an inline consequence hint so the user can
predict the outcome before pressing Enter.

### State: unlicensed, AI configured

```
  commit-whisper · I know what you did last commit
  │
  ◇  Free · AI: ollama (llama3) · cwd: ~/work/payments-api (main)
  │
  ◆  What would you like to do?
  │
  │   ●  Analyze this repository        payments-api · main · 1,204 commits
  │   ○  Analyze a remote repository…
  │
  │   ○  Settings                       provider, model, default format
  │   ○  Status / doctor
  │   ○  Help / show all flags
  │
  │   ○  Activate license               enter your license key
  │   ○  Buy a license                  opens the store in your browser
  │   ○  Restore a purchase             opens your Lemon Squeezy orders
  │   ○  Buy Me a Coffee
  │
  └  ↑↓ move · ↵ select · esc quit
```

### State: unlicensed, AI NOT configured (first run)

Identical layout; the header carries the `⚠ AI not configured` flag. The Analyze rows are
**not disabled** — discovery is preserved; choosing one routes to the no-AI interstitial.

```
  ◇  Free · ⚠ AI not configured · cwd: ~/work/payments-api (main)
  │
  ◆  What would you like to do?
  │
  │   ●  Analyze this repository        payments-api · main · 1,204 commits
  │   ○  Analyze a remote repository…
  │
  │   ○  Settings                       set up your AI provider →
  │   ○  Status / doctor                check setup & fix what's missing
  │   ○  Help / show all flags
  │
  │   ○  Activate license               enter your license key
  │   ○  Buy a license                  opens the store in your browser
  │   ○  Restore a purchase             opens your Lemon Squeezy orders
  │   ○  Buy Me a Coffee
  │
  └  ↑↓ move · ↵ select · esc quit
```

### State: licensed

Coffee, Activate, Buy, and Restore retire; **Deactivate** appears. The menu gets quieter as
the user gets more committed.

```
  ◇  Single-device · AI: openai (gpt-4o) · cwd: ~/work/payments-api (main)
  │
  ◆  What would you like to do?
  │
  │   ●  Analyze this repository        payments-api · main · 1,204 commits
  │   ○  Analyze a remote repository…
  │
  │   ○  Settings                       provider, model, default format
  │   ○  Status / doctor
  │   ○  Help / show all flags
  │
  │   ○  Deactivate license             free this device to move machines
  │
  └  ↑↓ move · ↵ select · esc quit
```

### State: cwd is not a git repository

The cwd Analyze row is shown but routes to a short notice (with a door to "Analyze a remote
repository" instead); the header shows `cwd: — (not a git repo)`.

Menu item reference
-------------------

| Item | Group | Shown when | Action |
| --- | --- | --- | --- |
| Analyze this repository | ACT | always | Guided run against cwd (default target) |
| Analyze a remote repository… | ACT | always | Prompt for URL, then guided run (`…` = more input coming) |
| Settings | ORIENT | always | Configure non-secret AI + defaults; writes `~/.commit-whisper` |
| Status / doctor | ORIENT | always | Read-only readiness diagnostic |
| Help / show all flags | ORIENT | always | Full flag reference (same content as `--help`) |
| Activate license | LICENSE | unlicensed | Enter a license key to bind this device |
| Buy a license | LICENSE | unlicensed | Open the store in the browser (checkout) |
| Restore a purchase | LICENSE | unlicensed | Open the customer's Lemon Squeezy orders to recover a key |
| Buy Me a Coffee | LICENSE | unlicensed only | Open the voluntary support link |
| Deactivate license | LICENSE | licensed | Free this device's activation so the license can move |
| Quit | — | always | Esc/quit; clean exit + short flags cheatsheet |

No-AI interstitial
------------------

Reached when an Analyze row is chosen while no provider is configured. A calm teacher, not
a wall — it names the exact, env-only path and leads with the zero-cost local option.

```
  ◆  Analysis needs an AI provider
  │
  │  commit-whisper explains your history with an LLM — every run narrates,
  │  so you'll need one provider configured and reachable. Two easy paths:
  │
  │  • Local & free — open Settings and pick Ollama, then make sure it's
  │    running (`ollama serve`, then `ollama pull <model>`). Nothing leaves
  │    your machine.
  │  • Cloud — pick a provider in Settings, then set its key in your
  │    environment, e.g. OPENAI_API_KEY (I never store keys).
  │
  └  ↵ open Settings · esc back to menu
```

Settings
--------

The single place to configure **non-secret** AI plumbing and everyday defaults. Choices are
written to `~/.commit-whisper` (set-once, remembered). The resolver precedence still holds:
an explicit env var or flag overrides a saved Setting. **No secret is ever entered here** —
a cloud provider's key stays an environment variable.

```
  ◆  Settings
  │
  ◇  AI provider
  │   ○ Ollama (local, free)   ○ OpenAI   ○ Gemini   ○ Anthropic   ○ OpenAI-compatible
  │
  ◇  Model            llama3
  ◇  Base URL         http://localhost:11434      (required for Ollama / OpenAI-compatible)
  │
  ◇  Default format   ◉ terminal  ○ html  ○ markdown  ○ json
  ◇  Timezone         UTC
  ◇  Max commits      (none)
  │
  │   ✓ Saved to ~/.commit-whisper/config
  │   ⓘ Ollama runs locally — no key needed, but it must be running:
  │      `ollama serve`, then `ollama pull <model>`. Saving selects it; it
  │      doesn't start it. For cloud providers, set the key in your
  │      environment (e.g. OPENAI_API_KEY); I never store keys.
  │
  └  ↵ save · esc cancel
```

- **Base URL** field is surfaced only when the chosen provider is Ollama or OpenAI-compatible.
- Saving writes only the **non-secret** fields. The config file never contains a key or token.
- Selecting **Ollama** configures it but does not install or start it — a preflight check
  before analysis verifies it is actually reachable and, if not, says how to start it
  (`ollama serve`).

Analyze — guided run
--------------------

"Fill only what's missing; default the inferable; then go silent." Every field arrives
pre-filled (from cwd + Settings); the user mostly confirms. The `▸ Next time:` line is the
self-teaching bridge, updating live as fields change.

```
  ◇  Free · AI: ollama (llama3) · cwd: ~/work/payments-api (main)
  │
  ◆  Analyze payments-api
  │
  ◇  Branch     main        (↵ keep · type to change · "all" for every branch)
  ◇  Limit      all         (↵ all history · or max commits, e.g. 500)
  ◇  Date range all         (↵ all · or absolute since/until, e.g. 2024-01-01..2024-06-30)
  ◇  Output     ◉ terminal  ○ html  ○ markdown  ○ json   (space to toggle)
  │
  │   ▸ Next time:  commit-whisper --branch main --format terminal
  │
  └  ↵ run · esc cancel
```

- **Output** is multi-select (formats are multi-select; one run can emit several).
- **Limit** caps the number of most-recent commits (`--max-commits`); empty = all history.
  **Date range** is optional absolute since/until bounds (`--since` / `--until`); empty = all
  history. They are independent inputs — a limit is a count, a range is a pair of dates.
- **Self-teaching echo:** the `▸ Next time:` line emits only flags that actually exist — e.g.
  `--max-commits 500`, `--since 2024-01-01 --until 2024-06-30` — never a relative shorthand
  like `--range 6mo`. Relative-date input is a non-locked recommendation parked in
  EXPERIENCE.md, not a current flag.
- **Analyze a remote repository** is the same flow preceded by a URL prompt. If the clone
  reaches a private remote with no token in the environment, it stops and **names the env
  var to set** (never a paste field) — the secret rule holds.

### Phase log (the live run)

Progress by phase, one line each — never a silent spinner.

```
  ◆  Analyzing payments-api · main
  │
  ◇  ✓ Retrieved   1,204 commits · 87 contributors
  ◇  ✓ Analyzed    30 metrics across 6 groups
  ◇  ⟳ Narrating   grounding against your metrics…
  ◇  · Render      queued
  │
```

Progress glyphs are distinct from the report's health bands: `✓` done · `⟳` active (a live
spinner) · `·` queued — the `●◐▲○` shapes mean *health*, never progress.

### Run summary

```
  ◆  Done · confidence: high
  │
  │   Report ready:
  │     ./commit-whisper-report.html      (opening in browser…)
  │     ./commit-whisper-report.json
  │
  │   ▸ Reproduce:  commit-whisper --format html,json
  │
  └  ↵ menu · esc quit
```

- HTML auto-opens only at an interactive terminal; on auto-open failure the path stays
  printed and copyable. `--no-open` (argument mode) suppresses it; CI never opens.
- Free-tier truncation surfaces here and in the report: `Analyzed 100 of 1,204 commits — Free tier cap`.

### Run summary — degraded (narrative unavailable)

When narration **fails open**, the summary keeps the same shape but leads with the wound: a
banner replaces the calm `confidence:` line, and the fix sits right under it. The report still
resolves (the deterministic `analysis` substrate rendered), and the run exits on a distinct
degraded exit code (see architecture exit-code enum) so a script can tell this from a clean run.

```
  ◆  ⚠ Narrative unavailable — showing raw analysis
  │     The provider failed during narration; your metrics are intact.
  │     → retry · check the provider (Status / doctor) · switch it in Settings
  │
  │   Report ready (raw analysis only):
  │     ./commit-whisper-report.html      (opening in browser…)
  │     ./commit-whisper-report.json
  │
  │   ▸ Reproduce:  commit-whisper --format html,json
  │
  └  ↵ menu · esc quit
```

This degraded summary is the **interactive** face of fail-open. The intentional `--no-ai`
metrics-only substrate is a non-interactive (CI/headless) path — a clean success with no banner —
so it has no menu screen of its own; don't conflate the two.

Status / doctor
---------------

The read-only mirror — the header line expanded into a full checklist. Diagnoses with a
next action; never a dead-end. Environment variables show **`✓ set` / `✗ missing` by name
only — never their values**.

```
  ◆  Status / doctor
  │
  ◇  License     Free            100-commit cap · Buy a license to unlock
  ◇  AI          ⚠ not configured
  │              provider   — not set
  │              model      — not set
  │
  ◇  Environment
  │     ✓  OPENAI_API_KEY     set
  │     ✗  GITHUB_TOKEN       missing   (only needed for private remotes)
  │
  ◇  Repository  ✓ payments-api · main · 1,204 commits
  │
  │   ⚠ AI isn't configured — analysis can't run yet.
  │     → Open Settings to choose a provider
  │
  └  ↵ Settings · esc menu
```

- The **AI** block distinguishes *configured* from *reachable*. With a provider set, a
  preflight probe (Ollama endpoint ping; a low-cost auth check for cloud) adds a reachability
  line — `✓ reachable` or `⚠ unreachable` — because Ollama can be configured but not running:

```
  ◇  AI          ollama (llama3)
  │              provider   ollama
  │              model      llama3
  │              status     ⚠ unreachable — start it with `ollama serve`
```

  When unreachable, the door names the fix: `→ start Ollama (ollama serve)` or `→ pick
  another provider in Settings`.

Licensing screens
-----------------

Four items; they split by **where the work happens**. **Buy** sends the user to the store
(checkout) and **Restore** to their Lemon Squeezy orders (recover a key) — both browser
hand-offs; **Activate** brings them back to paste the key; **Deactivate** frees the device.
The natural returning-user loop is **Buy → get key from the store → Activate** (or **Restore
→ find key in your orders → Activate**).

### Activate license (the only in-terminal key entry)

The license key is **not a secret** — it is entered in-app and may be cached.

```
  ◆  Activate license
  │
  ◇  License key    ____________________________
  │
  │   ⓘ Find your key in the store (Buy a license) or your Lemon Squeezy orders (Restore a purchase).
  │
  └  ↵ activate · esc menu
```

On success: validates online, caches the activation-instance id under `~/.commit-whisper`, and
returns to the launchpad now showing the paid tier. On a definitive invalid/revoked key, it
says so plainly and stays on this screen.

### Buy a license / Restore a purchase

Two one-shot browser hand-offs — no in-terminal screen, no in-app checkout (payment and
account lookup always live in the browser). **Buy** opens the store/checkout; **Restore**
opens the customer's Lemon Squeezy orders to recover an existing key. Both URLs are
deployment-overridable (`COMMIT_WHISPER_STORE_URL` / `COMMIT_WHISPER_RESTORE_URL`); on an
open failure the URL is printed plainly so it stays copyable (never a dead-end).

```
  ◆  Opening the store in your browser…
  │   commit-whisper never handles payment — checkout happens in your browser.
  │   After buying, return and choose “Activate license”.
  └  ↵ menu
```

```
  ◆  Opening your Lemon Squeezy orders in your browser…
  │   commit-whisper never handles payment. Find your license key in your
  │   Lemon Squeezy orders, then return and choose “Activate license”.
  └  ↵ menu
```

### Deactivate license (licensed)

```
  ◆  Deactivate license
  │
  │   This frees the activation on this device so you can use the license on
  │   another machine. You can re-activate here anytime with your key.
  │
  └  ↵ deactivate · esc menu
```

Escape & cancel (every screen)
------------------------------

- **Esc / quit** on the launchpad exits cleanly (success) and prints a short flags
  cheatsheet on the way out.
- **Esc** on a sub-screen returns to the launchpad (or the prior screen), never the OS.
- **Ctrl-C** always cancels immediately with no half-written output.

Open deltas (flagged for PRD / architecture reconciliation)
-----------------------------------------------------------

These screens introduce changes beyond the currently-locked FR-14/FR-16 text; they are
flagged to John (PRD) and Winston (architecture):

1. **`Settings` is a new menu action** (provider/model/base-URL + default format/timezone/
   max-commits). Not in the locked FR-14 action set. → John (FR-14).
2. **Settings *writes* non-secret config** to `~/.commit-whisper`. The architecture's resolver
   currently only *reads* this file; a write path is new (non-secret fields only, never a
   key). → Winston (config-write path).
3. **Licensing split:** key entry lives **only** under **Activate**; **Buy** and **Restore**
   are separate browser hand-offs (checkout vs. recover-from-orders). This revises FR-16's
   "restore consumes the license key" and FR-14's "Buy/Restore = buy or restore from key."
   → John (FR-14, FR-16).
4. **Persistent header readiness line** on every interactive screen — an addition beyond the
   standalone Status/doctor view. → now also authored in EXPERIENCE.md (Component Patterns),
   so the experience spine and this composition agree.
