import { describe, it, expect } from "vitest";

import {
  type LicenseCache,
  type LicenseStoreIo,
  clearLicenseCache,
  licenseFilePath,
  readActivationInstanceId,
  readCachedLicenseKey,
  readLicenseCache,
  writeLicenseCache,
} from "./store.js";

/** An in-memory filesystem fake — records calls + holds written bytes by path. */
function memoryIo(seed: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(seed));
  const calls: string[] = [];
  const io: LicenseStoreIo = {
    readFile: async (path) => {
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

describe("readActivationInstanceId", () => {
  it("reads the cached instanceId from ~/.commit-whisper/license.json", async () => {
    const path = licenseFilePath({ HOME: "/home/alice" });
    const { io } = memoryIo({ [path]: JSON.stringify({ instanceId: "inst-42" }) });
    expect(await readActivationInstanceId({ HOME: "/home/alice" }, io)).toBe("inst-42");
  });

  it("a COMMIT_WHISPER_LICENSE_INSTANCE env override wins (no file read needed)", async () => {
    const id = await readActivationInstanceId(
      { HOME: "/home/alice", COMMIT_WHISPER_LICENSE_INSTANCE: "ci-instance" },
      memoryIo().io,
    );
    expect(id).toBe("ci-instance");
  });

  it("returns undefined when the file is missing (never throws)", async () => {
    expect(await readActivationInstanceId({ HOME: "/home/alice" }, memoryIo().io)).toBeUndefined();
  });

  it("returns undefined for a corrupt or shapeless file", async () => {
    const path = licenseFilePath({ HOME: "/home/alice" });
    expect(
      await readActivationInstanceId({ HOME: "/home/alice" }, memoryIo({ [path]: "{not json" }).io),
    ).toBeUndefined();
    expect(await readActivationInstanceId({ HOME: "/home/alice" }, memoryIo({ [path]: "[]" }).io)).toBeUndefined();
  });
});

describe("readLicenseCache / readCachedLicenseKey (Story 7.2)", () => {
  it("reads both allow-listed fields", async () => {
    const path = licenseFilePath({ HOME: "/h" });
    const { io } = memoryIo({ [path]: JSON.stringify({ instanceId: "i", licenseKey: "LIC" }) });
    expect(await readLicenseCache({ HOME: "/h" }, io)).toEqual({ instanceId: "i", licenseKey: "LIC" });
    expect(await readCachedLicenseKey({ HOME: "/h" }, io)).toBe("LIC");
  });

  it("ignores non-allow-listed keys (a corrupt/forged extra is dropped)", async () => {
    const path = licenseFilePath({ HOME: "/h" });
    const { io } = memoryIo({ [path]: JSON.stringify({ instanceId: "i", aiKey: "sk-x" }) });
    expect(await readLicenseCache({ HOME: "/h" }, io)).toEqual({ instanceId: "i" });
  });

  it("a missing file → {} (never throws)", async () => {
    expect(await readLicenseCache({ HOME: "/h" }, memoryIo().io)).toEqual({});
  });
});

describe("writeLicenseCache (Story 7.2)", () => {
  it("atomically writes only the allow-listed fields (mkdir → same-dir .tmp → rename)", async () => {
    const { io, calls, files } = memoryIo();
    const path = await writeLicenseCache({ HOME: "/home/alice" }, { instanceId: "i-1", licenseKey: "LIC" }, io);
    expect(path).toBe("/home/alice/.commit-whisper/license.json");
    expect(calls[0]).toBe("mkdir /home/alice/.commit-whisper");
    expect(calls[1]).toMatch(/^write \/home\/alice\/\.commit-whisper\/license\.json\.[a-z0-9]+\.tmp$/);
    expect(calls[2]).toMatch(/^rename .+\.tmp \/home\/alice\/\.commit-whisper\/license\.json$/);
    expect(JSON.parse(files.get(path)!)).toEqual({ instanceId: "i-1", licenseKey: "LIC" });
  });

  it("never serialises a non-allow-listed extra (forged secret-shaped field)", async () => {
    const { io, files } = memoryIo();
    const sneaky = { instanceId: "i", licenseKey: "LIC", aiKey: "sk-secret" } as unknown as LicenseCache;
    const path = await writeLicenseCache({ HOME: "/h" }, sneaky, io);
    expect(files.get(path)).not.toContain("sk-secret");
  });

  it("cleans up the temp file when rename fails", async () => {
    const { io, calls, files } = memoryIo();
    const failingIo: LicenseStoreIo = {
      ...io,
      rename: async () => {
        throw new Error("EXDEV");
      },
    };
    await expect(writeLicenseCache({ HOME: "/h" }, { instanceId: "i" }, failingIo)).rejects.toThrow();
    expect(calls.some((c) => c.startsWith("unlink "))).toBe(true);
    expect([...files.keys()].some((k) => k.endsWith(".tmp"))).toBe(false);
  });

  it("round-trips a write → read", async () => {
    const shared = memoryIo();
    await writeLicenseCache({ HOME: "/h" }, { instanceId: "i-9", licenseKey: "LIC-9" }, shared.io);
    expect(await readLicenseCache({ HOME: "/h" }, shared.io)).toEqual({ instanceId: "i-9", licenseKey: "LIC-9" });
  });
});

describe("clearLicenseCache (Story 7.2)", () => {
  it("unlinks the license file", async () => {
    const path = licenseFilePath({ HOME: "/h" });
    const shared = memoryIo({ [path]: JSON.stringify({ instanceId: "i" }) });
    await clearLicenseCache({ HOME: "/h" }, shared.io);
    expect(shared.files.has(path)).toBe(false);
  });

  it("is a no-op (no throw) when the file is already absent", async () => {
    await expect(clearLicenseCache({ HOME: "/h" }, memoryIo().io)).resolves.toBeUndefined();
  });
});
