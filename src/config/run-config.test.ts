import { describe, it, expect } from "vitest";

import { deepFreeze } from "./run-config.js";

describe("deepFreeze", () => {
  it("returns primitives unchanged", () => {
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze("x")).toBe("x");
    expect(deepFreeze(null)).toBe(null);
  });

  it("freezes the top-level object (mutation rejected in strict mode)", () => {
    const frozen = deepFreeze({ a: 1 });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => {
      (frozen as { a: number }).a = 2;
    }).toThrow(TypeError);
    expect(frozen.a).toBe(1);
  });

  it("freezes nested objects and arrays (deep immutability)", () => {
    const frozen = deepFreeze({
      branch: { kind: "named", name: "main" },
      outputFormats: ["terminal"],
    });
    expect(Object.isFrozen(frozen.branch)).toBe(true);
    expect(Object.isFrozen(frozen.outputFormats)).toBe(true);
    expect(() => {
      (frozen.branch as { name: string }).name = "dev";
    }).toThrow(TypeError);
    expect(() => {
      frozen.outputFormats.push("json");
    }).toThrow(TypeError);
  });

  it("tolerates already-frozen children without error", () => {
    const child = Object.freeze({ k: 1 });
    const frozen = deepFreeze({ child });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.child).toBe(child);
  });

  it("is cycle-safe (freezes a self-referential graph without infinite recursion)", () => {
    const cyclic: { self?: unknown; v: number } = { v: 1 };
    cyclic.self = cyclic;
    const frozen = deepFreeze(cyclic);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.self).toBe(frozen);
  });
});
