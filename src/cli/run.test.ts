import { describe, it, expect } from "vitest";

import { runPipeline, type RunDeps } from "./run.js";
import { ExitCode } from "./exit-codes.js";
import { resolveRunConfig } from "../config/resolve-run-config.js";
import type { RunConfig, PartialRunConfig, Entitlement } from "../config/run-config.js";
import type { RepoHistory } from "../retrieve/retrieve.port.js";
import type { NarrateOutcome } from "../narrate/narrate.port.js";
import type { PreflightResult } from "../narrate/preflight.js";
import { parseReport } from "../assemble/report.js";
import { RetrieveError, NarrationError } from "../shared/errors.js";
import type { Ui } from "../shared/ui.js";
import { DEGRADED_BANNER, METRICS_ONLY_NOTE } from "../render/terminal/terminal-renderer.js";

const EMPTY_HISTORY: RepoHistory = { repoTarget: "/repo", commits: [] };

const NARRATIVE = {
  summary: { headline: "Healthy and steady.", overview: "An overview.", keyFindings: ["A finding"] },
  explanation: { paragraphs: ["A plain-language interpretation."] },
  coaching: { introduction: "A short plan.", chapters: [{ theme: "Cadence", steps: ["Commit smaller"] }], closingSummary: "Start with cadence." },
};

function makeConfig(flags: PartialRunConfig, entitlement?: Entitlement): RunConfig {
  return resolveRunConfig({
    cwd: "/repo",
    env: {},
    stdinIsTTY: false,
    stdoutIsTTY: false,
    nonInteractive: true,
    analysisTimestamp: "2026-01-01T00:00:00.000Z",
    flags,
    entitlement,
  });
}

function recorder() {
  const stdout: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const infos: string[] = [];
  const ui: Ui = {
    error: (m) => errors.push(m),
    warn: (m) => warnings.push(m),
    info: (m) => infos.push(m),
    plain: () => {},
  };
  return { stdout, warnings, errors, infos, ui, writeStdout: (s: string) => stdout.push(s) };
}

/** A recorder that also captures injected file writes (Story 4.4). */
function writeRecorder() {
  const base = recorder();
  const files: { path: string; content: string }[] = [];
  const writeFile = async (path: string, content: string): Promise<void> => {
    files.push({ path, content });
  };
  return { ...base, files, writeFile };
}

const reachable = async (): Promise<PreflightResult> => ({ reachable: true });
const unreachable = (reason: string) => async (): Promise<PreflightResult> => ({ reachable: false, reason });

