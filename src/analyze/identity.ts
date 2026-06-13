/**
 * Author-identity canonicalization (Story 1.5 — C2 determinism rule 3).
 *
 * Pure functions only: `parseMailmap(text)` builds an index from `.mailmap` text,
 * and `canonicalizeIdentity(raw, index)` resolves a raw git identity to its
 * canonical form. Where the `.mailmap` text comes from (the repo file / `git
 * check-mailmap`) is a pipeline concern wired later — `analyze/` stays free of
 * I/O so determinism is enforceable. An empty index means "no rewrites": the
 * fallback still normalizes the email (lowercased + trimmed), which is the
 * identity key, so two commits from the same author with cosmetic email casing
 * collapse to one identity.
 */

import type { Identity } from "../retrieve/retrieve.port.js";

export interface CanonicalIdentity {
  name: string;
  email: string;
}

/**
 * Parsed `.mailmap`. Keyed by normalized lookup email; an entry may be qualified
 * by a commit name when the source line specified one (`<commit-email>` shared by
 * multiple people via different commit names).
 */
export interface MailmapIndex {
  byEmail: Map<string, CanonicalIdentity>;
  byNameEmail: Map<string, CanonicalIdentity>; // key: `${lowerName}\x00${lowerEmail}`
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nameEmailKey(name: string, email: string): string {
  return `${name.trim().toLowerCase()}\x00${normalizeEmail(email)}`;
}

/** Match `Proper Name <proper@email>` / `<proper@email>` segments on a line. */
const SEGMENT = /([^<>]*?)\s*<([^<>]+)>/g;

interface Segment {
  name: string;
  email: string;
}

function segments(line: string): Segment[] {
  const out: Segment[] = [];
  for (const m of line.matchAll(SEGMENT)) {
    out.push({ name: m[1].trim(), email: m[2].trim() });
  }
  return out;
}

/**
 * Parse the common `.mailmap` forms:
 *   Proper Name <proper@x> Commit Name <commit@x>
 *   Proper Name <proper@x> <commit@x>
 *   Proper Name <proper@x>            (canonicalize the name for that email)
 *   <proper@x> <commit@x>             (rewrite email only)
 * `#` comments and blank lines are ignored. Lines that don't parse are skipped.
 */
export function parseMailmap(text: string): MailmapIndex {
  const byEmail = new Map<string, CanonicalIdentity>();
  const byNameEmail = new Map<string, CanonicalIdentity>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line === "") {
      continue;
    }
    const segs = segments(line);
    if (segs.length === 0) {
      continue;
    }
    const canonical: CanonicalIdentity = { name: segs[0].name, email: segs[0].email };

    if (segs.length === 1) {
      // `Proper Name <proper@x>` — canonicalize the name for that email.
      byEmail.set(normalizeEmail(canonical.email), canonical);
      continue;
    }
    // Two segments: the second is the commit identity to rewrite from.
    const commit = segs[1];
    if (commit.name === "") {
      byEmail.set(normalizeEmail(commit.email), canonical);
    } else {
      byNameEmail.set(nameEmailKey(commit.name, commit.email), canonical);
    }
  }

  return { byEmail, byNameEmail };
}

/** An empty index — used when a repo has no `.mailmap`. */
export function emptyMailmap(): MailmapIndex {
  return { byEmail: new Map(), byNameEmail: new Map() };
}

/** Resolve a raw git identity to its canonical form (mailmap, else normalized email). */
export function canonicalizeIdentity(raw: Identity, mailmap: MailmapIndex): CanonicalIdentity {
  const byNameEmail = mailmap.byNameEmail.get(nameEmailKey(raw.name, raw.email));
  if (byNameEmail !== undefined) {
    return byNameEmail;
  }
  const byEmail = mailmap.byEmail.get(normalizeEmail(raw.email));
  if (byEmail !== undefined) {
    return byEmail;
  }
  return { name: raw.name.trim(), email: normalizeEmail(raw.email) };
}
