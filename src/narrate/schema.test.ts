import { describe, it, expect } from "vitest";

import { SummarySchema, ExplanationSchema, CoachingSchema, NarrativeSchema } from "./schema.js";

const SUMMARY = {
  headline: "Healthy, steady cadence.",
  overview: "The repo shows consistent activity across two contributors.",
  keyFindings: ["Two active authors", "No long dormant gaps"],
};
const EXPLANATION = { paragraphs: ["Volume is steady.", "Ownership is concentrated."] };
const COACHING = {
  introduction: "The repo is healthy but has a few practices to tighten.",
  chapters: [{ theme: "Commit-message hygiene", steps: ["Adopt Conventional Commits", "Avoid one-word messages"] }],
  closingSummary: "Start with commit-message hygiene this week.",
};

describe("SummarySchema", () => {
  it("parses a valid Summary object", () => {
    expect(SummarySchema.safeParse(SUMMARY).success).toBe(true);
  });

  it("accepts an empty keyFindings array", () => {
    expect(
      SummarySchema.safeParse({ headline: "h", overview: "o", keyFindings: [] }).success,
    ).toBe(true);
  });

  it("rejects a missing field", () => {
    expect(SummarySchema.safeParse({ headline: "h", overview: "o" }).success).toBe(false);
  });

  it("rejects a wrong type", () => {
    expect(
      SummarySchema.safeParse({ headline: "h", overview: "o", keyFindings: "not-an-array" }).success,
    ).toBe(false);
  });
});

describe("ExplanationSchema", () => {
  it("parses a valid Explanation", () => {
    expect(ExplanationSchema.safeParse(EXPLANATION).success).toBe(true);
  });

  it("rejects an empty paragraphs array (min 1)", () => {
    expect(ExplanationSchema.safeParse({ paragraphs: [] }).success).toBe(false);
  });

  it("rejects an empty-string paragraph (no blank content)", () => {
    expect(ExplanationSchema.safeParse({ paragraphs: [""] }).success).toBe(false);
  });
});

describe("CoachingSchema — structured report (not a flat list)", () => {
  it("parses a valid Coaching report", () => {
    expect(CoachingSchema.safeParse(COACHING).success).toBe(true);
  });

  it("rejects chapterless coaching (chapters min 1)", () => {
    expect(CoachingSchema.safeParse({ ...COACHING, chapters: [] }).success).toBe(false);
  });

  it("rejects a chapter with no steps (steps min 1)", () => {
    expect(
      CoachingSchema.safeParse({ ...COACHING, chapters: [{ theme: "T", steps: [] }] }).success,
    ).toBe(false);
  });

  it("rejects an empty-string step / theme / introduction / closing (no blank content)", () => {
    expect(CoachingSchema.safeParse({ ...COACHING, chapters: [{ theme: "", steps: ["s"] }] }).success).toBe(false);
    expect(CoachingSchema.safeParse({ ...COACHING, chapters: [{ theme: "T", steps: [""] }] }).success).toBe(false);
    expect(CoachingSchema.safeParse({ ...COACHING, introduction: "" }).success).toBe(false);
    expect(CoachingSchema.safeParse({ ...COACHING, closingSummary: "" }).success).toBe(false);
  });

  it("rejects a missing introduction or closing summary", () => {
    expect(CoachingSchema.safeParse({ chapters: COACHING.chapters, closingSummary: "c" }).success).toBe(false);
    expect(CoachingSchema.safeParse({ introduction: "i", chapters: COACHING.chapters }).success).toBe(false);
  });
});

describe("NarrativeSchema — exactly three parts", () => {
  it("parses a full three-part narrative", () => {
    expect(
      NarrativeSchema.safeParse({ summary: SUMMARY, explanation: EXPLANATION, coaching: COACHING }).success,
    ).toBe(true);
  });

  it("rejects a narrative missing the explanation part", () => {
    expect(NarrativeSchema.safeParse({ summary: SUMMARY, coaching: COACHING }).success).toBe(false);
  });

  it("rejects a narrative missing the coaching part", () => {
    expect(NarrativeSchema.safeParse({ summary: SUMMARY, explanation: EXPLANATION }).success).toBe(false);
  });
});
