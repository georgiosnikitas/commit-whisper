import { describe, it, expect } from "vitest";

import { canonicalizeIdentity, emptyMailmap, parseMailmap } from "./identity.js";

describe("parseMailmap", () => {
  it("maps a full Proper/Commit line", () => {
    const idx = parseMailmap("Proper Name <proper@x.com> Commit Name <commit@x.com>");
    expect(canonicalizeIdentity({ name: "Commit Name", email: "commit@x.com" }, idx)).toEqual({
      name: "Proper Name",
      email: "proper@x.com",
    });
  });

  it("maps an email-only rewrite", () => {
    const idx = parseMailmap("Proper Name <proper@x.com> <old@x.com>");
    expect(canonicalizeIdentity({ name: "Whoever", email: "old@x.com" }, idx)).toEqual({
      name: "Proper Name",
      email: "proper@x.com",
    });
  });

  it("canonicalizes the name for a single-segment line", () => {
    const idx = parseMailmap("Proper Name <proper@x.com>");
    expect(canonicalizeIdentity({ name: "proper", email: "PROPER@x.com" }, idx)).toEqual({
      name: "Proper Name",
      email: "proper@x.com",
    });
  });

  it("ignores comments and blank lines", () => {
    const idx = parseMailmap("# a comment\n\n   \nProper <p@x.com> <c@x.com>\n");
    expect(canonicalizeIdentity({ name: "x", email: "c@x.com" }, idx).email).toBe("p@x.com");
  });
});

describe("canonicalizeIdentity fallback (no mailmap hit)", () => {
  it("lowercases and trims the email and trims the name", () => {
    expect(canonicalizeIdentity({ name: "  Alice  ", email: "  Alice@X.COM " }, emptyMailmap())).toEqual({
      name: "Alice",
      email: "alice@x.com",
    });
  });

  it("collapses two cosmetically-different emails to one identity", () => {
    const a = canonicalizeIdentity({ name: "Alice", email: "alice@x.com" }, emptyMailmap());
    const b = canonicalizeIdentity({ name: "Alice", email: "ALICE@x.com" }, emptyMailmap());
    expect(a).toEqual(b);
  });
});
