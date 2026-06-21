import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";

const execFileMock = vi.fn(
  (
    _cmd: string,
    _args: readonly string[],
    _opts: unknown,
    cb: (err: null, result: { stdout: string; stderr: string }) => void,
  ) => cb(null, { stdout: "MOCK_OUT", stderr: "" }),
);

/** A fake child process that streams one stdout chunk then closes 0 (a successful streamed read). */
const spawnCalls: Array<{ cmd: string; args: readonly string[] }> = [];
const spawnMock = vi.fn((cmd: string, args: readonly string[]) => {
  spawnCalls.push({ cmd, args });
  const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter & { setEncoding: () => void }; stderr: EventEmitter & { setEncoding: () => void } };
  child.stdout = Object.assign(new EventEmitter(), { setEncoding: (): void => {} });
  child.stderr = Object.assign(new EventEmitter(), { setEncoding: (): void => {} });
  queueMicrotask(() => {
    child.stdout.emit("data", "STREAM_OUT");
    child.emit("close", 0);
  });
  return child;
});

vi.mock("node:child_process", () => ({ execFile: execFileMock, spawn: spawnMock }));

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

  it("streams via spawn (not execFile) when onChunk is given, returning the full stdout and reporting each chunk", async () => {
    execFileMock.mockClear();
    spawnMock.mockClear();
    const chunks: string[] = [];
    const out = await execFileGitRunner(["log", "--numstat"], { cwd: "/repo", onChunk: (c) => chunks.push(c) });
    expect(out).toBe("STREAM_OUT");
    expect(chunks).toEqual(["STREAM_OUT"]);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).not.toHaveBeenCalled(); // the streamed path does NOT use execFile
    expect(spawnCalls[0]).toEqual({ cmd: "git", args: ["log", "--numstat"] });
  });
});
