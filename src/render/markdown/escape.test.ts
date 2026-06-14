import { describe, it, expect } from "vitest";

import { escapeCell, inlineProse } from "./escape.js";

describe("escapeCell", () => {
  it("neutralizes the structure-breaking + raw-HTML characters", () => {
    expect(escapeCell("a|b")).toBe("a\\|b"); // a table-cell breaker
    expect(escapeCell("*x*")).toBe("\\*x\\*"); // emphasis
    expect(escapeCell("`code`")).toBe("\\`code\\`"); // a code span
    expect(escapeCell("[link](x)")).toBe("\\[link\\](x)"); // link syntax
    expect(escapeCell("<script>")).toBe("&lt;script&gt;"); // raw HTML
  });

  it("escapes backslash first so later escapes are not double-escaped", () => {
    expect(escapeCell("a\\b")).toBe("a\\\\b");
  });

  it("collapses newlines/tabs/runs of whitespace to a single space and trims", () => {
    expect(escapeCell("  a\n\nb\tc  ")).toBe("a b c");
  });

  it("a hostile file path cannot break a table or inject HTML", () => {
    const evil = "src/<img onerror=alert(1)>|evil.ts";
    const out = escapeCell(evil);
    expect(out).not.toContain("<img");
    expect(out).toContain("\\|evil"); // the pipe is escaped (cannot break a table cell)
    expect(out).toContain("&lt;img onerror=alert(1)&gt;");
  });
});

describe("inlineProse", () => {
  it("collapses newlines to single spaces (one diff-able line)", () => {
    expect(inlineProse("line one\nline two")).toBe("line one line two");
  });

  it("leaves Markdown emphasis intact (narrative is meant to be Markdown)", () => {
    expect(inlineProse("a **bold** and _italic_ word")).toBe("a **bold** and _italic_ word");
  });
});
