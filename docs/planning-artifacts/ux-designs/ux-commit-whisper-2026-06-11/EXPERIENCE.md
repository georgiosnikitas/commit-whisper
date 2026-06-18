---
title: commit-whisper EXPERIENCE
status: draft
created: 2026-06-11
updated: 2026-06-13
---

Sources
-------

- {planning_artifacts}/prds/prd-commit-whisper-2026-06-06/prd.md
- {planning_artifacts}/prds/prd-commit-whisper-2026-06-06/addendum.md

commit-whisper — Experience Spine
------------------------------

> Terminal-first git-history analysis. Report JSON is canonical; HTML, Markdown, and terminal are the rendered outputs derived from it. The terminal runs the analysis and can render the full report; the HTML report is the richest visual surface and opens in a browser when HTML output is selected. The product is not a standalone web app or hosted portal.
>
> Interaction is progressive, escapable, skippable, and self-teaching: the bare zero-arg `commit-whisper` command is the single interactive entry — a discovery menu plus gap-filling prompts — while passing any argument runs a strict single-shot that never prompts and hard-fails on missing input.

Foundation
----------

commit-whisper runs from the terminal on macOS, Linux, and Windows, and ships as a self-contained executable so a machine without a preinstalled Node runtime can run it. The primary interaction begins with a CLI command, continues with phase progress in the terminal, and ends with the rendered output(s) the user selected.

Report JSON is the canonical artifact; HTML, Markdown, and terminal are rendered outputs generated from it, so they never disagree and runs stay diff-able for trend deltas. Terminal output can present the full report on its own; the HTML report is the richest visual surface and opens in a browser when HTML output is selected. There is no standalone web app, hosted dashboard, or central portal.

The product posture is analytical and calm. Microcopy should be short, evidence-backed, and non-judgmental. The UX should feel like a technical brief rather than a dashboard meant to keep the user clicking.

Information Architecture
------------------------

| Surface | Reached from | Purpose |
| --- | --- | --- |
| Terminal command | Shell | Start analysis, set scope, select provider, and choose output formats |
| Terminal progress | During run | Show retrieve → analyze → narrate → render phases |
| Terminal summary | End of run | Confirm output is ready, where it was saved, and the confidence level |
| Report JSON | JSON output selected | Canonical machine-readable artifact and a selectable output format; all other formats render from it |
| HTML report | HTML output selected | Self-contained single file with the full narrative, charts, coaching, and metric explanations |
| Markdown report | Markdown output selected | Diff-able text output (tables, sparklines, Mermaid) for PRs, wikis, and CI artifacts |
| Terminal report | Terminal output selected | Full report as compact textual summaries and sparklines, suitable for CI logs |

Report JSON is the single source of truth. The HTML report is the richest deep-dive surface and should support in-page anchors for Summary, Explanation, Coaching, and each metric group so the reader can jump directly to what they care about.

Voice and Tone
-------------

Microcopy in the terminal should be concise and action-oriented. The product should tell the user what is happening, what happened, and what to do next, without over-explaining.

| Do | Don't |
| --- | --- |
| "Retrieving 18,402 commits…" | "Please wait while we do some work for you!" |
| "Output ready — written to …/report.html" | "Your beautifully crafted report is ready!" |
| "Confidence: medium" | "Looks pretty good overall" |
| "Confidence low — re-run with a stronger provider (switch it in Settings)." | "Try again maybe?" |
| "Analyzed 100 of 18,402 commits — Free tier cap." | Hiding or burying the cap |
| "Buy Me a Coffee support link available in Free." | Donation nagging or modal upsells |

The AI Narrative reads like a knowledgeable peer who has read the whole history and wants to help: plain language, no unexplained jargon, evidence first and interpretation second. Coaching is prescriptive but supportive ("a good next step is…", not "you should have…"). Manager-facing wording stays at team-level health and risk — never per-developer ranking. The same restraint applies in every rendered output; none should become promotional or conversationally noisy.

Component Patterns
------------------

