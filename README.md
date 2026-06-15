# commit-whisper

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=georgiosnikitas_commit-whisper&metric=alert_status)](https://sonarcloud.io/summary/overall?id=georgiosnikitas_commit-whisper)
[![CI](https://github.com/georgiosnikitas/commit-whisper/actions/workflows/ci.yml/badge.svg)](https://github.com/georgiosnikitas/commit-whisper/actions/workflows/ci.yml)
[![Release](https://github.com/georgiosnikitas/commit-whisper/actions/workflows/release.yml/badge.svg?event=push)](https://github.com/georgiosnikitas/commit-whisper/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/commit-whisper)](https://www.npmjs.com/package/commit-whisper)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/github/license/georgiosnikitas/commit-whisper)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/georgiosnikitas)

> 🕵️ **I know what you did last commit.**

Deterministic git history analysis with a grounded, bring-your-own-key AI narrative — a
terminal-native CLI.

commit-whisper analyzes a local or remote git repository, computes a catalog of deterministic
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

## 🚀 Installation

### 🍺 Homebrew (macOS)

```bash
brew tap georgiosnikitas/commit-whisper
brew install commit-whisper
```

### 📦 From npm

```bash
npm install -g commit-whisper
```

Or run it once without installing:

```bash
npx commit-whisper .
```

### 📦 From GitHub Packages

```bash
npm install -g @georgiosnikitas/commit-whisper --registry=https://npm.pkg.github.com
```

> **Note:** GitHub Packages requires authentication even for public packages. Add a
> [personal access token](https://github.com/settings/tokens) with `read:packages` scope
> to your `~/.npmrc`:
>
> ```
> //npm.pkg.github.com/:_authToken=YOUR_TOKEN
> ```

### 💾 Prebuilt binaries (no Node.js required)

Self-contained executables for macOS, Linux, and Windows are attached to each
[GitHub Release](https://github.com/georgiosnikitas/commit-whisper/releases).

After installing via Homebrew, npm, GitHub Packages, or a prebuilt binary, run it from
anywhere:

```bash
commit-whisper .
```

### 🛠️ From source

```bash
git clone https://github.com/georgiosnikitas/commit-whisper.git
cd commit-whisper
npm install
npm run build
node dist/index.js .
```

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

[MIT](LICENSE) © Georgios Nikitas. The CLI and its source are MIT-licensed; paid
tiers are enforced at runtime via an online license check (BYOK AI keys and git
tokens stay on your machine).
