/**
 * The cached activation-instance reader (Story 7.1 — READ only).
 *
 * A paid validation may transmit the server-issued activation-instance id as the
 * device identifier. Story 7.2's `activate` flow caches it under the config home
 * (`~/.commit-sage/license.json`); 7.1 only READS it (validate-only). A
 * `COMMIT_SAGE_LICENSE_INSTANCE` env override is accepted (e.g. CI pinning an
 * instance). A missing or corrupt file resolves to `undefined` (never throws).
 *
 * The cached instance id is a licensing artifact, NOT a user secret — distinct
 * from the env-only rule governing the PAT and the LLM key.
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";

import { configHome } from "../config/config-store.js";

const LICENSE_FILE_NAME = "license.json";

/** The injectable read seam (so the reader is unit-tested with no real disk). */
export interface LicenseStoreIo {
  readFile(path: string): Promise<string>;
}

export const defaultLicenseStoreIo: LicenseStoreIo = {
  readFile: (path) => readFile(path, "utf8"),
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
 * Read the cached activation-instance id (the device identifier). A
 * `COMMIT_SAGE_LICENSE_INSTANCE` env override wins; otherwise read
 * `~/.commit-sage/license.json` → `{ instanceId }`. Missing / corrupt → undefined.
 */
export async function readActivationInstanceId(
  env: NodeJS.ProcessEnv,
  io: LicenseStoreIo = defaultLicenseStoreIo,
): Promise<string | undefined> {
  const override = str(env.COMMIT_SAGE_LICENSE_INSTANCE);
  if (override !== undefined) {
    return override;
  }
  try {
    const parsed = JSON.parse(await io.readFile(licenseFilePath(env))) as unknown;
    if (parsed === null || typeof parsed !== "object") {
      return undefined;
    }
    return str((parsed as Record<string, unknown>).instanceId);
  } catch {
    return undefined;
  }
}
