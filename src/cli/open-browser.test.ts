import { describe, it, expect } from "vitest";

import { browserCommand } from "./open-browser.js";

describe("browserCommand — platform → argv mapping", () => {
  it("macOS (darwin) → `open <target>`", () => {
    expect(browserCommand("darwin", "commit-sage-report.html")).toEqual({
      command: "open",
      args: ["commit-sage-report.html"],
    });
  });

  it("Windows (win32) → `cmd /c start \"\" <target>` (the empty title guards a quoted path)", () => {
    expect(browserCommand("win32", "report.html")).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "report.html"],
    });
  });

  it("Linux / other → `xdg-open <target>`", () => {
    expect(browserCommand("linux", "report.html")).toEqual({ command: "xdg-open", args: ["report.html"] });
    expect(browserCommand("freebsd", "report.html")).toEqual({ command: "xdg-open", args: ["report.html"] });
  });

  it("a hostile path is a single argv element — never interpolated into a command (injection-safe)", () => {
    const evil = "/tmp/a b; rm -rf ~ && $(touch pwned).html";
    for (const platform of ["darwin", "win32", "linux"] as const) {
      const { args } = browserCommand(platform, evil);
      // The full path appears verbatim as ONE array element (execFile passes it as a
      // standalone argv, so no shell ever parses the metacharacters).
      expect(args).toContain(evil);
    }
  });
});
