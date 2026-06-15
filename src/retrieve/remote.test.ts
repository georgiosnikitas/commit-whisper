import { describe, it, expect } from "vitest";

import { createRemoteRetrieve } from "./remote.js";
import type { GitRunner } from "./git.js";
import type { TempWorkspaceDeps } from "./temp-workspace.js";
import type { RunConfig } from "../config/run-config.js";
import { RetrieveError } from "../shared/errors.js";
import { Secret } from "../shared/secret.js";

const RS = "\x1e";
const US = "\x1f";

const CANNED_LOG =
  `${RS}sha1${US}Alice${US}alice@example.com${US}2024-01-02T10:00:00+00:00` +
  `${US}Alice${US}alice@example.com${US}2024-01-02T10:00:00+00:00${US}${US}Initial commit\n${US}\n\n1\t0\tREADME.md\n`;

function cfg(repoTarget: string): RunConfig {
  return { repoTarget } as unknown as RunConfig;
}

interface CallRecord {
  args: string[];
  extraEnv?: Record<string, string>;
}

interface Handlers {
  clone?: (args: readonly string[]) => Promise<string>;
}

function fakeRunner(h: Handlers = {}): { runner: GitRunner; calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const runner: GitRunner = async (args, options) => {
    calls.push({ args: [...args], extraEnv: options.extraEnv });
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
      mkdtemp: () => "/work/commit-whisper-AAAA",
      rmrf: (dir) => {
        removed.push(dir);
      },
      signals: { once: () => {}, removeListener: () => {}, exit: () => {} },
    },
  };
}

const cloneCall = (calls: CallRecord[]): CallRecord => calls.find((c) => subcommand(c.args) === "clone")!;

describe("createRemoteRetrieve — AC1 clone-into-temp + read", () => {
  it("clones the URL into a temp dir (— guard) and reads the history from the clone", async () => {
    const { runner, calls } = fakeRunner();
    const ws = fakeWorkspace();
    const history = await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/repo"));

    const clone = cloneCall(calls).args;
    expect(clone).toContain("clone");
    expect(clone).toContain("--"); // end-of-options guard before the url
    expect(clone).toContain("https://github.com/owner/repo"); // the url is ONE argv element
    expect(clone).toContain("/work/commit-whisper-AAAA/repo"); // dest under the temp dir
    // The history is read FROM the clone, but LABELLED with the URL (not the temp path).
    expect(history.repoTarget).toBe("https://github.com/owner/repo");
    expect(history.commits).toHaveLength(1);
    expect(calls.some((c) => c.args.join(" ") === "rev-parse --is-inside-work-tree")).toBe(true);
  });

  it("cleans up the temp dir after a successful read (stateless)", async () => {
    const { runner } = fakeRunner();
    const ws = fakeWorkspace();
    await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/repo"));
    expect(ws.removed).toEqual(["/work/commit-whisper-AAAA"]);
  });
});

describe("createRemoteRetrieve — private-remote auth (Story 5.2)", () => {
  const TOKEN = "ghp_supersecretvalue";

  it("a no-token clone clears credential helpers + disables prompts, but adds NO inline helper or token", async () => {
    const { runner, calls } = fakeRunner();
    const ws = fakeWorkspace();
    await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/public"));
    const clone = cloneCall(calls);
    expect(clone.args).toContain("credential.helper="); // clears any inherited helper (no GUI/system prompt)
    expect(clone.args.some((a) => a.startsWith("credential.helper=!f()"))).toBe(false); // but no inline helper
    expect(clone.extraEnv).toMatchObject({ GIT_TERMINAL_PROMPT: "0" }); // prompts off → fail fast, no hang
    expect(clone.extraEnv?.COMMIT_WHISPER_GIT_PAT).toBeUndefined(); // no token channel
  });

  it("an authenticated clone feeds the token via the child ENV, never argv (anti-ps-leak)", async () => {
    const { runner, calls } = fakeRunner();
    const ws = fakeWorkspace();
    await createRemoteRetrieve(runner, ws.deps, new Secret(TOKEN))(cfg("https://github.com/owner/private"));
    const clone = cloneCall(calls);
    expect(clone.args.some((a) => a.includes("$COMMIT_WHISPER_GIT_PAT"))).toBe(true); // helper references the env-var NAME
    expect(clone.extraEnv?.COMMIT_WHISPER_GIT_PAT).toBe(TOKEN); // the VALUE is only in the child env
    expect(clone.args.every((a) => !a.includes(TOKEN))).toBe(true); // never in argv / ps
    expect(clone.extraEnv).toMatchObject({ GIT_TERMINAL_PROMPT: "0" });
  });

  it("an auth-rejected clone WITH a token → a scope-hint error that never contains the token", async () => {
    const { runner } = fakeRunner({
      clone: async () => {
        throw Object.assign(new Error("clone failed"), { stderr: "fatal: Authentication failed for 'https://...'" });
      },
    });
    const ws = fakeWorkspace();
    const err = await createRemoteRetrieve(runner, ws.deps, new Secret(TOKEN))(cfg("https://github.com/owner/private")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RetrieveError);
    expect((err as RetrieveError).message).toMatch(/scope|permission/i);
    expect((err as RetrieveError).message).toContain("COMMIT_WHISPER_GIT_TOKEN");
    expect((err as RetrieveError).message).not.toContain(TOKEN); // never leaks the token
    expect(ws.removed).toEqual(["/work/commit-whisper-AAAA"]); // still cleaned up
  });

  it("an auth-rejected clone WITHOUT a token → a set-the-var error", async () => {
    const { runner } = fakeRunner({
      clone: async () => {
        throw Object.assign(new Error("clone failed"), { stderr: "fatal: could not read Username for 'https://...': terminal prompts disabled" });
      },
    });
    const ws = fakeWorkspace();
    const err = await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/private")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RetrieveError);
    expect((err as RetrieveError).message).toMatch(/Authentication is required/i);
    expect((err as RetrieveError).message).toContain("COMMIT_WHISPER_GIT_TOKEN");
  });

  it("a NON-auth clone failure stays the generic message (the taxonomy is Story 5.3)", async () => {
    const { runner } = fakeRunner({
      clone: async () => {
        throw Object.assign(new Error("clone failed"), { stderr: "fatal: some unrecognized git problem" });
      },
    });
    const ws = fakeWorkspace();
    const err = await createRemoteRetrieve(runner, ws.deps, new Secret(TOKEN))(cfg("https://example.invalid/repo")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RetrieveError);
    expect((err as RetrieveError).message).toMatch(/Failed to clone/);
    expect((err as RetrieveError).message).not.toContain(TOKEN);
  });
});

