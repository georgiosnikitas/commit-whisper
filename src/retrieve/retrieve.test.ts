import { describe, it, expect } from "vitest";

import { createRetrieve } from "./retrieve.js";
import type { GitRunner } from "./git.js";
import type { TempWorkspaceDeps } from "./temp-workspace.js";
import type { RunConfig } from "../config/run-config.js";
import { Secret } from "../shared/secret.js";

function cfg(repoTarget: string): RunConfig {
  return { repoTarget } as unknown as RunConfig;
}

/** A runner that records the first subcommand it sees, then short-circuits. */
function probeRunner(): { runner: GitRunner; firstSub: () => string | undefined; cloneEnv: () => Record<string, string> | undefined } {
  let first: string | undefined;
  let cloneExtraEnv: Record<string, string> | undefined;
  const runner: GitRunner = async (args, options) => {
    if (first === undefined) {
      first = subcommand(args);
    }
    if (subcommand(args) === "clone") {
      cloneExtraEnv = options.extraEnv;
    }
    // Enough to let the local path's assertGitRepo + empty-history read complete.
    if (args.join(" ") === "rev-parse --is-inside-work-tree") {
      return "true\n";
    }
    if (args.join(" ") === "rev-parse --verify --quiet HEAD") {
      return ""; // unborn HEAD → empty history, no further calls
    }
    return ""; // clone → resolves; remote then reads (also short-circuits on the rev-parses)
  };
  return { runner, firstSub: () => first, cloneEnv: () => cloneExtraEnv };
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

const workspace: TempWorkspaceDeps = {
  mkdtemp: () => "/tmp/commit-sage-DISPATCH",
  rmrf: () => {},
  signals: { once: () => {}, removeListener: () => {}, exit: () => {} },
};

describe("createRetrieve — dispatch by target", () => {
  it("routes a remote https URL to the remote adapter (first git call is `clone`)", async () => {
    const p = probeRunner();
    await createRetrieve({ runner: p.runner, workspace })(cfg("https://github.com/owner/repo"));
    expect(p.firstSub()).toBe("clone");
  });

  it("routes a local path to the local adapter (first git call is `rev-parse`, never `clone`)", async () => {
    const p = probeRunner();
    await createRetrieve({ runner: p.runner, workspace })(cfg("/local/path/repo"));
    expect(p.firstSub()).toBe("rev-parse");
  });

  it("threads the git token to the remote adapter (the clone carries the token env, Story 5.2)", async () => {
    const p = probeRunner();
    await createRetrieve({ runner: p.runner, workspace, gitToken: new Secret("ghp_x") })(cfg("https://github.com/owner/repo"));
    expect(p.cloneEnv()?.COMMIT_SAGE_GIT_PAT).toBe("ghp_x");
  });

  it("a local target ignores the token (no clone, no token env)", async () => {
    const p = probeRunner();
    await createRetrieve({ runner: p.runner, workspace, gitToken: new Secret("ghp_x") })(cfg("/local/path/repo"));
    expect(p.cloneEnv()).toBeUndefined(); // never cloned
  });
});
