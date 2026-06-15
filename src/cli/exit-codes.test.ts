import { describe, it, expect } from "vitest";

import { ExitCode, exitCodeForError, messageForError } from "./exit-codes.js";
import {
  CommitWhisperError,
  InternalError,
  LicenseError,
  MetricsError,
  MissingRequiredConfigError,
  NarrationError,
  RenderError,
  RetrieveError,
  UsageError,
} from "../shared/errors.js";

describe("ExitCode enum", () => {
  it("maps every C4 name to its exact number", () => {
    expect(ExitCode).toEqual({
      Success: 0,
      Internal: 1,
      Usage: 2,
      MissingInput: 3,
      Retrieve: 4,
      Metrics: 5,
      Narration: 6,
      Render: 7,
      License: 8,
      Degraded: 9,
    });
  });
});

describe("exitCodeForError", () => {
  it("returns a CommitWhisperError's own exit code", () => {
    expect(exitCodeForError(new UsageError("bad flag"))).toBe(2);
    expect(exitCodeForError(new RetrieveError("no repo"))).toBe(4);
    expect(exitCodeForError(new MissingRequiredConfigError("provider"))).toBe(3);
  });

  it("maps any non-CommitWhisperError throwable to Internal (1)", () => {
    expect(exitCodeForError(new Error("plain"))).toBe(ExitCode.Internal);
    expect(exitCodeForError("a string")).toBe(1);
    expect(exitCodeForError(undefined)).toBe(1);
    expect(exitCodeForError({ nope: true })).toBe(1);
  });
});

describe("messageForError", () => {
  it("returns the typed error's message", () => {
    expect(messageForError(new UsageError("bad flag"))).toBe("bad flag");
  });

  it("returns a generic message for unknown throwables (never leaks raw detail)", () => {
    const raw = new Error("stack-trace-ish internal detail");
    expect(messageForError(raw)).not.toContain("stack-trace-ish");
    expect(messageForError("boom")).toBe("An unexpected internal error occurred.");
  });

  it("falls back to the generic message when a typed error has a blank message", () => {
    expect(messageForError(new UsageError("   "))).toBe("An unexpected internal error occurred.");
    expect(messageForError(new UsageError(""))).toBe("An unexpected internal error occurred.");
  });
});

describe("error exit-code ↔ enum consistency", () => {
  const pairs: { err: CommitWhisperError; expected: number }[] = [
    { err: new InternalError(), expected: ExitCode.Internal },
    { err: new UsageError("x"), expected: ExitCode.Usage },
    { err: new MissingRequiredConfigError("x"), expected: ExitCode.MissingInput },
    { err: new RetrieveError("x"), expected: ExitCode.Retrieve },
    { err: new MetricsError("x"), expected: ExitCode.Metrics },
    { err: new NarrationError("x"), expected: ExitCode.Narration },
    { err: new RenderError("x"), expected: ExitCode.Render },
    { err: new LicenseError("x"), expected: ExitCode.License },
  ];

  for (const { err, expected } of pairs) {
    it(`${err.name} literal matches the ExitCode enum`, () => {
      expect(err.exitCode).toBe(expected);
    });
  }
});
