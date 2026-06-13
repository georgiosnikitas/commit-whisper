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
});
