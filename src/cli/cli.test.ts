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
      env: { COMMIT_WHISPER_GIT_TOKEN: "ghp_tok" },
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
  it("a missing required input exits 3, names the missing config, and points to bare commit-whisper", async () => {
    const r = recorder();
    const code = await main(["--ai"], { ...BASE, ui: r.ui }); // required ⇒ provider/model required, none set
    expect(code).toBe(ExitCode.MissingInput);
    const joined = r.errors.join(" ");
    expect(joined).toContain("Required configuration");
    expect(joined).toContain("Run `commit-whisper` with no arguments for guided setup.");
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
      env: { COMMIT_WHISPER_PROVIDER: "ollama", COMMIT_WHISPER_LLM_MODEL: "llama3" },
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
      env: { COMMIT_WHISPER_GIT_TOKEN: "ghp_tok" },
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
      env: { COMMIT_WHISPER_PROVIDER: "openai", COMMIT_WHISPER_LLM_MODEL: "gpt-4o" },
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
      env: { COMMIT_WHISPER_PROVIDER: "openai", COMMIT_WHISPER_LLM_MODEL: "gpt-4o" },
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    const names = (lp.calls[0]!.envDiagnostics ?? []).map((d) => d.name);
    expect(names).toContain("OPENAI_API_KEY");
    expect(names).toContain("COMMIT_WHISPER_GIT_TOKEN");
    expect(typeof lp.calls[0]!.probeReachability).toBe("function");
  });

  it("the wired reachability probe maps the injected preflight result (Story 6.3)", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_WHISPER_PROVIDER: "ollama", COMMIT_WHISPER_LLM_MODEL: "llama3" },
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

describe("main — operational flags (Story 6.4)", () => {
  it("--show-config dumps the resolved config to stdout and exits 0 WITHOUT running", async () => {
    const r = recorder();
    const cap = captureRun();
    const code = await main([".", "--show-config", "--max-commits", "5"], {
      ...BASE,
      ui: r.ui,
      run: cap.run,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Success);
    expect(cap.calls).toHaveLength(0); // pipeline never invoked
    const out = r.stdout.join("");
    expect(out).toContain("resolved configuration");
    expect(out).toContain("maxCommits = 5  (flag)");
  });

  it("--show-config renders a secret env value as *** (never the value)", async () => {
    const r = recorder();
    const code = await main([".", "--show-config", "--provider", "openai", "--model", "gpt-4o"], {
      ...BASE,
      env: { OPENAI_API_KEY: "sk-supersecret" },
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Success);
    const out = r.stdout.join("");
    expect(out).toContain("aiKey = ***");
    expect(out).not.toContain("sk-supersecret");
  });

  it("--show-config still dumps when a required field is missing (lenient — the debugging case)", async () => {
    const r = recorder();
    const cap = captureRun();
    // `--ai` makes provider/model required; with none set a normal run throws exit 3.
    const code = await main([".", "--show-config", "--ai"], {
      ...BASE,
      env: {},
      ui: r.ui,
      run: cap.run,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Success); // dumps, does not throw
    expect(cap.calls).toHaveLength(0);
    const out = r.stdout.join("");
    expect(out).toContain("aiMode = required  (flag)");
    expect(out).toContain("provider = (unset)");
  });

  it("--version prints and exits 0 without running", async () => {
    const cap = captureRun();
    const code = await main(["--version"], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(code).toBe(ExitCode.Success);
    expect(cap.calls).toHaveLength(0);
  });

  it("--non-interactive runs headless single-shot (gate closed, aiMode defaults off, no auto-open)", async () => {
    const cap = captureRun();
    const code = await main(["--non-interactive", "."], { ...BASE, ui: recorder().ui, run: cap.run });
    expect(code).toBe(ExitCode.Success);
    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0]!.config.aiMode).toBe("off"); // headless default
    expect(cap.calls[0]!.deps.autoOpen).toBe(false);
  });

  it("--quiet and --verbose are accepted and still run (exit 0)", async () => {
    const cap = captureRun();
    expect(await main([".", "--no-ai", "--quiet"], { ...BASE, ui: recorder().ui, run: cap.run })).toBe(
      ExitCode.Success,
    );
    expect(await main([".", "--no-ai", "--verbose"], { ...BASE, ui: recorder().ui, run: cap.run })).toBe(
      ExitCode.Success,
    );
  });
});

describe("main — Settings config-file layer (Story 6.5)", () => {
  it("a saved setting flows into the resolved config at configFile provenance", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], {
      ...BASE,
      configFile: { maxCommits: 25, timezone: "Europe/Athens" },
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.config.maxCommits).toBe(25);
    expect(cap.calls[0]!.config.provenance.maxCommits).toBe("configFile");
    expect(cap.calls[0]!.config.timezone).toBe("Europe/Athens");
    expect(cap.calls[0]!.config.provenance.timezone).toBe("configFile");
  });

  it("an env var overrides a saved setting (config < env)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], {
      ...BASE,
      env: { COMMIT_WHISPER_MAX_COMMITS: "99" },
      configFile: { maxCommits: 25 },
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.config.maxCommits).toBe(99);
    expect(cap.calls[0]!.config.provenance.maxCommits).toBe("env");
  });

  it("a flag overrides both a saved setting and an env var (config < env < flag)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai", "--max-commits", "7"], {
      ...BASE,
      env: { COMMIT_WHISPER_MAX_COMMITS: "99" },
      configFile: { maxCommits: 25 },
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.config.maxCommits).toBe(7);
    expect(cap.calls[0]!.config.provenance.maxCommits).toBe("flag");
  });

  it("--show-config reflects a saved setting with configFile provenance", async () => {
    const r = recorder();
    await main([".", "--show-config"], {
      ...BASE,
      configFile: { provider: "ollama", llmModel: "llama3" },
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    const out = r.stdout.join("");
    expect(out).toContain("provider = ollama  (configFile)");
    expect(out).toContain("llmModel = llama3  (configFile)");
  });

  it("a saved ollama provider shows in the 0-arg launchpad header (cures the no-AI state)", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      configFile: { provider: "ollama", llmModel: "llama3" },
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    expect(lp.calls[0]!.state.provider).toBe("ollama");
    expect(lp.calls[0]!.state.llmModel).toBe("llama3");
    expect(typeof lp.calls[0]!.saveSettings).toBe("function");
    expect(typeof lp.calls[0]!.loadSettings).toBe("function");
  });

  it("an env provider still beats a saved provider in the header (config < env)", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_WHISPER_PROVIDER: "openai", COMMIT_WHISPER_LLM_MODEL: "gpt-4o" },
      configFile: { provider: "ollama", llmModel: "llama3" },
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    expect(lp.calls[0]!.state.provider).toBe("openai");
    expect(lp.calls[0]!.state.llmModel).toBe("gpt-4o");
  });
});

