import tseslint from "typescript-eslint";

// All first-party TypeScript source (broadened beyond `.ts` so a future
// `.mts`/`.cts` module cannot silently escape the guardrails below).
const TS_GLOBS = ["src/**/*.{ts,mts,cts}"];

// P2 — named exports only (no default exports). Shared so every block that sets
// `no-restricted-syntax` can carry it: flat config REPLACES a rule's options per
// matching file (it does not merge), so each `no-restricted-syntax` block must
// include this selector or the ban would be lost where another block also sets
// the rule.
const noDefaultExport = {
  selector: "ExportDefaultDeclaration",
  message:
    "Named exports only — no default exports (architecture pattern P2).",
};

export default [
  {
    ignores: [
      "dist/**",
      "dist-sea/**",
      "node_modules/**",
      "coverage/**",
      "docs/**",
      "_bmad/**",
      ".agents/**",
      ".github/**",
    ],
  },

  // Base TypeScript-aware recommended rules (non-type-checked: fast, no project graph).
  ...tseslint.configs.recommended,

  // P2 inside src/config/** — config IS allowed to read process.env, so the
  // env-boundary block below deliberately skips it; this block keeps the
  // default-export ban in force there.
  {
    files: ["src/config/**/*.{ts,mts,cts}"],
    rules: {
      "no-restricted-syntax": ["error", noDefaultExport],
    },
  },

  // Hexagonal boundary (all src EXCEPT config/) — `process.env` may be read ONLY
  // inside src/config/ (config/env.ts is the single intended reader). Catches
  // the static member form via `no-restricted-properties`, plus the two common
  // bypasses via `no-restricted-syntax`: destructuring `env` off `process`, and
  // importing `env` from `(node:)process`. Full aliasing (`const p = process;
  // p.env`) is not statically catchable and is left to review.
  {
    files: TS_GLOBS,
    ignores: ["src/config/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read process.env only within src/config/ (hexagonal boundary).",
        },
      ],
      "no-restricted-syntax": [
        "error",
        noDefaultExport,
        {
          selector:
            "VariableDeclarator[init.name='process'] > ObjectPattern > Property[key.name='env']",
          message:
            "Read process.env only within src/config/ — do not destructure `env` from `process` (hexagonal boundary).",
        },
        {
          selector:
            "ImportDeclaration[source.value=/^(node:)?process$/] > ImportSpecifier[imported.name='env']",
          message:
            "Read process.env only within src/config/ — do not import `env` from process (hexagonal boundary).",
        },
      ],
    },
  },

  // P5 — no `console` inside pipeline modules AND the entrypoint (human chrome
  // goes through the `ui` module to stderr; machine data to stdout). `cli/` and
  // `config/` are exempt — they own user-facing interaction and config loading.
  {
    files: [
      "src/index.{ts,mts,cts}",
      "src/retrieve/**/*.{ts,mts,cts}",
      "src/analyze/**/*.{ts,mts,cts}",
      "src/narrate/**/*.{ts,mts,cts}",
      "src/assemble/**/*.{ts,mts,cts}",
      "src/render/**/*.{ts,mts,cts}",
      "src/license/**/*.{ts,mts,cts}",
      "src/shared/**/*.{ts,mts,cts}",
    ],
    rules: {
      "no-console": "error",
    },
  },
];

