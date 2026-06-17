import { describe, it, expect } from "vitest";

import {
  type ConfigStoreIo,
  configFilePath,
  configHome,
  parseSettings,
  readSettings,
  serializeSettings,
  writeSettings,
  type SettingsData,
} from "./config-store.js";

/** An in-memory filesystem fake — records calls + holds written bytes by path. */
function memoryIo(seed: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(seed));
  const calls: string[] = [];
  const io: ConfigStoreIo = {
    readFile: async (path) => {
      calls.push(`read ${path}`);
      const data = files.get(path);
      if (data === undefined) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return data;
    },
    writeFile: async (path, data) => {
      calls.push(`write ${path}`);
      files.set(path, data);
    },
    mkdir: async (path) => {
      calls.push(`mkdir ${path}`);
    },
    rename: async (from, to) => {
      calls.push(`rename ${from} ${to}`);
      const data = files.get(from);
      if (data === undefined) {
        throw new Error("rename source missing");
      }
      files.set(to, data);
      files.delete(from);
    },
    unlink: async (path) => {
      calls.push(`unlink ${path}`);
      files.delete(path);
    },
  };
  return { io, files, calls };
}

describe("configHome / configFilePath", () => {
  it("uses <HOME>/.commit-whisper by default", () => {
    expect(configHome({ HOME: "/home/alice" })).toBe("/home/alice/.commit-whisper");
    expect(configFilePath({ HOME: "/home/alice" })).toBe("/home/alice/.commit-whisper/config.json");
  });

  it("honors a COMMIT_WHISPER_CONFIG home override", () => {
    expect(configHome({ COMMIT_WHISPER_CONFIG: "/custom/dir", HOME: "/home/alice" })).toBe("/custom/dir");
  });

  it("falls back to USERPROFILE (Windows) when HOME is unset", () => {
    expect(configHome({ USERPROFILE: String.raw`C:\Users\bob` })).toContain("bob");
  });
});

describe("parseSettings", () => {
  it("parses the allow-listed keys with coercion", () => {
    const json = JSON.stringify({
      provider: "openai",
      llmModel: "gpt-4o",
      llmBaseUrl: "https://x",
      outputFormats: ["html", "json"],
      timezone: "Europe/Athens",
      maxCommits: 250,
    });
    expect(parseSettings(json)).toEqual({
      provider: "openai",
      llmModel: "gpt-4o",
      llmBaseUrl: "https://x",
      outputFormats: ["html", "json"],
      timezone: "Europe/Athens",
      maxCommits: 250,
    });
  });

  it("drops invalid field values (bad provider, empty formats, non-positive maxCommits)", () => {
    const json = JSON.stringify({
      provider: "not-a-provider",
      outputFormats: ["bogus"],
      maxCommits: 0,
      timezone: "   ",
    });
    expect(parseSettings(json)).toEqual({});
  });

  it("returns {} for malformed JSON, an array, or null", () => {
    expect(parseSettings("{not json")).toEqual({});
    expect(parseSettings("[1,2,3]")).toEqual({});
    expect(parseSettings("null")).toEqual({});
    expect(parseSettings('"a string"')).toEqual({});
  });

  it("structurally drops a secret-looking key (never re-enters the config layer)", () => {
    const json = JSON.stringify({ provider: "ollama", aiKey: "sk-secret", gitPat: "ghp_secret" });
    const parsed = parseSettings(json);
    expect(parsed).toEqual({ provider: "ollama" });
    expect(JSON.stringify(parsed)).not.toContain("sk-secret");
    expect(JSON.stringify(parsed)).not.toContain("ghp_secret");
  });

  it("ignores unknown keys (forward-compat)", () => {
    expect(parseSettings(JSON.stringify({ provider: "ollama", futureKey: 1 }))).toEqual({ provider: "ollama" });
  });

  it("de-duplicates output formats", () => {
    expect(parseSettings(JSON.stringify({ outputFormats: ["html", "html", "json"] })).outputFormats).toEqual([
      "html",
      "json",
    ]);
  });
});

