import { describe, it, expect } from "vitest";

import { binaryNameFor, postjectArgsFor, seaPlanFor, SEA_FUSE, MACHO_SEGMENT } from "../scripts/sea-plan.mjs";

describe("binaryNameFor", () => {
  it("appends .exe only on Windows", () => {
    expect(binaryNameFor("win32")).toBe("commit-whisper.exe");
    expect(binaryNameFor("darwin")).toBe("commit-whisper");
    expect(binaryNameFor("linux")).toBe("commit-whisper");
  });
});

describe("seaPlanFor", () => {
  it("macOS: signs (remove + re-sign), chmods, no npx shell, Mach-O segment set", () => {
    const plan = seaPlanFor("darwin");
    expect(plan).toEqual({
      isWindows: false,
      isMac: true,
      binaryName: "commit-whisper",
      removeSignature: true,
      reSign: true,
      chmod: true,
      npxShell: false,
      machoSegment: MACHO_SEGMENT,
    });
  });

  it("Linux: no signing, chmods, no npx shell, no Mach-O segment", () => {
    const plan = seaPlanFor("linux");
    expect(plan).toEqual({
      isWindows: false,
      isMac: false,
      binaryName: "commit-whisper",
      removeSignature: false,
      reSign: false,
      chmod: true,
      npxShell: false,
      machoSegment: undefined,
    });
  });

  it("Windows: no signing, NO chmod (no Unix mode bits), npx shelled, .exe name", () => {
    const plan = seaPlanFor("win32");
    expect(plan).toEqual({
      isWindows: true,
      isMac: false,
      binaryName: "commit-whisper.exe",
      removeSignature: false,
      reSign: false,
      chmod: false,
      npxShell: true,
      machoSegment: undefined,
    });
  });
});

describe("postjectArgsFor", () => {
  const base = { binaryPath: "dist-sea/commit-whisper", blobPath: "dist-sea/sea-prep.blob" };

  it("carries the blob name + the sentinel fuse on every platform", () => {
    for (const platform of ["darwin", "linux", "win32"] as const) {
      const args = postjectArgsFor({ ...base, platform });
      expect(args.slice(0, 5)).toEqual([
        "--yes",
        "postject",
        "dist-sea/commit-whisper",
        "NODE_SEA_BLOB",
        "dist-sea/sea-prep.blob",
      ]);
      expect(args).toContain("--sentinel-fuse");
      expect(args).toContain(SEA_FUSE);
    }
  });

  it("appends the Mach-O segment ONLY on macOS", () => {
    expect(postjectArgsFor({ ...base, platform: "darwin" })).toEqual(
      expect.arrayContaining(["--macho-segment-name", MACHO_SEGMENT]),
    );
    expect(postjectArgsFor({ ...base, platform: "linux" })).not.toContain("--macho-segment-name");
    expect(postjectArgsFor({ ...base, platform: "win32" })).not.toContain("--macho-segment-name");
  });

  it("the macOS arg vector is exactly the cross-platform vector + the segment pair", () => {
    const linux = postjectArgsFor({ ...base, platform: "linux" });
    const mac = postjectArgsFor({ ...base, platform: "darwin" });
    expect(mac).toEqual([...linux, "--macho-segment-name", MACHO_SEGMENT]);
  });
});
