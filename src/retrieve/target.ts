/**
 * Target classification — local path vs remote HTTPS URL (Story 5.1).
 *
 * A pure predicate the retrieve dispatcher uses to pick the local adapter (a
 * filesystem path) or the remote adapter (a clone-into-temp). Anchored to an
 * `https?://` scheme so a filesystem path can never be misread as a URL and a
 * `-`-leading argument can never reach `git clone` as an option. SSH targets
 * (`git@…` / `ssh://`) and private-auth are Story 5.2 — out of scope here.
 */

/** A URL with an http(s) scheme — the remote forms commit-sage clones. */
const REMOTE_SCHEME = /^https?:\/\//i;

/** True iff `target` is a remote HTTP(S) URL; false for a local filesystem path. */
export function isRemoteTarget(target: string): boolean {
  return REMOTE_SCHEME.test(target.trim());
}