| Component | Use | Behavioral rules |
| --- | --- | --- |
| Command invocation | Terminal | The `commit-whisper` command is the entry; any argument (e.g. `commit-whisper analyze <repo-url>`, plus flags for scope, provider/model, and output formats) runs strict single-shot, while the bare command opens the interactive menu |
| Menu (launchpad) | Terminal (zero-arg, TTY) | The single interactive entry: a calm, line-oriented list of actions for discovery, led by "Analyze this repository" (the cwd default); always includes "Settings", "Doctor", "Help", and "Quit"; license actions appear by state; never a flashy dashboard or a mandatory wizard |
| Header readiness line | Terminal (every interactive screen) | A persistent, dim header shown on every interactive screen — license tier · AI provider/model (or `⚠ not configured`) · cwd path and branch — so the user always knows who they are, whether they can run, and what "this repo" means without opening Doctor |
| Settings | Terminal (menu action) | A guided, writable configuration surface: sets non-secret AI plumbing (provider, model, base URL) and everyday defaults (output format, timezone, max-commits) and writes them to `~/.commit-whisper`; the writable counterpart to the read-only Doctor view and a calm way out of the first-run no-provider state (especially by picking local Ollama); never collects a secret — a cloud key stays an env var, named but never entered |
| Doctor view | Terminal (menu action) | A read-only "where do I stand" mirror: license tier, configured provider/model and whether it is actually reachable (the doctor probes, not just checks the var is set), and which required env vars are set vs missing (values never shown); the primary guide out of the first-run no-provider state |
| Guided prompt | Terminal (interactive) | Fills only missing required inputs; collects input, then goes silent; defaults anything inferable; never bleeds prompt styling into the report |
| Command echo | Terminal (end of interactive run) | Echoes the equivalent full command (`Next time: commit-whisper --max-commits 500 --format md`) so the menu teaches itself out of existence |
| Phase log | Terminal | Show retrieve → analyze → narrate → render in order; one line per phase |
| Run summary | Terminal | Confirm output is ready and name the saved path(s), branch scope, and confidence level |
| Metric section | Rendered report | Show title, value(s), a status band whose shape — not color — carries the health signal (`●` ok · `◐` watch · `▲` risk · greyed `○` n/a) with a text label alongside, and the four-facet explanation (meaning, good behaviours, needs improvement, suggestions) in a stable layout |
| Chart block | HTML report | Each Metric Group uses its fixed chart type, paired with a label and explanation; charts never stand alone without text |
| Coaching report | Rendered report | Introduction, themed chapters of prioritized steps, and a closing summary; consolidates and ranks the per-metric suggestions |
| Confidence indicator | Terminal + rendered report | Surface `high` / `medium` / `low` as a word (never a status shape); when low, name the concrete escalation (which provider/config to change) |
| Support link | HTML/Markdown report + Free-tier terminal summary | Visible but unobtrusive; never blocks reading or export |

The launchpad action set (zero-arg, TTY) is fixed and state-aware:

| Action | Shown when | Behavior |
| --- | --- | --- |
| Analyze this repository | Always — default/primary | Analyzes the current directory; the cwd is inferred as the repo, so it never asks for a URL |
| Analyze a remote repository | Always | Prompts for a repository URL; any required access token stays env-only (named, never collected) |
| Settings | Always | Configures non-secret AI (provider, model, base URL) and everyday defaults (output format, timezone, max-commits); writes `~/.commit-whisper`; never collects a secret |
| Doctor | Always | Shows license tier, configured provider/model and whether it is reachable (probed, not just set), and required env vars set vs missing |
| Help | Always | Prints the full flag reference |
| Activate license | Unlicensed | Prompts for a license key to activate this device (the only in-app key entry) |
| Buy / Restore license | Unlicensed | One browser door for users without an active license: buy a new license or recover an existing purchase from the store; the recovered key is then entered separately under Activate |
| Buy Me a Coffee | Unlicensed only | Optional support link; hidden once licensed |
| Deactivate license | Licensed | Releases this device's activation |
| Quit | Always | Esc or quit exits cleanly and prints a short flags cheatsheet |

Behavioral rules:

- The menu is for discovery ("what can I do?"); prompts are for gap-filling ("what's missing to run?"). They are distinct surfaces and never merge into a mandatory wizard, and an interactive run echoes the equivalent command on its way out.
- Metrics are always shown with context, not raw numbers alone.
- Charts do not replace narrative; they reinforce it.
- Every factual claim traces to a computed Metric; the report never asserts history the Metrics don't support.
- A Metric that is `not_available` still gets an explanation of why, rather than being silently omitted.
- Every major section has a stable anchor so the reader can jump to it.

