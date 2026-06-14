import { describe, it, expect } from "vitest";

import { classifyCloneFailure, cloneFailureError, type CloneFailureKind } from "./errors.js";
import { RetrieveError } from "../shared/errors.js";

/** A fake execFile-style rejection carrying git's stderr. */
function gitError(stderr: string): Error {
  return Object.assign(new Error("Command failed: git clone"), { stderr });
}

describe("classifyCloneFailure", () => {
  const cases: ReadonlyArray<[string, CloneFailureKind]> = [
    ["fatal: unable to access 'https://x/': Could not resolve host: github.com", "network"],
    ["fatal: unable to access 'https://x/': Failed to connect to github.com port 443: Connection refused", "network"],
    ["fatal: unable to access 'https://x/': Operation timed out after 30000 ms", "network"],
    ["fatal: unable to access 'https://x/': SSL certificate problem", "network"],
    ["fatal: Authentication failed for 'https://github.com/owner/repo'", "auth"],
    ["remote: HTTP Basic: Access denied\nfatal: Authentication failed", "auth"],
    ["fatal: could not read Username for 'https://github.com': terminal prompts disabled", "auth"],
    ["error: The requested URL returned error: 403", "auth"],
    ["remote: Repository not found.\nfatal: repository 'https://github.com/owner/nope/' not found", "not-found"],
    ["error: The requested URL returned error: 404", "not-found"],
    ["You have exceeded a secondary rate limit", "rate-limit"],
    ["error: The requested URL returned error: 429 Too Many Requests", "rate-limit"],
    ["fatal: some unrecognized git problem", "unknown"],
    ["", "unknown"],
  ];

  it.each(cases)("classifies %j as %s", (stderr, kind) => {
    expect(classifyCloneFailure(gitError(stderr))).toBe(kind);
  });

  it("resolves overlapping signals by order: 429 is rate-limit (not auth), 403 is auth (not not-found)", () => {
    // A 429 could loosely read as a failure, but rate-limit wins (checked first).
    expect(classifyCloneFailure(gitError("returned error: 429"))).toBe("rate-limit");
    // A 403 is an explicit auth reject, classified auth before any not-found text.
    expect(classifyCloneFailure(gitError("returned error: 403 Forbidden — not found in your scope"))).toBe("auth");
  });

  it("a non-Error / missing-field cause is unknown (never a crash)", () => {
    expect(classifyCloneFailure(null)).toBe("unknown");
    expect(classifyCloneFailure(undefined)).toBe("unknown");
    expect(classifyCloneFailure("a string")).toBe("unknown");
    expect(classifyCloneFailure({ stderr: 42 })).toBe("unknown"); // non-string stderr
  });
});

describe("cloneFailureError", () => {
  const URL = "https://github.com/owner/repo";

  it("produces a RetrieveError (exit 4) with a class-specific, actionable message", () => {
    const network = cloneFailureError(URL, false, gitError("Could not resolve host: github.com"));
    expect(network).toBeInstanceOf(RetrieveError);
    expect(network.exitCode).toBe(4);
    expect(network.message).toMatch(/network connection/i);

    expect(cloneFailureError(URL, false, gitError("Repository not found")).message).toMatch(/not found|visibility/i);
    expect(cloneFailureError(URL, false, gitError("exceeded a secondary rate limit")).message).toMatch(/rate limit/i);
    expect(cloneFailureError(URL, false, gitError("exceeded a secondary rate limit")).message).toMatch(/does not retry/i);
    expect(cloneFailureError(URL, false, gitError("boom")).message).toMatch(/Failed to clone/);
  });

  it("keeps the 5.2 auth token-present / token-absent split", () => {
    expect(cloneFailureError(URL, true, gitError("Authentication failed")).message).toMatch(/scope|permission/i);
    expect(cloneFailureError(URL, true, gitError("Authentication failed")).message).toContain("COMMIT_SAGE_GIT_TOKEN");
    expect(cloneFailureError(URL, false, gitError("could not read Username")).message).toMatch(/Authentication is required/i);
  });

  it("never contains the token value (the message takes only the URL + booleans)", () => {
    // The token never reaches this function — but lock that no class echoes a secret-shaped string.
    const SECRET = "ghp_supersecretvalue";
    for (const stderr of ["Authentication failed", "Could not resolve host", "Repository not found", "rate limit", "boom"]) {
      const err = cloneFailureError(URL, true, Object.assign(gitError(stderr), { token: SECRET }));
      expect(err.message).not.toContain(SECRET);
    }
  });

  it("attaches git's raw error as `cause` (never rendered) — the message stays curated", () => {
    const raw = gitError("Could not resolve host: github.com");
    const err = cloneFailureError(URL, false, raw);
    expect(err.cause).toBe(raw); // raw stderr available for debugging, never in the user message
    expect(err.message).not.toContain("Could not resolve host"); // git's raw text is not echoed verbatim
  });

  it("redacts userinfo from the URL so a credential mistakenly embedded in it never echoes", () => {
    const withCreds = "https://user:ghp_embeddedsecret@github.com/owner/repo";
    const err = cloneFailureError(withCreds, false, gitError("Could not resolve host"));
    expect(err.message).not.toContain("ghp_embeddedsecret"); // the embedded secret is stripped
    expect(err.message).toContain("//***@github.com/owner/repo"); // redacted, still recognizable
  });
});
