// @ts-check
/**
 * Pure, cross-platform SEA build PLAN (Story 7.4 · refactored for the release CI
 * matrix). This module holds the per-platform DECISIONS the build makes —
 * extracted from `build-sea.mjs` so the same logic that runs on macOS, Linux,
 * and Windows can be unit-tested on ONE host (the CI matrix runs the real build
 * on all three, but the branching is verified here deterministically).
 *
 * No I/O, no `process` — every input is a parameter, so it is trivially testable.
 */

/** The standard Node SEA sentinel fuse (see the Node.js SEA docs). */
export const SEA_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

/** The Mach-O segment that holds the blob on macOS (Node SEA docs). */
export const MACHO_SEGMENT = "NODE_SEA";

/**
 * The output binary file name for a platform. Windows needs the `.exe`
 * extension to be runnable; POSIX platforms do not.
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
export function binaryNameFor(platform) {
  return platform === "win32" ? "commit-sage.exe" : "commit-sage";
}

/**
 * @typedef {object} SeaPlan
 * @property {boolean} isWindows
 * @property {boolean} isMac
 * @property {string}  binaryName
 * @property {boolean} removeSignature  macOS strips the signature before injecting.
 * @property {boolean} reSign           macOS ad-hoc re-signs so Gatekeeper allows it.
 * @property {boolean} chmod            POSIX marks the copy executable; Windows `.exe` has no mode bits.
 * @property {boolean} npxShell         Windows shells `npx` so `npx.cmd` resolves.
 * @property {string|undefined} machoSegment  Set only on macOS.
 */

/**
 * Resolve the full per-platform build plan.
 * @param {NodeJS.Platform} platform
 * @returns {SeaPlan}
 */
export function seaPlanFor(platform) {
  const isWindows = platform === "win32";
  const isMac = platform === "darwin";
  return {
    isWindows,
    isMac,
    binaryName: binaryNameFor(platform),
    removeSignature: isMac,
    reSign: isMac,
    chmod: !isWindows,
    npxShell: isWindows,
    machoSegment: isMac ? MACHO_SEGMENT : undefined,
  };
}

/**
 * Build the `postject` argument vector for a platform. macOS appends the
 * Mach-O segment name; every platform shares the blob + sentinel-fuse args.
 * @param {object} opts
 * @param {NodeJS.Platform} opts.platform
 * @param {string} opts.binaryPath
 * @param {string} opts.blobPath
 * @returns {string[]}
 */
export function postjectArgsFor({ platform, binaryPath, blobPath }) {
  const args = ["--yes", "postject", binaryPath, "NODE_SEA_BLOB", blobPath, "--sentinel-fuse", SEA_FUSE];
  if (platform === "darwin") {
    args.push("--macho-segment-name", MACHO_SEGMENT);
  }
  return args;
}
