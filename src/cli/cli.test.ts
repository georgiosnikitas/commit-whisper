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

describe("main — commit-selection flags (Story 2.6)", () => {
  it("resolves --no-merges / --max-commits / --author / --since / --until into the config", async () => {
    const cap = captureRun();
    await main(
      [".", "--no-ai", "--no-merges", "--max-commits", "100", "--author", "alice", "--since", "2024-01-01", "--until", "2024-12-31"],
      { ...BASE, ui: recorder().ui, run: cap.run },
    );
    const config = cap.calls[0]!.config;
    expect(config.noMerges).toBe(true);
    expect(config.maxCommits).toBe(100);
    expect(config.authorFilter).toBe("alice");
    expect(config.startDate).toBe("2024-01-01");
    expect(config.endDate).toBe("2024-12-31");
  });

  it("leaves noMerges at its default (false) when --no-merges is absent", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.config.noMerges).toBe(false);
  });

  it("rejects a non-positive-integer --max-commits with a usage error (exit 2)", async () => {
    const r = recorder();
    const code = await main([".", "--no-ai", "--max-commits", "0"], { ...BASE, ui: r.ui });
    expect(code).toBe(ExitCode.Usage);
    expect(r.errors.join(" ")).toContain("max-commits");
  });

  it("rejects a non-decimal --max-commits (hex / scientific) with a usage error", async () => {
    const r = recorder();
    expect(await main([".", "--no-ai", "--max-commits", "0x10"], { ...BASE, ui: r.ui })).toBe(ExitCode.Usage);
    expect(await main([".", "--no-ai", "--max-commits", "1e3"], { ...BASE, ui: recorder().ui })).toBe(ExitCode.Usage);
  });

  it("rejects a malformed --since / --until date with a usage error", async () => {
    const r = recorder();
    const code = await main([".", "--no-ai", "--since", "2024-03"], { ...BASE, ui: r.ui }); // partial, not YYYY-MM-DD
    expect(code).toBe(ExitCode.Usage);
    expect(r.errors.join(" ")).toContain("--since");
  });

  it("accepts a well-formed --since date (and a full ISO timestamp)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--since", "2024-01-01", "--until", "2024-12-31T23:59:59Z"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.config.startDate).toBe("2024-01-01");
    expect(cap.calls[0]!.config.endDate).toBe("2024-12-31T23:59:59Z");
  });
});

describe("main — output format flags (Story 4.4)", () => {
  it("resolves --format json,html and --output into the config", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--format", "json", "--output", "report.json"], { ...BASE, ui: recorder().ui, run: cap.run });
    const config = cap.calls[0]!.config;
    expect(config.outputFormats).toEqual(["json"]);
    expect(config.outputPath).toBe("report.json");
  });

  it("parses a comma-separated --format list, de-duped and order-preserving", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--format", "terminal,html,json,html"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.config.outputFormats).toEqual(["terminal", "html", "json"]);
  });

  it("accepts -o as the --output alias and '-' for stdout", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--format", "json", "-o", "-"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.config.outputPath).toBe("-");
  });

  it("defaults outputFormats to ['terminal'] when --format is absent", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.config.outputFormats).toEqual(["terminal"]);
  });

  it("rejects an unknown --format token with a usage error naming the valid set", async () => {
    const r = recorder();
    const code = await main([".", "--no-ai", "--format", "bogus"], { ...BASE, ui: r.ui });
    expect(code).toBe(ExitCode.Usage);
    expect(r.errors.join(" ")).toContain("Unknown format");
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
