import { describe, it, expect } from "vitest";

import { computeCapability, detectCI, detectCapability } from "./capability.js";

describe("computeCapability — truth table", () => {
  it("is interactive only when both TTYs are present, not CI, not nonInteractive", () => {
    expect(
      computeCapability({ stdinIsTTY: true, stdoutIsTTY: true, isCI: false, nonInteractive: false }),
    ).toEqual({ interactive: true, aiModeDefault: "auto" });
  });

  it("fails closed when stdin is not a proven TTY", () => {
    expect(
      computeCapability({ stdinIsTTY: false, stdoutIsTTY: true, isCI: false, nonInteractive: false })
        .interactive,
    ).toBe(false);
  });

  it("fails closed when stdout is not a proven TTY", () => {
    expect(
      computeCapability({ stdinIsTTY: true, stdoutIsTTY: false, isCI: false, nonInteractive: false })
        .interactive,
    ).toBe(false);
  });

  it("fails closed under CI even with TTYs", () => {
    expect(
      computeCapability({ stdinIsTTY: true, stdoutIsTTY: true, isCI: true, nonInteractive: false })
        .interactive,
    ).toBe(false);
  });

  it("fails closed when nonInteractive is forced", () => {
    expect(
      computeCapability({ stdinIsTTY: true, stdoutIsTTY: true, isCI: false, nonInteractive: true })
        .interactive,
    ).toBe(false);
  });

  it("maps aiModeDefault: interactive->auto, else off", () => {
    expect(
      computeCapability({ stdinIsTTY: true, stdoutIsTTY: true, isCI: false, nonInteractive: false })
        .aiModeDefault,
    ).toBe("auto");
    expect(
      computeCapability({ stdinIsTTY: false, stdoutIsTTY: false, isCI: false, nonInteractive: false })
        .aiModeDefault,
    ).toBe("off");
  });
});

describe("detectCI", () => {
  it("is true for common truthy CI markers", () => {
    expect(detectCI({ CI: "true" })).toBe(true);
    expect(detectCI({ CI: "1" })).toBe(true);
    expect(detectCI({ CI: "anything" })).toBe(true);
  });

  it("is false when CI is unset, empty, or explicitly disabled", () => {
    expect(detectCI({})).toBe(false);
    expect(detectCI({ CI: "" })).toBe(false);
    expect(detectCI({ CI: "0" })).toBe(false);
    expect(detectCI({ CI: "false" })).toBe(false);
  });
});

describe("detectCapability — adapter", () => {
  it("coerces undefined isTTY to false (fails closed)", () => {
    expect(
      detectCapability({ nonInteractive: false, stdinIsTTY: undefined, stdoutIsTTY: undefined, env: {} })
        .interactive,
    ).toBe(false);
  });

  it("is interactive for real TTYs with no CI and no nonInteractive", () => {
    expect(
      detectCapability({ nonInteractive: false, stdinIsTTY: true, stdoutIsTTY: true, env: {} }).interactive,
    ).toBe(true);
  });

  it("derives CI from env", () => {
    expect(
      detectCapability({ nonInteractive: false, stdinIsTTY: true, stdoutIsTTY: true, env: { CI: "true" } })
        .interactive,
    ).toBe(false);
  });
});