State Patterns
--------------

| State | Surface | Treatment |
| --- | --- | --- |
| Cold start | Terminal | Show command parsing and an immediate phase indicator |
| Interactive menu (zero-arg, TTY) | Terminal | Open the launchpad led by "Analyze this repository" (cwd default), with "Settings", "Doctor", "Help", and "Quit" always present and license actions shown by state (Activate / Buy-Restore / Buy Me a Coffee when unlicensed, Deactivate when licensed); Esc/quit exits cleanly and prints a short flags cheatsheet |
| Missing required input (argument mode) | Terminal | Strict single-shot hard-fails with a typed, actionable error and a non-zero exit code; never prompts to fill the gap |
| Zero-arg, non-interactive (no TTY / CI) | Terminal | Fail fast with a clean, typed error and a non-zero exit code; never hang, never prompt |
| First run, missing secret (token or LLM key) | Terminal | Secrets are read from env vars only and are never prompted for or stored. Argument mode hard-fails naming the exact env var and points to bare `commit-whisper` for guided setup; zero-arg interactive names the exact env var in the menu and waits for the user to set it and re-run |
| First run, no AI provider configured | Terminal | AI is required, so with no provider configured the run cannot produce output. The tool never prompts for the secret; instead the menu and Doctor name a concrete path — set a provider key (e.g. `OPENAI_API_KEY`) or configure a local Ollama provider for a zero-cost path — then re-run |
| Analyze chosen with no provider (no-AI interstitial) | Terminal | The Analyze actions are never disabled; choosing one with no provider configured routes to a calm teaching screen (not an error) that names the env-var path (e.g. `OPENAI_API_KEY`) and points to Settings and the zero-cost local Ollama option, then returns to the menu |
| Provider configured but unreachable | Terminal | A configured provider is not the same as a reachable one (e.g. Ollama is selected but not running). A preflight reachability probe runs before retrieval and fails fast with an actionable message — "Ollama isn't responding at `<url>` — start it with `ollama serve`, or pick another provider in Settings" — so the run never dies connection-refused minutes into analysis |
| Running retrieval | Terminal | Display source scope and commit counts as they become known |
| Running analysis | Terminal | Show progress messages by phase, not a silent spinner |
| Running narration | Terminal | Surface that the narrative is being produced and grounded |
| Render complete | Terminal | State that output is ready and name the saved path(s) for each selected format (HTML, Markdown, Terminal, JSON); when HTML is selected the report auto-opens in a browser unless `--no-open` is passed |
| Browser open failure | Terminal | Keep the HTML path visible and explain how to open it manually |
| Narration failed (fail-open degrade) | Terminal + report | When narration, grounding, or the provider fails *after* the metrics are computed, never discard the work: still render the deterministic `analysis` substrate, but make the wound visible. A prominent `⚠ Narrative unavailable — showing raw analysis` banner leads every rendered output (terminal, HTML, Markdown) with an actionable next line (retry · check the provider · switch it in Settings), and the run ends on a distinct degraded exit code (see architecture exit-code enum) so scripts can detect it. This is the plainer substrate render, never the polished hero — it must read as *something is missing*, not as a clean success |
| Metrics-only run (`--no-ai` / CI default) | Terminal + report | An intentional, AI-free path — the default in CI/headless and available anywhere via `--no-ai`. Renders the same clean `analysis` substrate and exits `0`: a success, not a wound, so it carries **no** degrade banner — just a single calm nudge that the narrative is available interactively or by adding a key. Metrics-only is never the interactive default and never the Free-tier identity; interactively the narrative stays the hero, present on the Free tier |
| Free-tier cap reached | Terminal + report | State the cap explicitly with the total — "Analyzed 100 of N commits — Free tier cap"; date bounds are applied first, then the most-recent 100 within range are kept |
| Low confidence | Terminal + report | Name the concrete escalation (which provider/config to change); never degrade silently into confident-sounding output |
| Auth failure | Terminal | Name the missing credential or scope and stop cleanly |
| Rate-limit / network failure | Terminal | Name the provider and the failure class, include provider guidance where available, and stop without a partial report (no silent retry) when this happens before the metrics exist (retrieve/analyze); a provider or rate-limit failure *during narration* instead fails open to the `analysis` substrate with the degrade banner (see "Narration failed") rather than discarding the computed metrics |
| Unhealthy findings | Terminal | Report findings normally; this is a successful run, never an error exit |
| Invalid license (headless / argument mode) | Terminal | Fail closed: stop at startup before analysis with exit code 8 and explain the license issue clearly; a non-interactive run never silently downgrades |
| License validation fails (interactive) | Terminal | Degrade, never refuse: state the license issue plainly and continue on the Free 100-commit cap, so an interactive user is never locked out of running — the mode, not the failure class, decides refuse-vs-degrade |
| Second device (Single-device) | Terminal | Refuse with a clear message that the license is bound to one device |
| Empty / tiny repo | Rendered report | Still render, with explicit `not_available` metrics and a clear explanation |

