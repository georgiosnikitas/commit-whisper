import { describe, it, expect } from "vitest";

import { buildProvenance, stripCredentials, remoteSlug, localName, branchLabel, type ProvenanceInput } from "./provenance.js";

const BASE: ProvenanceInput = {
  target: "/home/dev/payments-api",
  branch: { kind: "named", name: "main" },
  totalCommits: 1204,
  analyzedCommits: 100,
  contributors: 87,
  provider: "anthropic",
  model: "claude-sonnet-4",
  generatedAt: "2026-06-12T00:00:00Z",
  toolVersion: "1.0.8",
  tier: "free",
  commitCap: 100,
};

describe("buildProvenance — repo identity", () => {
  it("a local target → source 'local', name = basename, target = the path verbatim", () => {
    const p = buildProvenance(BASE);
    expect(p.repo).toEqual({ name: "payments-api", target: "/home/dev/payments-api", source: "local", branch: "main" });
  });

  it("a remote target → source 'remote', name = owner/repo slug, target = the URL", () => {
    const p = buildProvenance({ ...BASE, target: "https://github.com/acme/payments-api.git" });
    expect(p.repo?.source).toBe("remote");
    expect(p.repo?.name).toBe("acme/payments-api");
    expect(p.repo?.target).toBe("https://github.com/acme/payments-api.git");
  });

  it("omits repo.branch for the HEAD sentinel, labels named / all", () => {
    expect(buildProvenance({ ...BASE, branch: { kind: "head" } }).repo?.branch).toBeUndefined();
    expect(buildProvenance({ ...BASE, branch: { kind: "all" } }).repo?.branch).toBe("all branches");
    expect(buildProvenance({ ...BASE, branch: { kind: "named", name: "release/2.0" } }).repo?.branch).toBe("release/2.0");
  });
});

describe("buildProvenance — SECURITY: a token-bearing remote URL is credential-stripped", () => {
  it("strips an x-access-token clone URL so NO token substring survives in repo.target", () => {
    const p = buildProvenance({ ...BASE, target: "https://x-access-token:ghp_SUPERSECRET@github.com/acme/payments-api.git" });
    expect(p.repo?.target).toBe("https://github.com/acme/payments-api.git");
    expect(p.repo?.target).not.toContain("ghp_SUPERSECRET");
    expect(p.repo?.target).not.toContain("x-access-token");
    // The display name is parsed from the path only — never carries the credential either.
    expect(p.repo?.name).toBe("acme/payments-api");
    expect(JSON.stringify(p)).not.toContain("ghp_SUPERSECRET");
  });

  it("strips a user:password@ clone URL", () => {
    const p = buildProvenance({ ...BASE, target: "https://alice:hunter2@gitlab.com/team/repo" });
    expect(p.repo?.target).toBe("https://gitlab.com/team/repo");
    expect(JSON.stringify(p)).not.toContain("hunter2");
  });
});

describe("buildProvenance — scale, run, entitlement, ai", () => {
  it("carries the scale counts and the injected run timestamp + tool version", () => {
    const p = buildProvenance(BASE);
    expect(p.scale).toEqual({ totalCommits: 1204, analyzedCommits: 100, contributors: 87 });
    expect(p.run).toEqual({ generatedAt: "2026-06-12T00:00:00Z", toolVersion: "1.0.8" });
  });

  it("omits scale.contributors when the count is unavailable", () => {
    const p = buildProvenance({ ...BASE, contributors: undefined });
    expect(p.scale?.contributors).toBeUndefined();
    expect(p.scale?.totalCommits).toBe(1204);
  });

  it("records the commit cap ONLY on the Free tier", () => {
    expect(buildProvenance(BASE).entitlement).toEqual({ tier: "free", commitCap: 100 });
    expect(buildProvenance({ ...BASE, tier: "unlimited", commitCap: undefined }).entitlement).toEqual({ tier: "unlimited" });
    // A stray cap on a paid tier is dropped (cap is a Free-only field).
    expect(buildProvenance({ ...BASE, tier: "single-device", commitCap: 100 }).entitlement).toEqual({ tier: "single-device" });
  });

  it("builds the ai CANDIDATE when a provider+model are configured, omits it otherwise", () => {
    expect(buildProvenance(BASE).ai).toEqual({ provider: "anthropic", model: "claude-sonnet-4" });
    expect(buildProvenance({ ...BASE, provider: undefined }).ai).toBeUndefined();
    expect(buildProvenance({ ...BASE, model: undefined }).ai).toBeUndefined();
  });
});

describe("stripCredentials", () => {
  it("removes userinfo from a remote URL, leaving the rest verbatim (no normalization)", () => {
    expect(stripCredentials("https://x-access-token:tok@github.com/o/r.git")).toBe("https://github.com/o/r.git");
    expect(stripCredentials("https://u:p@host/path")).toBe("https://host/path");
  });

  it("leaves a credential-free URL and a local path untouched", () => {
    expect(stripCredentials("https://github.com/o/r")).toBe("https://github.com/o/r");
    expect(stripCredentials("/home/user@host/repo")).toBe("/home/user@host/repo"); // not a URL — no scheme
    expect(stripCredentials("https://github.com/o/r@v1")).toBe("https://github.com/o/r@v1"); // @ in path, not authority
  });
});

describe("remoteSlug", () => {
  it("extracts owner/repo, a single segment, or the host", () => {
    expect(remoteSlug("https://github.com/acme/payments-api.git")).toBe("acme/payments-api");
    expect(remoteSlug("https://gitlab.com/group/subgroup/repo")).toBe("subgroup/repo");
    expect(remoteSlug("https://example.com/repo/")).toBe("repo");
    expect(remoteSlug("https://example.com")).toBe("example.com");
  });

  it("never carries credentials from a token-bearing URL", () => {
    expect(remoteSlug("https://x-access-token:ghp_x@github.com/acme/repo.git")).toBe("acme/repo");
  });
});

describe("localName", () => {
  it("takes the basename, tolerating a trailing slash", () => {
    expect(localName("/Users/dev/payments-api")).toBe("payments-api");
    expect(localName("/Users/dev/payments-api/")).toBe("payments-api");
    expect(localName("payments-api")).toBe("payments-api");
  });
});

describe("branchLabel", () => {
  it("maps the Branch sentinel to a label, omitting HEAD", () => {
    expect(branchLabel({ kind: "named", name: "main" })).toBe("main");
    expect(branchLabel({ kind: "all" })).toBe("all branches");
    expect(branchLabel({ kind: "head" })).toBeUndefined();
  });
});
