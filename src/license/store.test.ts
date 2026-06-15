import { describe, it, expect } from "vitest";

import { type LicenseStoreIo, licenseFilePath, readActivationInstanceId } from "./store.js";

function memoryIo(seed: Record<string, string> = {}): LicenseStoreIo {
  const files = new Map<string, string>(Object.entries(seed));
  return {
    readFile: async (path) => {
      const data = files.get(path);
      if (data === undefined) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return data;
    },
  };
}

describe("readActivationInstanceId", () => {
  it("reads the cached instanceId from ~/.commit-sage/license.json", async () => {
    const path = licenseFilePath({ HOME: "/home/alice" });
    const io = memoryIo({ [path]: JSON.stringify({ instanceId: "inst-42" }) });
    expect(await readActivationInstanceId({ HOME: "/home/alice" }, io)).toBe("inst-42");
  });

  it("a COMMIT_SAGE_LICENSE_INSTANCE env override wins (no file read needed)", async () => {
    const id = await readActivationInstanceId(
      { HOME: "/home/alice", COMMIT_SAGE_LICENSE_INSTANCE: "ci-instance" },
      memoryIo(),
    );
    expect(id).toBe("ci-instance");
  });

  it("returns undefined when the file is missing (never throws)", async () => {
    expect(await readActivationInstanceId({ HOME: "/home/alice" }, memoryIo())).toBeUndefined();
  });

  it("returns undefined for a corrupt or shapeless file", async () => {
    const path = licenseFilePath({ HOME: "/home/alice" });
    expect(await readActivationInstanceId({ HOME: "/home/alice" }, memoryIo({ [path]: "{not json" }))).toBeUndefined();
    expect(await readActivationInstanceId({ HOME: "/home/alice" }, memoryIo({ [path]: "[]" }))).toBeUndefined();
    expect(
      await readActivationInstanceId({ HOME: "/home/alice" }, memoryIo({ [path]: JSON.stringify({ other: 1 }) })),
    ).toBeUndefined();
  });
});
