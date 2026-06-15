/**
 * The `--show-config` formatter (Story 6.4, AC1).
 *
 * Renders the resolved `RunConfig` with PER-FIELD PROVENANCE (which layer set
 * each value) and the injected fields, then a Secrets block where every secret
 * is shown as `***` (via the `Secret` wrapper — `reveal()` is never called). It
 * is the requested inspection artifact, so the CLI writes it to STDOUT and exits
 * without running the pipeline.
 */

import type { Branch, ConfigData, RunConfig, Source } from "../config/run-config.js";
import { CONFIG_FIELD_KEYS } from "../config/sources.js";
import type { Secret } from "../shared/secret.js";

export interface ShowConfigSecrets {
  aiKey?: Secret<string>;
  gitPat?: Secret<string>;
}

const UNSET = "(unset)";

function renderBranch(branch: Branch): string {
  switch (branch.kind) {
    case "named":
      return `named:${branch.name}`;
    case "all":
      return "all";
    default:
      return "head";
  }
}

/** Render one resolved config-data value as a stable, readable string. */
function renderValue(key: keyof ConfigData, value: unknown): string {
  if (value === undefined) {
    return UNSET;
  }
  if (key === "branch") {
    return renderBranch(value as Branch);
  }
  if (Array.isArray(value)) {
    return value.join(",");
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function fieldLine(key: keyof ConfigData, config: RunConfig): string {
  const value = renderValue(key, config[key]);
  // A field with no provenance is either a defaulted value or genuinely unset
  // (the latter only under a lenient `--show-config` resolve); name it honestly.
  const source: Source | "none" = config.provenance[key] ?? (config[key] === undefined ? "none" : "default");
  return `  ${key} = ${value}  (${source})`;
}

/** Render a secret as `***` when present, `(unset)` when absent — never the value. */
function secretLine(name: string, secret: Secret<string> | undefined): string {
  return `  ${name} = ${secret === undefined ? UNSET : String(secret)}  (env)`;
}

/**
 * Build the deterministic `--show-config` dump: a header, every config-data
 * field with its value + provenance source (in the stable `CONFIG_FIELD_KEYS`
 * order), the injected fields, and the Secrets block (`***` / `(unset)`).
 */
export function formatShowConfig(config: RunConfig, secrets: ShowConfigSecrets): string {
  const lines = ["commit-whisper — resolved configuration", "", "config:"];
  for (const key of CONFIG_FIELD_KEYS) {
    lines.push(fieldLine(key, config));
  }
  lines.push(
    "",
    "resolved:",
    `  analysisTimestamp = ${config.analysisTimestamp}`,
    `  tier = ${config.entitlement.tier}`,
    `  commitCap = ${config.entitlement.commitCap ?? UNSET}`,
    "",
    "secrets:",
    secretLine("aiKey", secrets.aiKey),
    secretLine("gitPat", secrets.gitPat),
  );
  return lines.join("\n");
}
