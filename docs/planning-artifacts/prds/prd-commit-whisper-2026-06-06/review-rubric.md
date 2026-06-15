# PRD Quality Review — commit-whisper

*Reviewer: Mary (Business Analyst). Date: 2026-06-06. Stakes: high (commercial, paid product). Source reconciled against [brief.md](../../briefs/brief-commit-whisper-2026-06-06/brief.md).*

## Overall verdict

This is a strong, coherent, build-shaped PRD with a real thesis (the comprehension gap), honest non-goals, and testable FRs — well above the median draft. What's at risk is **not the document, it's three unresolved commercial linchpins it leaves open**: how a perpetual, offline, single-device license is *enforced* (the entire revenue model rests on it), how success is *measured at all* given a deliberately telemetry-free product, and whether the $2.99 tier *cannibalizes* the $100 tier. None of these block the PRD's shape; all three should be named tensions resolved before architecture, not during it.

## 1. Decision-readiness — adequate

Most decisions are stated as decisions (JSON-canonical output, three providers, BYOK, three tiers, Node + self-contained binary). Open Questions are genuinely open, not rhetorical. But two real tensions are smoothed to neutral:

### Findings
- **high** — Pricing cliff treated as a footnote (§9) — The $2.99→$100 gap is framed only as "possible future mid-tier." The sharper risk is **arbitrage**: single-device grants "unlimited runs, repositories, and remote servers," so a 4-person team can buy 4× single-device ($12) and get everything except (a) multiple devices per license and (b) headless/CI. The $100 tier's entire marginal value collapses onto "CI automation is worth +$88." That's a real strategic bet the PRD doesn't make explicitly. *Fix:* add a `[NOTE FOR PM]` in §9 naming the cannibalization risk and stating what, precisely, justifies the $100 tier over N× single-device.
- **high** — License enforcement is the linchpin and carries zero leaning (FR-16, Open Q2) — Perpetual + offline + single-device + "never transmits repository data" is genuinely hard with no server check-in. The whole paid model depends on FR-16, yet the mechanism is fully TBD. Honest, but under-weighted for a product whose explicit goal is "people pay for it." *Fix:* elevate Open Q2 from open question to a named pre-architecture spike; note that "fails safe" (FR-16) currently means *fails open* (a cracked check just unlocks it) — decide the acceptable leakage.

## 2. Substance over theater — strong

No furniture. Three UJs (Dana/Marco/Sofia), each drives FRs — under the four-persona line, none decorative. The "first mover" claim is earned by the brief's competitive addendum and carries an honest caveat ("the barrier is execution, not secret technology"). Vision (§1) is commit-whisper-specific and could not swap into another PRD. NFRs (§7) are mostly product-specific (determinism, offline-first, grounding) rather than boilerplate. No findings.

## 3. Strategic coherence — adequate

Clear thesis (comprehension gap), features serve it in a logical arc (metrics → narrative → render), counter-metrics present (SM-C1/C2) — that last is a maturity signal most PRDs skip. One serious crack:

### Findings
- **high** — Measurement-vs-privacy paradox is unaddressed (§11 vs §5/§7) — The product is deliberately portal-less, local-first, BYOK, with no phone-home (§5 Non-Goals, §7 Privacy). Yet **every** success metric (SM-1 Comprehension, SM-2 Repeat use, SM-3 Conversion, SM-4 Trust) requires knowing what happens on users' machines. With zero telemetry, all four are unmeasurable except by proxy (sales, refunds, reviews, manual surveys). The PRD never names this tension. This is the kind of gap that leaves a founder flying blind post-launch. *Fix:* add a `[NOTE FOR PM]` in §11 stating the measurement model explicitly — either (a) accept SMs are proxy/qualitative and say how (license-sale counts, refund rate, opt-in survey), or (b) introduce opt-in anonymous telemetry and accept the positioning cost. Don't leave it implied.
- **medium** — What the free tier *caps* may not gate the actual pain (§9, Open Q1) — The painkiller is *long history beyond human scale*. Free caps the *N most-recent commits*, which gives a free user on a huge repo a **truncated, incomplete story** — that may demo the product's weakness (a partial narrative) rather than create upgrade desire. Alternatives (cap repo count; full analysis but watermarked; full analysis minus CI) aren't weighed. *Fix:* in Open Q1, enumerate the candidate gating models, not just the value of N.

## 4. Done-ness clarity — strong

Every FR carries a "Consequences (testable)" block — this is the dimension most drafts fail and this PRD is genuinely good at it. Determinism (FR-4), read-only (FR-1), exit-code semantics (FR-15), "token never in logs/JSON" (FR-2) are all verifiable. Residual softness:

