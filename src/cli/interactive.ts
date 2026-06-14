/**
 * The launchpad — the single interactive entry point (Story 6.1).
 *
 * Reached ONLY by the bare zero-argument `commit-sage` in an interactive TTY
 * (the STRICT truth table's one prompting row); any argument bypasses this for
 * strict single-shot. This module is the calm, line-oriented discovery menu: a
 * persistent header readiness line, a state-aware action list (license rows vary
 * by effective tier), keyboard navigation (via `@clack/prompts` `select`), and a
 * clean Esc/Quit that prints a short flags cheatsheet.
 *
 * Design: the MODEL is pure (`formatReadinessLine`, `buildLaunchpadOptions`) and
 * the DRIVER (`runLaunchpad`) loops over an INJECTED `select` so the whole thing
 * is unit-testable with no TTY. All chrome is written to the injected `output`
 * (default `process.stderr`) — stdout stays clean for machine data (`cli/` is
 * under `no-console`, so we write via the stream, never `console.*`).
 *
 * 6.1 is the menu only: `Help` (full flag reference) and `Quit` (cheatsheet +
 * exit 0) are the live actions; every other row is shown (discovery is the
 * point) but routes to a calm "coming soon" placeholder until its owning story
 * (Analyze 6.2 · Status 6.3 · Settings 6.5 · license actions Epic 7) lands.
 */

import { Writable } from "node:stream";

import { isCancel, select as clackSelect } from "@clack/prompts";

import type { Provider, Tier } from "../config/run-config.js";
import { ExitCode } from "./exit-codes.js";

/** A launchpad row's stable identity (the value returned by the menu). */
export type LaunchpadAction =
  | "analyze-cwd"
  | "analyze-remote"
  | "settings"
  | "status"
  | "help"
  | "activate"
  | "buy-restore"
  | "coffee"
  | "deactivate"
  | "quit";

/**
 * A fully-resolved presentation snapshot — the menu does NO I/O of its own. The
 * caller (`cli/`) reads the env-configured AI, the entitlement, and the repo
 * context, and hands them here already resolved.
 */
export interface LaunchpadState {
  tier: Tier;
  licensed: boolean;
  provider?: Provider;
  llmModel?: string;
  cwdLabel: string;
  isRepo: boolean;
  branch?: string;
}

/** A single menu row. `label` is always present — selection never relies on color (AC4). */
export interface LaunchpadOption {
  value: LaunchpadAction;
  label: string;
  hint?: string;
}

/** The injected menu primitive: resolve to the chosen action, or `null` on cancel (Esc/Ctrl-C). */
export type LaunchpadSelect = (opts: {
  message: string;
  options: LaunchpadOption[];
}) => Promise<LaunchpadAction | null>;

export interface LaunchpadDeps {
  state: LaunchpadState;
  /** The full flag reference (commander's help text), shown by "Help / show all flags". */
  helpText: string;
  /** Where all chrome is written. Default `process.stderr`. */
  output?: Writable;
  /** The menu primitive. Default: a `@clack/prompts` `select` wired to `output`. */
  select?: LaunchpadSelect;
}

/** The locked product tagline (brief.md / DESIGN.md). */
export const LAUNCHPAD_TAGLINE = "commit-sage · I know what you did last commit";

/** The short, copyable cheatsheet printed on Esc/Quit (AC4). */
export const FLAGS_CHEATSHEET = [
  "Common commands:",
  "  commit-sage .              analyze the current repository",
  "  commit-sage <path|url>     analyze a local path or remote URL",
  "  --no-ai                    metrics only — no LLM call",
  "  --format html,json         choose one or more output formats",
  "  --help                     the full flag reference",
].join("\n");

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  "single-device": "Single-device",
  unlimited: "Unlimited",
};

