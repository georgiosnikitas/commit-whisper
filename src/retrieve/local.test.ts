import { describe, it, expect } from "vitest";

import { createLocalRetrieve } from "./local.js";
import type { GitRunner } from "./git.js";
import type { RunConfig } from "../config/run-config.js";
import { RetrieveError } from "../shared/errors.js";

const RS = "\x1e";
const US = "\x1f";

function cfg(repoTarget: string): RunConfig {
  return { repoTarget } as unknown as RunConfig;
}

const CANNED_LOG =
  `${RS}sha1${US}Alice${US}alice@example.com${US}2024-01-02T10:00:00+00:00` +
  `${US}Alice${US}alice@example.com${US}2024-01-02T10:00:00+00:00${US}${US}Initial commit\n${US}\n\n1\t0\tREADME.md\n`;

interface Handlers {
  insideWorkTree?: () => Promise<string>;
  hasHead?: () => Promise<string>;
  log?: () => Promise<string>;
}

function fakeRunner(h: Handlers): { runner: GitRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: GitRunner = async (args) => {
    calls.push([...args]);
    const key = args.join(" ");
    if (key === "rev-parse --is-inside-work-tree") {
      return (h.insideWorkTree ?? (async () => "true\n"))();
    }
    if (key === "rev-parse --verify --quiet HEAD") {
      return (h.hasHead ?? (async () => ""))();
    }
    if (gitSubcommand(args) === "log") {
      return (h.log ?? (async () => CANNED_LOG))();
    }
    throw new Error(`unexpected git args: ${key}`);
  };
  return { runner, calls };
}

/** The git subcommand = the first arg that is not a global `-c key=value` pair or a flag. */
function gitSubcommand(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-c") {
      i++; // skip the config value
      continue;
    }
    if (!args[i].startsWith("-")) {
      return args[i];
    }
  }
  return undefined;
}

describe("createLocalRetrieve — AC1 happy path", () => {
  it("reads the local history into a RepoHistory", async () => {
    const { runner } = fakeRunner({});
    const history = await createLocalRetrieve(runner)(cfg("/repo"));
    expect(history.repoTarget).toBe("/repo");
    expect(history.commits).toHaveLength(1);
    expect(history.commits[0]).toMatchObject({
      sha: "sha1",
      author: { name: "Alice", email: "alice@example.com" },
      message: "Initial commit",
      files: [{ path: "README.md", additions: 1, deletions: 0 }],
    });
  });
});

describe("createLocalRetrieve — streamed progress (live commit count)", () => {
  it("reports the running commit count to onProgress as the log streams in", async () => {
    const counts: number[] = [];
    const runner: GitRunner = async (args, options) => {
      const key = args.join(" ");
      if (key === "rev-parse --is-inside-work-tree") return "true\n";
      if (key === "rev-parse --verify --quiet HEAD") return "";
      if (gitSubcommand(args) === "log") {
        // Simulate two streamed chunks, each carrying one commit record (RS-prefixed).
        options.onChunk?.(`${RS}rec-a`);
        options.onChunk?.(`${RS}rec-b`);
        return CANNED_LOG;
      }
      throw new Error(`unexpected git args: ${key}`);
    };
    await createLocalRetrieve(runner)(cfg("/repo"), (count) => counts.push(count));
    expect(counts).toEqual([1, 2]); // cumulative across chunks
  });

  it("stays on the buffered path (no onChunk) when no progress sink is given", async () => {
    let sawOnChunk = false;
    const runner: GitRunner = async (args, options) => {
      const key = args.join(" ");
      if (key === "rev-parse --is-inside-work-tree") return "true\n";
      if (key === "rev-parse --verify --quiet HEAD") return "";
      if (gitSubcommand(args) === "log") {
        sawOnChunk = options.onChunk !== undefined;
        return CANNED_LOG;
      }
      throw new Error(`unexpected git args: ${key}`);
    };
    await createLocalRetrieve(runner)(cfg("/repo")); // no onProgress
    expect(sawOnChunk).toBe(false);
  });
});

describe("createLocalRetrieve — AC2 not a git repo", () => {
  it("throws RetrieveError (exit 4) when rev-parse fails", async () => {
    const { runner } = fakeRunner({
      insideWorkTree: () => Promise.reject(new Error("fatal: not a git repository")),
    });
    await expect(createLocalRetrieve(runner)(cfg("/work/not-a-repo"))).rejects.toBeInstanceOf(
      RetrieveError,
    );
    await expect(createLocalRetrieve(runner)(cfg("/work/not-a-repo"))).rejects.toMatchObject({
      exitCode: 4,
    });
  });

  it("throws RetrieveError when inside-work-tree is not 'true'", async () => {
    const { runner } = fakeRunner({ insideWorkTree: async () => "false\n" });
    await expect(createLocalRetrieve(runner)(cfg("/work/x"))).rejects.toBeInstanceOf(RetrieveError);
  });

  it("carries the underlying error as cause", async () => {
    const inner = new Error("fatal: not a git repository");
    const { runner } = fakeRunner({ insideWorkTree: () => Promise.reject(inner) });
    await createLocalRetrieve(runner)(cfg("/work/x")).catch((e: unknown) => {
      expect((e as RetrieveError).cause).toBe(inner);
    });
  });
});

describe("createLocalRetrieve — AC3 read-only", () => {
  it("only ever invokes read subcommands (rev-parse, log)", async () => {
    const { runner, calls } = fakeRunner({});
    await createLocalRetrieve(runner)(cfg("/repo"));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(["rev-parse", "log"]).toContain(gitSubcommand(call));
    }
  });
});

describe("createLocalRetrieve — empty repository", () => {
  it("returns an empty history when HEAD has no commits (unborn HEAD: exit 1, no stderr)", async () => {
    const { runner, calls } = fakeRunner({
      hasHead: () => Promise.reject(Object.assign(new Error("exit 1"), { code: 1, stderr: "" })),
    });
    const history = await createLocalRetrieve(runner)(cfg("/fresh"));
    expect(history).toEqual({ repoTarget: "/fresh", commits: [] });
    // never reached the log read
    expect(calls.some((c) => gitSubcommand(c) === "log")).toBe(false);
  });

  it("rethrows a real HEAD-probe failure as RetrieveError (not an empty history)", async () => {
    const { runner } = fakeRunner({
      hasHead: () =>
        Promise.reject(Object.assign(new Error("permission denied"), { code: 128, stderr: "fatal: permission denied" })),
    });
    await expect(createLocalRetrieve(runner)(cfg("/locked"))).rejects.toMatchObject({
      exitCode: 4,
    });
  });
});
