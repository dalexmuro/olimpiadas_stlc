import { describe, expect, it } from "vitest";
import {
  CLOSED_TAB_SESSION_SECONDS,
  evaluateIdleState,
  formatCountdownMmSs,
  OPEN_TAB_IDLE_LOGOUT_MS,
  OPEN_TAB_IDLE_WARNING_MS,
  OPEN_TAB_WARNING_COUNTDOWN_MS,
  SESSION_HEARTBEAT_INTERVAL_MS,
} from "../session-timeout";

describe("Banking-style Rolling Session & Inactivity Timeout", () => {
  it("expires closed-tab sessions (10m) faster than open-tab logout (15m) and refreshes safely before expiry", () => {
    expect(CLOSED_TAB_SESSION_SECONDS).toBe(10 * 60);
    expect(OPEN_TAB_IDLE_WARNING_MS).toBe(14 * 60 * 1000);
    expect(OPEN_TAB_WARNING_COUNTDOWN_MS).toBe(1 * 60 * 1000);
    expect(OPEN_TAB_IDLE_LOGOUT_MS).toBe(15 * 60 * 1000);
    expect(CLOSED_TAB_SESSION_SECONDS * 1000).toBeLessThan(
      OPEN_TAB_IDLE_LOGOUT_MS
    );
    expect(SESSION_HEARTBEAT_INTERVAL_MS).toBeLessThan(
      CLOSED_TAB_SESSION_SECONDS * 1000
    );
  });

  it("transitions from active to warning to expired accurately", () => {
    const start = 1_700_000_000_000;

    const active = evaluateIdleState(start, start + 10 * 60 * 1000);
    expect(active.status).toBe("active");

    const warning = evaluateIdleState(start, start + OPEN_TAB_IDLE_WARNING_MS);
    expect(warning.status).toBe("warning");
    expect(warning.remainingMs).toBe(1 * 60 * 1000);

    const expired = evaluateIdleState(start, start + OPEN_TAB_IDLE_LOGOUT_MS);
    expect(expired.status).toBe("expired");
    expect(expired.remainingMs).toBe(0);
  });

  it("formats countdown values as MM:SS", () => {
    expect(formatCountdownMmSs(5 * 60 * 1000)).toBe("05:00");
    expect(formatCountdownMmSs(61_500)).toBe("01:02");
    expect(formatCountdownMmSs(0)).toBe("00:00");
  });
});
