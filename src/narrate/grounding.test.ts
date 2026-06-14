import { describe, it, expect } from "vitest";

import {
  groundNarrative,
  collectGroundedNumbers,
  extractNumericTokens,
  isGrounded,
  GROUNDING_PLACEHOLDER,
  GROUNDING_PLACEHOLDER_THEME,
} from "./grounding.js";
import type { Narrative } from "./schema.js";
import type { Analysis } from "../analyze/engine.js";
import { NarrativeSchema as ReportNarrativeSchema } from "../assemble/report-schema.js";

const ANALYSIS: Analysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: { total: 42, perMonth: { "2024-01": 3 } } },
    { id: "b-bus-factor", group: "B", title: "Bus factor", status: "computed", value: { busFactor: 2, topAuthorSharePct: 62.5 } },
    { id: "c-conventional", group: "C", title: "Conventional", status: "not_available", reason: "Need at least 5 commits." },
  ],
};

/** A number-FREE base narrative; tests inject numeric claims via `over`. */
const full = (over: Partial<Narrative> = {}): Narrative => ({
  summary: { headline: "Healthy.", overview: "Steady activity.", keyFindings: ["Consistent"] },
  explanation: { paragraphs: ["A plain-language interpretation."] },
  coaching: { introduction: "A plan.", chapters: [{ theme: "Cadence", steps: ["Commit smaller"] }], closingSummary: "Start with cadence." },
  explanations: { "a-commit-volume": { explanation: "Means steady.", goodBehaviours: ["Consistent"], needsImprovement: [], suggestions: ["Keep it up"] } },
  ...over,
});

describe("collectGroundedNumbers", () => {
  it("collects nested value numbers, rounded forms, and integers inside date-bucket keys/strings", () => {
    const set = collectGroundedNumbers(ANALYSIS);
    expect(set.has(42)).toBe(true); // value.total
    expect(set.has(3)).toBe(true); // value.perMonth["2024-01"]
    expect(set.has(2024)).toBe(true); // from the "2024-01" key
    expect(set.has(2)).toBe(true); // busFactor
    expect(set.has(62.5)).toBe(true); // share
    expect(set.has(63)).toBe(true); // ceil(62.5)
    expect(set.has(5)).toBe(true); // from the not_available reason string
    expect(set.has(999)).toBe(false); // absent everywhere
  });
});

describe("extractNumericTokens / isGrounded", () => {
  it("extracts number tokens (percent suffix + thousands commas handled)", () => {
    expect(extractNumericTokens("62% of 1,234 commits since 2021")).toEqual([62, 1234, 2021]);
    expect(extractNumericTokens("no digits here")).toEqual([]);
  });

  it("skips date / time / version / range components (no false-positive removals)", () => {
    // Components glued by - : / . to another digit are NOT standalone claims.
    expect(extractNumericTokens("released on 2024-01-15")).toEqual([]); // date
    expect(extractNumericTokens("at 10:30 today")).toEqual([]); // time
    expect(extractNumericTokens("version v2.3.5 shipped")).toEqual([]); // version
    expect(extractNumericTokens("a 3-5 range")).toEqual([]); // range
  });

  it("still flags a hyphen-compound's number (the dash is not followed by a digit)", () => {
    expect(extractNumericTokens("a 999-contributor finding")).toEqual([999]);
  });

  it("grounds a prose number on exact or rounded forms (share rounding tolerance)", () => {
    const set = collectGroundedNumbers(ANALYSIS);
    expect(isGrounded(62, set)).toBe(true); // 62.5 → round/floor
    expect(isGrounded(63, set)).toBe(true); // 62.5 → ceil
    expect(isGrounded(42, set)).toBe(true);
    expect(isGrounded(999, set)).toBe(false);
  });

  it("grounds a number whose metric value is negative (abs is collected)", () => {
    const set = collectGroundedNumbers({
      metrics: [{ id: "f-trend-deltas", group: "F", title: "Trend", status: "computed", value: { volumeDelta: -5 } }],
    });
    expect(isGrounded(5, set)).toBe(true); // prose "5" (sign dropped) grounds against a -5 metric
    expect(isGrounded(-5, set)).toBe(true);
  });
});

describe("groundNarrative — conservative keep (AC1)", () => {
  it("keeps a narrative whose numbers are all grounded, verbatim", () => {
    const narrative = full({
      summary: { headline: "42 commits total.", overview: "Across 2024 the repo had 42 commits.", keyFindings: ["62% top-author share"] },
    });
    const { narrative: out, report } = groundNarrative(narrative, ANALYSIS);
    expect(out.summary.headline).toBe("42 commits total.");
    expect(out.summary.overview).toBe("Across 2024 the repo had 42 commits.");
    expect(out.summary.keyFindings).toEqual(["62% top-author share"]);
    expect(report.ungroundedClaims).toBe(0);
  });
});

