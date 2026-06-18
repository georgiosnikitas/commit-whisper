import { describe, it, expect } from "vitest";

import { buildValueTree, formatScalar } from "./value-tree.js";

describe("formatScalar", () => {
  it("rounds numbers to 2 decimals and renders booleans/strings verbatim", () => {
    expect(formatScalar(91.814)).toBe("91.81");
    expect(formatScalar(120)).toBe("120");
    expect(formatScalar(true)).toBe("true");
    expect(formatScalar("hello")).toBe("hello");
  });

  it("renders null/undefined as an em-dash and non-finite numbers as 0", () => {
    expect(formatScalar(null)).toBe("—");
    expect(formatScalar(undefined)).toBe("—");
    expect(formatScalar(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("buildValueTree", () => {
  it("collapses a time-bucket of objects to `period: <primary numeric>` (churn over time)", () => {
    const tree = buildValueTree({
      perMonth: {
        "2026-05": { additions: 100, deletions: 20, churn: 120, commitCount: 4 },
        "2026-06": { additions: 49404, deletions: 6116, churn: 55520, commitCount: 12 },
      },
      totalChurn: 55640,
    });
    expect(tree).toEqual({
      kind: "branch",
      entries: [
        {
          label: "perMonth",
          child: {
            kind: "branch",
            entries: [
              { label: "2026-05", child: { kind: "scalar", text: "120" } },
              { label: "2026-06", child: { kind: "scalar", text: "55520" } },
            ],
          },
        },
        { label: "totalChurn", child: { kind: "scalar", text: "55640" } },
      ],
    });
  });

  it("flattens an object of named-score arrays to `name: score` (strengths & weaknesses)", () => {
    const tree = buildValueTree({
      strengths: [{ name: "Message Quality", subScore: 91.81 }],
      weaknesses: [{ name: "Churn Stability", subScore: 40 }],
    });
    expect(tree).toEqual({
      kind: "branch",
      entries: [
        {
          label: "strengths",
          child: { kind: "branch", entries: [{ label: "Message Quality", child: { kind: "scalar", text: "91.81" } }] },
        },
        {
          label: "weaknesses",
          child: { kind: "branch", entries: [{ label: "Churn Stability", child: { kind: "scalar", text: "40" } }] },
        },
      ],
    });
  });

  it("renders a bare scalar as a scalar leaf", () => {
    expect(buildValueTree(42)).toEqual({ kind: "scalar", text: "42" });
  });
});
