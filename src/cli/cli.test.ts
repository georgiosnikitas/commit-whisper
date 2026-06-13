import { describe, it, expect } from "vitest";

import { main, type CliDeps } from "./cli.js";
import { ExitCode } from "./exit-codes.js";
import type { RunConfig } from "../config/run-config.js";
import type { RunDeps } from "./run.js";
import type { Ui } from "../shared/ui.js";

function recorder() {
  const errors: string[] = [];
  const infos: string[] = [];
  const warns: string[] = [];
  const stdout: string[] = [];
  const ui: Ui = {
    error: (m) => errors.push(m),
    warn: (m) => warns.push(m),
    info: (m) => infos.push(m),
    plain: () => {},
  };
  return { errors, infos, warns, stdout, ui, writeStdout: (s: string) => stdout.push(s) };
}

function captureRun() {
  const calls: { config: RunConfig; deps: RunDeps }[] = [];
  const run = async (config: RunConfig, deps: RunDeps = {}): Promise<number> => {
    calls.push({ config, deps });
    return ExitCode.Success;
  };
  return { calls, run };
}

const BASE: CliDeps = {
  cwd: "/repo",
  env: {},
  stdinIsTTY: false,
  stdoutIsTTY: false,
  analysisTimestamp: "2026-01-01T00:00:00.000Z",
};

describe("main — strict single-shot wiring", () => {
  it("--no-ai resolves aiMode=off and runs single-shot, exit 0", async () => {
    const r = recorder();
    const cap = captureRun();
    const code = await main([".", "--no-ai"], { ...BASE, ui: r.ui, run: cap.run, writeStdout: r.writeStdout });
    expect(code).toBe(ExitCode.Success);
    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0]!.config.aiMode).toBe("off");
    expect(cap.calls[0]!.config.repoTarget).toBe(".");
  });

  it("injects the resolved clock (never reads it inside the pipeline)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.config.analysisTimestamp).toBe("2026-01-01T00:00:00.000Z");
  });

  it("reads the env-only LLM key and injects it into the pipeline deps", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--provider", "gemini", "--model", "m"], {
      ...BASE,
      env: { GEMINI_API_KEY: "secret-key" },
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.deps.aiKey?.reveal()).toBe("secret-key");
  });
});

describe("main — AC4: hard-fail names the gap and redirects", () => {
  it("a missing required input exits 3, names the missing config, and points to bare commit-sage", async () => {
    const r = recorder();
    const code = await main(["--ai"], { ...BASE, ui: r.ui }); // required ⇒ provider/model required, none set
    expect(code).toBe(ExitCode.MissingInput);
    const joined = r.errors.join(" ");
    expect(joined).toContain("Required configuration");
    expect(joined).toContain("Run `commit-sage` with no arguments for guided setup.");
  });
});

describe("main — usage errors (exit 2)", () => {
  it("an unknown flag exits 2", async () => {
    const r = recorder();
    expect(await main(["--bogus"], { ...BASE, ui: r.ui })).toBe(ExitCode.Usage);
  });

  it("an unknown provider exits 2", async () => {
    const r = recorder();
    const code = await main([".", "--ai", "--provider", "bogus"], { ...BASE, ui: r.ui });
    expect(code).toBe(ExitCode.Usage);
    expect(r.errors.join(" ")).toContain("Unknown provider");
  });

  it("a bare invocation (0 args) reports usage and points at guided setup", async () => {
    const r = recorder();
    const code = await main([], { ...BASE, ui: r.ui });
    expect(code).toBe(ExitCode.Usage);
    expect(r.infos.join(" ")).toContain("guided setup");
  });
});
