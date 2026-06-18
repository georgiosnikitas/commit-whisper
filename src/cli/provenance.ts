/**
 * Report-JSON provenance builder (Story 4.7 — FR-17).
 *
 * A PURE shaper that assembles the OPTIONAL `provenance` subtree (FR-17) from
 * facts the pipeline already holds — repo identity, scale, AI provider/model, the
 * injected run timestamp + tool version, and the resolved entitlement. No renderer
 * re-derives a provenance fact; it is sourced once here and emitted verbatim in the
 * JSON, then read by the HTML masthead/footer chips.
 *
 * Security (LOAD-BEARING): a remote `repo.target` is CREDENTIAL-STRIPPED — a token
 * embedded in a clone URL (`https://x-access-token:…@host/…`) can never leak into a
 * shareable artifact. Provenance never carries a secret.
 *
 * The `ai` field is a CANDIDATE here (present iff a provider+model are configured);
 * the assembler (`reportFromOutcome`) is the authority that KEEPS it only when
 * narration actually ran, stripping it on a `--no-ai` / fail-open degraded run.
 */

import { basename } from "node:path";

import type { Branch, IsoDate, Provider, Tier } from "../config/run-config.js";
import type { ReportProvenance } from "../assemble/report-schema.js";
import { isRemoteTarget } from "../retrieve/target.js";
import { stripTrailingSlashes } from "../shared/url.js";

export interface ProvenanceInput {
  /** The raw user target (`RunConfig.repoTarget`) — a local path or a remote URL. */
  target: string;
  branch: Branch;
  /** Total reachable commits from retrieval (`history.commits.length`). */
  totalCommits: number;
  /** Commits actually analyzed after selection + the tier cap (`selection.history.commits.length`). */
  analyzedCommits: number;
  /** Distinct `.mailmap`-canonicalized authors in the analyzed history; omitted if unavailable. */
  contributors?: number;
  provider?: Provider;
  model?: string;
  /** The injected determinism anchor (`RunConfig.analysisTimestamp`) — never `Date.now()`. */
  generatedAt: IsoDate;
  toolVersion: string;
  tier: Tier;
  commitCap?: number;
}

/** Build the `provenance` subtree from the run's contextual facts (pure). */
export function buildProvenance(input: ProvenanceInput): ReportProvenance {
  const source: "local" | "remote" = isRemoteTarget(input.target) ? "remote" : "local";
  const repo: NonNullable<ReportProvenance["repo"]> = {
    name: source === "remote" ? remoteSlug(input.target) : localName(input.target),
    target: source === "remote" ? stripCredentials(input.target) : input.target,
    source,
  };
  const branch = branchLabel(input.branch);
  if (branch !== undefined) {
    repo.branch = branch;
  }

  const scale: NonNullable<ReportProvenance["scale"]> = {
    totalCommits: input.totalCommits,
    analyzedCommits: input.analyzedCommits,
  };
  if (input.contributors !== undefined) {
    scale.contributors = input.contributors;
  }

  const provenance: ReportProvenance = {
    repo,
    scale,
    run: { generatedAt: input.generatedAt, toolVersion: input.toolVersion },
    entitlement: buildEntitlement(input.tier, input.commitCap),
  };
  if (input.provider !== undefined && input.model !== undefined) {
    provenance.ai = { provider: input.provider, model: input.model };
  }
  return provenance;
}

/** The entitlement subtree: the tier always, the commit cap ONLY on the Free tier. */
function buildEntitlement(tier: Tier, commitCap: number | undefined): NonNullable<ReportProvenance["entitlement"]> {
  const entitlement: NonNullable<ReportProvenance["entitlement"]> = { tier };
  if (tier === "free" && commitCap !== undefined) {
    entitlement.commitCap = commitCap;
  }
  return entitlement;
}

/** The display label for the analyzed branch — the HEAD sentinel is omitted (undefined). */
export function branchLabel(branch: Branch): string | undefined {
  switch (branch.kind) {
    case "named":
      return branch.name;
    case "all":
      return "all branches";
    case "head":
      return undefined; // the default sentinel carries no meaningful label
    default:
      return undefined;
  }
}

/**
 * Strip any `user:secret@` / `x-access-token:…@` userinfo from a remote URL so an
 * embedded credential never reaches a shareable artifact. A surgical, anchored
 * removal of ONLY the authority's userinfo (linear scan — no super-linear
 * backtracking); a local path or a credential-free URL is returned unchanged.
 */
export function stripCredentials(target: string): string {
  return target.replace(/^(https?:\/\/)[^@/]*@/i, "$1");
}

/**
 * The `owner/repo` slug of a remote URL (or the last path segment / host). Parsed
 * via the URL API so userinfo, query, and fragment are dropped — the slug can
 * never carry a credential. Falls back to a credential-stripped target if the URL
 * does not parse.
 */
export function remoteSlug(target: string): string {
  try {
    const url = new URL(target.trim());
    const path = stripTrailingSlashes(url.pathname).replace(/\.git$/i, "");
    const segments = path.split("/").filter((segment) => segment !== "");
    if (segments.length >= 2) {
      return `${segments.at(-2)}/${segments.at(-1)}`;
    }
    if (segments.length === 1) {
      return segments[0];
    }
    return url.host;
  } catch {
    return stripCredentials(target.trim());
  }
}

/** The basename of a local path; falls back to the trimmed path if it has no clean basename. */
export function localName(target: string): string {
  const trimmed = stripTrailingSlashes(target.trim());
  const base = basename(trimmed);
  if (base === "" || base === "." || base === "..") {
    return trimmed === "" ? target.trim() : trimmed;
  }
  return base;
}
