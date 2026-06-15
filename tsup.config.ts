import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  // Make the published `dist/index.js` a runnable CLI (the npm `bin` target).
  banner: { js: "#!/usr/bin/env node" },
});
