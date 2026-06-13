/**
 * Deterministic timezone bucketing helpers (Story 1.5).
 *
 * Uses the built-in `Intl.DateTimeFormat` (no new dependency) to derive tz-aware
 * calendar parts from an epoch-ms instant. The underlying metric is computed in
 * UTC; these helpers only derive the *bucket labels* in the user's timezone, so
 * the time-of-day / day-of-week / volume metrics stay deterministic and
 * tz-correct. Formatters are cached per timezone.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  weekday: number; // 0 = Sunday … 6 = Saturday
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached !== undefined) {
    return cached;
  }
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  formatterCache.set(timezone, fmt);
  return fmt;
}

/** Derive tz-aware calendar parts for an epoch-ms instant. */
export function zonedParts(epochMs: number, timezone: string): ZonedParts {
  const parts = formatterFor(timezone).formatToParts(epochMs);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  // `hour: "2-digit"` with hour12:false can emit "24" at midnight in some engines.
  const hour = Number(get("hour")) % 24;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/** `YYYY-MM-DD` day bucket label in the given timezone. */
export function dayBucket(epochMs: number, timezone: string): string {
  const p = zonedParts(epochMs, timezone);
  return `${pad(p.year, 4)}-${pad(p.month, 2)}-${pad(p.day, 2)}`;
}

/** `YYYY-MM` month bucket label in the given timezone. */
export function monthBucket(epochMs: number, timezone: string): string {
  const p = zonedParts(epochMs, timezone);
  return `${pad(p.year, 4)}-${pad(p.month, 2)}`;
}

/** ISO-week bucket label `YYYY-Www` (ISO-8601 week date) in the given timezone. */
export function isoWeekBucket(epochMs: number, timezone: string): string {
  const p = zonedParts(epochMs, timezone);
  // Compute ISO week from the tz-local calendar date (UTC math on a pure date).
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${pad(isoYear, 4)}-W${pad(week, 2)}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