function failing(stderr: string): { runner: GitRunner; cloneCalls: () => number } {
  let cloneCalls = 0;
  const runner: GitRunner = async (args) => {
    if (subcommand(args) === "clone") {
      cloneCalls += 1;
      throw Object.assign(new Error("clone failed"), { stderr });
    }
    throw new Error(`unexpected git args: ${args.join(" ")}`);
  };
  return { runner, cloneCalls: () => cloneCalls };
}

describe("createRemoteRetrieve — classified failures + no-retry (Story 5.3)", () => {
  it("a network failure → a network-worded RetrieveError", async () => {
    const { runner } = failing("fatal: unable to access: Could not resolve host: example.invalid");
    const ws = fakeWorkspace();
    const err = await createRemoteRetrieve(runner, ws.deps)(cfg("https://example.invalid/repo")).catch((e: unknown) => e);
    expect((err as RetrieveError).message).toMatch(/network connection/i);
  });

  it("a not-found failure → a not-found-worded RetrieveError", async () => {
    const { runner } = failing("remote: Repository not found.\nfatal: repository not found");
    const ws = fakeWorkspace();
    const err = await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/nope")).catch((e: unknown) => e);
    expect((err as RetrieveError).message).toMatch(/not found|visibility/i);
  });

  it("a rate-limit failure → a rate-limit-worded error that states it will not retry", async () => {
    const { runner } = failing("You have exceeded a secondary rate limit");
    const ws = fakeWorkspace();
    const err = await createRemoteRetrieve(runner, ws.deps)(cfg("https://github.com/owner/repo")).catch((e: unknown) => e);
    expect((err as RetrieveError).message).toMatch(/rate limit/i);
    expect((err as RetrieveError).message).toMatch(/does not retry/i);
  });

  it("clones exactly once on failure — no retry/backoff", async () => {
    const f = failing("fatal: Could not resolve host: example.invalid");
    const ws = fakeWorkspace();
    await createRemoteRetrieve(f.runner, ws.deps)(cfg("https://example.invalid/repo")).catch(() => {});
    expect(f.cloneCalls()).toBe(1);
  });

  it("cleans up the temp dir on every class of failure", async () => {
    for (const stderr of ["Could not resolve host", "Repository not found", "rate limit", "Authentication failed", "boom"]) {
      const { runner } = failing(stderr);
      const ws = fakeWorkspace();
      await createRemoteRetrieve(runner, ws.deps)(cfg("https://x/repo")).catch(() => {});
      expect(ws.removed).toEqual(["/work/commit-whisper-AAAA"]);
    }
  });
});

describe("createRemoteRetrieve — clone failure + cleanup (Story 5.1)", () => {
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
    expect(ws.removed).toEqual(["/work/commit-whisper-AAAA"]); // cleaned despite the failure
  });

  it("a post-clone read error names the URL, never the disposable temp path", async () => {
    const runner: GitRunner = async (args) => {
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
    ).rejects.toThrowError(/https:\/\/github\.com\/owner\/repo/); // the URL, not /work/commit-whisper-AAAA
    expect(ws.removed).toEqual(["/work/commit-whisper-AAAA"]);
  });
});