describe("groundNarrative — remove ungrounded (AC2)", () => {
  it("removes the sentence and the bullet carrying an ungrounded number", () => {
    const narrative = full({
      summary: { headline: "Steady.", overview: "The repo had 42 commits. There were 999 reverts.", keyFindings: ["999 contributors", "Bus factor of 2"] },
    });
    const { narrative: out, report } = groundNarrative(narrative, ANALYSIS);
    expect(out.summary.overview).toBe("The repo had 42 commits."); // the 999 sentence dropped
    expect(out.summary.keyFindings).toEqual(["Bus factor of 2"]); // the 999 bullet dropped
    expect(report.totalClaims).toBe(4); // 42, 999, 999, 2
    expect(report.ungroundedClaims).toBe(2); // both 999s
  });

  it("drops a sentence mixing a grounded and an ungrounded number (the bad one taints it)", () => {
    const narrative = full({
      summary: { headline: "h", overview: "There were 42 commits and 999 merges.", keyFindings: [] },
    });
    const { narrative: out } = groundNarrative(narrative, ANALYSIS);
    // The single sentence holds 999 → removed → overview emptied → honest placeholder.
    expect(out.summary.overview).toBe(GROUNDING_PLACEHOLDER);
  });
});

describe("groundNarrative — honest placeholders + read-back validity (AC3)", () => {
  it("fills emptied required fields with the placeholder and still parses the strict Report schema", () => {
    const narrative = full({
      explanation: { paragraphs: ["All 999 of this is fabricated."] },
      coaching: { introduction: "Based on 999 fake commits.", chapters: [{ theme: "Theme", steps: ["Do 999 things"] }], closingSummary: "Prioritize 999." },
    });
    const { narrative: out } = groundNarrative(narrative, ANALYSIS);
    expect(out.explanation.paragraphs).toEqual([GROUNDING_PLACEHOLDER]); // .min(1) preserved
    expect(out.coaching.introduction).toBe(GROUNDING_PLACEHOLDER);
    expect(out.coaching.closingSummary).toBe(GROUNDING_PLACEHOLDER);
    // The only chapter's only step was ungrounded → chapter dropped → placeholder chapter.
    expect(out.coaching.chapters).toEqual([{ theme: GROUNDING_PLACEHOLDER_THEME, steps: [GROUNDING_PLACEHOLDER] }]);
    // The grounded narrative still satisfies the strict Report read-back schema.
    expect(ReportNarrativeSchema.safeParse(out).success).toBe(true);
  });

  it("lets a facet bullet array empty without a placeholder, but keeps the meaning facet non-empty", () => {
    const narrative = full({
      explanations: { "a-commit-volume": { explanation: "Means 999 things.", goodBehaviours: ["999 good"], needsImprovement: [], suggestions: ["Improve by 42"] } },
    });
    const { narrative: out } = groundNarrative(narrative, ANALYSIS);
    const facet = out.explanations?.["a-commit-volume"];
    expect(facet?.explanation).toBe(GROUNDING_PLACEHOLDER); // meaning emptied → placeholder (.min(1))
    expect(facet?.goodBehaviours).toEqual([]); // the "999 good" bullet dropped; array may legitimately empty
    expect(facet?.suggestions).toEqual(["Improve by 42"]); // 42 grounded → kept
  });
});

describe("groundNarrative — determinism + report", () => {
  it("is deterministic — two runs are byte-identical", () => {
    const narrative = full({ summary: { headline: "42 here.", overview: "999 there.", keyFindings: ["2 ok"] } });
    const a = JSON.stringify(groundNarrative(narrative, ANALYSIS).narrative);
    const b = JSON.stringify(groundNarrative(narrative, ANALYSIS).narrative);
    expect(a).toBe(b);
  });

  it("reports zero ungrounded claims for an all-grounded narrative", () => {
    const narrative = full({ summary: { headline: "42.", overview: "2 authors.", keyFindings: ["3 commits"] } });
    expect(groundNarrative(narrative, ANALYSIS).report.ungroundedClaims).toBe(0);
  });

  it("preserves a narrative with no numbers verbatim (nothing to ground)", () => {
    const narrative = full();
    expect(groundNarrative(narrative, ANALYSIS).narrative).toEqual(narrative);
  });

  it("keeps a sentence citing a date even when a day component is not in the metrics (no false positive)", () => {
    const narrative = full({ summary: { headline: "Steady.", overview: "The migration landed on 2024-01-15.", keyFindings: [] } });
    const { narrative: out, report } = groundNarrative(narrative, ANALYSIS);
    expect(out.summary.overview).toBe("The migration landed on 2024-01-15."); // date components not flagged
    expect(report.ungroundedClaims).toBe(0);
  });

  it("grounds a narrative with no explanations map (the three-part-only branch)", () => {
    const partsOnly = full();
    delete (partsOnly as { explanations?: unknown }).explanations;
    const { narrative: out } = groundNarrative(partsOnly, ANALYSIS);
    expect("explanations" in out).toBe(false);
    expect(out.summary).toEqual(partsOnly.summary);
  });
});
