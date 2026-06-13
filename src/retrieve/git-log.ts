/**
 * `git log` command builder + pure parser (Story 1.4).
 *
 * The format delimits records with ASCII RS (`\x1e`) and fields with US
 * (`\x1f`) — non-printing control characters that never appear in commit
 * content — and brackets the multi-line body (`%B`) with `\x1f` on both sides so
 * the trailing `--numstat` block is unambiguously separable. `parseGitLog` is a
 * PURE function (no I/O) for table-testing against canned output.
 */

import type { ChangedFile, RawCommit } from "./retrieve.port.js";

const RS = "\x1e"; // record separator (between commits)
const US = "\x1f"; // unit separator (between fields)

/** Strict ISO-8601 timestamps (%aI/%cI); body (%B) bracketed by US on both sides. */
export const GIT_LOG_FORMAT = `${RS}%H${US}%an${US}%ae${US}%aI${US}%cn${US}%ce${US}%cI${US}%P${US}%B${US}`;

/**
 * Read-only `git log` args for the full HEAD history with per-file numstat.
 *
 * `-c` pins ambient git config that would otherwise reshape the parser's input
 * per-machine: `log.showSignature=false` keeps GPG signature lines out of the
 * stream, and `core.quotePath=false` emits UTF-8 paths verbatim instead of
 * octal-escaped, double-quoted ones. All read-only.
 */
export function gitLogArgs(): string[] {
  return [
    "-c",
    "log.showSignature=false",
    "-c",
    "core.quotePath=false",
    "log",
    "--numstat",
    "--no-color",
    `--pretty=format:${GIT_LOG_FORMAT}`,
  ];
}

/** Resolve a `--numstat` rename path (`old => new`, incl. brace form) to the new path. */
function resolveNumstatPath(raw: string): string {
  if (!raw.includes(" => ")) {
    return raw;
  }
  const brace = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(raw);
  if (brace) {
    const [, prefix, , next, suffix] = brace;
    return `${prefix}${next}${suffix}`.replace(/\/{2,}/g, "/");
  }
  return raw.slice(raw.indexOf(" => ") + " => ".length);
}

/** Parse the `--numstat` block trailing a commit record into changed-file entries. */
function parseNumstat(block: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const line of block.split(/\r?\n/)) {
    const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (match === null) {
      continue;
    }
    const [, add, del, path] = match;
    files.push({
      path: resolveNumstatPath(path),
      additions: add === "-" ? null : Number(add),
      deletions: del === "-" ? null : Number(del),
    });
  }
  return files;
}

/** Parse `git log` output (the format above) into raw commit records. PURE. */
export function parseGitLog(stdout: string): RawCommit[] {
  const commits: RawCommit[] = [];
  for (const record of stdout.split(RS)) {
    if (record === "") {
      continue; // the empty leading chunk before the first RS
    }
    const parts = record.split(US);
    if (parts.length < 9) {
      continue; // malformed record — skip defensively
    }
    const [sha, authorName, authorEmail, authoredAt, committerName, committerEmail, committedAt, parents, body] =
      parts;
    commits.push({
      sha,
      author: { name: authorName, email: authorEmail },
      committer: { name: committerName, email: committerEmail },
      authoredAt,
      committedAt,
      message: body.replace(/\r?\n$/, ""),
      parents: parents.trim() === "" ? [] : parents.trim().split(/\s+/),
      files: parseNumstat(parts[9] ?? ""),
    });
  }
  return commits;
}
