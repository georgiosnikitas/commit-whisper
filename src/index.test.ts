import { describe, it, expect } from "vitest";

import { APP_NAME } from "./index.js";

describe("scaffold smoke test", () => {
  it("exposes the application name", () => {
    expect(APP_NAME).toBe("commit-sage");
  });
});
