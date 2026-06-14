import { describe, it, expect } from "vitest";

import { isRemoteTarget } from "./target.js";

describe("isRemoteTarget", () => {
  it("an https / http URL (any case, surrounding space) is remote", () => {
    expect(isRemoteTarget("https://github.com/owner/repo")).toBe(true);
    expect(isRemoteTarget("https://gitlab.com/group/sub/repo.git")).toBe(true);
    expect(isRemoteTarget("HTTPS://Example.com/X")).toBe(true);
    expect(isRemoteTarget("http://internal.example/repo")).toBe(true);
    expect(isRemoteTarget("  https://github.com/owner/repo  ")).toBe(true);
  });

  it("a local filesystem path is not remote", () => {
    expect(isRemoteTarget(".")).toBe(false);
    expect(isRemoteTarget("/abs/path/to/repo")).toBe(false);
    expect(isRemoteTarget("./relative")).toBe(false);
    expect(isRemoteTarget("../up")).toBe(false);
    expect(isRemoteTarget("~/projects/repo")).toBe(false);
    expect(isRemoteTarget("C:\\Users\\me\\repo")).toBe(false);
  });

  it("an empty string and a flag-looking string are not remote (never reach `git clone` as an option)", () => {
    expect(isRemoteTarget("")).toBe(false);
    expect(isRemoteTarget("   ")).toBe(false);
    expect(isRemoteTarget("--upload-pack=touch pwned")).toBe(false);
    expect(isRemoteTarget("-oProxyCommand=evil")).toBe(false);
  });

  it("an SSH target is not remote (HTTPS only — SSH is Story 5.2)", () => {
    expect(isRemoteTarget("git@github.com:owner/repo.git")).toBe(false);
    expect(isRemoteTarget("ssh://git@github.com/owner/repo.git")).toBe(false);
  });
});