Interaction Primitives
---------------------

The entry model is decided by argument count and terminal context, never by hidden state:

- **Zero arguments, interactive terminal (TTY):** the bare `commit-whisper` command opens interactive mode — a top-level menu for discovery plus guided prompts for gap-filling. This is the only interactive entry point in the product. Inside a git repo the menu's primary action analyzes the current directory (cwd-first) and never asks for a URL; analyzing a remote repository is the explicit second path and the only one that prompts for a URL (its access token stays env-only).
- **Zero arguments, non-interactive (no TTY / CI):** fail fast with a clean, typed error and a non-zero exit code. Never hang, never prompt.
- **One or more arguments (any context, even a terminal):** strict single-shot. Run when every required input is present; otherwise hard-fail with a typed, actionable error and a non-zero exit code. Passing any argument is an explicit intent to run non-interactively, so argument mode never prompts.
- **First run with no secret (access token or LLM key):** secrets are read from environment variables only and are never prompted for or stored. In argument mode, hard-fail with an error that names the exact environment variable to set and points the user to run bare `commit-whisper` for guided setup; in zero-arg interactive mode, the menu names the exact environment variable to set and the user exports it and re-runs. Neither mode ever prompts for a secret — the redirect is what keeps the failure from being a hostile cliff.
- **AI-first by default — the narrative is the hero:** the interactive default needs a configured LLM provider, because the full narrated report *is* the product; a brand-new user with nothing set up cannot get that hero report yet. Because secrets are never prompted, the launchpad and the Doctor view are the way through: set a provider key (e.g. `OPENAI_API_KEY`) or configure a local Ollama provider for a zero-cost path, then re-run. This is the one genuinely heavier onboarding moment, so the guidance must be concrete (name the variable and offer the local Ollama option), never a vague "configure a provider." A separate, explicit `--no-ai` metrics-only path exists for CI/headless (see State Patterns), but it is **never** the interactive default and **never** the Free-tier identity — interactively the narrative is always the hero, and it is present on the Free tier.
- **No-AI interstitial, not a locked door:** choosing an Analyze action with no provider configured never disables the action or throws a raw error — it routes to a calm teaching screen that names the env-var path (e.g. `OPENAI_API_KEY`), points to Settings, and leads with the zero-cost local Ollama option, then drops back to the menu. Discovery is preserved; the dead-end always has a door.
- **Preflight reachability (configured ≠ reachable):** before the costly retrieve/analyze, a fast preflight probes the chosen provider — pinging the Ollama endpoint, or a low-cost auth check for a cloud provider — and fails fast with an actionable message if it is unreachable (e.g. "Ollama isn't responding at `<url>` — start it with `ollama serve`, or pick another provider in Settings"). Picking Ollama in Settings configures it; it does not install or start it, so the probe is what turns a silent multi-minute connection-refused into an immediate, fixable message.
- **Self-teaching bridge:** every interactive run ends by echoing the equivalent full command (e.g. `Next time: commit-whisper --max-commits 500 --format md`) so the menu teaches itself out of existence. A single-shot success may show at most one dim tip line.
- **Escape hatch:** in the zero-arg menu, Esc or quit exits cleanly (success) and prints a short flags cheatsheet on the way out, and a "Help" item is always present. Ctrl-C always cancels with no half-written output.
- **Prompts collect, then go silent:** at most a few prompts, and prompt styling never bleeds into the report, which stays a line-oriented brief. Anything inferable is defaulted, not asked — the cwd is taken as the repo, date bounds default to all history (start/end dates are optional), and a default output format is assumed.
- **Stream separation:** stdout carries only machine output; all human chrome (menu, prompts, spinner, tips) goes to stderr, so piping and redirecting stay clean.

