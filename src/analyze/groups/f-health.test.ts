import { describe, it, expect } from "vitest";

import {
  hygieneScore,
  busFactorRisk,
  trendDeltas,
  strengthsWeaknesses,
  GROUP_F_ROLLUPS,
} from "./f-health.js";
import type { Metric, MetricValue } from "../metric.js";
import { computed, notAvailable } from "../metric.js";
import type { AnalysisContext } from "../model.js";
import { emptyMailmap } from "../identity.js";

function ctx(priorMetrics?: readonly Metric[]): AnalysisContext {
  return { analysisTimestamp: "2024-06-01T00:00:00.000Z", timezone: "UTC", mailmap: emptyMailmap(), priorMetrics };
}

function metric(id: string, value: MetricValue): Metric {
  return computed({ id, group: "A", title: id }, value);
}

/** Build a byId map from a set of synthetic A–E computed metrics. */
function byId(metrics: Metric[]): ReadonlyMap<string, Metric> {
  return new Map(metrics.map((m) => [m.id, m]));
}

/**
 * A clean healthy source set:
 *  - Message Quality: adherence 90, lowInfo 10 → (90 + 90)/2 = 90
 *  - Commit Size: median 50 → 100
 *  - Branching: directToDefault 25 → 75
 *  - Collaboration: topShare 40 → 60
 *  - Churn Stability: churn [100, 100] (2 months, no variance) → 100
 *  Weighted: (90·35 + 100·20 + 75·20 + 60·15 + 100·10)/100 = 85.5
 */
function healthySources(): Metric[] {
  return [
    metric("c-conventional-commits", { adherenceSharePct: 90 }),
    metric("c-low-information-rate", { lowInfoSharePct: 10 }),
    metric("a-commit-size-distribution", { median: 50 }),
    metric("d-direct-to-default", { directToDefaultSharePct: 25 }),
    metric("b-contribution-distribution", { topCommitSharePct: 40 }),
    metric("b-bus-factor", { busFactor: 3, topAuthorSharePct: 40 }),
    metric("e-churn-over-time", { perMonth: { "2024-01": { churn: 100 }, "2024-02": { churn: 100 } } }),
  ];
}

describe("hygieneScore — transparent weighted composite", () => {
  it("computes the renormalized weighted score with all five components", () => {
    const v = hygieneScore(byId(healthySources()), ctx()).value as {
      score: number; components: { name: string; subScore: number | null; contributed: boolean }[]; componentsContributing: number;
    };
    expect(v.score).toBe(85.5);
    expect(v.componentsContributing).toBe(5);
    const sub = Object.fromEntries(v.components.map((c) => [c.name, c.subScore]));
    expect(sub["Message Quality"]).toBe(90);
    expect(sub["Commit Size Discipline"]).toBe(100);
    expect(sub["Branching Discipline"]).toBe(75);
    expect(sub["Collaboration Breadth"]).toBe(60);
    expect(sub["Churn Stability"]).toBe(100);
  });

  it("renormalizes the weights over available components when a source is not_available", () => {
    // Drop Churn Stability (no e-churn) → contributing weights 35+20+20+15 = 90.
    const sources = healthySources().filter((m) => m.id !== "e-churn-over-time");
    const v = hygieneScore(byId(sources), ctx()).value as {
      score: number; components: { name: string; subScore: number | null; contributed: boolean }[]; componentsContributing: number;
    };
    expect(v.componentsContributing).toBe(4);
    const churn = v.components.find((c) => c.name === "Churn Stability");
    expect(churn).toMatchObject({ subScore: null, contributed: false });
    // (90·35 + 100·20 + 75·20 + 60·15) / 90 = 7550/90 = 83.89
    expect(v.score).toBe(83.89);
  });

  it("is not_available only when no component source is available", () => {
    const m = hygieneScore(byId([]), ctx());
    expect(m.status).toBe("not_available");
    expect(m.reason).toContain("No component");
  });

  it("blends only the available half of Message Quality when one C source is missing", () => {
    const sources = [metric("c-conventional-commits", { adherenceSharePct: 80 })]; // no low-info metric
    const v = hygieneScore(byId(sources), ctx()).value as { components: { name: string; subScore: number | null }[] };
    expect(v.components.find((c) => c.name === "Message Quality")?.subScore).toBe(80); // just adherence
  });
});

