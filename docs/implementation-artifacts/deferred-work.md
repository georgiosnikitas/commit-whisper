# Deferred Work

Tracked items deferred from reviews and other workflows. Each entry names its source and date.

## Deferred from: code review of 1-1-project-scaffold-and-toolchain (2026-06-13)

- **No `bin`/shebang for the CLI** — `package.json` has no `bin` field and `tsup.config.ts` adds no `#!/usr/bin/env node` banner, so `dist/index.js` can't yet be invoked as a command. Out of scope for the scaffold; CLI entry wiring belongs to later Epic 1 stories (notably 1.8, end-to-end strict single-shot run). Revisit when the `cli/` shell is implemented.
- **`shared/ui.ts` will collide with the `no-console` rule** — the ESLint config applies `no-console: error` to `src/shared/**`, but the architecture designates `src/shared/ui.ts` as the single human-output writer to stderr. When `ui.ts` lands, implement it with `process.stderr.write` (idiomatic, avoids the rule) or add a narrowly-scoped override for that one file. Address in the story that introduces `ui.ts`.
- **Root config files escape `tsc` typecheck** — `tsconfig.json` `include: ["src"]` excludes `tsup.config.ts`, `vitest.config.ts`, and `eslint.config.js`, so type errors in build/test/lint config are never caught by `tsc --noEmit`. Minor; consider a dedicated config-typecheck pass (e.g. a second tsconfig) in a later tooling/CI story.
