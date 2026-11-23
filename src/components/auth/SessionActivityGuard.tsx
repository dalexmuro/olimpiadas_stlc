"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  evaluateIdleState,
  formatCountdownMmSs,
  SESSION_HEARTBEAT_INTERVAL_MS,
} from "@/lib/session-timeout";

const ACTIVITY_STORAGE_KEY = "olimpiadas:lastActivityAt";
const LOGOUT_STORAGE_KEY = "olimpiadas:forcedLogoutAt";
const AUTH_PUBLIC_ROUTES = new Set([
  "/login",
  "/registro",
  "/recuperar-clave",
  "/verificar-correo",
]);

export function SessionActivityGuard() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [extending, setExtending] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const loggingOutRef = useRef(false);

  const performAutoSignOut = useCallback(
    async (reason: "inactividad" | "manual") => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      setShowWarning(false);

      try {
        localStorage.setItem(LOGOUT_STORAGE_KEY, String(Date.now()));
      } catch {
        // Ignore storage errors
      }

      try {
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          credentials: "same-origin",
        });
      } catch {
        // Ignore network errors during sign-out
      }

      window.location.href =
        reason === "inactividad" ? "/login?motivo=inactividad" : "/";
    },
    []
  );

  const refreshServerSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/keep-alive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
      if (res.status === 401) {
        void performAutoSignOut("inactividad");
        return false;
      }
      return res.ok;
    } catch {
      return false;
    }
  }, [performAutoSignOut]);

  // Check if the user has an active session whenever pathname changes
  useEffect(() => {
    if (AUTH_PUBLIC_ROUTES.has(pathname)) {
      setIsAuthenticated(false);
      setShowWarning(false);
      return;
    }

    let active = true;
    async function checkSession() {
      try {
        const res = await fetch("/api/profile", { credentials: "same-origin" });
        if (!active) return;
        if (res.ok) {
          setIsAuthenticated(true);
          const now = Date.now();
          lastActivityRef.current = now;
          try {
            localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
          } catch {
            // Ignore storage errors
          }
        } else {
          setIsAuthenticated(false);
          setShowWarning(false);
        }
      } catch {
        if (active) setIsAuthenticated(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [pathname]);

  // Track user interactions, sync across tabs, heartbeat D1 token, and evaluate idle countdown
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastThrottleMs = 0;

    const recordActivity = () => {
      // Do not silently dismiss the warning modal on accidental mouse movement;
      // the user must explicitly click "Seguir conectado" or "Cerrar sesión".
      if (showWarning) return;

      const now = Date.now();
      if (now - lastThrottleMs < 1000) return;
      lastThrottleMs = now;
      lastActivityRef.current = now;
      try {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
      } catch {
        // Ignore storage errors
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACTIVITY_STORAGE_KEY && event.newValue) {
        const parsed = Number(event.newValue);
        if (Number.isFinite(parsed) && parsed > lastActivityRef.current) {
          lastActivityRef.current = parsed;
          setShowWarning(false);
        }
      } else if (event.key === LOGOUT_STORAGE_KEY && event.newValue) {
        window.location.href = "/login?motivo=inactividad";
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const state = evaluateIdleState(lastActivityRef.current, Date.now());
        if (state.status === "expired") {
          void performAutoSignOut("inactividad");
        } else {
          void refreshServerSession();
        }
      }
    };

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ];
    events.forEach((evt) =>
      window.addEventListener(evt, recordActivity, { passive: true })
    );
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Periodic heartbeat keeps the short-lived 15-min D1 session alive while tab is open
    const heartbeatTimer = window.setInterval(() => {
      const state = evaluateIdleState(lastActivityRef.current, Date.now());
      if (state.status !== "expired") {
        void refreshServerSession();
      }
    }, SESSION_HEARTBEAT_INTERVAL_MS);

    // 1-second tick evaluates warning modal & countdown
    const idleTimer = window.setInterval(() => {
      const state = evaluateIdleState(lastActivityRef.current, Date.now());
      if (state.status === "expired") {
        void performAutoSignOut("inactividad");
      } else if (state.status === "warning") {
        setShowWarning(true);
        setRemainingMs(state.remainingMs);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(heartbeatTimer);
      window.clearInterval(idleTimer);
    };
  }, [isAuthenticated, showWarning, performAutoSignOut, refreshServerSession]);

  async function handleStayConnected() {
    setExtending(true);
    try {
      const ok = await refreshServerSession();
      if (ok) {
        const now = Date.now();
        lastActivityRef.current = now;
        try {
          localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
        } catch {
          // Ignore storage errors
        }
        setShowWarning(false);
      }
    } finally {
      setExtending(false);
    }
  }

  if (!showWarning) return null;

  return (
    <div className="ta-modal-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        className="ta-modal-dialog"
      >
        <h2
          id="session-timeout-title"
          className="font-display text-2xl font-bold tracking-display text-ink"
        >
          Tu sesión está por{" "}
          <span className="ta-serif-italic">cerrarse</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Detectamos inactividad en tu cuenta. Por tu seguridad, cerraremos la
          sesión automáticamente en{" "}
          <strong className="num text-ink">
            {formatCountdownMmSs(remainingMs)}
          </strong>
          .
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={extending}
            onClick={() => void performAutoSignOut("manual")}
            className="btn btn--secondary"
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            disabled={extending}
            onClick={() => void handleStayConnected()}
            className="btn btn--primary"
          >
            {extending ? "Renovando…" : "Seguir conectado"}
          </button>
        </div>
      </div>
    </div>
  );
}
