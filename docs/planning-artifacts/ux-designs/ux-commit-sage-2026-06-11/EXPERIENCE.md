---
title: commit-sage EXPERIENCE
status: draft
created: 2026-06-11
updated: 2026-06-11
---

Sources
-------

- {planning_artifacts}/prds/prd-commit-sage-2026-06-06/prd.md
- {planning_artifacts}/prds/prd-commit-sage-2026-06-06/addendum.md

commit-sage — Experience Spine
------------------------------

> Terminal-first git-history analysis. Report JSON is canonical; HTML, Markdown, and terminal are the rendered outputs derived from it. The terminal runs the analysis and can render the full report; the HTML report is the richest visual surface and opens in a browser when HTML output is selected. The product is not a standalone web app or hosted portal.

Foundation
----------

commit-sage runs from the terminal on macOS, Linux, and Windows, and ships as a self-contained executable so a machine without a preinstalled Node runtime can run it. The primary interaction begins with a CLI command, continues with phase progress in the terminal, and ends with the rendered output(s) the user selected.

Report JSON is the canonical artifact; HTML, Markdown, and terminal are rendered outputs generated from it, so they never disagree and runs stay diff-able for trend deltas. Terminal output can present the full report on its own; the HTML report is the richest visual surface and opens in a browser when HTML output is selected. There is no standalone web app, hosted dashboard, or central portal.

The product posture is analytical and calm. Microcopy should be short, evidence-backed, and non-judgmental. The UX should feel like a technical brief rather than a dashboard meant to keep the user clicking.

Information Architecture
------------------------

| Surface | Reached from | Purpose |
| --- | --- | --- |
| Terminal command | Shell | Start analysis, set scope, select provider, and choose output formats |
| Terminal progress | During run | Show retrieve → analyze → narrate → render phases |
| Terminal summary | End of run | Confirm output is ready, where it was saved, and the confidence level |
| Report JSON | File path | Canonical machine-readable artifact; all other outputs render from it |
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
| "Confidence low — re-run with a stronger provider (set provider=openai)." | "Try again maybe?" |
| "Analyzed the 100 most-recent commits (Free tier cap)." | Hiding or burying the cap |
| "Buy Me a Coffee support link available in Free." | Donation nagging or modal upsells |

The AI Narrative reads like a knowledgeable peer who has read the whole history and wants to help: plain language, no unexplained jargon, evidence first and interpretation second. Coaching is prescriptive but supportive ("a good next step is…", not "you should have…"). Manager-facing wording stays at team-level health and risk — never per-developer ranking. The same restraint applies in every rendered output; none should become promotional or conversationally noisy.

Component Patterns
------------------

| Component | Use | Behavioral rules |
| --- | --- | --- |
| Command invocation | Terminal | Primary entry is `commit-sage analyze <repo-url>`; flags set branch scope, provider/model, and one or more output formats |
| Phase log | Terminal | Show retrieve → analyze → narrate → render in order; one line per phase |
| Run summary | Terminal | Confirm output is ready and name the saved path(s), branch scope, and confidence level |
| Metric section | Rendered report | Show title, value(s), and the four-facet explanation (meaning, good behaviours, needs improvement, suggestions) in a stable layout |
| Chart block | HTML report | Each Metric Group uses its fixed chart type, paired with a label and explanation; charts never stand alone without text |
| Coaching report | Rendered report | Introduction, themed chapters of prioritized steps, and a closing summary; consolidates and ranks the per-metric suggestions |
| Confidence indicator | Terminal + rendered report | Surface `high` / `medium` / `low`; when low, name the concrete escalation (which provider/config to change) |
| Support link | HTML/Markdown report + Free-tier terminal summary | Visible but unobtrusive; never blocks reading or export |

Behavioral rules:

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
| Running retrieval | Terminal | Display source scope and commit counts as they become known |
| Running analysis | Terminal | Show progress messages by phase, not a silent spinner |
| Running narration | Terminal | Surface that the narrative is being produced and grounded |
| Render complete | Terminal | State that output is ready and where it was saved; open the HTML report only when HTML output is selected |
| Browser open failure | Terminal | Keep the HTML path visible and explain how to open it manually |
| Free-tier cap reached | Terminal + report | State that only the 100 most-recent commits were analyzed |
| Low confidence | Terminal + report | Name the concrete escalation (which provider/config to change); never degrade silently into confident-sounding output |
| Auth failure | Terminal | Name the missing credential or scope and stop cleanly |
| Rate-limit / network failure | Terminal | Name the provider and the failure class, include provider guidance where available, and stop without a partial report (no silent retry) |
| Unhealthy findings | Terminal | Report findings normally; this is a successful run, never an error exit |
| Invalid license | Terminal | Stop at startup before analysis and explain the license issue clearly |
| Second device (Single-device) | Terminal | Refuse with a clear message that the license is bound to one device |
| Empty / tiny repo | Rendered report | Still render, with explicit `not_available` metrics and a clear explanation |

