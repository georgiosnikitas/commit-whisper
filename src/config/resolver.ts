/**
 * Phase-1 deterministic pure merge (Story 1.2, AC1).
 *
 * Merges the four source layers by precedence `defaults -> config file -> env
 * -> flags` (low -> high) into a `PartialRunConfig` carrying per-field
 * provenance. This is a PURE function: no I/O, no globals, no clock -- so it is
 * fully table-testable.
 */

import type { PartialRunConfig, Provenance, Source } from "./run-config.js";
import { CONFIG_FIELD_KEYS } from "./sources.js";

export interface Layers {
  defaults: PartialRunConfig;
  configFile: PartialRunConfig;
  env: PartialRunConfig;
  flags: PartialRunConfig;
}

export interface MergeResult {
  config: PartialRunConfig;
  provenance: Provenance;
}

/** Layers in precedence order, low -> high, paired with their provenance label. */
const LAYER_ORDER: readonly { layer: keyof Layers; source: Source }[] = [
  { layer: "defaults", source: "default" },
  { layer: "configFile", source: "configFile" },
  { layer: "env", source: "env" },
  { layer: "flags", source: "flag" },
];

export function mergeLayers(layers: Layers): MergeResult {
  const config: PartialRunConfig = {};
  const provenance: Provenance = {};

  for (const key of CONFIG_FIELD_KEYS) {
    for (const { layer, source } of LAYER_ORDER) {
      const value = layers[layer][key];
      // `undefined` means "not supplied" -- it never overrides a lower layer.
      if (value !== undefined) {
        (config as Record<string, unknown>)[key] = value;
        provenance[key] = source;
      }
    }
  }

  return { config, provenance };
}
