import { describe, expect, it } from "vitest";
import {
  CARACAS_OFFSET_MINUTES,
  OFFICIAL_TIMEZONE,
  OFFICIAL_UTC_OFFSET,
  addHoursToUtcIso,
  caracasLocalToUtcIso,
  formatCaracasDateTime,
  getRemainingTimeBreakdown,
  hasMinimumHoursGap,
  utcIsoToCaracasLocalInput,
} from "../timezone";

describe("Step 1.8 — Official Timezone Utilities (America/Caracas UTC-4)", () => {
  it("defines America/Caracas (UTC-4 / -240 min) constants", () => {
    expect(OFFICIAL_TIMEZONE).toBe("America/Caracas");
    expect(OFFICIAL_UTC_OFFSET).toBe("-04:00");
    expect(CARACAS_OFFSET_MINUTES).toBe(-240);
  });

  it("converts Caracas local datetime strings to UTC ISO and back losslessly", () => {
    // 09:00 AM in Caracas (UTC-4) is 13:00 UTC
    const utcIso = caracasLocalToUtcIso("2026-06-15T09:00");
    expect(utcIso).toBe("2026-06-15T13:00:00.000Z");

    const roundTrip = utcIsoToCaracasLocalInput(utcIso);
    expect(roundTrip).toBe("2026-06-15T09:00");

    // Late evening in Caracas (22:30 on June 15) crosses into June 16 02:30 UTC
    const lateUtc = caracasLocalToUtcIso("2026-06-15T22:30:00");
    expect(lateUtc).toBe("2026-06-16T02:30:00.000Z");
    expect(utcIsoToCaracasLocalInput(lateUtc)).toBe("2026-06-15T22:30");
  });

  it("rejects malformed Caracas local datetime strings", () => {
    expect(() => caracasLocalToUtcIso("15/06/2026 09:00")).toThrow(
      "Invalid Caracas local datetime format"
    );
    expect(() => caracasLocalToUtcIso("not-a-date")).toThrow(
      "Invalid Caracas local datetime format"
    );
  });

  it("formats UTC dates into Spanish Caracas wall-clock strings", () => {
    const formatted = formatCaracasDateTime("2026-06-15T13:00:00.000Z");
    expect(formatted).toBe("15/06/2026, 09:00 (hora de Caracas)");

    const withoutLabel = formatCaracasDateTime("2026-06-15T13:00:00.000Z", {
      includeTimezoneLabel: false,
    });
    expect(withoutLabel).toBe("15/06/2026, 09:00");
  });

  it("adds hours and validates mandatory 48-hour stage gaps accurately", () => {
    const endOfWriting = "2026-06-10T13:00:00.000Z";
    const plus24h = addHoursToUtcIso(endOfWriting, 24);
    const plus48h = addHoursToUtcIso(endOfWriting, 48);

    expect(plus24h).toBe("2026-06-11T13:00:00.000Z");
    expect(plus48h).toBe("2026-06-12T13:00:00.000Z");

    expect(hasMinimumHoursGap(endOfWriting, plus24h, 48)).toBe(false);
    expect(hasMinimumHoursGap(endOfWriting, plus48h, 48)).toBe(true);
    expect(hasMinimumHoursGap(endOfWriting, endOfWriting, 0)).toBe(true);
  });

  it("calculates countdown breakdowns and flags the last 1-hour window", () => {
    const target = "2026-06-15T13:00:00.000Z";

    // 45 minutes remaining -> under 1 hour
    const underOneHour = getRemainingTimeBreakdown(
      target,
      "2026-06-15T12:15:00.000Z"
    );
    expect(underOneHour.expired).toBe(false);
    expect(underOneHour.isUnderOneHour).toBe(true);
    expect(underOneHour.formatted).toBe("00:45:00");

    // 2 days, 3 hours, 10 minutes, 5 seconds remaining
    const multiDay = getRemainingTimeBreakdown(
      target,
      "2026-06-13T09:49:55.000Z"
    );
    expect(multiDay.expired).toBe(false);
    expect(multiDay.isUnderOneHour).toBe(false);
    expect(multiDay.days).toBe(2);
    expect(multiDay.hours).toBe(3);
    expect(multiDay.minutes).toBe(10);
    expect(multiDay.seconds).toBe(5);
    expect(multiDay.formatted).toBe("2d 03h 10m 05s");

    // Past deadline -> expired
    const expired = getRemainingTimeBreakdown(
      target,
      "2026-06-15T14:00:00.000Z"
    );
    expect(expired.expired).toBe(true);
    expect(expired.totalMs).toBe(0);
    expect(expired.isUnderOneHour).toBe(false);
    expect(expired.formatted).toBe("00:00:00");
  });
});
