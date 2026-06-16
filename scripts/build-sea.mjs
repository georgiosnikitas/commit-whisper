// @ts-check
/**
 * Build a Node SEA (Single Executable Application) for commit-whisper (Story 7.4).
 *
 * Pipeline (per the Node.js SEA docs):
 *   1. bundle  — tsup → one self-contained CJS file (dist-sea/commit-whisper.cjs)
 *   2. blob    — `node --experimental-sea-config sea-config.json` → sea-prep.blob
 *   3. copy    — copy the running `node` to the output binary name
 *   4. unsign  — (macOS) strip the signature before injecting
 *   5. inject  — postject the blob into the binary (via `npx --yes`, no committed dep)
 *   6. resign  — (macOS) ad-hoc re-sign so Gatekeeper lets it run
 *   7. chmod   — make it executable
 *
 * Cross-platform: branches on `process.platform` (darwin / linux / win32). This
 * is a BUILD script (trusted, local) — using a shell on Windows to resolve
 * `npx.cmd` is fine here; the PRODUCT never shells out without array args.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { postjectArgsFor, seaPlanFor, SEA_FUSE } from "./sea-plan.mjs";

const OUT_DIR = "dist-sea";
const BUNDLE = join(OUT_DIR, "commit-whisper.cjs");
const BLOB = join(OUT_DIR, "sea-prep.blob");
const SEA_CONFIG = "sea-config.json";

// The full per-platform build plan (binary name, signing, chmod, npx shell,
// Mach-O segment) — pure + unit-tested in tests/sea-plan.test.ts.
const plan = seaPlanFor(process.platform);
const { isWindows, isMac, binaryName } = plan;
const binaryPath = join(OUT_DIR, binaryName);

// The node runtime that becomes the binary base. Must be an OFFICIAL Node.js
// build (from nodejs.org) — those embed the SEA fuse sentinel. Homebrew / some
// nvm / distro builds omit it and cannot be injected. Override with the env var
// when the running node isn't suitable.
const baseNode = process.env.COMMIT_WHISPER_SEA_NODE ?? process.execPath;

/**
 * Run a command, inheriting stdio. `node` / `codesign` are real executables run
 * WITHOUT a shell, so a base-node path with spaces (e.g. `C:\Program Files\…`)
 * is passed intact. `npx` needs a shell on Windows to resolve `npx.cmd`; its args
 * here are all space-free relative paths, so shelling it is safe.
 */
function run(command, args, { shell = false } = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", shell });
}

function step(label) {
  console.log(`\n=== ${label} ===`);
}

/** True if the binary embeds the SEA fuse sentinel (i.e. an official Node build). */
function hasSeaFuse(path) {
  try {
    return readFileSync(path).includes(SEA_FUSE);
  } catch {
    return false;
  }
}

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// Validate the base node up front (it is first used to generate the blob): it
// must exist AND embed the SEA fuse sentinel, else nothing downstream can work.
console.log(`base node: ${baseNode}`);
if (!existsSync(baseNode)) {
  throw new Error(
    `Base node binary not found: ${baseNode}\n` +
      `Set COMMIT_WHISPER_SEA_NODE to an official Node.js build (https://nodejs.org/dist).`,
  );
}
if (!hasSeaFuse(baseNode)) {
  throw new Error(
    `The base node binary has no SEA fuse — it cannot be injected.\n` +
      `  ${baseNode}\n` +
      `Use an OFFICIAL Node.js build from https://nodejs.org/dist (Homebrew / some nvm / distro\n` +
      `builds omit the fuse), then point this script at it:\n` +
      `  COMMIT_WHISPER_SEA_NODE=/path/to/official/bin/node npm run build:sea`,
  );
}

step("1/7 Bundle the app to a single self-contained CJS file");
run("npx", ["--no-install", "tsup", "--config", "tsup.sea.config.ts"], { shell: isWindows });
if (!existsSync(BUNDLE)) {
  throw new Error(`Bundle not produced: ${BUNDLE}`);
}

step("2/7 Generate the SEA preparation blob");
// `node --experimental-sea-config <config>` reads the bundle named in the config
// and writes the blob. Use the SAME node that becomes the binary base so the
// blob format matches the runtime (avoids a version-mismatch at launch).
run(baseNode, ["--experimental-sea-config", SEA_CONFIG]);
if (!existsSync(BLOB)) {
  throw new Error(`SEA blob not produced: ${BLOB}`);
}

step("3/7 Copy the node runtime to the output binary");
copyFileSync(baseNode, binaryPath);
// The source `node` is often read-only (e.g. Homebrew ships it r-x); make our
// copy writable NOW so codesign + postject can modify it in place. Windows `.exe`
// files have no Unix mode bits (chmod would throw ENOTSUP), so skip it there.
if (!isWindows) {
  chmodSync(binaryPath, 0o755);
}

if (isMac) {
  step("4/7 (macOS) Remove the existing code signature");
  run("codesign", ["--remove-signature", binaryPath]);
} else {
  console.log("\n=== 4/7 (skipped — signature removal is macOS-only) ===");
}

step("5/7 Inject the blob with postject");
// The Mach-O segment (macOS) is folded into the plan-built arg vector.
const postjectArgs = postjectArgsFor({ platform: process.platform, binaryPath, blobPath: BLOB });
run("npx", postjectArgs, { shell: isWindows });

if (isMac) {
  step("6/7 (macOS) Re-sign the binary (ad-hoc) so Gatekeeper allows it");
  run("codesign", ["--sign", "-", binaryPath]);
} else {
  console.log("\n=== 6/7 (skipped — re-signing is macOS-only; Windows may use signtool) ===");
}

step("7/7 Mark the binary executable");
if (!isWindows) {
  chmodSync(binaryPath, 0o755);
}

console.log(`\n✓ SEA binary built: ${binaryPath}`);
const smokeBinary = isWindows ? binaryPath : `./${binaryPath}`;
console.log(`  Smoke-test it:  ${smokeBinary} --version`);
