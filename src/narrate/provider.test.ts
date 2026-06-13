import { describe, it, expect } from "vitest";

import { resolveModel } from "./provider.js";
import type { NarrateConfig } from "./narrate.port.js";
import { NarrationError } from "../shared/errors.js";
import { Secret } from "../shared/secret.js";

function cfg(overrides: Partial<NarrateConfig> = {}): NarrateConfig {
  return {
    aiMode: "auto",
    provider: "gemini",
    llmModel: "gemini-2.5-flash",
    aiKey: new Secret("dummy-key-not-real"),
    ...overrides,
  };
}

describe("resolveModel (gemini)", () => {
  it("builds a model from a gemini config without making a network call", () => {
    const model = resolveModel(cfg());
    expect(model).toBeDefined();
  });

  it("throws NarrationError (exit 6) naming the env var when the key is missing", () => {
    try {
      resolveModel(cfg({ aiKey: undefined }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(NarrationError);
      expect((e as NarrationError).exitCode).toBe(6);
      expect((e as NarrationError).message).toContain("GOOGLE_GENERATIVE_AI_API_KEY");
    }
  });

  it("throws NarrationError when the model is missing", () => {
    expect(() => resolveModel(cfg({ llmModel: undefined }))).toThrow(NarrationError);
  });

  it("throws NarrationError mentioning Story 3.6 for an unsupported provider", () => {
    try {
      resolveModel(cfg({ provider: "openai" }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(NarrationError);
      expect((e as NarrationError).message).toContain("3.6");
    }
  });
});