Interaction Primitives
---------------------

- The terminal run is single-command first. Prompts are avoided unless the user omitted a required value; headless/CI runs use no prompts at all.
- The user selects one or more output formats per run (HTML, Markdown, Terminal).
- A completed run always states that output is ready and shows the saved path(s).
- The HTML report opens in a browser when HTML output is selected; if that auto-open fails, the HTML path is still printed clearly and is easy to copy.
- Secrets (access token, LLM key) come only from environment variables or config file — never from CLI flags; non-secret config (repo URL, provider, model, output formats) may be flags.
- Exit codes are machine-readable: success vs. operational failure (auth, network, config). An "unhealthy" finding is not a failure exit.
- The HTML report supports standard navigation: table-of-contents links, in-page anchors, and browser search.
- There is no hidden multi-step wizard for the core path.

Accessibility Floor
-------------------

- Terminal output must not rely on color alone; every state must also be represented in text.
- Long status lines should wrap cleanly and remain readable in narrow terminals.
- Browser report must meet WCAG 2.2 AA expectations for contrast and keyboard navigation.
- Section headings and anchors in the browser report must be keyboard reachable.
- The report must remain readable with reduced motion; no essential behavior may depend on animation.
- Charts need text labels and accompanying narrative so screen readers and low-vision users can understand them.
- Copyable paths and report links must be presented in plain text and not hidden behind hover-only UI.

Key Flows
---------

Flow 1 — Dana analyzes an inherited repo

1. Dana runs `commit-sage analyze <repo-url>` with HTML output selected; her access token is read from the environment.
2. The terminal confirms the repo target and that all branches are in scope by default.
3. Retrieval starts and the terminal shows retrieve → analyze → narrate → render progress.
4. Analysis and narration run; the terminal displays a concise running summary.
5. Rendering completes; the terminal states the output is ready and where it was saved, then opens the HTML report because HTML was selected.
6. Dana reads the Summary, then jumps to Coaching for next steps.
7. **Climax:** Dana can recount the repo's story and name one concrete improvement without leaving the report.

Failure beat: if the browser fails to open, the terminal still gives Dana the HTML path and the report is fully usable from disk.

Flow 2 — Marco uses it in CI

1. Marco wires the command into scheduled CI on the Unlimited/Automation tier.
2. Secrets (token, LLM key) are injected from the CI secret store as environment variables; non-secret config is passed as flags.
3. The run starts headless with no prompts; the log records retrieve → analyze → narrate → render progress and any warnings.
4. Report JSON and a Markdown report are written to predictable paths as build artifacts.
5. The JSON is diffed against last month's to show whether hygiene is trending up.
6. **Climax:** the team gets a recurring health report with no manual dashboard work, and an "unhealthy" finding never fails the build.

Failure beat: an invalid license, auth failure, or provider failure stops early with a machine-readable non-zero exit and no partial report — distinct from a healthy/unhealthy finding, which always exits success.

Flow 3 — Sofia checks her own Git hygiene

1. Sofia runs the command on her side project on the Free tier.
2. The terminal states that the 100 most-recent commits were analyzed (Free cap) and shows the Buy Me a Coffee link in the summary.
3. She opens the report and reads the Coaching section, which cites her own message-quality and branching Metrics.
4. Each recommendation is grounded in a Metric (e.g., "62% of your messages are under 10 characters"), prioritized in the closing summary.
5. **Climax:** Sofia knows the next two habits to improve and understands, from her own data, why they matter.

Failure beat: if a Metric is `not_available`, the report explains the limitation instead of leaving a blank gap.

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
- **Rejected — forward authoring:** commit-sage explains the past; it does not write the user's next commit or PR.
- **Rejected — gamification / streaks / badges:** the product is about understanding git history, not dopamine loops.
- **Rejected — silent completion states:** every run needs clear phase and result feedback.

Open Questions
--------------

- None are required for the core UX shape. Remaining implementation details belong to architecture and engineering.

This experience spine is intentionally stable until implementation details force a change.
