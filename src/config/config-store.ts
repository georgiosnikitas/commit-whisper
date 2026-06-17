/**
 * The config-store (Story 6.5) — the product's one config WRITE path + the
 * `~/.commit-whisper` reader that feeds the resolver's `configFile` layer.
 *
 * The interactive Settings screen persists the user's NON-SECRET everyday
 * choices (provider, model, base URL, default output format, timezone,
 * max-commits) so they are set-once and remembered. Two invariants hold by
 * construction:
 *
 *   - NON-SECRET ONLY. The writer accepts a closed allow-list (`SettingsData`)
 *     with no secret field, and the reader (`parseSettings`) drops anything not
 *     allow-listed — so neither a write nor a hand-edited file can introduce a
 *     key/token into the config-file layer. Secrets stay env-only.
 *   - ATOMIC WRITE. Persist via write-to-temp + `rename` (atomic on one volume)
 *     so an interrupt or a racing writer can never leave a torn file.
 *
 * A corrupt config never breaks a run: a malformed file parses to `{}`, and a
 * read error is swallowed to `{}` (absence is normal). All I/O is injected so
 * the suite never touches real disk. `env` is a PARAMETER (never `process.env`)
 * so the module stays pure/testable inside the hexagonal boundary.
 */

import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

import type { OutputFormat, PartialRunConfig, Provider } from "./run-config.js";

const PROVIDERS = new Set<string>(["ollama", "openai", "gemini", "anthropic", "openai-compatible"]);
const OUTPUT_FORMATS = new Set<string>(["html", "markdown", "terminal", "json"]);

/** The closed allow-list of NON-SECRET, persistable config-file keys (a subset of `ConfigData`). */
export interface SettingsData {
  provider?: Provider;
  llmModel?: string;
  llmBaseUrl?: string;
  outputFormats?: OutputFormat[];
  timezone?: string;
  maxCommits?: number;
}

/** The allow-listed key names — the single source of truth for "what may be persisted". */
export const SETTINGS_KEYS = [
  "provider",
  "llmModel",
  "llmBaseUrl",
  "outputFormats",
  "timezone",
  "maxCommits",
] as const;

const CONFIG_FILE_NAME = "config.json";

/** Trim to a non-empty string, or `undefined`. */
function str(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const v = raw.trim();
  return v === "" ? undefined : v;
}

function coerceProvider(raw: unknown): Provider | undefined {
  const v = str(raw);
  return v !== undefined && PROVIDERS.has(v) ? (v as Provider) : undefined;
}

function coerceFormats(raw: unknown): OutputFormat[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const valid = raw.filter((f): f is OutputFormat => typeof f === "string" && OUTPUT_FORMATS.has(f));
  return valid.length > 0 ? [...new Set(valid)] : undefined;
}

function coercePositiveInt(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    return undefined;
  }
  return raw;
}

/** The config home: an explicit `COMMIT_WHISPER_CONFIG` override, else `<home>/.commit-whisper`. */
export function configHome(env: NodeJS.ProcessEnv): string {
  const override = str(env.COMMIT_WHISPER_CONFIG);
  if (override !== undefined) {
    return override;
  }
  const home = str(env.HOME) ?? str(env.USERPROFILE) ?? ".";
  return join(home, ".commit-whisper");
}

/** The config file path inside the config home. */
export function configFilePath(env: NodeJS.ProcessEnv): string {
  return join(configHome(env), CONFIG_FILE_NAME);
}

/**
 * Parse the config-file JSON into a sanitised `PartialRunConfig` carrying ONLY
 * the allow-listed, validated keys. Never throws: malformed JSON or a non-object
 * (array, null, primitive) → `{}`; an invalid field value is dropped; any key
 * not on the allow-list (incl. a secret-looking `aiKey`/`gitPat`) is ignored.
 */
export function parseSettings(raw: string): PartialRunConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const record = parsed as Record<string, unknown>;
  const out: PartialRunConfig = {};
  assignString(out, "provider", coerceProvider(record.provider));
  assignString(out, "llmModel", str(record.llmModel));
  assignString(out, "llmBaseUrl", str(record.llmBaseUrl));
  assignString(out, "timezone", str(record.timezone));
  const formats = coerceFormats(record.outputFormats);
  if (formats !== undefined) {
    out.outputFormats = formats;
  }
  const maxCommits = coercePositiveInt(record.maxCommits);
  if (maxCommits !== undefined) {
    out.maxCommits = maxCommits;
  }
  return out;
}

/** Assign a present optional string-shaped field, skipping `undefined` (keeps the partial clean). */
function assignString<K extends keyof PartialRunConfig>(
  out: PartialRunConfig,
  key: K,
  value: PartialRunConfig[K] | undefined,
): void {
  if (value !== undefined) {
    out[key] = value;
  }
}

/**
 * Serialize the allow-listed present fields to stable, sorted, pretty JSON so a
 * write is deterministic and diff-friendly. Only `SettingsData` keys are ever
 * emitted — there is no path that serialises a secret.
 */
export function serializeSettings(data: SettingsData): string {
  const ordered: Record<string, unknown> = {};
  for (const key of [...SETTINGS_KEYS].sort((a, b) => a.localeCompare(b))) {
    const value = data[key];
    if (value !== undefined) {
      ordered[key] = value;
    }
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** The injectable filesystem seam (so the store is unit-tested with an in-memory fake). */
export interface ConfigStoreIo {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** Best-effort temp cleanup if a rename fails (never throws). */
  unlink(path: string): Promise<void>;
}

export const defaultConfigStoreIo: ConfigStoreIo = {
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
      // Best-effort — a missing temp is fine.
    }
  },
};

/**
 * Read the persisted settings as the resolver's `configFile` layer. A missing
 * file (ENOENT) or any read error → `{}` (absence is normal, never an error).
 */
export async function readSettings(
  env: NodeJS.ProcessEnv,
  io: ConfigStoreIo = defaultConfigStoreIo,
): Promise<PartialRunConfig> {
  try {
    return parseSettings(await io.readFile(configFilePath(env)));
  } catch {
    return {};
  }
}

/**
 * Persist the non-secret settings via an ATOMIC write (temp + `rename` in the
 * same dir). Returns the final config file path (for the "✓ Saved to …"
 * confirmation). Accepts ONLY `SettingsData` — no secret can be serialised.
 */
export async function writeSettings(
  env: NodeJS.ProcessEnv,
  data: SettingsData,
  io: ConfigStoreIo = defaultConfigStoreIo,
): Promise<string> {
  const home = configHome(env);
  const finalPath = join(home, CONFIG_FILE_NAME);
  // Temp in the SAME dir so `rename` is same-volume (atomic). A random suffix
  // avoids collisions with a racing writer.
  const tempPath = join(home, `${CONFIG_FILE_NAME}.${randomSuffix()}.tmp`);
  await io.mkdir(home);
  await io.writeFile(tempPath, serializeSettings(data));
  try {
    await io.rename(tempPath, finalPath);
  } catch (err) {
    // Clean up the orphaned temp so failures never accumulate `.tmp` files.
    await io.unlink(tempPath);
    throw err;
  }
  return finalPath;
}

/** A short random suffix for the temp file name (collision-avoidance, not security). */
function randomSuffix(): string {
  return randomBytes(6).toString("hex");
}
