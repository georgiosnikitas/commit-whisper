import { describe, it, expect } from "vitest";

import { buildDefaults, CONFIG_FIELD_KEYS, FIELD_SPECS } from "./sources.js";

describe("buildDefaults", () => {
  it("defaults aiMode to auto when interactive", () => {
    const d = buildDefaults({ interactive: true, cwd: "/repo" });
    expect(d.aiMode).toBe("auto");
  });

  it("defaults aiMode to off when headless/CI", () => {
    const d = buildDefaults({ interactive: false, cwd: "/repo" });
    expect(d.aiMode).toBe("off");
  });

  it("sets repoTarget to the injected cwd and the documented defaults", () => {
    const d = buildDefaults({ interactive: false, cwd: "/some/dir" });
    expect(d.repoTarget).toBe("/some/dir");
    expect(d.branch).toEqual({ kind: "head" });
    expect(d.timezone).toBe("UTC");
    expect(d.noMerges).toBe(false);
    expect(d.outputFormats).toEqual(["terminal"]);
  });

  it("leaves optional/unbounded fields unset", () => {
    const d = buildDefaults({ interactive: false, cwd: "/repo" });
    expect(d.startDate).toBeUndefined();
    expect(d.endDate).toBeUndefined();
    expect(d.authorFilter).toBeUndefined();
    expect(d.maxCommits).toBeUndefined();
    expect(d.outputPath).toBeUndefined();
    expect(d.provider).toBeUndefined();
    expect(d.llmBaseUrl).toBeUndefined();
    expect(d.llmModel).toBeUndefined();
  });
});

describe("FIELD_SPECS / CONFIG_FIELD_KEYS", () => {
  it("marks the AI cluster with conditional requiredness", () => {
    expect(FIELD_SPECS.provider.requiredness.kind).toBe("whenAi");
    expect(FIELD_SPECS.llmModel.requiredness.kind).toBe("whenAi");
    expect(FIELD_SPECS.llmBaseUrl.requiredness.kind).toBe("whenAiBaseUrl");
  });

  it("marks repoTarget always-required and filters/output optional", () => {
    expect(FIELD_SPECS.repoTarget.requiredness.kind).toBe("always");
    expect(FIELD_SPECS.timezone.requiredness.kind).toBe("optional");
    expect(FIELD_SPECS.outputFormats.requiredness.kind).toBe("optional");
  });

  it("exposes a stable, exhaustive field-key order", () => {
    expect(CONFIG_FIELD_KEYS[0]).toBe("repoTarget");
    expect(CONFIG_FIELD_KEYS).toContain("aiMode");
    expect(CONFIG_FIELD_KEYS).toHaveLength(Object.keys(FIELD_SPECS).length);
  });

  it("maps every field to a COMMIT_WHISPER_* env var", () => {
    for (const key of CONFIG_FIELD_KEYS) {
      expect(FIELD_SPECS[key].envVar.startsWith("COMMIT_WHISPER_")).toBe(true);
    }
  });
});
