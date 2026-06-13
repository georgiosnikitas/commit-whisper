import { describe, it, expect } from "vitest";

import { gini } from "./stats.js";

describe("gini", () => {
  it("returns null for an empty array", () => {
    expect(gini([])).toBeNull();
  });

  it("is 0 for a perfectly even distribution", () => {
    expect(gini([5, 5, 5, 5])).toBeCloseTo(0, 10);
  });

  it("is 0 when the total is zero (nothing to measure)", () => {
    expect(gini([0, 0, 0])).toBe(0);
  });

  it("approaches (n-1)/n for full concentration in one holder", () => {
    // All weight on one of four holders → maximal inequality = (n-1)/n = 0.75.
    expect(gini([0, 0, 0, 8])).toBeCloseTo(0.75, 10);
  });

  it("matches the known value for a small skewed vector", () => {
    // [1,2,3,4]: G = (2·(1·1+2·2+3·3+4·4))/(4·10) − 5/4 = (2·30)/40 − 1.25 = 0.25.
    expect(gini([1, 2, 3, 4])).toBeCloseTo(0.25, 10);
  });

  it("is order-independent (sorts a copy; input untouched)", () => {
    const input = [4, 1, 3, 2];
    const a = gini(input);
    const b = gini([2, 3, 1, 4]);
    expect(a).toBe(b);
    expect(input).toEqual([4, 1, 3, 2]); // not mutated
  });
});
