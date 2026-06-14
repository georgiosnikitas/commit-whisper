import { Writable } from "node:stream";

import { describe, it, expect } from "vitest";

import {
  buildLaunchpadOptions,
  FLAGS_CHEATSHEET,
  formatEquivalentCommand,
  formatReadinessLine,
  interpretDateRange,
  interpretLimit,
  LAUNCHPAD_TAGLINE,
  runLaunchpad,
  type GuidedPrompts,
  type LaunchpadAction,
  type LaunchpadDeps,
  type LaunchpadSelect,
  type LaunchpadState,
} from "./interactive.js";
import type { OutputFormat, PartialRunConfig } from "../config/run-config.js";
import { ExitCode } from "./exit-codes.js";

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  return { stream, text: (): string => chunks.join("") };
}

/** A scripted menu primitive: returns each answer in turn, then cancels (so the loop always ends). */
function scriptedSelect(script: (LaunchpadAction | null)[]) {
  let i = 0;
  const select: LaunchpadSelect = async () => (i < script.length ? script[i++] : null);
  return { select, calls: (): number => i };
}

const FREE_CONFIGURED: LaunchpadState = {
  tier: "free",
  licensed: false,
  provider: "ollama",
  llmModel: "llama3",
  cwdLabel: "~/work/payments-api",
  isRepo: true,
  branch: "main",
};

describe("formatReadinessLine (AC2)", () => {
  it("shows tier · configured AI (provider + model) · cwd (branch)", () => {
    expect(formatReadinessLine(FREE_CONFIGURED)).toBe(
      "Free · AI: ollama (llama3) · cwd: ~/work/payments-api (main)",
    );
  });

  it("flags AI as not configured when no provider is set", () => {
    const line = formatReadinessLine({ ...FREE_CONFIGURED, provider: undefined, llmModel: undefined });
    expect(line).toContain("AI: ⚠ not configured");
  });

  it("shows the provider alone when a model is not set", () => {
    const line = formatReadinessLine({ ...FREE_CONFIGURED, provider: "openai", llmModel: undefined });
    expect(line).toContain("AI: openai ·");
    expect(line).not.toContain("openai (");
  });

  it("renders a non-repo cwd as '— (not a git repo)'", () => {
    const line = formatReadinessLine({ ...FREE_CONFIGURED, isRepo: false, branch: undefined });
    expect(line).toContain("cwd: — (not a git repo)");
  });

  it("falls back to 'detached' when in a repo with no current branch", () => {
    const line = formatReadinessLine({ ...FREE_CONFIGURED, branch: undefined });
    expect(line).toContain("cwd: ~/work/payments-api (detached)");
  });

  it("renders the paid tier labels", () => {
    expect(formatReadinessLine({ ...FREE_CONFIGURED, tier: "single-device" })).toContain("Single-device ·");
    expect(formatReadinessLine({ ...FREE_CONFIGURED, tier: "unlimited" })).toContain("Unlimited ·");
  });
});

