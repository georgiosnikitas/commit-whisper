import { defineConfig } from "tsup";

/**
 * The SEA (Single Executable Application) bundle build (Story 7.4).
 *
 * Distinct from `tsup.config.ts` (the ESM `dist/index.js`, the npm/library
 * entry, which is UNCHANGED). This emits ONE self-contained CommonJS file with
 * EVERY third-party dependency inlined (a catch-all `noExternal`) so a Node SEA
 * blob has no runtime `require` of `node_modules`. Node builtins stay external —
 * the packaged `node` provides them. The whole dependency set is pure JavaScript
 * (no native addons), and git is a `git` shell-out, so it all bundles cleanly.
 */
export default defineConfig({
  entry: { "commit-sage": "src/sea-entry.ts" },
  format: ["cjs"],
  target: "node22",
  platform: "node",
  outDir: "dist-sea",
  clean: true,
  sourcemap: false,
  dts: false,
  // Inline ALL third-party deps into the single file; node: builtins stay external.
  noExternal: [/.*/],
});
