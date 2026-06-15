import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import { VERSION } from "./version.js";

describe("VERSION", () => {
  it("matches package.json's version (never drifts)", () => {
    const pkgUrl = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), "utf8")) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});
