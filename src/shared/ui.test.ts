import { describe, it, expect, vi, afterEach } from "vitest";

import { createProgress, createUi, noopProgress, resolveColor, resolveLogLevel } from "./ui.js";

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

  it("falls back to COMMIT_WHISPER_LOG_LEVEL when no flag is given", () => {
    expect(resolveLogLevel({ env: { COMMIT_WHISPER_LOG_LEVEL: "quiet" } })).toBe("quiet");
    expect(resolveLogLevel({ env: { COMMIT_WHISPER_LOG_LEVEL: "VERBOSE" } })).toBe("verbose");
  });

  it("a flag beats the env var", () => {
    expect(resolveLogLevel({ verbose: true, env: { COMMIT_WHISPER_LOG_LEVEL: "quiet" } })).toBe("verbose");
  });

  it("defaults to normal (no flag, no/invalid env)", () => {
    expect(resolveLogLevel({ env: {} })).toBe("normal");
    expect(resolveLogLevel({ env: { COMMIT_WHISPER_LOG_LEVEL: "loud" } })).toBe("normal");
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

describe("createProgress — non-TTY (plain status lines)", () => {
  it("writes a working line on start and a ✓ verdict on done (final label wins)", () => {
    const { stream, chunks } = fakeStream();
    const progress = createProgress(stream, { tty: false });
    progress.start("Retrieving…");
    progress.done(); // no final label ⇒ closes on the current label
    progress.start("Computing…");
    progress.done("Computed 10 commits");
    expect(chunks).toEqual(["Retrieving…\n", "✓ Retrieving…\n", "Computing…\n", "✓ Computed 10 commits\n"]);
  });

  it("never animates (no carriage returns) and never writes to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { stream, chunks } = fakeStream();
    const progress = createProgress(stream, { tty: false });
    progress.start("Working…");
    progress.update("Still working…");
    progress.fail("Boom");
    expect(chunks.join("")).not.toContain("\r");
    expect(chunks).toEqual(["Working…\n", "Still working…\n", "✗ Boom\n"]);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});

describe("createProgress — TTY (animated spinner)", () => {
  it("animates one rewritten line and closes with a ✓ verdict line", () => {
    const { stream, chunks } = fakeStream();
    const progress = createProgress(stream, { tty: true });
    progress.start("Retrieving…");
    progress.done("Retrieved 5 commits");
    // First write is the initial spinner frame; the close rewrites the line in place.
    expect(chunks[0]).toContain("Retrieving…");
    expect(chunks[0]).toContain("\r");
    const last = chunks.at(-1) ?? "";
    expect(last).toContain("✓ Retrieved 5 commits\n");
    expect(last.startsWith("\r")).toBe(true);
  });

  it("clear() wipes the line without a verdict", () => {
    const { stream, chunks } = fakeStream();
    const progress = createProgress(stream, { tty: true });
    progress.start("Working…");
    progress.clear();
    const last = chunks.at(-1) ?? "";
    expect(last).not.toContain("✓");
    expect(last).not.toContain("✗");
    expect(last).toContain("\r");
  });
});

describe("createProgress — quiet + noopProgress", () => {
  it("quiet self-suppresses to the no-op (parity with ui.info)", () => {
    const { stream, chunks } = fakeStream();
    const progress = createProgress(stream, { tty: true, level: "quiet" });
    progress.start("Retrieving…");
    progress.update("More…");
    progress.done("Done");
    progress.fail("Nope");
    expect(chunks).toEqual([]);
  });

  it("noopProgress writes nothing anywhere", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    noopProgress.start("x");
    noopProgress.update("y");
    noopProgress.done("z");
    noopProgress.fail("w");
    noopProgress.clear();
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
