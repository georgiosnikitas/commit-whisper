import { describe, it, expect } from "vitest";

import { CommitSageError, MissingRequiredConfigError } from "./errors.js";

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