### Findings
- **medium** — Grounding (FR-9) may be unenforceable by prompt alone across arbitrary BYOK models — FR-9 is the trust linchpin (SM-4 calls a confidently-wrong narrative "the worst outcome"), but enforcement is "prompt design + (possible) post-generation check" (Open Q5). Prompt-only grounding fails *most* exactly when a weak local model is used — i.e., precisely the low-confidence case FR-10 handles. The FR-9/FR-10 pairing is smart, but the PRD should commit that a **post-generation numeric cross-check is in MVP**, not optional, or trust is unfalsifiable. *Fix:* make the post-gen check a Consequence of FR-9 rather than deferring the whole question.
- **low** — Adjective bounds in §7 Performance — "reasonable time and memory" is the exact phrasing the rubric warns on; it's tagged `[ASSUMPTION: budgets in architecture]`, which is acceptable for a draft but should not survive to `final` without at least one anchor (e.g., target wall-clock for a 50k-commit repo).

## 5. Scope honesty — strong

§5 Non-Goals does real work (no portal, no per-dev ranking, no forward authoring, read-only). Assumptions are tagged inline and indexed (§13); roundtrip spot-checks pass. Open-items density (8 Open Qs + ~20 `[ASSUMPTION]`) is appropriate for a `draft` heading into UX/architecture — it would only be a blocker on a green-lit build PRD, which this isn't yet.

### Findings
- **medium** — Three-provider parity is asserted, not scoped (FR-1) — "GitHub, GitLab, Bitbucket (HTTPS form at minimum)" treats three different APIs/auth-scope/rate-limit regimes as fungible. The PRD never says whether v1 guarantees *full metric parity* across all three or whether one is primary and the others best-effort. This will bite in architecture and possibly in what metrics are computable per provider. *Fix:* state the parity commitment explicitly, or `[NOTE FOR PM]` it as a per-provider scope decision.

## 6. Downstream usability — strong

Glossary present and load-bearing; domain nouns (Metric, Report JSON, Narrative, Grounding) used consistently. IDs contiguous and unique (FR-1–16, UJ-1–3, SM-1–4 + C1/C2); cross-references resolve. Each section reads standalone via Glossary terms. This PRD is chain-top (feeds UX → architecture → stories) and is well-prepared for source extraction.

### Findings
- **medium** — Retrieval *mechanism* is load-bearing but invisible to the FRs (FR-1, FR-3, §7) — Whether history is obtained by **git clone** (cheap full history, changed-file metadata free) versus **REST/GraphQL API paging** (hard rate limits, expensive diffs) materially changes FR-3 (rate-limit handling), §7 (performance), and even which Group E churn metrics are affordable. It's parked as an addendum library choice, but it's really a capability-shaping decision. *Fix:* add a one-line `[NOTE FOR PM]` under FR-1 flagging that the retrieval approach gates several downstream metrics and NFRs.

## 7. Shape fit — strong

Correct shape: a prosumer developer tool with meaningful report/visual UX → UJs with named protagonists are load-bearing and present; chain-top → traceability invested. Not over-formalized (no UJ bloat) nor under-formalized (no missing journeys for a consumer-facing product). No findings.

## Mechanical notes

- **Stale title qualifier** — line 9 `*Working title — confirm.*` under the H1, but "commit-whisper" is the confirmed product name in the finalized brief. Remove the false uncertainty.
- **Markdown lint** — MD025 (frontmatter title + H1 — template-inherent, acceptable), MD032 (lists need surrounding blank lines — pervasive, cosmetic), MD036 (§11 `**Primary**`/`**Secondary**`/`**Counter-metrics**` bolded-as-heading — promote to `####` or accept). Clean in the Polish step of finalize.
- **Assumptions Index roundtrip** — §13 indexes by section rather than by FR-ID; all inline tags are covered, but by-ID would be more precise for downstream extraction. Low priority.
- **Glossary** — "Confidence self-assessment" defined; lowercase "confidence" used in prose (FR-10). Acceptable drift.

## Recommended disposition

- **Fix before finalize (cheap, high-value):** the three `[NOTE FOR PM]` additions (cannibalization §9, measurement model §11, retrieval mechanism FR-1) and the stale title qualifier. These are paragraph-level edits that materially raise decision-readiness.
- **Resolve before architecture (not during):** Open Q2 (license enforcement) and the FR-9 post-gen grounding-check commitment — both are linchpins, not details.
- **Acceptable to carry as `draft` open items:** free-tier cap value, hygiene-score formula, performance budgets, chart types, three-provider parity — these are legitimately UX/architecture-phase.
