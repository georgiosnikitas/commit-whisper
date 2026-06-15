/**
 * The license cache (Story 7.1 read · Story 7.2 write/clear).
 *
 * `~/.commit-sage/license.json` holds the licensing artifacts a one-time
 * interactive **Activate** caches so later runs resolve the paid tier without
 * re-supplying anything: the server-issued **activation-instance id** (the
 * device identifier) and the **license key** (a credential, not a user secret —
 * architecture I3 sanctions caching it; the PAT and LLM key stay env-only and
 * never touch this file). ONLY these two fields are ever written.
 *
 * Reads NEVER throw (missing / corrupt → `{}`). The write is ATOMIC (temp +
 * `rename` in the same dir; the temp is cleaned on a rename failure), mirroring
 * the config-store. All I/O is injected so the suite never touches real disk.
 */

import { join } from "node:path";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

import { configHome } from "../config/config-store.js";

const LICENSE_FILE_NAME = "license.json";

/** The cached licensing artifacts (the closed allow-list — no other field is written). */
export interface LicenseCache {
  instanceId?: string;
  licenseKey?: string;
}

/** The injectable filesystem seam (so the store is unit-tested with no real disk). */
export interface LicenseStoreIo {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

export const defaultLicenseStoreIo: LicenseStoreIo = {
  readFile: (path) => readFile(path, "utf8"),
  writeFile: (path, data) => writeFile(path, data, "utf8"),
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  rename: (from, to) => rename(from, to),
  unlink: async (path) => {
    try {
      await unlink(path);
    } catch {
      // Best-effort — a missing file is fine.
    }
  },
};

/** The license cache file path inside the config home. */
export function licenseFilePath(env: NodeJS.ProcessEnv): string {
  return join(configHome(env), LICENSE_FILE_NAME);
}

/** Trim to a non-empty string, or `undefined`. */
function str(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const v = raw.trim();
  return v === "" ? undefined : v;
}

/**
 * Read the cached licensing artifacts. A missing / corrupt / shapeless file → `{}`
 * (never throws). Only the two allow-listed fields are returned.
 */
export async function readLicenseCache(
  env: NodeJS.ProcessEnv,
  io: LicenseStoreIo = defaultLicenseStoreIo,
): Promise<LicenseCache> {
  try {
    const parsed = JSON.parse(await io.readFile(licenseFilePath(env))) as unknown;
    if (parsed === null || typeof parsed !== "object") {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    const cache: LicenseCache = {};
    const instanceId = str(record.instanceId);
    if (instanceId !== undefined) {
      cache.instanceId = instanceId;
    }
    const licenseKey = str(record.licenseKey);
    if (licenseKey !== undefined) {
      cache.licenseKey = licenseKey;
    }
    return cache;
  } catch {
    return {};
  }
}

/**
 * Read the cached activation-instance id (the device identifier). A
 * `COMMIT_SAGE_LICENSE_INSTANCE` env override wins; otherwise the cached value.
 */
export async function readActivationInstanceId(
  env: NodeJS.ProcessEnv,
  io: LicenseStoreIo = defaultLicenseStoreIo,
): Promise<string | undefined> {
  const override = str(env.COMMIT_SAGE_LICENSE_INSTANCE);
  if (override !== undefined) {
    return override;
  }
  return (await readLicenseCache(env, io)).instanceId;
}

/**
 * Read the cached license key (the "may be cached" path that lets a one-time
 * interactive Activate resolve the paid tier on later runs). Env still wins at
 * the call site (`readLicenseKey(env) ?? readCachedLicenseKey(env)`).
 */
export async function readCachedLicenseKey(
  env: NodeJS.ProcessEnv,
  io: LicenseStoreIo = defaultLicenseStoreIo,
): Promise<string | undefined> {
  return (await readLicenseCache(env, io)).licenseKey;
}

/** Serialize ONLY the two allow-listed fields (pretty) — no other key is ever written. */
function serializeCache(cache: LicenseCache): string {
  const ordered: Record<string, string> = {};
  if (cache.instanceId !== undefined) {
    ordered.instanceId = cache.instanceId;
  }
  if (cache.licenseKey !== undefined) {
    ordered.licenseKey = cache.licenseKey;
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * Persist the license cache via an ATOMIC write (temp + `rename` in the same
 * dir). Returns the final path. Accepts ONLY `LicenseCache` — no other field can
 * be serialised.
 */
export async function writeLicenseCache(
  env: NodeJS.ProcessEnv,
  cache: LicenseCache,
  io: LicenseStoreIo = defaultLicenseStoreIo,
): Promise<string> {
  const home = configHome(env);
  const finalPath = join(home, LICENSE_FILE_NAME);
  const tempPath = join(home, `${LICENSE_FILE_NAME}.${randomSuffix()}.tmp`);
  await io.mkdir(home);
  await io.writeFile(tempPath, serializeCache(cache));
  try {
    await io.rename(tempPath, finalPath);
  } catch (err) {
    await io.unlink(tempPath);
    throw err;
  }
  return finalPath;
}

/** Clear the license cache (deactivate). Best-effort — a missing file is fine. */
export async function clearLicenseCache(
  env: NodeJS.ProcessEnv,
  io: LicenseStoreIo = defaultLicenseStoreIo,
): Promise<void> {
  await io.unlink(licenseFilePath(env));
}

/** A short random suffix for the temp file name (collision-avoidance, not security). */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
