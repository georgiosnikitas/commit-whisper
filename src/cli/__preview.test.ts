import { test, expect } from "vitest";
import { formatStatusReport } from "./interactive.js";

test("preview", () => {
  const state = {
    tier: "free",
    provider: "anthropic",
    llmModel: undefined,
    isRepo: true,
    cwdLabel: "~/Workspace/commit-whisper",
    branch: "main",
    licensed: false,
  } as never;
  const env = [
    { name: "ANTHROPIC_API_KEY", set: false },
    { name: "COMMIT_WHISPER_GIT_TOKEN", set: false, note: "only needed for private remotes" },
  ];
  const report = formatStatusReport(state, env, {
    kind: "unreachable",
    reason: "No API key configured (set ANTHROPIC_API_KEY).",
  });
  process.stdout.write("\nPREVIEW_START\n" + report + "\nPREVIEW_END\n");
  // The report must reflect its inputs: the configured provider and the env-var name.
  expect(report).toContain("anthropic");
  expect(report).toContain("ANTHROPIC_API_KEY");
});
