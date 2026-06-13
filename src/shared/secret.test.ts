import { describe, it, expect } from "vitest";
import { inspect } from "node:util";

import { Secret } from "./secret.js";

const RAW = "super-secret-token-123";

describe("Secret", () => {
  it("redacts via toString and template interpolation", () => {
    const s = new Secret(RAW);
    expect(s.toString()).toBe("***");
    expect(String(s)).toBe("***");
    expect(`${s}`).toBe("***");
    expect(`${s}`).not.toContain(RAW);
  });

  it("redacts via JSON.stringify (direct and nested), never leaking the value", () => {
    const s = new Secret(RAW);
    expect(JSON.stringify(s)).toBe('"***"');
    expect(JSON.stringify({ apiKey: s })).toBe('{"apiKey":"***"}');
    expect(JSON.stringify({ apiKey: s })).not.toContain(RAW);
  });

  it("redacts via util.inspect / console.log path", () => {
    const s = new Secret(RAW);
    const shown = inspect(s);
    expect(shown).toContain("***");
    expect(shown).not.toContain(RAW);
    expect(inspect({ apiKey: s })).not.toContain(RAW);
  });

  it("does not expose the value through spread or Object.keys (true private field)", () => {
    const s = new Secret(RAW);
    expect(Object.keys(s)).toEqual([]);
    expect(JSON.stringify({ ...s })).not.toContain(RAW);
  });

  it("reveal() returns the original value (the single read path)", () => {
    const s = new Secret(RAW);
    expect(s.reveal()).toBe(RAW);
  });

  it("works for non-string payloads too", () => {
    const s = new Secret({ token: RAW });
    expect(s.toString()).toBe("***");
    expect(s.reveal()).toEqual({ token: RAW });
  });
});
