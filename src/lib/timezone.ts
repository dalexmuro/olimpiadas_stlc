/**
 * Official Contest Timezone Utilities — America/Caracas (UTC-4)
 * Step 1.8: Timezone conversion, formatting, countdown calculation, and stage buffer math
 */

export const OFFICIAL_TIMEZONE = "America/Caracas" as const;
export const OFFICIAL_UTC_OFFSET = "-04:00" as const;
export const CARACAS_OFFSET_MINUTES = -240 as const; // UTC-4 fixed (Venezuela has no DST)
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

const LOCAL_DATETIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses an ISO-8601 string or Date into a validated UTC timestamp in milliseconds.
 */
export function parseUtcMs(dateOrIso: Date | string): number {
  const ms =
    dateOrIso instanceof Date ? dateOrIso.getTime() : Date.parse(dateOrIso);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date or ISO timestamp: "${String(dateOrIso)}"`);
  }
  return ms;
}

/**
 * Converts a local Caracas datetime string (`YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`)
 * from an admin form input into an ISO-8601 UTC string (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 */
export function caracasLocalToUtcIso(localDateTimeStr: string): string {
  const trimmed = localDateTimeStr.trim();
  const match = LOCAL_DATETIME_REGEX.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid Caracas local datetime format "${localDateTimeStr}". Expected "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss".`
    );
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const isoWithCaracasOffset = `${year}-${month}-${day}T${hour}:${minute}:${second}${OFFICIAL_UTC_OFFSET}`;
  const parsedMs = Date.parse(isoWithCaracasOffset);

  if (Number.isNaN(parsedMs)) {
    throw new Error(
      `Invalid calendar date in Caracas local datetime "${localDateTimeStr}".`
    );
  }

  return new Date(parsedMs).toISOString();
}

/**
 * Converts a UTC ISO-8601 timestamp or Date into a `YYYY-MM-DDTHH:mm` string
 * in `America/Caracas` time, suitable for `<input type="datetime-local">`.
 */
export function utcIsoToCaracasLocalInput(dateOrIso: Date | string): string {
  const utcMs = parseUtcMs(dateOrIso);
  // Shift by -4 hours in UTC math so getUTC* getters yield America/Caracas wall-clock components
  const caracasWallClock = new Date(
    utcMs + CARACAS_OFFSET_MINUTES * MS_PER_MINUTE
  );

  const yyyy = String(caracasWallClock.getUTCFullYear()).padStart(4, "0");
  const mm = String(caracasWallClock.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(caracasWallClock.getUTCDate()).padStart(2, "0");
  const hh = String(caracasWallClock.getUTCHours()).padStart(2, "0");
  const min = String(caracasWallClock.getUTCMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Formats a UTC ISO timestamp or Date into a human-readable Spanish string
 * in `America/Caracas` time (e.g., `"15/06/2026, 09:00 (hora de Caracas)"`).
 */
export function formatCaracasDateTime(
  dateOrIso: Date | string,
  options: { includeTimezoneLabel?: boolean } = {}
): string {
  const utcMs = parseUtcMs(dateOrIso);
  const caracasWallClock = new Date(
    utcMs + CARACAS_OFFSET_MINUTES * MS_PER_MINUTE
  );

  const dd = String(caracasWallClock.getUTCDate()).padStart(2, "0");
  const mm = String(caracasWallClock.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(caracasWallClock.getUTCFullYear()).padStart(4, "0");
  const hh = String(caracasWallClock.getUTCHours()).padStart(2, "0");
  const min = String(caracasWallClock.getUTCMinutes()).padStart(2, "0");

  const base = `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
  if (options.includeTimezoneLabel === false) {
    return base;
  }
  return `${base} (hora de Caracas)`;
}

/**
 * Adds a specified number of hours (can be fractional or negative) to a UTC ISO timestamp.
 */
export function addHoursToUtcIso(
  dateOrIso: Date | string,
  hours: number
): string {
  const utcMs = parseUtcMs(dateOrIso);
  return new Date(utcMs + hours * MS_PER_HOUR).toISOString();
}

/**
 * Checks whether `laterIso` is at least `minHours` hours after `earlierIso`.
 * Used to enforce sequential stage dates and mandatory 48-hour buffers.
 */
export function hasMinimumHoursGap(
  earlierIso: Date | string,
  laterIso: Date | string,
  minHours: number
): boolean {
  const earlierMs = parseUtcMs(earlierIso);
  const laterMs = parseUtcMs(laterIso);
  return laterMs - earlierMs >= minHours * MS_PER_HOUR;
}

export interface CountdownBreakdown {
  totalMs: number;
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when > 0 ms and <= 1 hour remains (triggers urgent editor countdown & 1h emails) */
  isUnderOneHour: boolean;
  /** Formatted string: `HH:MM:SS` if under 24h, or `Xd HHh MMm SSs` if >= 1 day */
  formatted: string;
}

/**
 * Calculates the remaining time breakdown between `now` and `targetIso`.
 */
export function getRemainingTimeBreakdown(
  targetIso: Date | string,
  nowIso: Date | string = new Date()
): CountdownBreakdown {
  const targetMs = parseUtcMs(targetIso);
  const nowMs = parseUtcMs(nowIso);
  const diffMs = Math.max(0, targetMs - nowMs);

  if (diffMs === 0) {
    return {
      totalMs: 0,
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isUnderOneHour: false,
      formatted: "00:00:00",
    };
  }

  const totalSeconds = Math.floor(diffMs / MS_PER_SECOND);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hhStr = String(hours).padStart(2, "0");
  const mmStr = String(minutes).padStart(2, "0");
  const ssStr = String(seconds).padStart(2, "0");

  const formatted =
    days > 0
      ? `${days}d ${hhStr}h ${mmStr}m ${ssStr}s`
      : `${hhStr}:${mmStr}:${ssStr}`;

  return {
    totalMs: diffMs,
    expired: false,
    days,
    hours,
    minutes,
    seconds,
    isUnderOneHour: diffMs <= MS_PER_HOUR,
    formatted,
  };
}