describe("buildLaunchpadOptions (AC1, AC3)", () => {
  it("leads with ACT then ORIENT in the locked order", () => {
    const values = buildLaunchpadOptions(FREE_CONFIGURED).map((o) => o.value);
    expect(values.slice(0, 5)).toEqual(["analyze-cwd", "analyze-remote", "settings", "status", "help"]);
  });

  it("always ends with Quit", () => {
    const values = buildLaunchpadOptions(FREE_CONFIGURED).map((o) => o.value);
    expect(values.at(-1)).toBe("quit");
  });

  it("when unlicensed: shows Activate, Buy/Restore, Buy Me a Coffee — and no Deactivate", () => {
    const values = buildLaunchpadOptions({ ...FREE_CONFIGURED, licensed: false }).map((o) => o.value);
    expect(values).toContain("activate");
    expect(values).toContain("buy-restore");
    expect(values).toContain("coffee");
    expect(values).not.toContain("deactivate");
  });

  it("when licensed: shows Deactivate — and retires Activate/Buy-Restore/Coffee", () => {
    const values = buildLaunchpadOptions({ ...FREE_CONFIGURED, licensed: true, tier: "single-device" }).map(
      (o) => o.value,
    );
    expect(values).toContain("deactivate");
    expect(values).not.toContain("activate");
    expect(values).not.toContain("buy-restore");
    expect(values).not.toContain("coffee");
  });

  it("every row carries a non-empty text label (never color-alone — AC4)", () => {
    for (const state of [FREE_CONFIGURED, { ...FREE_CONFIGURED, licensed: true }]) {
      for (const option of buildLaunchpadOptions(state)) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("runLaunchpad (AC1, AC4)", () => {
  it("writes the tagline + readiness line once, before the first prompt", async () => {
    const out = captureStream();
    const sel = scriptedSelect([null]); // immediate cancel
    await runLaunchpad({ state: FREE_CONFIGURED, helpText: "HELP", output: out.stream, select: sel.select });
    const text = out.text();
    expect(text).toContain(LAUNCHPAD_TAGLINE);
    expect(text).toContain(formatReadinessLine(FREE_CONFIGURED));
    expect(text.indexOf(LAUNCHPAD_TAGLINE)).toBe(0); // header is first
  });

  it("Esc/cancel exits cleanly (exit 0) printing the flags cheatsheet", async () => {
    const out = captureStream();
    const sel = scriptedSelect([null]);
    const code = await runLaunchpad({
      state: FREE_CONFIGURED,
      helpText: "HELP",
      output: out.stream,
      select: sel.select,
    });
    expect(code).toBe(ExitCode.Success);
    expect(out.text()).toContain(FLAGS_CHEATSHEET);
  });

  it("Help prints the full flag reference, then returns to the menu; Quit then exits 0", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["help", "quit"]);
    const code = await runLaunchpad({
      state: FREE_CONFIGURED,
      helpText: "FULL-FLAG-REFERENCE",
      output: out.stream,
      select: sel.select,
    });
    expect(code).toBe(ExitCode.Success);
    expect(out.text()).toContain("FULL-FLAG-REFERENCE");
    expect(out.text()).toContain(FLAGS_CHEATSHEET);
    expect(sel.calls()).toBe(2); // looped back to the menu after Help
  });

  it("a not-yet-built action shows a calm placeholder and loops back to the menu", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["settings", "quit"]);
    await runLaunchpad({ state: FREE_CONFIGURED, helpText: "HELP", output: out.stream, select: sel.select });
    expect(out.text()).toContain("Settings is coming soon.");
    expect(sel.calls()).toBe(2);
  });

  it("the Analyze placeholder teaches the headless command (self-teaching bridge)", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["analyze-cwd", "quit"]);
    await runLaunchpad({
      state: FREE_CONFIGURED,
      helpText: "HELP",
      output: out.stream,
      select: sel.select,
      prompts: scriptedPrompts({ texts: ["", ""], formats: ["terminal"] }).prompts,
      runAnalysis: captureAnalysis().runAnalysis,
    });
    expect(out.text()).toContain("commit-sage .");
  });
});

// ── Story 6.2: guided prompts + command echo ────────────────────────────────

/** A scripted guided-prompt primitive: returns each text answer in turn, then the formats. */
function scriptedPrompts(script: { texts?: (string | null)[]; formats?: OutputFormat[] | null }) {
  let ti = 0;
  const textMessages: string[] = [];
  const prompts: GuidedPrompts = {
    async text(opts) {
      textMessages.push(opts.message);
      const next = script.texts?.[ti++];
      return next ?? null;
    },
    async multiselect() {
      if (script.formats === undefined) {
        return ["terminal"];
      }
      return script.formats;
    },
  };
  return { prompts, textMessages };
}

function captureAnalysis() {
  const calls: PartialRunConfig[] = [];
  const runAnalysis = async (flags: PartialRunConfig): Promise<number> => {
    calls.push(flags);
    return ExitCode.Success;
  };
  return { calls, runAnalysis };
}

