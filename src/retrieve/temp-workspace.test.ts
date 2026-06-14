import { describe, it, expect, vi } from "vitest";

import { withTempWorkspace, type SignalHub, type TempWorkspaceDeps } from "./temp-workspace.js";

/** A fake signal hub that records registrations and lets a test fire a signal. */
function fakeSignals() {
  const handlers = new Map<string, Set<() => void>>();
  const exits: number[] = [];
  const hub: SignalHub = {
    once: (event, handler) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    },
    removeListener: (event, handler) => {
      handlers.get(event)?.delete(handler);
    },
    exit: (code) => {
      exits.push(code);
    },
  };
  const fire = (event: "SIGINT" | "SIGTERM"): void => {
    for (const h of handlers.get(event) ?? []) {
      h();
    }
  };
  const count = (event: "SIGINT" | "SIGTERM"): number => handlers.get(event)?.size ?? 0;
  return { hub, fire, exits, count };
}

function harness(over: Partial<TempWorkspaceDeps> = {}) {
  const removed: string[] = [];
  const signals = fakeSignals();
  const deps: TempWorkspaceDeps = {
    mkdtemp: () => "/tmp/commit-sage-XXXX",
    rmrf: (dir) => {
      removed.push(dir);
    },
    signals: signals.hub,
    ...over,
  };
  return { deps, removed, signals };
}

describe("withTempWorkspace", () => {
  it("on success: runs work in the temp dir, cleans up once, and deregisters handlers", async () => {
    const h = harness();
    const result = await withTempWorkspace(async (dir) => {
      expect(dir).toBe("/tmp/commit-sage-XXXX");
      return "ok";
    }, h.deps);
    expect(result).toBe("ok");
    expect(h.removed).toEqual(["/tmp/commit-sage-XXXX"]); // cleaned exactly once
    expect(h.signals.count("SIGINT")).toBe(0); // handler removed
    expect(h.signals.count("SIGTERM")).toBe(0);
  });

  it("on failure: rethrows the work error AND still cleans up + deregisters", async () => {
    const h = harness();
    await expect(
      withTempWorkspace(async () => {
        throw new Error("boom");
      }, h.deps),
    ).rejects.toThrow("boom");
    expect(h.removed).toEqual(["/tmp/commit-sage-XXXX"]); // cleaned despite the throw
    expect(h.signals.count("SIGINT")).toBe(0);
    expect(h.signals.count("SIGTERM")).toBe(0);
  });

  it("on SIGINT mid-work: cleans up the temp dir then exits 130", async () => {
    const h = harness();
    await withTempWorkspace(async () => {
      h.signals.fire("SIGINT"); // Ctrl-C arrives while work is running
      return "done";
    }, h.deps);
    expect(h.removed).toContain("/tmp/commit-sage-XXXX");
    expect(h.signals.exits).toContain(130);
  });

  it("on SIGTERM: cleans up then exits 143", async () => {
    const h = harness();
    await withTempWorkspace(async () => {
      h.signals.fire("SIGTERM");
      return "done";
    }, h.deps);
    expect(h.signals.exits).toContain(143);
  });

  it("cleanup is idempotent — the SIGINT handler + the finally remove the dir only once", async () => {
    const h = harness();
    await withTempWorkspace(async () => {
      h.signals.fire("SIGINT"); // cleanup #1 (handler)
      return "done"; // → finally cleanup #2 (no-op)
    }, h.deps);
    expect(h.removed).toEqual(["/tmp/commit-sage-XXXX"]); // exactly one rm
  });

  it("an rmrf failure is swallowed — never masks the work result", async () => {
    const rmrf = vi.fn(() => {
      throw new Error("EBUSY");
    });
    const h = harness({ rmrf });
    const result = await withTempWorkspace(async () => "value", h.deps);
    expect(result).toBe("value"); // the cleanup error did not surface
    expect(rmrf).toHaveBeenCalledTimes(1);
  });

  it("a mkdtemp failure rejects cleanly — no dir created, no handlers registered, no rmrf", async () => {
    const rmrf = vi.fn();
    const h = harness({
      mkdtemp: () => {
        throw new Error("EACCES: tmpdir not writable");
      },
      rmrf,
    });
    await expect(withTempWorkspace(async () => "x", h.deps)).rejects.toThrow("EACCES");
    expect(rmrf).not.toHaveBeenCalled(); // nothing to clean — the dir never existed
    expect(h.signals.count("SIGINT")).toBe(0); // no handler leaked
    expect(h.signals.count("SIGTERM")).toBe(0);
  });
});
