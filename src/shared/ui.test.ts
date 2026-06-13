import { describe, it, expect, vi, afterEach } from "vitest";

import { createUi } from "./ui.js";

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
