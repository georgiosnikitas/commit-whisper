/**
 * commit-whisper entrypoint (Story 1.8).
 *
 * The ONLY top-level await in the codebase: bootstrap the CLI shell and exit
 * with its resolved code. All logic lives in `cli/cli.ts` (`main`), which is
 * unit-tested directly — this file is the thin executable shim and has no
 * co-located test (importing it would run the CLI and exit the process).
 */

import { main } from "./cli/cli.js";

process.exit(await main(process.argv.slice(2)));