describe("runPipeline — terminal outcomes", () => {
  it("narrated (auto, provider reachable) → exit 0, showpiece on stdout", async () => {
    const r = recorder();
    const deps: RunDeps = {
      retrieve: async () => EMPTY_HISTORY,
      preflight: reachable,
      narrate: async (): Promise<NarrateOutcome> => ({ kind: "narrated", narrative: NARRATIVE }),
      ui: r.ui,
      writeStdout: r.writeStdout,
    };
    const code = await runPipeline(makeConfig({ aiMode: "auto", provider: "gemini", llmModel: "m" }), deps);
    expect(code).toBe(ExitCode.Success);
    expect(r.stdout.join("")).toContain("Healthy and steady.");
    expect(r.stdout.join("")).not.toContain(DEGRADED_BANNER);
  });

  it("skipped (off) → exit 0, neutral metrics-only substrate; preflight + narrate never called", async () => {
    const r = recorder();
    let preflightCalls = 0;
    let narrateCalls = 0;
    const code = await runPipeline(makeConfig({ aiMode: "off" }), {
      retrieve: async () => EMPTY_HISTORY,
      preflight: async () => {
        preflightCalls += 1;
        return { reachable: true };
      },
      narrate: async () => {
        narrateCalls += 1;
        return { kind: "skipped" };
      },
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Success);
    expect(r.stdout.join("")).toContain(METRICS_ONLY_NOTE);
    expect(preflightCalls).toBe(0);
    expect(narrateCalls).toBe(0);
  });

  it("fail-open (auto, provider unreachable) → exit 9, ⚠ substrate, up-front warning, doomed narrate skipped", async () => {
    const r = recorder();
    let narrateCalls = 0;
    const code = await runPipeline(makeConfig({ aiMode: "auto", provider: "gemini", llmModel: "m" }), {
      retrieve: async () => EMPTY_HISTORY,
      preflight: unreachable("Ollama is not running."),
      narrate: async () => {
        narrateCalls += 1;
        return { kind: "narrated", narrative: NARRATIVE };
      },
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Degraded);
    expect(r.stdout.join("")).toContain(DEGRADED_BANNER);
    expect(r.warnings.join("")).toContain("Ollama is not running.");
    expect(narrateCalls).toBe(0); // skipped the doomed call
  });

  it("forced-AI hard fail (required, provider unreachable) → throws NarrationError (6) before retrieve", async () => {
    const r = recorder();
    let retrieveCalls = 0;
    await expect(
      runPipeline(makeConfig({ aiMode: "required", provider: "gemini", llmModel: "m" }), {
        retrieve: async () => {
          retrieveCalls += 1;
          return EMPTY_HISTORY;
        },
        preflight: unreachable("Auth failed."),
        ui: r.ui,
        writeStdout: r.writeStdout,
      }),
    ).rejects.toBeInstanceOf(NarrationError);
    expect(retrieveCalls).toBe(0);
    expect(r.stdout.join("")).toBe("");
  });
});

describe("runPipeline — stage failures propagate", () => {
  it("a retrieve failure propagates as RetrieveError (mapped to exit 4 at the shell)", async () => {
    const r = recorder();
    await expect(
      runPipeline(makeConfig({ aiMode: "off" }), {
        retrieve: async () => {
          throw new RetrieveError("not a git repo");
        },
        ui: r.ui,
        writeStdout: r.writeStdout,
      }),
    ).rejects.toBeInstanceOf(RetrieveError);
    expect(r.stdout.join("")).toBe("");
  });

  it("the narrated showpiece path does not require AI keys when narrate is injected", async () => {
    const r = recorder();
    const code = await runPipeline(makeConfig({ aiMode: "auto", provider: "gemini", llmModel: "m" }), {
      retrieve: async () => EMPTY_HISTORY,
      preflight: reachable,
      narrate: async () => ({ kind: "narrated", narrative: NARRATIVE }),
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Success);
  });
});

describe("runPipeline — commit selection (Story 2.6)", () => {
  const FIVE: RepoHistory = {
    repoTarget: "/repo",
    commits: ["2024-01-01", "2024-01-05", "2024-03-01", "2024-03-10", "2024-03-20"].map((day, i) => ({
      sha: `c${i + 1}`,
      author: { name: i % 2 === 0 ? "Alice" : "Bob", email: i % 2 === 0 ? "alice@x.com" : "bob@x.com" },
      committer: { name: "Alice", email: "alice@x.com" },
      authoredAt: `${day}T10:00:00.000Z`,
      committedAt: `${day}T10:00:00.000Z`,
      message: `commit ${i + 1}`,
      parents: i === 2 ? ["c2", "x"] : ["p"], // c3 is a merge
      files: [{ path: "a.ts", additions: 1, deletions: 0 }],
    })),
  };

  /** Run the pipeline and capture the `analysis` the narrate stage receives. */
  async function analysisFor(flags: PartialRunConfig) {
    const r = recorder();
    let commitCount: number | undefined;
    await runPipeline(makeConfig({ aiMode: "auto", provider: "gemini", llmModel: "m", ...flags }), {
      retrieve: async () => FIVE,
      preflight: reachable,
      narrate: async (analysis) => {
        const dist = analysis.metrics.find((m) => m.id === "a-commit-size-distribution");
        commitCount = (dist?.value as { commitCount?: number } | undefined)?.commitCount;
        return { kind: "narrated", narrative: NARRATIVE };
      },
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    return commitCount;
  }

  it("applies max-commits before analyze — the analysis reflects the narrowed slice", async () => {
    expect(await analysisFor({})).toBe(5); // no selection → all five
    expect(await analysisFor({ maxCommits: 2 })).toBe(2); // narrowed to the most-recent two
  });

  it("applies no-merges before analyze — the merge commit is excluded from the metrics", async () => {
    expect(await analysisFor({ noMerges: true })).toBe(4); // c3 (merge) dropped → four
  });
});

describe("runPipeline — Free-tier cap truncation notice (Story 2.7)", () => {
  const THREE: RepoHistory = {
    repoTarget: "/repo",
    commits: ["2024-01-01", "2024-02-01", "2024-03-01"].map((day, i) => ({
      sha: `c${i + 1}`,
      author: { name: "Alice", email: "alice@x.com" },
      committer: { name: "Alice", email: "alice@x.com" },
      authoredAt: `${day}T10:00:00.000Z`,
      committedAt: `${day}T10:00:00.000Z`,
      message: `commit ${i + 1}`,
      parents: ["p"],
      files: [{ path: "a.ts", additions: 1, deletions: 0 }],
    })),
  };

  it("emits the cap notice to stderr (info) when the Free cap truncates — never to stdout", async () => {
    const r = recorder();
    const code = await runPipeline(makeConfig({ aiMode: "off" }, { tier: "free", commitCap: 2 }), {
      retrieve: async () => THREE,
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(code).toBe(ExitCode.Success);
    expect(r.infos.join("\n")).toContain("Analyzed 2 of 3 commits — Free tier cap");
    expect(r.stdout.join("")).not.toContain("Free tier cap"); // stderr chrome, not the Report
  });

  it("emits no cap notice when the in-scope history is within the cap", async () => {
    const r = recorder();
    await runPipeline(makeConfig({ aiMode: "off" }, { tier: "free", commitCap: 100 }), {
      retrieve: async () => THREE,
      ui: r.ui,
      writeStdout: r.writeStdout,
    });
    expect(r.infos.join("\n")).not.toContain("Free tier cap");
  });
});

describe("runPipeline — multi-format output dispatch (Story 4.4)", () => {
  const narrate = async (): Promise<NarrateOutcome> => ({ kind: "narrated", narrative: NARRATIVE });

  it("the default (terminal) selection still renders to stdout — back-compat", async () => {
    const r = writeRecorder();
    const code = await runPipeline(makeConfig({ aiMode: "off" }), {
      retrieve: async () => EMPTY_HISTORY,
      ui: r.ui,
      writeStdout: r.writeStdout,
      writeFile: r.writeFile,
    });
    expect(code).toBe(ExitCode.Success);
    expect(r.stdout.join("")).toContain(METRICS_ONLY_NOTE);
    expect(r.files.length).toBe(0); // nothing written to disk
  });

  it("--format json -o - writes the canonical Report JSON to STDOUT (machine-clean)", async () => {
    const r = writeRecorder();
    await runPipeline(makeConfig({ aiMode: "auto", provider: "gemini", llmModel: "m", outputFormats: ["json"], outputPath: "-" }), {
      retrieve: async () => EMPTY_HISTORY,
      preflight: reachable,
      narrate,
      ui: r.ui,
      writeStdout: r.writeStdout,
      writeFile: r.writeFile,
    });
    expect(r.files.length).toBe(0); // '-' → stdout, not a file
    const out = r.stdout.join("");
    const parsed = parseReport(out); // it is the canonical, parseable Report JSON
    expect(parsed.narrative?.summary.headline).toBe("Healthy and steady.");
  });

  it("--format json (no path) writes the file and keeps stdout empty + a stderr 'Wrote' line", async () => {
    const r = writeRecorder();
    await runPipeline(makeConfig({ aiMode: "off", outputFormats: ["json"] }), {
      retrieve: async () => EMPTY_HISTORY,
      ui: r.ui,
      writeStdout: r.writeStdout,
      writeFile: r.writeFile,
    });
    expect(r.stdout.join("")).toBe(""); // machine-clean: nothing on stdout
    expect(r.files).toHaveLength(1);
    expect(r.files[0].path).toBe("commit-sage-report.json");
    expect(parseReport(r.files[0].content).analysis).toBeDefined();
    expect(r.infos.join("\n")).toContain("Wrote json → commit-sage-report.json");
  });

  it("--format terminal,html writes terminal to stdout AND the html file", async () => {
    const r = writeRecorder();
    await runPipeline(makeConfig({ aiMode: "off", outputFormats: ["terminal", "html"] }), {
      retrieve: async () => EMPTY_HISTORY,
      ui: r.ui,
      writeStdout: r.writeStdout,
      writeFile: r.writeFile,
    });
    expect(r.stdout.join("")).toContain(METRICS_ONLY_NOTE); // terminal on stdout
    expect(r.files).toHaveLength(1);
    expect(r.files[0].path).toBe("commit-sage-report.html");
    expect(r.files[0].content).toContain("<!doctype html>");
  });

  it("renders all selected formats from ONE report — narrate is called at most once", async () => {
    const r = writeRecorder();
    let narrateCalls = 0;
    await runPipeline(makeConfig({ aiMode: "auto", provider: "gemini", llmModel: "m", outputFormats: ["terminal", "html", "markdown", "json"] }), {
      retrieve: async () => EMPTY_HISTORY,
      preflight: reachable,
      narrate: async () => {
        narrateCalls += 1;
        return { kind: "narrated", narrative: NARRATIVE };
      },
      ui: r.ui,
      writeStdout: r.writeStdout,
      writeFile: r.writeFile,
    });
    expect(narrateCalls).toBe(1); // one narration feeds every format
    expect(r.files.map((f) => f.path)).toEqual(["commit-sage-report.html", "commit-sage-report.md", "commit-sage-report.json"]);
  });

  it("a writeFile failure surfaces as RenderError (exit 7) naming the path", async () => {
    const r = writeRecorder();
    await expect(
      runPipeline(makeConfig({ aiMode: "off", outputFormats: ["json"] }), {
        retrieve: async () => EMPTY_HISTORY,
        ui: r.ui,
        writeStdout: r.writeStdout,
        writeFile: async () => {
          throw new Error("EACCES: permission denied");
        },
      }),
    ).rejects.toMatchObject({ exitCode: ExitCode.Render });
  });
});


