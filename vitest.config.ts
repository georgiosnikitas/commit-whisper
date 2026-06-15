import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // `lcov` feeds SonarCloud (sonar.javascript.lcov.reportPaths); `text-summary`
      // prints the totals in the CI log.
      reporter: ["text-summary", "lcov"],
      include: ["src/**"],
      exclude: ["src/**/*.test.ts", "src/**/sample-history.ts"],
    },
  },
});
