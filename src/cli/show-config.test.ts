import { describe, it, expect } from "vitest";

import { formatShowConfig } from "./show-config.js";
import { resolveRunConfig } from "../config/resolve-run-config.js";
import type { PartialRunConfig } from "../config/run-config.js";
import { Secret } from "../shared/secret.js";

function makeConfig(flags: PartialRunConfig, env: NodeJS.ProcessEnv = {}) {
  return resolveRunConfig({
    cwd: "/repo",
    env,
    stdinIsTTY: false,
    stdoutIsTTY: false,
    nonInteractive: true,
    analysisTimestamp: "2026-01-01T00:00:00.000Z",
    flags,
  });
}

describe("formatShowConfig", () => {
  it("renders each field with its value and provenance source", () => {
    const config = makeConfig({ repoTarget: "/r", maxCommits: 50, provider: "openai", llmModel: "gpt-4o" });
    const out = formatShowConfig(config, {});
    expect(out).toContain("repoTarget = /r  (flag)");
    expect(out).toContain("maxCommits = 50  (flag)");
    expect(out).toContain("provider = openai  (flag)");
    expect(out).toContain("timezone = UTC  (default)");
  });

  it("renders the branch sentinel by kind and arrays comma-joined", () => {
    const config = makeConfig({ branch: { kind: "all" }, outputFormats: ["terminal", "html"] });
    const out = formatShowConfig(config, {});
    expect(out).toContain("branch = all  (flag)");
    expect(out).toContain("outputFormats = terminal,html  (flag)");
  });

  it("shows (unset) for optional fields that were never supplied", () => {
    const out = formatShowConfig(makeConfig({}), {});
    expect(out).toContain("authorFilter = (unset)");
    expect(out).toContain("startDate = (unset)");
  });

  it("includes the injected resolved fields (timestamp, tier, cap)", () => {
    const out = formatShowConfig(makeConfig({}), {});
    expect(out).toContain("analysisTimestamp = 2026-01-01T00:00:00.000Z");
    expect(out).toContain("tier = free");
    expect(out).toContain("commitCap = 100");
  });

  it("renders secrets as *** when present and (unset) when absent — never the value", () => {
    const out = formatShowConfig(makeConfig({}), { aiKey: new Secret("sk-supersecret") });
    expect(out).toContain("aiKey = ***  (env)");
    expect(out).toContain("gitPat = (unset)  (env)");
    expect(out).not.toContain("sk-supersecret");
  });

  it("is deterministic (stable field order)", () => {
    const config = makeConfig({ repoTarget: "/r" });
    expect(formatShowConfig(config, {})).toBe(formatShowConfig(config, {}));
  });
});
