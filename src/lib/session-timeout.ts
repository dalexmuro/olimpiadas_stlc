/**
 * Banking-style Rolling Session & Inactivity Timeout Configuration
 *
 * - Closed tab / no heartbeat: server-side D1 session token expires in 15 minutes.
 * - Open tab & active: periodic heartbeat renews the 15-minute token seamlessly.
 * - Open tab & idle: at 25 minutes shows a 5-minute countdown warning modal;
 *   at 30 minutes automatically signs out and redirects to /login?motivo=inactividad.
 */

export const CLOSED_TAB_SESSION_SECONDS = 15 * 60; // 15 minutes when tab is closed
export const SESSION_UPDATE_AGE_SECONDS = 60; // allow rolling refresh every 60s
export const OPEN_TAB_IDLE_WARNING_MS = 25 * 60 * 1000; // 25 minutes idle -> show modal
export const OPEN_TAB_WARNING_COUNTDOWN_MS = 5 * 60 * 1000; // 5 minutes countdown
export const OPEN_TAB_IDLE_LOGOUT_MS =
  OPEN_TAB_IDLE_WARNING_MS + OPEN_TAB_WARNING_COUNTDOWN_MS; // 30 minutes total
export const SESSION_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // refresh token every 5 minutes

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
