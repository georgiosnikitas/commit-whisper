import { Writable } from "node:stream";

import { describe, it, expect } from "vitest";

import {
  buildLaunchpadOptions,
  FLAGS_CHEATSHEET,
  formatReadinessLine,
  LAUNCHPAD_TAGLINE,
  runLaunchpad,
  type LaunchpadAction,
  type LaunchpadSelect,
  type LaunchpadState,
} from "./interactive.js";
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
    await runLaunchpad({ state: FREE_CONFIGURED, helpText: "HELP", output: out.stream, select: sel.select });
    expect(out.text()).toContain("commit-sage .");
  });
});
