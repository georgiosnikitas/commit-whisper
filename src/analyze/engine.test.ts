import { describe, it, expect } from "vitest";

import { analyze } from "./engine.js";
import type { AnalysisContext, RegisteredMetric, RegisteredRollup, RepoModel } from "./model.js";
import { emptyMailmap } from "./identity.js";
import { computed, notAvailable, type Metric, type MetricSpec } from "./metric.js";
import { SYNTHETIC_HISTORY } from "./sample-history.js";

function ctx(): AnalysisContext {
  return { analysisTimestamp: "2024-03-01T00:00:00.000Z", timezone: "UTC", mailmap: emptyMailmap() };
}

describe("analyze (engine)", () => {
  it("includes every catalog metric id in registry order (Group A then Group B then Group C then Group D then Group E)", () => {
    const ids = analyze(SYNTHETIC_HISTORY, ctx()).metrics.map((m) => m.id);
    expect(ids).toEqual([
      "a-commit-volume",
      "a-commit-cadence",
      "a-active-dormant",
      "a-project-age",
      "a-commit-size-distribution",
      "a-time-of-day-day-of-week",
      "b-contributor-count",
      "b-contribution-distribution",
      "b-bus-factor",
      "b-new-departed",
      "b-ownership-by-area",
      "b-co-authorship",
      "c-message-length-distribution",
      "c-conventional-commits",
      "c-imperative-mood",
      "c-low-information-rate",
      "c-issue-reference-rate",
      "c-revert-fixup-signal",
      "d-topology-summary",
      "d-merge-vs-rebase",
      "d-direct-to-default",
      "d-long-lived-branches",
      "d-average-changes-per-merge",
      "e-most-changed",
      "e-churn-over-time",
      "e-add-delete-ratio",
      "e-file-age",
      "e-large-change-events",
      "f-hygiene-score",
      "f-bus-factor-risk",
      "f-trend-deltas",
      "f-strengths-weaknesses",
    ]);
  });

  it("builds the shared model once and passes the same reference to every metric", () => {
    const seen: RepoModel[] = [];
    const probe = (id: string): RegisteredMetric => ({
      spec: { id, group: "A", title: id },
      fn: (m) => {
        seen.push(m);
        return computed({ id, group: "A", title: id }, 1);
      },
    });
    // `[]` roll-ups → exercise the base metric pass in isolation (Group F is tested separately).
    analyze(SYNTHETIC_HISTORY, ctx(), [probe("a-1"), probe("a-2"), probe("a-3")], []);
    expect(seen).toHaveLength(3);
    // All metrics received the identical model object → built once and shared.
    expect(seen[0]).toBe(seen[1]);
    expect(seen[1]).toBe(seen[2]);
  });

  it("converts a throwing metric to not_available (never crashes, never omits)", () => {
    const spec: MetricSpec = { id: "a-boom", group: "A", title: "Boom" };
    const boom: RegisteredMetric = {
      spec,
      fn: () => {
        throw new Error("kaboom");
      },
    };
    const ok: RegisteredMetric = {
      spec: { id: "a-ok", group: "A", title: "OK" },
      fn: () => computed({ id: "a-ok", group: "A", title: "OK" }, 1),
    };
    const result = analyze(SYNTHETIC_HISTORY, ctx(), [boom, ok], []);
    expect(result.metrics).toHaveLength(2);
    const boomMetric = result.metrics[0];
    expect(boomMetric.id).toBe("a-boom");
    expect(boomMetric.status).toBe("not_available");
    expect(boomMetric.reason).toContain("kaboom");
    expect(result.metrics[1].status).toBe("computed");
  });

  it("emits not_available (not omission) for an uncomputable metric on empty history", () => {
    const spec: MetricSpec = { id: "a-na", group: "A", title: "NA" };
    const na: RegisteredMetric = { spec, fn: () => notAvailable(spec, "no data") };
    const result = analyze({ repoTarget: "/x", commits: [] }, ctx(), [na], []);
    expect(result.metrics).toEqual([
      { id: "a-na", group: "A", title: "NA", status: "not_available", reason: "no data" },
    ]);
  });
});

describe("analyze (roll-up pass)", () => {
  const baseMetric: RegisteredMetric = {
    spec: { id: "a-1", group: "A", title: "A1" },
    fn: () => computed({ id: "a-1", group: "A", title: "A1" }, 42),
  };

  it("runs roll-ups AFTER the base pass with the computed base metrics indexed by id, appending them", () => {
    let seenValue: unknown;
    const rollup: RegisteredRollup = {
      spec: { id: "f-1", group: "F", title: "F1" },
      fn: (byId: ReadonlyMap<string, Metric>) => {
        seenValue = byId.get("a-1")?.value;
        return computed({ id: "f-1", group: "F", title: "F1" }, "rolled");
      },
    };
    const result = analyze(SYNTHETIC_HISTORY, ctx(), [baseMetric], [rollup]);
    expect(result.metrics.map((m) => m.id)).toEqual(["a-1", "f-1"]); // base then roll-up
    expect(seenValue).toBe(42); // the roll-up saw the computed base metric value
  });

  it("converts a throwing roll-up to not_available (never crashes the run)", () => {
    const boom: RegisteredRollup = {
      spec: { id: "f-boom", group: "F", title: "Boom" },
      fn: () => {
        throw new Error("rollup-kaboom");
      },
    };
    const result = analyze(SYNTHETIC_HISTORY, ctx(), [baseMetric], [boom]);
    const rolled = result.metrics.find((m) => m.id === "f-boom");
    expect(rolled?.status).toBe("not_available");
    expect(rolled?.reason).toContain("rollup-kaboom");
  });
});
