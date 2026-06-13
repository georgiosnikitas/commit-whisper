import { describe, it, expect } from "vitest";

import {
  CommitSageError,
  InternalError,
  LicenseError,
  MetricsError,
  MissingRequiredConfigError,
  NarrationError,
  RenderError,
  RetrieveError,
  UsageError,
} from "./errors.js";

describe("CommitSageError", () => {
  it("carries a machine code and exit code, and sets the subclass name", () => {
    const err = new CommitSageError("boom", "SOME_CODE", 7);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
    expect(err.code).toBe("SOME_CODE");
    expect(err.exitCode).toBe(7);
    expect(err.name).toBe("CommitSageError");
  });
});

describe("MissingRequiredConfigError", () => {
  it("is a CommitSageError with exit code 3 and a stable code", () => {
    const err = new MissingRequiredConfigError("provider");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CommitSageError);
    expect(err).toBeInstanceOf(MissingRequiredConfigError);
    expect(err.exitCode).toBe(3);
    expect(err.code).toBe("CONFIG_REQUIRED_MISSING");
    expect(err.name).toBe("MissingRequiredConfigError");
    expect(err.field).toBe("provider");
  });

  it("names the field in the message", () => {
    const err = new MissingRequiredConfigError("provider");
    expect(err.message).toContain("provider");
  });

  it("names the env var when supplied", () => {
    const err = new MissingRequiredConfigError("provider", "COMMIT_SAGE_PROVIDER");
    expect(err.message).toContain("COMMIT_SAGE_PROVIDER");
  });
});

describe("stage error hierarchy", () => {
  const cases = [
    { Cls: UsageError, exitCode: 2, code: "USAGE" },
    { Cls: RetrieveError, exitCode: 4, code: "RETRIEVE" },
    { Cls: MetricsError, exitCode: 5, code: "METRICS" },
    { Cls: NarrationError, exitCode: 6, code: "NARRATION" },
    { Cls: RenderError, exitCode: 7, code: "RENDER" },
    { Cls: LicenseError, exitCode: 8, code: "LICENSE" },
  ] as const;

  for (const { Cls, exitCode, code } of cases) {
    it(`${Cls.name} carries exit ${exitCode} / code ${code} and preserves its message`, () => {
      const err = new Cls("something failed");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CommitSageError);
      expect(err).toBeInstanceOf(Cls);
      expect(err.exitCode).toBe(exitCode);
      expect(err.code).toBe(code);
      expect(err.name).toBe(Cls.name);
      expect(err.message).toBe("something failed");
    });
  }

  it("InternalError is exit 1 / code INTERNAL with a default message", () => {
    const err = new InternalError();
    expect(err).toBeInstanceOf(CommitSageError);
    expect(err.exitCode).toBe(1);
    expect(err.code).toBe("INTERNAL");
    expect(err.name).toBe("InternalError");
    expect(err.message.length).toBeGreaterThan(0);
  });

  it("InternalError accepts an explicit message", () => {
    expect(new InternalError("boom").message).toBe("boom");
  });
});
