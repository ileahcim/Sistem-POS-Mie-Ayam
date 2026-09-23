// Single source of truth for "what time is it at the warung" — every
// server-side day-grouping, date-range boundary, or user-facing date/time
// display in this app must go through this module, never a bare
// `new Date().getHours()`/`toISOString().slice()`/`new Intl.DateTimeFormat()`
// without an explicit timeZone. See CLAUDE.md "Zona waktu".
//
// Why this exists (not just style): a bare local Date getter or a
// default-timeZone Intl call is only correct because THIS sandbox's OS
// clock happens to be set to Asia/Jakarta — verified once, at one point in
// time, in one environment. Vercel's serverless functions run in UTC
// regardless of selected region, so the exact same code that's correct in
// dev silently shows every timestamp shifted by 7 hours in production
// (a shift closed at 20:00 WIB would render as "13:00"). Passing an
// explicit IANA timeZone to Intl sidesteps the runtime's default entirely
// and is correct in any deploy environment — confirmed by running this
// module's logic under `TZ=UTC` and getting identical output to `TZ=Asia/Jakarta`.
//
// Indonesia has no daylight saving time, so WIB is a fixed UTC+7 offset —
// nothing here needs to special-case a DST transition.
export const APP_TIMEZONE = "Asia/Jakarta";

type DateParts = { year: number; month: number; day: number; hour: number; minute: number };

function partsFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getLocalParts(date: Date): DateParts {
  const parts = partsFormatter().formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // hour12:false can render midnight as "24" in some ICU implementations.
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute") };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" in Jakarta local time — for filenames, day-grouping keys,
// and anywhere a sortable calendar-day string is needed.
export function localDateStr(date: Date): string {
  const p = getLocalParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

// "HH:MM" in Jakarta local time.
export function localTimeStr(date: Date): string {
  const p = getLocalParts(date);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

// Hour of day (0-23) in Jakarta local time — e.g. Dashboard's Jam Sibuk chart.
export function localHour(date: Date): number {
  return getLocalParts(date).hour;
}

export function localDateParts(date: Date): { year: number; month: number; day: number } {
  const { year, month, day } = getLocalParts(date);
  return { year, month, day };
}

// Monday of the ISO week containing `date`, as a Jakarta calendar Y/M/D.
// Pure calendar-day arithmetic on the already-correct local Y/M/D triple —
// the UTC-flavored Date methods below are only ever used as a day-math
// scratchpad (add/subtract whole days), never to represent a real instant
// or read back an hour, so they stay timezone-independent from this point.
export function mondayOfLocalWeek(date: Date): { year: number; month: number; day: number } {
  const p = localDateParts(date);
  const scratch = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dow = scratch.getUTCDay() || 7; // Sunday -> 7
  if (dow > 1) scratch.setUTCDate(scratch.getUTCDate() - (dow - 1));
  return { year: scratch.getUTCFullYear(), month: scratch.getUTCMonth() + 1, day: scratch.getUTCDate() };
}

// Turns a "YYYY-MM-DD" Jakarta calendar date (e.g. a <input type="date">
// filter value) into the UTC instant range covering that whole day in WIB —
// [start, end) — ready for a Prisma `gte`/`lt` range query. WIB has no DST
// (see module comment), so this is a fixed -7h offset from local midnight;
// Date.UTC's built-in overflow normalization handles the day rollover, same
// day-math-scratchpad trick as mondayOfLocalWeek above.
export function wibDateRange(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day + 1, -7, 0, 0, 0)),
  };
}

// Every user-facing date/time display should call this instead of
// constructing `new Intl.DateTimeFormat("id-ID", ...)` directly — same
// explicit-timeZone reasoning as above. Safe to import from both client
// and server components (no other imports, nothing server-only).
export function formatId(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("id-ID", { ...options, timeZone: APP_TIMEZONE }).format(date);
}
