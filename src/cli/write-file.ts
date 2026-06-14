/**
 * The default file writer for rendered artifacts (Story 4.4).
 *
 * Isolates the one new real I/O edge — writing a rendered report to disk — behind
 * an injectable type so `runPipeline` stays offline-testable (tests pass a fake
 * `WriteFile`; the default wires `node:fs/promises`). Lives in `cli/` (the shell
 * that owns side effects), keeping `render/` a pure function of the Report JSON.
 */

import { writeFile as fsWriteFile } from "node:fs/promises";

/** Write `content` to `path` (UTF-8). */
export type WriteFile = (path: string, content: string) => Promise<void>;

/** The real writer: `node:fs/promises` `writeFile`, UTF-8. */
export const defaultWriteFile: WriteFile = async (path, content) => {
  await fsWriteFile(path, content, "utf8");
};