describe("serializeSettings", () => {
  it("emits only present allow-listed fields, sorted, pretty", () => {
    const out = serializeSettings({ provider: "openai", maxCommits: 5 });
    expect(out).toBe(`{\n  "maxCommits": 5,\n  "provider": "openai"\n}\n`);
  });

  it("round-trips through parseSettings", () => {
    const data: SettingsData = { provider: "ollama", llmModel: "llama3", outputFormats: ["terminal"] };
    expect(parseSettings(serializeSettings(data))).toEqual(data);
  });

  it("never serialises a non-allow-listed extra (e.g. an injected secret)", () => {
    const sneaky = { provider: "ollama", aiKey: "sk-secret" } as unknown as SettingsData;
    const out = serializeSettings(sneaky);
    expect(out).not.toContain("sk-secret");
    expect(out).not.toContain("aiKey");
  });
});

describe("writeSettings — atomic temp + rename", () => {
  it("mkdir → writes a same-dir .tmp → renames it onto config.json (in order)", async () => {
    const { io, calls, files } = memoryIo();
    const path = await writeSettings({ HOME: "/home/alice" }, { provider: "ollama" }, io);
    expect(path).toBe("/home/alice/.commit-whisper/config.json");
    expect(calls[0]).toBe("mkdir /home/alice/.commit-whisper");
    expect(calls[1]).toMatch(/^write \/home\/alice\/\.commit-whisper\/config\.json\.[a-z0-9]+\.tmp$/);
    expect(calls[2]).toMatch(/^rename .+\.tmp \/home\/alice\/\.commit-whisper\/config\.json$/);
    expect(files.get(path)).toContain('"provider": "ollama"');
  });

  it("the temp file lives in the SAME dir as the target (same-volume rename = atomic)", async () => {
    const { io, calls } = memoryIo();
    await writeSettings({ HOME: "/home/alice" }, { provider: "openai" }, io);
    const writeCall = calls.find((c) => c.startsWith("write "))!;
    expect(writeCall).toContain("/home/alice/.commit-whisper/");
  });

  it("persists nothing secret even if a secret-shaped extra is forced in", async () => {
    const { io, files } = memoryIo();
    const path = await writeSettings(
      { HOME: "/home/alice" },
      { provider: "ollama", aiKey: "sk-secret" } as unknown as SettingsData,
      io,
    );
    expect(files.get(path)).not.toContain("sk-secret");
  });

  it("cleans up the temp file when rename fails (no orphaned .tmp accumulation)", async () => {
    const { io, calls, files } = memoryIo();
    const failingIo = {
      ...io,
      rename: async () => {
        throw new Error("EXDEV cross-device");
      },
    };
    await expect(writeSettings({ HOME: "/home/alice" }, { provider: "ollama" }, failingIo)).rejects.toThrow();
    expect(calls.some((c) => c.startsWith("unlink "))).toBe(true);
    // No leftover .tmp file remains.
    expect([...files.keys()].some((k) => k.endsWith(".tmp"))).toBe(false);
  });
});

describe("readSettings", () => {
  it("reads + parses a present config file", async () => {
    const path = "/home/alice/.commit-whisper/config.json";
    const { io } = memoryIo({ [path]: JSON.stringify({ provider: "gemini" }) });
    expect(await readSettings({ HOME: "/home/alice" }, io)).toEqual({ provider: "gemini" });
  });

  it("returns {} when the file is missing (ENOENT is normal)", async () => {
    const { io } = memoryIo();
    expect(await readSettings({ HOME: "/home/alice" }, io)).toEqual({});
  });

  it("round-trips a writeSettings → readSettings cycle", async () => {
    const shared = memoryIo();
    await writeSettings({ HOME: "/h" }, { provider: "ollama", llmModel: "llama3" }, shared.io);
    expect(await readSettings({ HOME: "/h" }, shared.io)).toEqual({ provider: "ollama", llmModel: "llama3" });
  });
});
