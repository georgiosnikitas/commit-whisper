import { describe, it, expect, vi, afterEach } from "vitest";

import { createUi, resolveColor, resolveLogLevel } from "./ui.js";

function fakeStream(): { stream: NodeJS.WritableStream; chunks: string[] } {
  const chunks: string[] = [];
  const stream = {
    write: (chunk: string): boolean => {
      chunks.push(chunk);
      return true;
    },
  } as unknown as NodeJS.WritableStream;
  return { stream, chunks };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createUi", () => {
  it("writes each severity message + newline to the injected stream", () => {
    const { stream, chunks } = fakeStream();
    const ui = createUi(stream);
    ui.error("e");
    ui.warn("w");
    ui.info("i");
    ui.plain("p");
    expect(chunks).toEqual(["e\n", "w\n", "i\n", "p\n"]);
  });

  it("never writes to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { stream } = fakeStream();
    const ui = createUi(stream);
    ui.error("e");
    ui.warn("w");
    ui.info("i");
    ui.plain("p");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("round-trips the raw message (no level prefix today)", () => {
    const { stream, chunks } = fakeStream();
    createUi(stream).info("hello world");
    expect(chunks).toEqual(["hello world\n"]);
  });
});

describe("createUi — verbosity gating (Story 6.4)", () => {
  it("quiet keeps only error + warn (suppresses info/plain/debug)", () => {
    const { stream, chunks } = fakeStream();
    const ui = createUi(stream, { level: "quiet" });
    ui.error("e");
    ui.warn("w");
    ui.info("i");
    ui.plain("p");
    ui.debug?.("d");
    expect(chunks).toEqual(["e\n", "w\n"]);
  });

  it("normal shows error/warn/info/plain but suppresses debug", () => {
    const { stream, chunks } = fakeStream();
    const ui = createUi(stream, { level: "normal" });
    ui.error("e");
    ui.warn("w");
    ui.info("i");
    ui.plain("p");
    ui.debug?.("d");
    expect(chunks).toEqual(["e\n", "w\n", "i\n", "p\n"]);
  });

  it("verbose emits everything including debug", () => {
    const { stream, chunks } = fakeStream();
    const ui = createUi(stream, { level: "verbose" });
    ui.error("e");
    ui.warn("w");
    ui.info("i");
    ui.plain("p");
    ui.debug?.("d");
    expect(chunks).toEqual(["e\n", "w\n", "i\n", "p\n", "d\n"]);
  });

  it("verbosity never writes to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { stream } = fakeStream();
    const ui = createUi(stream, { level: "verbose" });
    ui.error("e");
    ui.debug?.("d");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});

describe("createUi — colour (Story 6.4)", () => {
  const ANSI = /\u001b\[/;

  it("color=false emits no ANSI escape codes", () => {
    const { stream, chunks } = fakeStream();
    const ui = createUi(stream, { color: false });
    ui.error("e");
    ui.warn("w");
    ui.info("i");
    expect(chunks.join("")).not.toMatch(ANSI);
  });

  it("color=true wraps error + warn in ANSI, but leaves info plain", () => {
    const { stream, chunks } = fakeStream();
    const ui = createUi(stream, { color: true });
    ui.error("e");
    ui.warn("w");
    ui.info("i");
    expect(chunks[0]).toMatch(ANSI); // error coloured
    expect(chunks[1]).toMatch(ANSI); // warn coloured
    expect(chunks[2]).toBe("i\n"); // info stays plain (calm)
  });
});

describe("resolveLogLevel (Story 6.4)", () => {
  it("a --quiet flag wins, even over --verbose", () => {
    expect(resolveLogLevel({ quiet: true, verbose: true, env: {} })).toBe("quiet");
  });

  it("a --verbose flag maps to verbose", () => {
    expect(resolveLogLevel({ verbose: true, env: {} })).toBe("verbose");
  });

  it("falls back to COMMIT_SAGE_LOG_LEVEL when no flag is given", () => {
    expect(resolveLogLevel({ env: { COMMIT_SAGE_LOG_LEVEL: "quiet" } })).toBe("quiet");
    expect(resolveLogLevel({ env: { COMMIT_SAGE_LOG_LEVEL: "VERBOSE" } })).toBe("verbose");
  });

  it("a flag beats the env var", () => {
    expect(resolveLogLevel({ verbose: true, env: { COMMIT_SAGE_LOG_LEVEL: "quiet" } })).toBe("verbose");
  });

  it("defaults to normal (no flag, no/invalid env)", () => {
    expect(resolveLogLevel({ env: {} })).toBe("normal");
    expect(resolveLogLevel({ env: { COMMIT_SAGE_LOG_LEVEL: "loud" } })).toBe("normal");
  });
});

describe("resolveColor (Story 6.4)", () => {
  it("a non-empty NO_COLOR wins (no colour), even with FORCE_COLOR set", () => {
    expect(resolveColor({ env: { NO_COLOR: "1", FORCE_COLOR: "1" }, isTTY: true })).toBe(false);
  });

  it("an empty NO_COLOR is ignored (treated as unset)", () => {
    expect(resolveColor({ env: { NO_COLOR: "" }, isTTY: true })).toBe(true);
  });

  it("FORCE_COLOR forces colour unless 0/false", () => {
    expect(resolveColor({ env: { FORCE_COLOR: "1" }, isTTY: false })).toBe(true);
    expect(resolveColor({ env: { FORCE_COLOR: "true" }, isTTY: false })).toBe(true);
    expect(resolveColor({ env: { FORCE_COLOR: "0" }, isTTY: true })).toBe(false);
    expect(resolveColor({ env: { FORCE_COLOR: "false" }, isTTY: true })).toBe(false);
  });

  it("with no colour vars, mirrors the TTY", () => {
    expect(resolveColor({ env: {}, isTTY: true })).toBe(true);
    expect(resolveColor({ env: {}, isTTY: false })).toBe(false);
  });
});