describe("main — license entitlement gate (Story 7.1)", () => {
  it("the default (no key) resolves the Free entitlement with the 100-commit cap (no network)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], { ...BASE, env: {}, ui: recorder().ui, run: cap.run });
    expect(cap.calls[0]!.config.entitlement).toEqual({ tier: "free", commitCap: 100 });
  });

  it("an injected entitlement flows into the resolved RunConfig (paid tier, no cap)", async () => {
    const cap = captureRun();
    await main([".", "--no-ai"], {
      ...BASE,
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "unlimited" } }),
      ui: recorder().ui,
      run: cap.run,
    });
    expect(cap.calls[0]!.config.entitlement).toEqual({ tier: "unlimited" });
  });

  it("--show-config reflects the resolved tier", async () => {
    const r = recorder();
    await main([".", "--show-config"], {
      ...BASE,
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "single-device" } }),
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(r.stdout.join("")).toContain("tier = single-device");
  });

  it("a paid entitlement makes the 0-arg launchpad header show the real tier + licensed", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "single-device" } }),
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    expect(lp.calls[0]!.state.tier).toBe("single-device");
    expect(lp.calls[0]!.state.licensed).toBe(true);
  });

  it("the license key never appears in a --show-config dump", async () => {
    const r = recorder();
    await main([".", "--show-config"], {
      ...BASE,
      env: { COMMIT_WHISPER_LICENSE_KEY: "LIC-SUPERSECRET" },
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "unlimited" } }),
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(r.stdout.join("")).not.toContain("LIC-SUPERSECRET");
  });
});

