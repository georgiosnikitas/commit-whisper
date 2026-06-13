import { describe, it, expect } from "vitest";

import {
  commitCadence,
  commitSizeDistribution,
  commitVolume,
  projectAge,
  timeOfDayDayOfWeek,
  activeDormantPeriods,
} from "./a-cadence.js";
import { buildModel, type AnalysisContext } from "../model.js";
import { emptyMailmap } from "../identity.js";
import type { RepoHistory } from "../../retrieve/retrieve.port.js";
import { SYNTHETIC_HISTORY } from "../sample-history.js";

function ctx(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    analysisTimestamp: "2024-03-01T00:00:00.000Z",
    timezone: "UTC",
    mailmap: emptyMailmap(),
    ...overrides,
  };
}

const EMPTY: RepoHistory = { repoTarget: "/x", commits: [] };

function model(history: RepoHistory = SYNTHETIC_HISTORY, c: AnalysisContext = ctx()) {
  return buildModel(history, c);
}

describe("commitVolume", () => {
  it("buckets commits per day/week/month", () => {
    const m = commitVolume(model(), ctx());
    expect(m.status).toBe("computed");
    const value = m.value as { perMonth: Record<string, number> };
    expect(value.perMonth).toEqual({ "2024-01": 3, "2024-02": 1 });
  });

  it("is not_available for empty history", () => {
    const m = commitVolume(model(EMPTY), ctx());
    expect(m.status).toBe("not_available");
    expect(m.reason).toBeTruthy();
  });
});

describe("commitCadence", () => {
  it("computes average + median intervals", () => {
    const m = commitCadence(model(), ctx());
    expect(m.status).toBe("computed");
    expect((m.value as { intervalCount: number }).intervalCount).toBe(3);
  });

  it("is not_available with fewer than two commits", () => {
    const one: RepoHistory = { repoTarget: "/x", commits: [SYNTHETIC_HISTORY.commits[0]] };
    expect(commitCadence(model(one), ctx()).status).toBe("not_available");
  });
});

describe("activeDormantPeriods", () => {
  it("detects the long January→February gap as dormant", () => {
    const m = activeDormantPeriods(model(), ctx());
    expect(m.status).toBe("computed");
    const value = m.value as { dormantPeriods: unknown[] };
    expect(value.dormantPeriods.length).toBe(1);
  });

  it("labels period days in ctx.timezone (consistent with the other tz-bucketed metrics)", () => {
    // The 23:15 UTC commit (c3) falls on 2024-01-04 in Asia/Tokyo (+9h).
    const tokyo = ctx({ timezone: "Asia/Tokyo" });
    const m = activeDormantPeriods(buildModel(SYNTHETIC_HISTORY, tokyo), tokyo);
    const value = m.value as { dormantPeriods: { start: string }[] };
    // Dormant period starts at c3's day — in Tokyo that is 2024-01-04, not -03.
    expect(value.dormantPeriods[0].start).toBe("2024-01-04");
  });
});

describe("projectAge", () => {
  it("computes lifespan and age against the injected analysisTimestamp", () => {
    const m = projectAge(model(), ctx());
    const value = m.value as { firstCommitDate: string; ageDays: number };
    expect(value.firstCommitDate).toBe("2024-01-01T09:00:00.000Z");
    // 2024-01-01 → 2024-03-01 is ~60 days; not Date.now()-dependent.
    expect(value.ageDays).toBeGreaterThan(59);
    expect(value.ageDays).toBeLessThan(61);
  });

  it("is not_available for empty history", () => {
    expect(projectAge(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("commitSizeDistribution", () => {
  it("computes line-change stats with binary files contributing zero lines", () => {
    const m = commitSizeDistribution(model(), ctx());
    const value = m.value as { commitCount: number; max: number };
    expect(value.commitCount).toBe(4);
    expect(value.max).toBe(42); // c2: 40+2, binary excluded
  });
});

describe("timeOfDayDayOfWeek", () => {
  it("buckets by hour and weekday, and differs across timezones", () => {
    const utc = timeOfDayDayOfWeek(model(), ctx({ timezone: "UTC" }));
    const tokyo = timeOfDayDayOfWeek(
      buildModel(SYNTHETIC_HISTORY, ctx({ timezone: "Asia/Tokyo" })),
      ctx({ timezone: "Asia/Tokyo" }),
    );
    const utcHours = (utc.value as { byHour: number[] }).byHour;
    const tokyoHours = (tokyo.value as { byHour: number[] }).byHour;
    expect(utcHours.reduce((a, b) => a + b, 0)).toBe(4);
    expect(tokyoHours.reduce((a, b) => a + b, 0)).toBe(4);
    // The 23:15 UTC commit shifts to the next day / different hour in Tokyo (+9h).
    expect(utcHours).not.toEqual(tokyoHours);
  });
});
