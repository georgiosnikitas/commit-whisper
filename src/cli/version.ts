/**
 * The product version (Story 6.4), mirroring `package.json`'s `version`.
 *
 * Kept as a const (not a runtime JSON import) so the tsup bundle + nodenext
 * resolution stay simple; `version.test.ts` reads `package.json` and asserts the
 * two never drift.
 */

export const VERSION = "1.1.0";