function guidedDeps(over: Partial<LaunchpadDeps>): LaunchpadDeps {
  return { state: FREE_CONFIGURED, helpText: "HELP", ...over };
}

describe("formatEquivalentCommand (AC2)", () => {
  it("emits the cwd target + real flags (max-commits, format)", () => {
    const cmd = formatEquivalentCommand(".", { repoTarget: ".", maxCommits: 500, outputFormats: ["markdown"] });
    expect(cmd).toBe("commit-sage . --max-commits 500 --format markdown");
  });

  it("omits --format when the selection is the default ['terminal']", () => {
    expect(formatEquivalentCommand(".", { outputFormats: ["terminal"] })).toBe("commit-sage .");
  });

  it("comma-joins multiple formats", () => {
    const cmd = formatEquivalentCommand(".", { outputFormats: ["terminal", "html"] });
    expect(cmd).toBe("commit-sage . --format terminal,html");
  });

  it("emits --since / --until from the date bounds", () => {
    const cmd = formatEquivalentCommand(".", { startDate: "2024-01-01", endDate: "2024-06-30" });
    expect(cmd).toBe("commit-sage . --since 2024-01-01 --until 2024-06-30");
  });

  it("uses the remote URL as the positional target", () => {
    expect(formatEquivalentCommand("https://github.com/x/y", {})).toBe("commit-sage https://github.com/x/y");
  });

  it("never emits a --branch flag (no such flag exists)", () => {
    const cmd = formatEquivalentCommand(".", { maxCommits: 10, outputFormats: ["json"] });
    expect(cmd).not.toContain("--branch");
  });

  it("shell-quotes a target with whitespace or metacharacters (faithful, paste-safe)", () => {
    expect(formatEquivalentCommand("/a path/repo", {})).toBe("commit-sage '/a path/repo'");
    expect(formatEquivalentCommand("https://h/x?a=1&b=2", {})).toBe("commit-sage 'https://h/x?a=1&b=2'");
    expect(formatEquivalentCommand("/o'reilly", {})).toBe("commit-sage '/o'\\''reilly'");
  });

  it("leaves a normal URL or path bare", () => {
    expect(formatEquivalentCommand("https://github.com/acme/app.git", {})).toBe(
      "commit-sage https://github.com/acme/app.git",
    );
  });
});

describe("interpretLimit (AC1)", () => {
  it("empty → all history (no cap, no error)", () => {
    expect(interpretLimit("")).toEqual({});
    expect(interpretLimit("   ")).toEqual({});
  });

  it("a positive integer → the cap (trimmed)", () => {
    expect(interpretLimit("500")).toEqual({ maxCommits: 500 });
    expect(interpretLimit("  42 ")).toEqual({ maxCommits: 42 });
  });

  it("rejects zero, negatives, decimals, and non-numbers", () => {
    for (const bad of ["0", "-3", "1.5", "abc", "0x10", "1e3"]) {
      expect("error" in interpretLimit(bad)).toBe(true);
    }
  });

  it("rejects an out-of-safe-range number (the echo must stay runnable)", () => {
    expect("error" in interpretLimit("99999999999999999999")).toBe(true);
  });
});

describe("interpretDateRange (AC1)", () => {
  it("empty → all history", () => {
    expect(interpretDateRange("")).toEqual({});
  });

  it("since..until → both bounds", () => {
    expect(interpretDateRange("2024-01-01..2024-06-30")).toEqual({
      startDate: "2024-01-01",
      endDate: "2024-06-30",
    });
  });

  it("one-sided ranges", () => {
    expect(interpretDateRange("2024-01-01..")).toEqual({ startDate: "2024-01-01" });
    expect(interpretDateRange("..2024-06-30")).toEqual({ endDate: "2024-06-30" });
  });

  it("a bare date is treated as since", () => {
    expect(interpretDateRange("2024-01-01")).toEqual({ startDate: "2024-01-01" });
  });

  it("rejects malformed dates", () => {
    for (const bad of ["nope", "2024-1-1", "01-01-2024", "2024/01/01"]) {
      expect("error" in interpretDateRange(bad)).toBe(true);
    }
  });

  it("rejects a triple-split range instead of silently dropping the extra part", () => {
    expect("error" in interpretDateRange("2024-01-01..2024-06-30..2024-12-31")).toBe(true);
  });
});

