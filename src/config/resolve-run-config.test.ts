import { describe, it, expect } from "vitest";

import { resolveRunConfig, type ResolveInput } from "./resolve-run-config.js";
import { MissingRequiredConfigError } from "../shared/errors.js";

const TS = "2026-06-13T00:00:00.000Z";

/** A headless (non-TTY, non-CI) base input; override per case. */
function headless(overrides: Partial<ResolveInput> = {}): ResolveInput {
  return {
    cwd: "/repo",
    env: {},
    stdinIsTTY: undefined,
    stdoutIsTTY: undefined,
    nonInteractive: false,
    analysisTimestamp: TS,
    ...overrides,
  };
}

describe("resolveRunConfig — end to end", () => {
  it("produces a frozen metrics-only config headless (aiMode off by channel default)", () => {
    const cfg = resolveRunConfig(headless());
    expect(cfg.aiMode).toBe("off");
    expect(cfg.provenance.aiMode).toBe("default");
    expect(cfg.repoTarget).toBe("/repo");
    expect(cfg.provenance.repoTarget).toBe("default");
    expect(cfg.timezone).toBe("UTC");
    expect(cfg.entitlement).toEqual({ tier: "free", commitCap: 100 });
    expect(cfg.analysisTimestamp).toBe(TS);
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it("applies the interactive channel default aiMode=auto when no layer sets it", () => {
    const cfg = resolveRunConfig(
      headless({
        stdinIsTTY: true,
        stdoutIsTTY: true,
        flags: { provider: "openai", llmModel: "gpt-5" },
      }),
    );
    expect(cfg.aiMode).toBe("auto");
    expect(cfg.provenance.aiMode).toBe("default");
    expect(cfg.provider).toBe("openai");
    expect(cfg.provenance.provider).toBe("flag");
  });

  it("honors full precedence defaults -> configFile -> env -> flags", () => {
    const cfg = resolveRunConfig(
      headless({
        env: { COMMIT_SAGE_TZ: "America/New_York", COMMIT_SAGE_AUTHOR: "env-alice" },
        configFile: { timezone: "Europe/Athens", authorFilter: "cfg-bob", maxCommits: 10 },
        flags: { timezone: "Asia/Tokyo" },
      }),
    );
    expect(cfg.timezone).toBe("Asia/Tokyo");
    expect(cfg.provenance.timezone).toBe("flag");
    expect(cfg.authorFilter).toBe("env-alice");
    expect(cfg.provenance.authorFilter).toBe("env");
    expect(cfg.maxCommits).toBe(10);
    expect(cfg.provenance.maxCommits).toBe("configFile");
  });

  it("forces headless when nonInteractive even with TTYs present", () => {
    const cfg = resolveRunConfig(headless({ stdinIsTTY: true, stdoutIsTTY: true, nonInteractive: true }));
    expect(cfg.aiMode).toBe("off");
  });

  it("forces headless under CI even with TTYs present", () => {
    const cfg = resolveRunConfig(
      headless({ stdinIsTTY: true, stdoutIsTTY: true, env: { CI: "true" } }),
    );
    expect(cfg.aiMode).toBe("off");
  });

  it("throws a typed exit-3 error when AI is requested headless without a provider", () => {
    expect(() => resolveRunConfig(headless({ env: { COMMIT_SAGE_AI_MODE: "required" } }))).toThrow(
      MissingRequiredConfigError,
    );
    try {
      resolveRunConfig(headless({ env: { COMMIT_SAGE_AI_MODE: "required" } }));
      expect.unreachable();
    } catch (e) {
      expect((e as MissingRequiredConfigError).exitCode).toBe(3);
      expect((e as MissingRequiredConfigError).field).toBe("provider");
    }
  });

  it("passes through an injected entitlement (license gate stand-in)", () => {
    const cfg = resolveRunConfig(headless({ entitlement: { tier: "unlimited" } }));
    expect(cfg.entitlement).toEqual({ tier: "unlimited" });
  });

  it("reads the env layer (a COMMIT_SAGE_* var lands with env provenance)", () => {
    const cfg = resolveRunConfig(headless({ env: { COMMIT_SAGE_MAX_COMMITS: "42" } }));
    expect(cfg.maxCommits).toBe(42);
    expect(cfg.provenance.maxCommits).toBe("env");
  });
});