The operational primitives still hold:

- The user selects one or more output formats per run (HTML, Markdown, Terminal, JSON); selection is multi-select, and Report JSON remains the canonical artifact the other three render from.
- A completed run always states that output is ready and shows the saved path(s).
- The HTML report auto-opens in a browser when HTML output is selected, unless `--no-open` is passed (and headless/CI never opens); if an attempted auto-open fails, the HTML path is still printed clearly and is easy to copy.
- Secrets (access token, LLM key) come only from environment variables — never from the config file and never from CLI flags; non-secret config (repo URL, provider, model, output formats) may be flags.
- Exit codes are machine-readable: success vs. operational failure (auth, network, config). An "unhealthy" finding is not a failure exit, and a fail-open degraded render is neither — it carries its own distinct degraded exit code (see architecture exit-code enum), so a wounded-but-rendered run reads as separate from both a clean success and a hard stop.
- The HTML report supports standard navigation: table-of-contents links, in-page anchors, and browser search.
- Interactivity is never hidden, mandatory, or inescapable: it appears only when invoked by the bare zero-arg command, is always escapable and skippable, and any argument bypasses it entirely. There is no hidden multi-step wizard on any path.

Accessibility Floor
-------------------

- Terminal output must not rely on color alone; every state must also be represented in text.
- Status bands are distinguished by shape and text label, not color alone: `●` ok, `◐` watch, `▲` risk, and a greyed `○` for n/a, each with its word beside it.
- The run-level **confidence** indicator is carried by its **word** — `high` / `medium` / `low`, always shown — never by color or shape alone. It deliberately does not borrow the status-band shapes, so the `●◐▲○` vocabulary stays reserved for per-metric health and the two scales never visually rhyme.
- Long status lines should wrap cleanly and remain readable in narrow terminals.
- Browser report must meet WCAG 2.2 AA expectations for contrast and keyboard navigation.
- Section headings and anchors in the browser report must be keyboard reachable.
- The report must remain readable with reduced motion; no essential behavior may depend on animation.
- Charts need text labels and accompanying narrative so screen readers and low-vision users can understand them.
- Copyable paths and report links must be presented in plain text and not hidden behind hover-only UI.
- The interactive menu and guided prompts must be fully keyboard-navigable, must not rely on color alone to convey selection or state, and must echo the selected or typed value in text.
- Every interactive surface must offer a clear, text-stated keyboard exit (Esc/quit and Ctrl-C); the escape affordance is never implied by styling alone.

Key Flows
---------

Flow 1 — Dana analyzes an inherited repo

1. Dana runs `commit-whisper analyze <repo-url>` with HTML output selected; because she passes arguments, the run is strict single-shot — no menu, no prompts. Her access token and LLM key are read from the environment.
2. The terminal confirms the repo target and that all branches are in scope by default.
3. Retrieval starts and the terminal shows retrieve → analyze → narrate → render progress.
4. Analysis and narration run; the terminal displays a concise running summary.
5. Rendering completes; the terminal states the output is ready and where it was saved, then auto-opens the HTML report because HTML was selected (unless `--no-open` is set); a single dim tip line may note an equivalent flag.
6. Dana reads the Summary, then jumps to Coaching for next steps.
7. **Climax:** Dana can recount the repo's story and name one concrete improvement without leaving the report.

Failure beat: if the browser fails to open, the terminal still gives Dana the HTML path and the report is fully usable from disk. On a first run with no LLM key set, argument mode does not prompt — it hard-fails with a typed error that names the exact environment variable to set and points her to run bare `commit-whisper` for guided setup.

Flow 2 — Marco uses it in CI

