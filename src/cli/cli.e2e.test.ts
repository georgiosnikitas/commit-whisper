import { describe, it, expect } from "vitest";

import { main, type CliDeps } from "./cli.js";
import { ExitCode } from "./exit-codes.js";
import type { RunDeps } from "./run.js";
import type { NarrateOutcome } from "../narrate/narrate.port.js";
import type { PreflightResult } from "../narrate/preflight.js";
import type { RepoHistory } from "../retrieve/retrieve.port.js";
import { parseReport } from "../assemble/report.js";
import { SYNTHETIC_HISTORY } from "../analyze/sample-history.js";
import { DEGRADED_BANNER, METRICS_ONLY_NOTE } from "../render/terminal/terminal-renderer.js";

/**
 * End-to-end walking skeleton: drives `main()` through the REAL `runPipeline`
 * (retrieve → analyze → narrate → assemble → render) with only the impure edges
 * faked, asserting the four terminal outcomes + headless parity.
 */

function harness() {
  const stdout: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  const infos: string[] = [];
  const base: CliDeps = {
    cwd: "/repo",
    env: {},
    stdinIsTTY: false,
    stdoutIsTTY: false,
    analysisTimestamp: "2026-01-01T00:00:00.000Z",
    ui: {
      error: (m) => errors.push(m),
      warn: (m) => warns.push(m),
      info: (m) => infos.push(m),
      plain: () => {},
    },
    writeStdout: (s) => stdout.push(s),
  };
  return { stdout, errors, warns, infos, base };
}

const retrieveSynthetic = async (): Promise<RepoHistory> => SYNTHETIC_HISTORY;
const reachable = async (): Promise<PreflightResult> => ({ reachable: true });
const unreachable = (reason: string) => async (): Promise<PreflightResult> => ({ reachable: false, reason });
const narrated = async (): Promise<NarrateOutcome> => ({
  kind: "narrated",
  narrative: {
    summary: { headline: "NARRATED-HEADLINE", overview: "ov", keyFindings: ["finding"] },
    explanation: { paragraphs: ["A plain-language interpretation."] },
    coaching: { introduction: "A short plan.", chapters: [{ theme: "Cadence", steps: ["Commit smaller"] }], closingSummary: "Start with cadence." },
  },
});

const stripAnsi = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, "");

describe("e2e — the four terminal outcomes", () => {
  it("intentional metrics-only (--no-ai): exit 0, neutral substrate, no banner", async () => {
    const h = harness();
    const runDeps: RunDeps = { retrieve: retrieveSynthetic };
    const code = await main([".", "--no-ai"], { ...h.base, runDeps });
    expect(code).toBe(ExitCode.Success);
    const out = h.stdout.join("");
    expect(out).toContain(METRICS_ONLY_NOTE);
    expect(out).not.toContain(DEGRADED_BANNER);
    expect(out).toContain("commit-sage");
  });

  it("full narrated showpiece (--ai, reachable): exit 0, narrative on stdout", async () => {
    const h = harness();
    const runDeps: RunDeps = { retrieve: retrieveSynthetic, preflight: reachable, narrate: narrated };
    const code = await main([".", "--ai", "--provider", "gemini", "--model", "m"], {
      ...h.base,
      env: { GEMINI_API_KEY: "k" },
      runDeps,
    });
    expect(code).toBe(ExitCode.Success);
    expect(h.stdout.join("")).toContain("NARRATED-HEADLINE");
    expect(h.stdout.join("")).not.toContain(DEGRADED_BANNER);
  });

  it("fail-open degraded (auto via env, unreachable): exit 9, ⚠ substrate + up-front warning", async () => {
    const h = harness();
    const runDeps: RunDeps = { retrieve: retrieveSynthetic, preflight: unreachable("Ollama is not running.") };
    const code = await main([".", "--provider", "gemini", "--model", "m"], {
      ...h.base,
      env: { COMMIT_SAGE_AI_MODE: "auto" },
      runDeps,
    });
    expect(code).toBe(ExitCode.Degraded);
    expect(h.stdout.join("")).toContain(DEGRADED_BANNER);
    expect(h.warns.join("")).toContain("Ollama is not running.");
  });

  it("forced-AI hard fail (--ai, unreachable): exit 6, typed error, nothing on stdout", async () => {
    const h = harness();
    const runDeps: RunDeps = { retrieve: retrieveSynthetic, preflight: unreachable("Auth failed.") };
    const code = await main([".", "--ai", "--provider", "gemini", "--model", "m"], {
      ...h.base,
      env: { GEMINI_API_KEY: "k" },
      runDeps,
    });
    expect(code).toBe(ExitCode.Narration);
    expect(h.stdout.join("")).toBe("");
    expect(h.errors.length).toBeGreaterThan(0);
  });
});

describe("e2e — AC3 headless parity", () => {
  it("produces identical report text whether stdout is a TTY or not", async () => {
    const runDeps: RunDeps = { retrieve: retrieveSynthetic };

    const tty = harness();
    await main([".", "--no-ai"], { ...tty.base, stdoutIsTTY: true, stdinIsTTY: true, runDeps });

    const headless = harness();
    await main([".", "--no-ai"], { ...headless.base, stdoutIsTTY: false, stdinIsTTY: false, runDeps });

    expect(stripAnsi(tty.stdout.join(""))).toBe(stripAnsi(headless.stdout.join("")));
  });
});

describe("e2e — multi-format output (Story 4.4)", () => {
  it("--no-ai --format json -o - emits a parseable canonical Report JSON on stdout (exit 0)", async () => {
    const h = harness();
    const files: { path: string; content: string }[] = [];
    const runDeps: RunDeps = {
      retrieve: retrieveSynthetic,
      writeFile: async (path, content) => {
        files.push({ path, content });
      },
    };
    const code = await main([".", "--no-ai", "--format", "json", "-o", "-"], { ...h.base, runDeps });
    expect(code).toBe(ExitCode.Success);
    expect(files).toHaveLength(0); // '-' → stdout, no file
    const report = parseReport(h.stdout.join(""));
    expect(report.analysis.metrics.length).toBeGreaterThan(0);
    expect(report.narrative).toBeUndefined(); // metrics-only substrate
  });

  it("--format json,html -o report.json is an ambiguous usage error (exit 2)", async () => {
    const h = harness();
    const runDeps: RunDeps = { retrieve: retrieveSynthetic };
    const code = await main([".", "--no-ai", "--format", "json,html", "-o", "report.json"], { ...h.base, runDeps });
    expect(code).toBe(ExitCode.Usage);
    expect(h.errors.join(" ")).toContain("--output cannot be used with multiple file formats");
  });
});
