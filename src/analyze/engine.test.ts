import { describe, it, expect } from "vitest";

import { analyze } from "./engine.js";
import type { AnalysisContext, RegisteredMetric, RepoModel } from "./model.js";
import { emptyMailmap } from "./identity.js";
import { computed, notAvailable, type MetricSpec } from "./metric.js";
import { SYNTHETIC_HISTORY } from "./sample-history.js";

function ctx(): AnalysisContext {
  return { analysisTimestamp: "2024-03-01T00:00:00.000Z", timezone: "UTC", mailmap: emptyMailmap() };
}

describe("analyze (engine)", () => {
  it("includes every catalog metric id in registry order (Group A then Group B then Group C then Group D)", () => {
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
    analyze(SYNTHETIC_HISTORY, ctx(), [probe("a-1"), probe("a-2"), probe("a-3")]);
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
    const result = analyze(SYNTHETIC_HISTORY, ctx(), [boom, ok]);
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
    const result = analyze({ repoTarget: "/x", commits: [] }, ctx(), [na]);
    expect(result.metrics).toEqual([
      { id: "a-na", group: "A", title: "NA", status: "not_available", reason: "no data" },
    ]);
  });
});