1. Marco wires the command into scheduled CI on the Unlimited/Automation tier.
2. Secrets (token, LLM key) are injected from the CI secret store as environment variables; non-secret config is passed as flags.
3. The run is strictly non-interactive on both counts — it passes arguments and has no TTY — so it never prompts and never hangs; the log records retrieve → analyze → narrate → render progress and any warnings.
4. Report JSON and a Markdown report are written to predictable paths as build artifacts.
5. The JSON is diffed against last month's to show whether hygiene is trending up.
6. **Climax:** the team gets a recurring health report with no manual dashboard work, and an "unhealthy" finding never fails the build.

Failure beat: an invalid license, auth failure, provider failure, or a missing required input stops early with a machine-readable non-zero exit and no partial report — distinct from a healthy/unhealthy finding, which always exits success.

Flow 3 — Sofia checks her own Git hygiene

1. Sofia runs bare `commit-whisper` in her terminal; with zero arguments in an interactive shell, the launchpad menu opens.
2. She picks "Analyze this repository" — the default action — and because the cwd is a git repo it is taken as the target, so she is never asked for a URL; guided prompts fill only what's missing (optional date bounds, output format(s)). AI is required, so on this first run, if no provider is configured, she gets no output yet: the menu and the Doctor view name a concrete path — set `OPENAI_API_KEY`, or point at a local Ollama provider for a zero-cost run — and she exports the variable and re-runs. The menu never prompts for or stores the secret.
3. The run proceeds on the Free tier; the terminal states that 100 of her N commits were analyzed (Free tier cap, applied after any date filter) and, because she is unlicensed, shows the Buy Me a Coffee link in the summary.
4. She opens the report and reads the Coaching section, which cites her own message-quality and branching Metrics.
5. Each recommendation is grounded in a Metric (e.g., "62% of your messages are under 10 characters"), prioritized in the closing summary.
6. The run ends by echoing the equivalent command (e.g. `Next time: commit-whisper --max-commits 100 --format html`) so she can skip the menu next time.
7. **Climax:** Sofia knows the next two habits to improve and understands, from her own data, why they matter — and now has the one-line command to repeat the run.

Failure beat: if a Metric is `not_available`, the report explains the limitation instead of leaving a blank gap. If Sofia quits the menu with Esc, it exits cleanly and prints a short flags cheatsheet on the way out.

Responsive & Platform
---------------------

| Context | Behavior |
| --- | --- |
| macOS / Linux / Windows terminal | Primary run surface; same command semantics across platforms; ships as a self-contained executable |
| Modern browser | The self-contained HTML report renders locally from a single file with no network dependency |
| Markdown viewers (GitHub/GitLab/PR) | Markdown report renders text tables and Mermaid; falls back to fenced code where Mermaid is unsupported |
| Narrow terminal windows | Summary and phase output wrap safely; core information stays visible |
| Large desktop displays | The HTML report can reveal wider chart and coaching layouts without losing the reading column |

The product should not become mobile-first or browser-first. It may be readable on a phone if someone opens the HTML file there, but the design target is desktop terminal plus desktop browser.

Inspiration & Anti-patterns
---------------------------

- **Lifted from terminal observability tools:** phase logs, concise status output, and copyable artifact paths.
- **Lifted from technical report writing:** evidence first, interpretation second, recommendations last.
- **Lifted from command-line utilities:** one command should do the common thing well.
- **Rejected — standalone dashboards / hosted portals:** they hide the action behind another surface and violate the terminal-first, no-central-portal posture.
- **Rejected — per-developer ranking or surveillance:** manager-facing output stays at team-level health; individual scoreboards are forbidden by design.
- **Rejected — ungrounded AI claims:** the Narrative never asserts history the Metrics don't support; a confidently wrong report is the worst outcome.
- **Rejected — forward authoring:** commit-whisper explains the past; it does not write the user's next commit or PR.
- **Rejected — gamification / streaks / badges:** the product is about understanding git history, not dopamine loops.
- **Rejected — silent completion states:** every run needs clear phase and result feedback.

Open Questions
--------------

- None are required for the core UX shape. Remaining implementation details belong to architecture and engineering.
- **UX recommendation for implementation (not a locked decision):** date scope is typed absolute dates with optional start/end bounds (empty = all history). A quality-of-life follow-up would be to also accept relative date input (e.g. "last 6 months") and resolve it to absolute bounds. Recorded here as a recommendation only — it is explicitly not part of the locked scope.

This experience spine is intentionally stable until implementation details force a change.
