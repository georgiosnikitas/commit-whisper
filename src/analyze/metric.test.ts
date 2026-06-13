import { describe, it, expect } from "vitest";

import { computed, notAvailable, type MetricSpec } from "./metric.js";

const SPEC: MetricSpec = { id: "a-test", group: "A", title: "Test metric" };

describe("metric envelope constructors", () => {
  it("computed() sets status computed, carries value, and omits reason", () => {
    const m = computed(SPEC, { x: 1 });
    expect(m).toEqual({ id: "a-test", group: "A", title: "Test metric", status: "computed", value: { x: 1 } });
    expect("reason" in m).toBe(false);
  });

  it("notAvailable() sets status not_available, carries reason, and omits value", () => {
    const m = notAvailable(SPEC, "insufficient data");
    expect(m).toEqual({
      id: "a-test",
      group: "A",
      title: "Test metric",
      status: "not_available",
      reason: "insufficient data",
    });
    expect("value" in m).toBe(false);
  });
});
