import { describe, it, expect } from "vitest";

import { chartSeries, detectShape, extractSeries, rangeField } from "./shape.js";

describe("detectShape", () => {
  it("classifies a perMonth time-bucket object as timeseries", () => {
    expect(detectShape({ perMonth: { "2024-01": 3, "2024-02": 7 } })).toBe("timeseries");
  });

  it("classifies a date-keyed numbers object as timeseries", () => {
    expect(detectShape({ "2024-01": 3, "2024-02": 7 })).toBe("timeseries");
  });

  it("classifies a non-date numeric object as distribution", () => {
    expect(detectShape({ small: 10, medium: 5, large: 2 })).toBe("distribution");
  });

  it("classifies a *SharePct field as scalar-range", () => {
    expect(detectShape({ topCommitSharePct: 62.5 })).toBe("scalar-range");
  });

  it("classifies a bare number as scalar and a single numeric field as scalar", () => {
    expect(detectShape(42)).toBe("scalar");
    expect(detectShape({ busFactor: 2 })).toBe("scalar");
  });

  it("classifies a string / null / non-finite as none", () => {
    expect(detectShape("hello")).toBe("none");
    expect(detectShape(null)).toBe("none");
    expect(detectShape(Number.NaN)).toBe("none");
    expect(detectShape({})).toBe("none");
  });

  it("classifies an array of numbers / labelled objects as distribution", () => {
    expect(detectShape([1, 2, 3])).toBe("distribution");
    expect(detectShape([{ path: "a.ts", changes: 9 }, { path: "b.ts", changes: 4 }])).toBe("distribution");
  });

  it("classifies a value whose numeric series sits in a nested map as distribution", () => {
    expect(detectShape({ timezone: "UTC", byHour: { "20": 34, "21": 28, "22": 2 } })).toBe("distribution");
  });

  it("classifies a value whose date-keyed series sits in a nested map as timeseries", () => {
    expect(detectShape({ note: "x", buckets: { "2024-01": 3, "2024-02": 7 } })).toBe("timeseries");
  });

  it("classifies a value whose series sits in a nested array of rows as distribution", () => {
    expect(detectShape({ topDirectories: [{ path: "src", touchCount: 9 }, { path: "docs", touchCount: 4 }] })).toBe("distribution");
  });

  it("classifies a value that only compares collections as a distribution (collection counts)", () => {
    expect(detectShape({ dormantGapThresholdDays: 14, activePeriods: [{ start: "a", end: "b" }], dormantPeriods: [] })).toBe("distribution");
  });
});

describe("extractSeries", () => {
  it("flattens a perMonth sub-object in key order", () => {
    expect(extractSeries({ perMonth: { "2024-01": 3, "2024-02": 7 } })).toEqual([
      { label: "2024-01", value: 3 },
      { label: "2024-02", value: 7 },
    ]);
  });

  it("maps an array of labelled objects by a label field, then the numeric field", () => {
    expect(extractSeries([{ path: "a.ts", changes: 9 }, { path: "b.ts", changes: 4 }])).toEqual([
      { label: "a.ts", value: 9 },
      { label: "b.ts", value: 4 },
    ]);
  });

  it("returns [] for an unextractable value", () => {
    expect(extractSeries("nope")).toEqual([]);
    expect(extractSeries(null)).toEqual([]);
  });

  it("pulls a series from a nested numeric map when there are no direct numeric fields", () => {
    expect(chartSeries({ timezone: "UTC", byHour: { "20": 34, "21": 28 } })).toEqual([
      { label: "20", value: 34 },
      { label: "21", value: 28 },
    ]);
  });

  it("pulls a series from a nested array of rows, labelled then first numeric field", () => {
    expect(chartSeries({ topDirectories: [{ path: "src", touchCount: 9 }, { path: "docs", touchCount: 4 }] })).toEqual([
      { label: "src", value: 9 },
      { label: "docs", value: 4 },
    ]);
  });

  it("stays strict for the value display: a time-bucket of objects yields [] (renders as a tree)", () => {
    expect(extractSeries({ perMonth: { "2026-06": { additions: 5, deletions: 2, churn: 7 } } })).toEqual([]);
  });

  it("charts a time-bucket of objects by a representative field (prefers churn)", () => {
    expect(chartSeries({ perMonth: { "2026-05": { additions: 3, churn: 5 }, "2026-06": { additions: 9, churn: 11 } } })).toEqual([
      { label: "2026-05", value: 5 },
      { label: "2026-06", value: 11 },
    ]);
  });

  it("charts collection sizes when a value only compares collections", () => {
    expect(chartSeries({ dormantGapThresholdDays: 14, activePeriods: [{ start: "a", end: "b" }], dormantPeriods: [] })).toEqual([
      { label: "activePeriods", value: 1 },
      { label: "dormantPeriods", value: 0 },
    ]);
  });

  it("is deterministic (key order preserved)", () => {
    const value = { c: 3, a: 1, b: 2 };
    expect(extractSeries(value)).toEqual([
      { label: "c", value: 3 },
      { label: "a", value: 1 },
      { label: "b", value: 2 },
    ]);
  });
});

describe("rangeField", () => {
  it("finds a 0–100 share/score field for the gauge", () => {
    expect(rangeField({ adherenceSharePct: 70 })).toEqual({ value: 70, max: 100 });
    expect(rangeField({ score: 81 })).toEqual({ value: 81, max: 100 });
  });

  it("returns undefined when no range field is present", () => {
    expect(rangeField({ busFactor: 2 })).toBeUndefined();
    expect(rangeField(42)).toBeUndefined();
  });
});
