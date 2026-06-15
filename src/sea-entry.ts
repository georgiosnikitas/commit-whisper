/**
 * The SEA (Single Executable Application) bundle entry (Story 7.4).
 *
 * A dedicated CJS-friendly sibling of `index.ts`: esbuild forbids top-level
 * await in `cjs` output and a Node SEA `main` must be CommonJS, so this shim
 * uses `.then(...)` instead of the ESM entry's top-level await. It delegates to
 * the SAME `main` — there is no second code path through the product.
 *
 * `process.argv.slice(2)` is correct here, exactly as in `index.ts`: modern Node
 * SEA (the Node 22 target) normalizes a packaged binary's argv to
 * `[execPath, execPath, ...userArgs]` (argv[1] is present), so the user's args
 * start at index 2 in BOTH the packaged binary and a `node …commit-whisper.cjs`
 * dry-run. (Early/pre-20 SEA omitted argv[1]; we target Node 22, so this holds.)
 */

import { main } from "./cli/cli.js";

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  () => process.exit(1),
);


