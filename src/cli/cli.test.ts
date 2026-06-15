import { describe, it, expect } from "vitest";

import { main, type CliDeps } from "./cli.js";
import { ExitCode } from "./exit-codes.js";
import type { RunConfig } from "../config/run-config.js";
import type { GitRunner } from "../retrieve/git.js";
import type { LaunchpadDeps, LaunchpadState } from "./interactive.js";
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

function captureLaunchpad() {
  const calls: LaunchpadDeps[] = [];
  const launchpad = async (deps: LaunchpadDeps): Promise<number> => {
    calls.push(deps);
    return ExitCode.Success;
  };
  return { calls, launchpad };
}

/** A fake git for the launchpad header: a work tree on branch `feature-x`. */
const repoRunner: GitRunner = async (args) =>
  args.join(" ") === "rev-parse --is-inside-work-tree" ? "true\n" : "feature-x\n";

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

  it("reads the env-only git PAT into the pipeline deps (Story 5.2)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], {
      ...BASE,
      env: { COMMIT_SAGE_GIT_TOKEN: "ghp_tok" },
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.deps.gitToken?.reveal()).toBe("ghp_tok");
  });

  it("a run with no git token still succeeds — absence is never an error (Story 5.2)", async () => {
    const cap = captureRun();
    const code = await main([".", "--no-ai"], { ...BASE, env: {}, ui: recorder().ui, run: cap.run });
    expect(code).toBe(ExitCode.Success);
    expect(cap.calls[0]!.deps.gitToken).toBeUndefined();
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

describe("main — HTML auto-open decision (Story 4.5)", () => {
  it("strict single-shot is non-interactive → autoOpen is false even for --format html", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--format", "html"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.deps.autoOpen).toBe(false); // AC3: headless never auto-opens
  });

  it("--no-open keeps autoOpen false (even were the terminal interactive)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--format", "html", "--no-open"], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.deps.autoOpen).toBe(false); // AC2: --no-open suppresses
  });

  it("an interactive TTY without --no-open would enable autoOpen — but single-shot forces non-interactive", async () => {
    // STRICT single-shot passes nonInteractive: true, so even a TTY resolves to
    // autoOpen=false. The live interactive path (autoOpen=true) is the Epic 6 menu.
    const cap = captureRun();
    await main([".", "--no-ai", "--format", "html"], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.deps.autoOpen).toBe(false);
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

  it("a bare invocation (0 args) in a non-interactive context fails fast (exit 2), naming the fix", async () => {
    const r = recorder();
    const code = await main([], { ...BASE, ui: r.ui });
    expect(code).toBe(ExitCode.Usage);
    expect(r.errors.join(" ")).toContain("interactive terminal");
  });
});

describe("main — zero-arg launchpad (Story 6.1)", () => {
  it("0 args + non-interactive (non-TTY/CI) never opens the launchpad", async () => {
    const r = recorder();
    const lp = captureLaunchpad();
    const code = await main([], { ...BASE, ui: r.ui, launchpad: lp.launchpad });
    expect(code).toBe(ExitCode.Usage);
    expect(lp.calls).toHaveLength(0);
  });

  it("0 args + interactive TTY opens the launchpad with the env-resolved header state", async () => {
    const lp = captureLaunchpad();
    const code = await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_SAGE_PROVIDER: "ollama", COMMIT_SAGE_LLM_MODEL: "llama3" },
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    expect(code).toBe(ExitCode.Success);
    expect(lp.calls).toHaveLength(1);
    const state: LaunchpadState = lp.calls[0]!.state;
    expect(state.provider).toBe("ollama");
    expect(state.llmModel).toBe("llama3");
    expect(state.branch).toBe("feature-x");
    expect(state.isRepo).toBe(true);
    expect(state.tier).toBe("free");
    expect(state.licensed).toBe(false);
    expect(lp.calls[0]!.helpText.length).toBeGreaterThan(0);
  });

  it("wires a guided-run executor and the git-token presence flag into the launchpad (Story 6.2)", async () => {
    const withToken = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_SAGE_GIT_TOKEN: "ghp_tok" },
      gitRunner: repoRunner,
      launchpad: withToken.launchpad,
    });
    expect(typeof withToken.calls[0]!.runAnalysis).toBe("function");
    expect(withToken.calls[0]!.gitTokenConfigured).toBe(true);

    const noToken = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      gitRunner: repoRunner,
      launchpad: noToken.launchpad,
    });
    expect(noToken.calls[0]!.gitTokenConfigured).toBe(false);
  });

  it("the wired guided executor resolves aiMode=auto and runs the pipeline with the collected flags", async () => {
    const lp = captureLaunchpad();
    const cap = captureRun();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_SAGE_PROVIDER: "openai", COMMIT_SAGE_LLM_MODEL: "gpt-4o" },
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
      run: cap.run,
    });
    const code = await lp.calls[0]!.runAnalysis!({ repoTarget: ".", maxCommits: 7 });
    expect(code).toBe(ExitCode.Success);
    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0]!.config.aiMode).toBe("auto"); // interactive default
    expect(cap.calls[0]!.config.maxCommits).toBe(7);
    expect(cap.calls[0]!.config.repoTarget).toBe(".");
  });

  it("a guided run with no AI configured surfaces the typed error gracefully (no throw, back to menu)", async () => {
    const r = recorder();
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {}, // interactive ⇒ aiMode auto ⇒ provider/model required ⇒ MissingRequiredConfigError
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
      ui: r.ui,
    });
    const code = await lp.calls[0]!.runAnalysis!({ repoTarget: "." });
    expect(code).toBe(ExitCode.MissingInput); // caught, named, not thrown into the menu
    expect(r.errors.join(" ")).toContain("Required configuration");
  });

  it("wires Status/doctor diagnostics (env-var names) + a reachability probe into the launchpad (Story 6.3)", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_SAGE_PROVIDER: "openai", COMMIT_SAGE_LLM_MODEL: "gpt-4o" },
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    const names = (lp.calls[0]!.envDiagnostics ?? []).map((d) => d.name);
    expect(names).toContain("OPENAI_API_KEY");
    expect(names).toContain("COMMIT_SAGE_GIT_TOKEN");
    expect(typeof lp.calls[0]!.probeReachability).toBe("function");
  });

  it("the wired reachability probe maps the injected preflight result (Story 6.3)", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_SAGE_PROVIDER: "ollama", COMMIT_SAGE_LLM_MODEL: "llama3" },
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
      preflight: async () => ({ reachable: false, reason: "Ollama responded with HTTP 500." }),
    });
    expect(await lp.calls[0]!.probeReachability!()).toEqual({
      kind: "unreachable",
      reason: "Ollama responded with HTTP 500.",
    });
  });

  it("a CI env is non-interactive even at a TTY — 0 args fails fast and skips the launchpad", async () => {
    const lp = captureLaunchpad();
    const code = await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { CI: "true" },
      ui: recorder().ui,
      launchpad: lp.launchpad,
    });
    expect(code).toBe(ExitCode.Usage);
    expect(lp.calls).toHaveLength(0);
  });
});