describe("main — fail-closed vs degrade-to-Free (Story 7.3)", () => {
  it("a headless run with an unverified license FAILS CLOSED (exit 8, pipeline never runs) (AC1)", async () => {
    const cap = captureRun();
    const r = recorder();
    const code = await main([".", "--no-ai"], {
      ...BASE,
      resolveEntitlement: async () => ({ kind: "unverified", reason: "license revoked" }),
      ui: r.ui,
      run: cap.run,
    });
    expect(code).toBe(ExitCode.License);
    expect(cap.calls).toHaveLength(0); // no analysis, no rendering
  });

  it("the fail-closed message names the license + COMMIT_WHISPER_LICENSE_KEY (validate-not-activate) (AC1)", async () => {
    const r = recorder();
    await main([".", "--no-ai"], {
      ...BASE,
      resolveEntitlement: async () => ({ kind: "unverified", reason: "server unreachable" }),
      ui: r.ui,
      run: captureRun().run,
    });
    const errorText = r.errors.join("\n");
    expect(errorText).toContain("server unreachable");
    expect(errorText).toContain("COMMIT_WHISPER_LICENSE_KEY");
    expect(errorText.toLowerCase()).toContain("validat");
  });

  it("--show-config stays lenient on an unverified license — dumps tier = free, no fail-closed (AC1 carve-out)", async () => {
    const r = recorder();
    const code = await main([".", "--show-config"], {
      ...BASE,
      resolveEntitlement: async () => ({ kind: "unverified", reason: "transient" }),
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Success);
    expect(r.stdout.join("")).toContain("tier = free");
  });

  it("an interactive run with an unverified license DEGRADES to Free + warns, never refusing (AC2)", async () => {
    const lp = captureLaunchpad();
    const r = recorder();
    const code = await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      resolveEntitlement: async () => ({ kind: "unverified", reason: "offline" }),
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
      ui: r.ui,
    });
    expect(code).toBe(ExitCode.Success);
    expect(lp.calls[0]!.state.tier).toBe("free");
    expect(lp.calls[0]!.state.licensed).toBe(false);
    expect(r.warns.join("\n")).toContain("Free");
  });

  it("the headless run never constructs / calls an activator (CI validates, never activates) (AC1)", async () => {
    const activatorCalls: string[] = [];
    const cap = captureRun();
    await main([".", "--no-ai"], {
      ...BASE,
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "unlimited" } }),
      activateLicense: async (_env, key) => {
        activatorCalls.push(key);
        return { ok: true, tier: "single-device" };
      },
      ui: recorder().ui,
      run: cap.run,
    });
    expect(activatorCalls).toHaveLength(0); // the headless path validates, it never activates
    expect(cap.calls).toHaveLength(1); // the resolved (paid) run proceeds
  });
});

describe("main — license actions wiring (Story 7.2)", () => {
  it("the 0-arg launchpad receives activate / deactivate / openUrl + the store/coffee URLs", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "free", commitCap: 100 } }),
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    expect(typeof lp.calls[0]!.activateLicense).toBe("function");
    expect(typeof lp.calls[0]!.deactivateLicense).toBe("function");
    expect(typeof lp.calls[0]!.openUrl).toBe("function");
  });

  it("the wired activate closure delegates to the injected action", async () => {
    const lp = captureLaunchpad();
    const calls: { key: string }[] = [];
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "free", commitCap: 100 } }),
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
      activateLicense: async (_env, key) => {
        calls.push({ key });
        return { ok: true, tier: "single-device" };
      },
    });
    const outcome = await lp.calls[0]!.activateLicense!("LIC-XYZ");
    expect(calls).toEqual([{ key: "LIC-XYZ" }]);
    expect(outcome).toEqual({ ok: true, tier: "single-device" });
  });

  it("a COMMIT_WHISPER_STORE_URL override flows into the launchpad storeUrl", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_WHISPER_STORE_URL: "https://my.store/buy" },
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "free", commitCap: 100 } }),
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    expect(lp.calls[0]!.storeUrl).toBe("https://my.store/buy");
  });

  it("a COMMIT_WHISPER_RESTORE_URL override flows into the launchpad restoreUrl", async () => {
    const lp = captureLaunchpad();
    await main([], {
      ...BASE,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { COMMIT_WHISPER_RESTORE_URL: "https://my.orders/x" },
      resolveEntitlement: async () => ({ kind: "resolved", entitlement: { tier: "free", commitCap: 100 } }),
      gitRunner: repoRunner,
      launchpad: lp.launchpad,
    });
    expect(lp.calls[0]!.restoreUrl).toBe("https://my.orders/x");
  });
});



