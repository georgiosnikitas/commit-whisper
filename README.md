# commit-sage

Deterministic git history analysis with a grounded, bring-your-own-key AI narrative — a
terminal-native CLI.

commit-sage analyzes a local or remote git repository, computes a catalog of deterministic
metrics (no AI), and — when a provider is configured — adds a grounded AI narrative and
coaching report. It renders to HTML, Markdown, terminal, and JSON from a single canonical
Report JSON.

> Status: v1 — all seven epics delivered. See
> [docs/planning-artifacts/](docs/planning-artifacts/) for the PRD, architecture, epics, and
> UX design.

## Requirements

- Node.js 22 LTS or newer
- npm (bundled with Node.js)
- A system `git` on `PATH` (retrieval shells out to it)

## Getting started (development)

```bash
npm install      # install pinned toolchain + runtime deps
npm run build    # bundle src/ → dist/ (tsup / esbuild)
npm test         # run the test suite (vitest)
```

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Bundle `src/` to `dist/` via tsup (ESM, Node 22 target). |
| `npm run bundle:sea` | Bundle `src/sea-entry.ts` to a single self-contained CJS file in `dist-sea/`. |
| `npm run build:sea` | Build a Node SEA single-executable binary (see [the 7.4 spike findings](docs/implementation-artifacts/7-4-sea-packaging-spike-findings.md)). |
| `npm test` | Run the test suite once (`vitest run`). |
| `npm run test:watch` | Run vitest in watch mode. |
| `npm run typecheck` | Type-check with `tsc --noEmit` (strict, nodenext). |
| `npm run lint` | Lint with ESLint (enforces the architecture patterns). |

## Project structure

```
src/
├── index.ts     # entrypoint (bootstrap → cli)
├── cli/         # CLI shell, menu, arg parsing, exit-code mapping
├── config/      # two-phase resolver, RunConfig, the only reader of process.env
├── retrieve/    # git clone shell-out, retrieval, temp-workspace lifecycle
├── analyze/     # normalized model + deterministic metric functions (Groups A–F)
├── narrate/     # AI client, reachability preflight, grounding check
├── assemble/    # canonical Report JSON assembly + schema
├── render/      # HTML / Markdown / Terminal / JSON renderers
├── license/     # license validation and tier resolution
└── shared/      # errors, ui (stderr), Secret<string>, ports, types
```

Only `cli/` and `config/` may touch `argv` / `env` / prompts; every stage from `retrieve/`
onward receives a frozen `RunConfig` (the hexagonal boundary). These conventions are
enforced by ESLint.

## License

UNLICENSED — all rights reserved (commercial product; license terms TBD).
