/**
 * Banking-style Rolling Session & Inactivity Timeout Configuration
 *
 * - Closed tab / no heartbeat: server-side D1 session token expires in 10 minutes.
 * - Open tab & active: periodic heartbeat (every 4 minutes) renews the 10-minute token seamlessly
 *   with safety margin before server expiry.
 * - Open tab & idle: at 14 minutes shows a 1-minute countdown warning modal;
 *   at 15 minutes automatically signs out and redirects to /login?motivo=inactividad.
 */

export const CLOSED_TAB_SESSION_SECONDS = 10 * 60; // 10 minutes when tab is closed
export const SESSION_UPDATE_AGE_SECONDS = 60; // allow rolling refresh every 60s
export const OPEN_TAB_IDLE_WARNING_MS = 14 * 60 * 1000; // 14 minutes idle -> show modal
export const OPEN_TAB_WARNING_COUNTDOWN_MS = 1 * 60 * 1000; // 1 minute countdown
export const OPEN_TAB_IDLE_LOGOUT_MS =
  OPEN_TAB_IDLE_WARNING_MS + OPEN_TAB_WARNING_COUNTDOWN_MS; // 15 minutes total
export const SESSION_HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000; // refresh 10-min token every 4 minutes

export type IdleSessionStatus = "active" | "warning" | "expired";

export interface IdleStateEvaluation {
  status: IdleSessionStatus;
  idleMs: number;
  remainingMs: number;
}

export function evaluateIdleState(
  lastActivityMs: number,
  nowMs: number
): IdleStateEvaluation {
  const idleMs = Math.max(0, nowMs - lastActivityMs);

  if (idleMs >= OPEN_TAB_IDLE_LOGOUT_MS) {
    return { status: "expired", idleMs, remainingMs: 0 };
  }

  if (idleMs >= OPEN_TAB_IDLE_WARNING_MS) {
    return {
      status: "warning",
      idleMs,
      remainingMs: OPEN_TAB_IDLE_LOGOUT_MS - idleMs,
    };
  }

  return {
    status: "active",
    idleMs,
    remainingMs: OPEN_TAB_IDLE_LOGOUT_MS - idleMs,
  };
}

export function formatCountdownMmSs(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
