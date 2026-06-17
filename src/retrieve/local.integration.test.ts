import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalRetrieve } from "./local.js";
import type { RunConfig } from "../config/run-config.js";
import { RetrieveError } from "../shared/errors.js";

/** Probe git availability once; skip the suite cleanly if absent (e.g. minimal CI). */
let gitAvailable = false;
try {
  execFileSync("git", ["--version"], { stdio: "ignore" });
  gitAvailable = true;
} catch {
  gitAvailable = false;
}

function cfg(repoTarget: string): RunConfig {
  return { repoTarget } as unknown as RunConfig;
}

/** Run git in `cwd` with an explicit local identity (no global config / env needed). */
function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args],
    {
      cwd,
      encoding: "utf8",
    },
  );
}

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "cs-retrieve-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe.skipIf(!gitAvailable)("createLocalRetrieve — integration (real git)", () => {
  it("reads real commits, identities, parents, and changed files", async () => {
    const dir = makeTempDir();
    git(dir, "init", "--initial-branch=main");
    writeFileSync(join(dir, "README.md"), "hello\n");
    git(dir, "add", ".");
    git(dir, "commit", "-m", "Initial commit");

    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\n");
    writeFileSync(join(dir, "src", "b.ts"), "export const b = 2;\n");
    git(dir, "add", ".");
    git(dir, "commit", "-m", "Add sources\n\nTwo files.");

    const history = await createLocalRetrieve()(cfg(dir));

    expect(history.repoTarget).toBe(dir);
    expect(history.commits).toHaveLength(2);

    // git log emits newest-first: [Add sources, Initial commit]
    const [second, first] = history.commits;
    expect(first.parents).toEqual([]); // root commit
    expect(first.message).toBe("Initial commit");
    expect(first.files.map((f) => f.path)).toEqual(["README.md"]);

    expect(second.parents).toEqual([first.sha]);
    expect(second.message).toBe("Add sources\n\nTwo files.");
    expect(second.author).toEqual({ name: "Test", email: "test@example.com" });
    expect(second.files.map((f) => f.path).sort((a, b) => a.localeCompare(b))).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(second.authoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not mutate the repository (AC3 read-only)", async () => {
    const dir = makeTempDir();
    git(dir, "init", "--initial-branch=main");
    writeFileSync(join(dir, "f.txt"), "x\n");
    git(dir, "add", ".");
    git(dir, "commit", "-m", "c1");

    const statusBefore = git(dir, "status", "--porcelain");
    const headBefore = git(dir, "rev-parse", "HEAD");

    await createLocalRetrieve()(cfg(dir));

    expect(git(dir, "status", "--porcelain")).toBe(statusBefore);
    expect(git(dir, "status", "--porcelain")).toBe(""); // clean before and after
    expect(git(dir, "rev-parse", "HEAD")).toBe(headBefore);
  });

  it("returns an empty history for an initialized repo with no commits", async () => {
    const dir = makeTempDir();
    git(dir, "init", "--initial-branch=main");
    const history = await createLocalRetrieve()(cfg(dir));
    expect(history.commits).toEqual([]);
  });

  it("throws RetrieveError (exit 4) for a non-git directory", async () => {
    const dir = makeTempDir(); // created, never `git init`-ed
    await expect(createLocalRetrieve()(cfg(dir))).rejects.toBeInstanceOf(RetrieveError);
    await expect(createLocalRetrieve()(cfg(dir))).rejects.toMatchObject({ exitCode: 4 });
  });
});