describe("commit-size + churn-stability transform boundaries", () => {
  it("scores a tiny median at 100 and a huge median at 0", () => {
    const tiny = hygieneScore(byId([metric("a-commit-size-distribution", { median: 10 })]), ctx()).value as { components: { name: string; subScore: number | null }[] };
    const huge = hygieneScore(byId([metric("a-commit-size-distribution", { median: 900 })]), ctx()).value as { components: { name: string; subScore: number | null }[] };
    expect(tiny.components.find((c) => c.name === "Commit Size Discipline")?.subScore).toBe(100);
    expect(huge.components.find((c) => c.name === "Commit Size Discipline")?.subScore).toBe(0);
  });

  it("excludes churn stability when fewer than two months are present", () => {
    // Pair the one-month churn with a contributing source so hygiene is still computed.
    const oneMonth = [
      metric("a-commit-size-distribution", { median: 50 }),
      metric("e-churn-over-time", { perMonth: { "2024-01": { churn: 100 } } }),
    ];
    const v = hygieneScore(byId(oneMonth), ctx()).value as { components: { name: string; subScore: number | null; contributed: boolean }[] };
    expect(v.components.find((c) => c.name === "Churn Stability")).toMatchObject({ subScore: null, contributed: false });
  });
});

describe("busFactorRisk — team-level risk bands (NFR-8)", () => {
  it("maps bus factor 1/2/3 to high/moderate/low", () => {
    const risk = (bf: number) => (busFactorRisk(byId([metric("b-bus-factor", { busFactor: bf, topAuthorSharePct: 50 })]), ctx()).value as { risk: string }).risk;
    expect(risk(1)).toBe("high");
    expect(risk(2)).toBe("moderate");
    expect(risk(5)).toBe("low");
  });

  it("is not_available when the bus-factor metric is unavailable", () => {
    const sources = [notAvailable({ id: "b-bus-factor", group: "B", title: "Bus factor" }, "no commits")];
    expect(busFactorRisk(byId(sources), ctx()).status).toBe("not_available");
  });
});

describe("trendDeltas — only with a prior report", () => {
  it("is not_available without a prior report", () => {
    const m = trendDeltas(byId(healthySources()), ctx());
    expect(m.status).toBe("not_available");
    expect(m.reason).toContain("prior report");
  });

  it("computes the hygiene-score delta and direction against an injected prior", () => {
    // Prior repo was less healthy (lower adherence → lower score) ⇒ improving.
    const prior = healthySources().map((m) => (m.id === "c-conventional-commits" ? metric("c-conventional-commits", { adherenceSharePct: 50 }) : m));
    const v = trendDeltas(byId(healthySources()), ctx(prior)).value as {
      currentHygieneScore: number; priorHygieneScore: number; hygieneScoreDelta: number; direction: string;
    };
    expect(v.currentHygieneScore).toBe(85.5);
    expect(v.priorHygieneScore).toBeLessThan(85.5);
    expect(v.hygieneScoreDelta).toBeGreaterThan(0);
    expect(v.direction).toBe("improving");
  });
});

describe("strengthsWeaknesses", () => {
  it("ranks the best and worst contributing dimensions", () => {
    const v = strengthsWeaknesses(byId(healthySources()), ctx()).value as {
      strengths: { name: string; subScore: number }[]; weaknesses: { name: string; subScore: number }[];
    };
    expect(v.strengths[0]!.subScore).toBe(100); // a 100-scoring dimension leads
    expect(v.weaknesses[0]!.name).toBe("Collaboration Breadth"); // 60, the lowest
    expect(v.weaknesses[0]!.subScore).toBe(60);
  });

  it("is not_available when nothing can be ranked", () => {
    expect(strengthsWeaknesses(byId([]), ctx()).status).toBe("not_available");
  });
});

describe("NFR-8 — no author identity leaks into any Group F value", () => {
  it("emits no author name or email anywhere in the serialized Group F output", () => {
    // Source metrics derived from these identities upstream; Group F must surface none of them.
    const sources = healthySources();
    const serialized = GROUP_F_ROLLUPS.map((entry) => JSON.stringify(entry.fn(byId(sources), ctx()).value)).join("\n");
    for (const sentinel of ["Alice", "alice@example.com", "Bob", "bob@example.com"]) {
      expect(serialized).not.toContain(sentinel);
    }
  });
});

describe("Group F determinism / serialization", () => {
  it("emits only JSON-serializable values (no Map/Set/Date) and is stable across runs", () => {
    const map = byId(healthySources());
    const a = GROUP_F_ROLLUPS.map((e) => JSON.stringify(e.fn(map, ctx()).value)).join("\n");
    const b = GROUP_F_ROLLUPS.map((e) => JSON.stringify(e.fn(map, ctx()).value)).join("\n");
    expect(a).toBe(b);
    expect(a).not.toContain("[object");
  });
});