describe("runGuidedAnalyze via runLaunchpad (AC1, AC2, AC3)", () => {
  it("a cwd run collects inputs, executes once, echoes the command, and returns to the menu", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["analyze-cwd", "quit"]);
    const analysis = captureAnalysis();
    await runLaunchpad(
      guidedDeps({
        output: out.stream,
        select: sel.select,
        prompts: scriptedPrompts({ texts: ["500", ""], formats: ["terminal", "html"] }).prompts,
        runAnalysis: analysis.runAnalysis,
      }),
    );
    expect(analysis.calls).toHaveLength(1);
    expect(analysis.calls[0]).toEqual({
      repoTarget: ".",
      maxCommits: 500,
      outputFormats: ["terminal", "html"],
    });
    expect(out.text()).toContain("▸ Next time: commit-sage . --max-commits 500 --format terminal,html");
    expect(sel.calls()).toBe(2); // looped back to the menu
  });

  it("cancelling a guided prompt aborts the run (no execution) and returns to the menu", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["analyze-cwd", "quit"]);
    const analysis = captureAnalysis();
    await runLaunchpad(
      guidedDeps({
        output: out.stream,
        select: sel.select,
        prompts: scriptedPrompts({ texts: [null] }).prompts, // cancel at the first prompt
        runAnalysis: analysis.runAnalysis,
      }),
    );
    expect(analysis.calls).toHaveLength(0);
    expect(sel.calls()).toBe(2);
  });

  it("a remote run prompts the URL, names the token env var when absent (AC3), and targets the URL", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["analyze-remote", "quit"]);
    const analysis = captureAnalysis();
    const scripted = scriptedPrompts({
      texts: ["https://github.com/acme/app", "", ""],
      formats: ["terminal"],
    });
    await runLaunchpad(
      guidedDeps({
        output: out.stream,
        select: sel.select,
        prompts: scripted.prompts,
        runAnalysis: analysis.runAnalysis,
        gitTokenConfigured: false,
      }),
    );
    expect(analysis.calls[0]?.repoTarget).toBe("https://github.com/acme/app");
    expect(out.text()).toContain("COMMIT_SAGE_GIT_TOKEN");
    expect(out.text()).toContain("▸ Next time: commit-sage https://github.com/acme/app");
    // AC3: the secret itself is never prompted (no prompt collects a key/token).
    expect(scripted.textMessages.some((m) => /key|token|secret/i.test(m))).toBe(false);
  });

  it("omits the token hint when a git token is already configured", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["analyze-remote", "quit"]);
    await runLaunchpad(
      guidedDeps({
        output: out.stream,
        select: sel.select,
        prompts: scriptedPrompts({ texts: ["https://github.com/acme/app", "", ""], formats: ["terminal"] }).prompts,
        runAnalysis: captureAnalysis().runAnalysis,
        gitTokenConfigured: true,
      }),
    );
    expect(out.text()).not.toContain("COMMIT_SAGE_GIT_TOKEN");
  });

  it("echo-only when no executor is injected (still teaches the command)", async () => {
    const out = captureStream();
    const sel = scriptedSelect(["analyze-cwd", "quit"]);
    await runLaunchpad(
      guidedDeps({
        output: out.stream,
        select: sel.select,
        prompts: scriptedPrompts({ texts: ["", "2024-01-01..2024-06-30"], formats: ["json"] }).prompts,
      }),
    );
    expect(out.text()).toContain("▸ Next time: commit-sage . --since 2024-01-01 --until 2024-06-30 --format json");
  });
});