/** Calm placeholders for the rows whose actions land in later stories (6.1 ships the menu only). */
const COMING_SOON: Record<Exclude<LaunchpadAction, "help" | "quit">, string> = {
  "analyze-cwd": "Guided analysis is coming soon. For now, run: commit-sage .",
  "analyze-remote": "Guided remote analysis is coming soon. For now, run: commit-sage <url>",
  settings: "Settings is coming soon.",
  status: "Status / doctor is coming soon.",
  activate: "License activation is coming soon.",
  "buy-restore": "Buy / Restore is coming soon.",
  coffee: "Buy Me a Coffee — link coming soon.",
  deactivate: "Deactivation is coming soon.",
};

function aiSegment(state: LaunchpadState): string {
  if (state.provider === undefined) {
    return "⚠ not configured";
  }
  if (state.llmModel === undefined) {
    return state.provider;
  }
  return `${state.provider} (${state.llmModel})`;
}

function cwdSegment(state: LaunchpadState): string {
  if (!state.isRepo) {
    return "— (not a git repo)";
  }
  return `${state.cwdLabel} (${state.branch ?? "detached"})`;
}

/**
 * The persistent header readiness line (AC2): `<tier> · AI: <provider (model) |
 * ⚠ not configured> · cwd: <path> (<branch>) | — (not a git repo)`.
 */
export function formatReadinessLine(state: LaunchpadState): string {
  return `${TIER_LABEL[state.tier]} · AI: ${aiSegment(state)} · cwd: ${cwdSegment(state)}`;
}

/**
 * The ordered, grouped, state-aware menu (AC1, AC3): ACT (analyze cwd/remote) →
 * ORIENT (settings/status/help) → LICENSE (by effective state) → Quit (always
 * last). Every option carries a non-empty text `label`.
 */
export function buildLaunchpadOptions(state: LaunchpadState): LaunchpadOption[] {
  const options: LaunchpadOption[] = [
    { value: "analyze-cwd", label: "Analyze this repository", hint: "the current directory" },
    { value: "analyze-remote", label: "Analyze a remote repository", hint: "clone a URL" },
    { value: "settings", label: "Settings", hint: "provider, model, default format" },
    { value: "status", label: "Status / doctor" },
    { value: "help", label: "Help / show all flags" },
  ];
  if (state.licensed) {
    options.push({ value: "deactivate", label: "Deactivate license", hint: "free this device" });
  } else {
    options.push(
      { value: "activate", label: "Activate license", hint: "enter your license key" },
      { value: "buy-restore", label: "Buy / Restore license", hint: "opens the store in your browser" },
      { value: "coffee", label: "Buy Me a Coffee" },
    );
  }
  options.push({ value: "quit", label: "Quit", hint: "esc" });
  return options;
}

function writeLine(output: Writable, text: string): void {
  output.write(text.endsWith("\n") ? text : `${text}\n`);
}

/** The default menu primitive: a `@clack/prompts` `select` wired to `output`; cancel → `null`. */
function clackLaunchpadSelect(output: Writable): LaunchpadSelect {
  return async ({ message, options }) => {
    const result = await clackSelect<LaunchpadAction>({ message, options, output });
    return isCancel(result) ? null : result;
  };
}

/**
 * Render the launchpad and loop until the user quits (AC1, AC4). Returns
 * `ExitCode.Success` on a clean Esc/Quit. The header is written once; the menu
 * re-prompts after each non-terminal action.
 */
export async function runLaunchpad(deps: LaunchpadDeps): Promise<number> {
  const output = deps.output ?? process.stderr;
  const select = deps.select ?? clackLaunchpadSelect(output);
  const options = buildLaunchpadOptions(deps.state);

  writeLine(output, LAUNCHPAD_TAGLINE);
  writeLine(output, formatReadinessLine(deps.state));

  for (;;) {
    const action = (await select({ message: "What would you like to do?", options })) ?? "quit";
    if (action === "quit") {
      writeLine(output, FLAGS_CHEATSHEET);
      return ExitCode.Success;
    }
    if (action === "help") {
      writeLine(output, deps.helpText);
      continue;
    }
    writeLine(output, COMING_SOON[action]);
  }
}
