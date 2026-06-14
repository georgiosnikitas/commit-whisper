import { describe, it, expect } from "vitest";

import { readRepoContext } from "./repo-context.js";
import type { GitRunner } from "../retrieve/git.js";

/** A fake git, keyed by the joined args, returning a string or throwing an Error. */
function fakeRunner(responses: {
  insideWorkTree?: string | Error;
  branch?: string | Error;
}): GitRunner {
  return async (args) => {
    const key = args.join(" ");
    if (key === "rev-parse --is-inside-work-tree") {
      const r = responses.insideWorkTree ?? "true\n";
      if (r instanceof Error) throw r;
      return r;
    }
    if (key === "branch --show-current") {
      const r = responses.branch ?? "main\n";
      if (r instanceof Error) throw r;
      return r;
    }
    throw new Error(`unexpected git args: ${key}`);
  };
}

describe("readRepoContext", () => {
  it("reports the repo + current branch for a git work tree", async () => {
    const ctx = await readRepoContext(fakeRunner({ insideWorkTree: "true\n", branch: "main\n" }), "/repo");
    expect(ctx).toEqual({ isRepo: true, branch: "main" });
  });

  it("returns { isRepo: false } when rev-parse throws (not a repo / no git)", async () => {
    const ctx = await readRepoContext(fakeRunner({ insideWorkTree: new Error("fatal: not a git repository") }), "/tmp");
    expect(ctx).toEqual({ isRepo: false });
  });

  it("returns { isRepo: false } when not inside a work tree", async () => {
    const ctx = await readRepoContext(fakeRunner({ insideWorkTree: "false\n" }), "/repo/.git");
    expect(ctx).toEqual({ isRepo: false });
  });

  it("maps an empty branch (detached HEAD) to undefined", async () => {
    const ctx = await readRepoContext(fakeRunner({ insideWorkTree: "true\n", branch: "\n" }), "/repo");
    expect(ctx).toEqual({ isRepo: true, branch: undefined });
  });

  it("never throws — a branch read failure still yields a repo header", async () => {
    const ctx = await readRepoContext(
      fakeRunner({ insideWorkTree: "true\n", branch: new Error("boom") }),
      "/repo",
    );
    expect(ctx).toEqual({ isRepo: true });
  });

  it("never throws even when the runner yields a non-string (defensive — guards the contract)", async () => {
    const runner: GitRunner = async (args) =>
      args[0] === "rev-parse" ? (42 as unknown as string) : "main\n";
    const ctx = await readRepoContext(runner, "/repo");
    expect(ctx).toEqual({ isRepo: false });
  });
});
