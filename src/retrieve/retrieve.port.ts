/**
 * Retrieve port + raw data model (Story 1.4).
 *
 * `retrieve/` reads a repository's history via a shell-out to the system `git`
 * and emits RAW commit records. The normalized model, `.mailmap`-aware identity
 * canonicalization, and the deterministic `[committerDate, sha]` ordering are
 * `analyze/`'s job (Story 1.5) — retrieve does NOT canonicalize or re-sort.
 *
 * The pipeline depends on the `RetrievePort` contract (not the implementation),
 * so a fake retriever can be substituted in pipeline tests. The frozen
 * `RunConfig` crosses the hexagonal boundary; the local adapter reads
 * `config.repoTarget` (already defaulted to cwd by the 1.2 resolver).
 */

import type { RunConfig } from "../config/run-config.js";

/** A git identity (name + email), raw — not `.mailmap`-canonicalized here. */
export interface Identity {
  name: string;
  email: string;
}

/**
 * Per-file change metadata from `git log --numstat`. `additions`/`deletions` are
 * `null` for a binary file (git emits `-`).
 */
export interface ChangedFile {
  path: string;
  additions: number | null;
  deletions: number | null;
}

/** A raw commit record as read from `git log` (pre-normalization). */
export interface RawCommit {
  sha: string;
  author: Identity;
  committer: Identity;
  authoredAt: string; // ISO-8601 (%aI)
  committedAt: string; // ISO-8601 (%cI)
  message: string; // full raw body (%B)
  parents: string[]; // %P split; empty for a root commit
  files: ChangedFile[];
}

/** The raw history a retriever produces. */
export interface RepoHistory {
  repoTarget: string;
  commits: RawCommit[];
}

/** The contract the pipeline depends on. */
export type RetrievePort = (config: RunConfig) => Promise<RepoHistory>;
