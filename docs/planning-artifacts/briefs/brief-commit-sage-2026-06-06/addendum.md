# Addendum — Product Brief: commit-sage

Depth captured during discovery that belongs in downstream documents (market research, PRD, architecture) or earned a place but does not fit the 1–2 page brief.

---

## Competitive landscape (background research, 2026-06-06)

> Source: background web-research subagent. Pricing pulled live and changes often — verify before any external publication. Flagged-stale items: Swarmia AI, LinearB credits/"AI retros", GitClear AI-ROI pivot, GitHub Copilot roadmap (biggest commoditization wildcard).

### Bucket (a) — OSS git stats / analysis
| Tool | What it does | Pricing | AI narrative + coaching? |
|------|--------------|---------|--------------------------|
| git-quick-stats | Shell dashboard of contributor stats | Free/OSS | No |
| gitstats / GitStats | HTML stats dashboards | Free/OSS | No |
| Hercules | Code-aging / churn analysis | Free/OSS | No |
| git-of-theseus | Code survival/aging viz | Free/OSS | No |
| onefetch | Terminal repo summary | Free/OSS | No |
| git-sizer | Repo health/size checks | Free/OSS | No |

### Bucket (b) — Commercial engineering-intelligence (per-seat SaaS, manager-focused)
| Tool | What it does | Pricing (approx, verify) | AI narrative + coaching? |
|------|--------------|--------------------------|--------------------------|
| LinearB | DORA/dev-workflow analytics | ~$29/user/mo + credits | Partial — "AI retros" over team data, not history narrative |
| Swarmia | Eng productivity + DORA | €42–52/dev/mo, free ≤9 devs | Partial — Swarmia AI Q&A over data |
| GitClear | Diff/commit quality analytics | $0–34.95/contributor/mo | Partial — AI-ROI analytics pivot |
| Jellyfish, Pluralsight Flow, Code Climate Velocity, Waydev, Haystack, Sleuth | DORA/SPACE dashboards | Per-seat SaaS | No plain-language history / git coaching |

### Bucket (c) — AI git tools (forward-looking only)
| Tool | What it does | Pricing | Explains past history / coaches? |
|------|--------------|---------|----------------------------------|
| aicommits (~9k★) | AI commit messages | OSS, pay LLM tokens | No |
| OpenCommit (~7.3k★) | AI commit messages | OSS, pay LLM tokens | No |
| what.the.diff | AI PR summaries | SaaS | No |
| Graphite | Stacked PR workflow + AI | SaaS | No |
| GitHub Copilot | AI coding assistant | Per-seat | Not natively for history narrative (yet) — wildcard |

### The gap (strongest case vs counter)
- **Strongest case:** fuses retrospective explanation (today only crude stats) with prescriptive coaching (today nonexistent). Valuable for onboarding, audits, solo learners.
- **Strongest counter:** "vitamin not painkiller" — largely educational/one-time, replicable with a Copilot/ChatGPT prompt over `git log`, and history quality is rarely a budgeted line item. Thin moat.

### Willingness to pay
Money is overwhelmingly in team/manager analytics seats (all priced platforms sell per-seat to orgs). Individual devs rarely pay for personal git tooling; AI-commit niche is OSS/free with devs paying only LLM tokens. Implication: team/manager buyer for revenue, solo-dev as freemium funnel.

### Risks / watch-outs
- **Commoditization:** GitHub/Copilot could add "explain history" natively; an OSS clone is trivial.
- **Metrics-theater backlash:** strong distrust of dev-productivity measurement (Kent Beck + Pragmatic Engineer vs. McKinsey, 2023). Frame coaching as **dev-owned**, not manager surveillance.
- **Privacy:** sending commit messages/diffs to an LLM blocks many orgs — offer local/Ollama + on-prem modes.
- **Accuracy:** a hallucinated history narrative destroys trust.
