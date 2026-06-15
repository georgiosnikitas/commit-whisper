import { describe, it, expect } from "vitest";

import { mergeLayers, type Layers } from "./resolver.js";

const empty: Layers = { defaults: {}, configFile: {}, env: {}, flags: {} };

describe("mergeLayers — precedence", () => {
  it("returns empty config + empty provenance for all-empty layers", () => {
    const { config, provenance } = mergeLayers(empty);
    expect(config).toEqual({});
    expect(provenance).toEqual({});
  });

  it("applies defaults -> configFile -> env -> flags (flags win)", () => {
    const layers: Layers = {
      defaults: { timezone: "UTC" },
      configFile: { timezone: "Europe/Athens" },
      env: { timezone: "America/New_York" },
      flags: { timezone: "Asia/Tokyo" },
    };
    const { config, provenance } = mergeLayers(layers);
    expect(config.timezone).toBe("Asia/Tokyo");
    expect(provenance.timezone).toBe("flag");
  });

  it("env beats configFile beats defaults when flags absent", () => {
    expect(
      mergeLayers({ ...empty, defaults: { timezone: "UTC" }, configFile: { timezone: "X" }, env: { timezone: "Y" } })
        .config.timezone,
    ).toBe("Y");
    expect(
      mergeLayers({ ...empty, defaults: { timezone: "UTC" }, configFile: { timezone: "X" } }).provenance.timezone,
    ).toBe("configFile");
    expect(mergeLayers({ ...empty, defaults: { timezone: "UTC" } }).provenance.timezone).toBe("default");
  });

  it("records provenance from the highest layer that supplied each field", () => {
    const layers: Layers = {
      defaults: { repoTarget: "/cwd", noMerges: false, aiMode: "off" },
      configFile: { noMerges: true },
      env: { aiMode: "auto" },
      flags: { authorFilter: "alice" },
    };
    const { config, provenance } = mergeLayers(layers);
    expect(config).toEqual({
      repoTarget: "/cwd",
      noMerges: true,
      aiMode: "auto",
      authorFilter: "alice",
    });
    expect(provenance).toEqual({
      repoTarget: "default",
      noMerges: "configFile",
      aiMode: "env",
      authorFilter: "flag",
    });
  });

  it("treats a higher layer's undefined as 'not supplied' (no clobber)", () => {
    const layers: Layers = {
      ...empty,
      defaults: { maxCommits: 50 },
      flags: { maxCommits: undefined },
    };
    const { config, provenance } = mergeLayers(layers);
    expect(config.maxCommits).toBe(50);
    expect(provenance.maxCommits).toBe("default");
  });

  it("merges non-overlapping fields keeping each field's origin layer", () => {
    const { provenance } = mergeLayers({
      defaults: { repoTarget: "/cwd" },
      configFile: { timezone: "Europe/Athens" },
      env: { maxCommits: 10 },
      flags: { noMerges: true },
    });
    expect(provenance).toEqual({
      repoTarget: "default",
      timezone: "configFile",
      maxCommits: "env",
      noMerges: "flag",
    });
  });
});
