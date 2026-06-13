import { describe, it, expect } from "vitest";

import { SummarySchema } from "./schema.js";

describe("SummarySchema", () => {
  it("parses a valid Summary object", () => {
    const result = SummarySchema.safeParse({
      headline: "Healthy, steady cadence.",
      overview: "The repo shows consistent activity across two contributors.",
      keyFindings: ["Two active authors", "No long dormant gaps"],
    });
    expect(result.success).toBe(true);
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
