import { describe, it, expect } from "vitest";

import { createRemoteRetrieve } from "./remote.js";
import type { GitRunner } from "./git.js";
import type { TempWorkspaceDeps } from "./temp-workspace.js";
import type { RunConfig } from "../config/run-config.js";
import { RetrieveError } from "../shared/errors.js";

const RS = "\x1e";
const US = "\x1f";

const CANNED_LOG =
  `${RS}sha1${US}Alice${US}alice@example.com${US}2024-01-02T10:00:00+00:00` +
  `${US}Alice${US}alice@example.com${US}2024-01-02T10:00:00+00:00${US}${US}Initial commit\n${US}\n\n1\t0\tREADME.md\n`;

function cfg(repoTarget: string): RunConfig {
  return { repoTarget } as unknown as RunConfig;
}

interface Handlers {
  clone?: (args: readonly string[]) => Promise<string>;
}

function fakeRunner(h: Handlers = {}): { runner: GitRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: GitRunner = async (args) => {
    calls.push([...args]);
    const sub = subcommand(args);
    if (sub === "clone") {
      return (h.clone ?? (async () => ""))(args);
    }
    if (args.join(" ") === "rev-parse --is-inside-work-tree") {
      return "true\n";
    }
    if (args.join(" ") === "rev-parse --verify --quiet HEAD") {
      return "";
    }
    if (sub === "log") {
      return CANNED_LOG;
    }
    throw new Error(`unexpected git args: ${args.join(" ")}`);
  };
  return { runner, calls };
}

function subcommand(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-c") {
      i++;
      continue;
    }
    if (!args[i].startsWith("-")) {
      return args[i];
    }
  }
  return undefined;
}

/** Fake temp-workspace seams: a fixed dir + recorded removals (no real fs / signals). */
function fakeWorkspace(): { deps: TempWorkspaceDeps; removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    deps: {
      mkdtemp: () => "/tmp/commit-sage-AAAA",
      rmrf: (dir) => {
        removed.push(dir);
      },
      signals: { once: () => {}, removeListener: () => {}, exit: () => {} },
    },
  };
}

describe("createRemoteRetrieve — AC1 clone-into-temp + read", () => {
  it("clones the URL into a temp dir and reads the history from the clone", async () => {
    const { runner, calls } = fakeRunner();
    const ws = fakeWorkspace();
    const history = await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/repo"));

    // First git call is the clone: `clone --quiet -- <url> <dest>` (dest under the temp dir).
    expect(calls[0]).toEqual(["clone", "--quiet", "--", "https://github.com/owner/repo", "/tmp/commit-sage-AAAA/repo"]);
    // The history is read FROM the clone, but LABELLED with the URL (not the temp path).
    expect(history.repoTarget).toBe("https://github.com/owner/repo");
    expect(history.commits).toHaveLength(1);
    // A subsequent read call runs inside the cloned dir.
    expect(calls.some((c) => c.join(" ") === "rev-parse --is-inside-work-tree")).toBe(true);
  });

  it("passes the URL and dest as separate argv elements with a `--` guard (injection-safe)", async () => {
    const { runner, calls } = fakeRunner();
    const ws = fakeWorkspace();
    await createRemoteRetrieve(runner, ws.deps)(cfg("https://example.com/a b/repo"));
    const clone = calls[0]!;
    expect(clone).toContain("--"); // end-of-options guard before the url
    expect(clone).toContain("https://example.com/a b/repo"); // the url is ONE argv element
  });

  it("cleans up the temp dir after a successful read (stateless)", async () => {
    const { runner } = fakeRunner();
    const ws = fakeWorkspace();
    await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/repo"));
    expect(ws.removed).toEqual(["/tmp/commit-sage-AAAA"]);
  });
});

describe("createRemoteRetrieve — clone failure", () => {
  it("maps a clone failure to a RetrieveError (exit 4) and still cleans up the temp dir", async () => {
    const { runner } = fakeRunner({
      clone: async () => {
        throw new Error("fatal: repository not found");
      },
    });
    const ws = fakeWorkspace();
    await expect(
      createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/missing")),
    ).rejects.toBeInstanceOf(RetrieveError);
    expect(ws.removed).toEqual(["/tmp/commit-sage-AAAA"]); // cleaned despite the failure
  });

  it("a post-clone read error names the URL, never the disposable temp path", async () => {
    // The clone succeeds, but the cloned tree reads back as a non-work-tree.
    const calls: string[][] = [];
    const runner: GitRunner = async (args) => {
      calls.push([...args]);
      if (subcommand(args) === "clone") {
        return "";
      }
      if (args.join(" ") === "rev-parse --is-inside-work-tree") {
        return "false\n"; // not a work tree → assertGitRepo throws
      }
      throw new Error(`unexpected git args: ${args.join(" ")}`);
    };
    const ws = fakeWorkspace();
    await expect(
      createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/repo")),
    ).rejects.toThrowError(/https:\/\/github\.com\/owner\/repo/); // the URL, not /tmp/commit-sage-AAAA
    expect(ws.removed).toEqual(["/tmp/commit-sage-AAAA"]);
  });
});
