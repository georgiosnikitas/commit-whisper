import { describe, it, expect, vi } from "vitest";

const execFileMock = vi.fn(
  (
    _cmd: string,
    _args: readonly string[],
    _opts: unknown,
    cb: (err: null, result: { stdout: string; stderr: string }) => void,
  ) => cb(null, { stdout: "MOCK_OUT", stderr: "" }),
);

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

const { execFileGitRunner } = await import("./git.js");

describe("execFileGitRunner", () => {
  it("invokes the system git with the args array (no shell) and returns stdout", async () => {
    const out = await execFileGitRunner(["log", "--numstat"], { cwd: "/repo" });
    expect(out).toBe("MOCK_OUT");
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = execFileMock.mock.calls[0];
    expect(cmd).toBe("git");
    expect(args).toEqual(["log", "--numstat"]);
    expect(opts).toMatchObject({ cwd: "/repo", windowsHide: true });
  });

  it("passes no `env` when no extraEnv is given (clean inherit of process.env)", async () => {
    execFileMock.mockClear();
    await execFileGitRunner(["log"], { cwd: "/repo" });
    const opts = execFileMock.mock.calls[0][2] as { env?: unknown };
    expect(opts.env).toBeUndefined();
  });

  it("merges extraEnv over the inherited env when given (the git-auth channel, Story 5.2)", async () => {
    execFileMock.mockClear();
    await execFileGitRunner(["clone"], { cwd: "/repo", extraEnv: { GIT_TERMINAL_PROMPT: "0", COMMIT_WHISPER_GIT_PAT: "tok" } });
    const opts = execFileMock.mock.calls[0][2] as { env?: Record<string, string> };
    expect(opts.env).toMatchObject({ GIT_TERMINAL_PROMPT: "0", COMMIT_WHISPER_GIT_PAT: "tok" });
    // The inherited base env is merged in too (more than just the two extras present).
    expect(Object.keys(opts.env ?? {}).length).toBeGreaterThan(2);
  });
});
