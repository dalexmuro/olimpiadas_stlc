"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  GitCompare,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  computeWordDiffSegments,
  formatSimilarityBadgeLabel,
} from "@/lib/similarity";

interface AdminStoryAlert {
  id: string;
  storyId: string;
  round: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  validateCount: number;
  rejectCount: number;
  myVote: "VALIDATE" | "REJECT" | null;
}

interface AdminPostulatedStory {
  id: string;
  promptNumber: number;
  promptTitle: string;
  authorName: string;
  enrollmentStatus: string;
  originalTitle: string;
  originalBody: string;
  editedTitle: string;
  editedBody: string;
  similarityPct: number;
  postulatedAt: string | null;
  alerts: AdminStoryAlert[];
}

interface PendingAlertForMe {
  alertId: string;
  round: number;
  storyId: string;
  storyTitle: string;
  authorName: string;
  promptNumber: number;
  similarityPct: number;
  validateCount: number;
  rejectCount: number;
}

export default function AdminCuentosPage() {
  const [editionTitle, setEditionTitle] = useState<string | null>(null);
  const [stories, setStories] = useState<AdminPostulatedStory[]>([]);
  const [pendingAlerts, setPendingAlerts] = useState<PendingAlertForMe[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [diffStory, setDiffStory] = useState<AdminPostulatedStory | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/cuentos");
      const data = (await res.json()) as {
        ok: boolean;
        edition?: { id: string; title: string } | null;
        stories?: AdminPostulatedStory[];
        pendingAlertsForMe?: PendingAlertForMe[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudieron cargar los cuentos.");
        return;
      }
      setEditionTitle(data.edition?.title ?? null);
      setStories(data.stories ?? []);
      setPendingAlerts(data.pendingAlertsForMe ?? []);
    } catch {
      setErrorMessage("Error de conexión al cargar los cuentos postulados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleTriggerAlert(storyId: string) {
    setBusyId(storyId);
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/admin/cuentos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "trigger_alert", storyId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo lanzar la alerta.");
        return;
      }
      setFeedbackMessage(
        "Alerta lanzada y notificada por correo a los demás administradores."
      );
      await loadData();
    } catch {
      setErrorMessage("Error de conexión al lanzar la alerta.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleVoteAlert(
    alertId: string,
    decision: "VALIDATE" | "REJECT"
  ) {
    setBusyId(alertId);
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/admin/cuentos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "vote_alert", alertId, decision }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        newStatus?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo registrar tu voto.");
        return;
      }
      setFeedbackMessage(
        data.newStatus === "APPROVED"
          ? "Voto registrado. La alerta alcanzó 2 validaciones y fue aprobada."
          : "Voto registrado correctamente."
      );
      await loadData();
    } catch {
      setErrorMessage("Error de conexión al registrar tu voto.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="border-b-2 border-ink pb-4">
        <h1>Revisión de cuentos postulados</h1>
        <p className="mt-2 text-sm text-ink-2">
          {editionTitle
            ? `Edición activa: ${editionTitle}`
            : "No hay una edición activa configurada."}
        </p>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {feedbackMessage && (
        <div
          role="status"
          className="border-l-2 border-success py-1 pl-4 text-sm text-success"
        >
          {feedbackMessage}
        </div>
      )}

      {/* Top Section: Alerts pending current admin's review */}
      {pendingAlerts.length > 0 && (
        <section className="rounded-card border-2 border-error bg-paper-2 p-6">
          <div className="flex items-center gap-2 text-error">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            <h2>Alertas pendientes de tu revisión</h2>
          </div>
          <p className="mt-2 text-sm text-ink-2">
            Se requieren 2 validaciones de administradores para aprobar los
            cambios de un cuento alertado.
          </p>

          <ul className="mt-5 divide-y divide-rule border-y border-rule">
            {pendingAlerts.map((alert) => {
              const matchedStory = stories.find((s) => s.id === alert.storyId);
              return (
                <li
                  key={alert.alertId}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-xs font-semibold text-error">
                      Ronda {alert.round} (Consigna {alert.promptNumber})
                    </p>
                    <p className="mt-1 font-display text-lg font-extrabold text-ink">
                      {alert.storyTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted num">
                      Autor: {alert.authorName} / Similitud:{" "}
                      {Math.round(alert.similarityPct)}% / Validaciones:{" "}
                      {alert.validateCount} / Rechazos: {alert.rejectCount}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {matchedStory && (
                      <button
                        type="button"
                        onClick={() => setDiffStory(matchedStory)}
                        className="btn btn--secondary"
                      >
                        <GitCompare
                          className="mr-1.5 inline h-4 w-4"
                          aria-hidden="true"
                        />
                        Ver diff
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === alert.alertId}
                      onClick={() => handleVoteAlert(alert.alertId, "VALIDATE")}
                      className="btn btn--primary"
                    >
                      Validar cambios
                    </button>
                    <button
                      type="button"
                      disabled={busyId === alert.alertId}
                      onClick={() => handleVoteAlert(alert.alertId, "REJECT")}
                      className="btn btn--secondary"
                    >
                      Rechazar cambios
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Main List: All postulated stories */}
      <section className="rounded-card border border-ink bg-paper p-6">
        <h2>Cuentos postulados ({stories.length})</h2>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Cargando cuentos…</p>
        ) : stories.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Aún no hay cuentos postulados definitivamente en esta edición.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-rule border-y border-rule">
            {stories.map((story) => {
              const isExact =
                story.originalBody.trim() === story.editedBody.trim() &&
                story.originalTitle.trim() === story.editedTitle.trim();
              const badgeLabel = formatSimilarityBadgeLabel(
                story.similarityPct,
                isExact
              );
              const latestAlert = story.alerts[0] ?? null;

              return (
                <li
                  key={story.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-accent-2">
                        Consigna {story.promptNumber}
                      </span>
                      <span
                        className={`text-xs font-semibold num ${
                          isExact ? "text-success" : "text-ink-2"
                        }`}
                      >
                        {badgeLabel}
                      </span>
                      {latestAlert && (
                        <span className="text-xs font-semibold text-error">
                          Alerta R{latestAlert.round}: {latestAlert.status} (
                          {latestAlert.validateCount}/2 validaciones)
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-display text-lg font-extrabold text-ink">
                      {story.editedTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Autor: <strong>{story.authorName}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDiffStory(story)}
                      aria-label="Comparar con versión original"
                      className="btn btn--secondary whitespace-nowrap"
                    >
                      <GitCompare
                        className="mr-1.5 inline h-4 w-4"
                        aria-hidden="true"
                      />
                      Comparar original
                    </button>

                    {!isExact && !latestAlert && (
                      <button
                        type="button"
                        disabled={busyId === story.id}
                        onClick={() => handleTriggerAlert(story.id)}
                        aria-label="Lanzar alerta por exceso de modificaciones"
                        className="btn btn--primary whitespace-nowrap"
                      >
                        <ShieldAlert
                          className="mr-1.5 inline h-4 w-4"
                          aria-hidden="true"
                        />
                        Lanzar alerta
                      </button>
                    )}

                    {latestAlert?.status === "APPROVED" && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Validado
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Visual Myers Diff Modal */}
      {diffStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diff-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-card border-2 border-ink bg-paper p-6">
            <div className="flex items-start justify-between gap-4 border-b border-rule pb-3">
              <div>
                <p className="text-xs font-semibold text-accent-2">
                  Comparador visual Diff (Consigna {diffStory.promptNumber})
                </p>
                <h3 id="diff-modal-title" className="mt-1">
                  {diffStory.editedTitle}
                </h3>
                <p className="mt-1 text-xs text-muted num">
                  Autor: {diffStory.authorName} / Similitud:{" "}
                  {diffStory.similarityPct.toFixed(1)}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiffStory(null)}
                aria-label="Cerrar comparador"
                className="btn btn--secondary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <span className="font-semibold text-success">
                Texto añadido (verde)
              </span>
              <span className="text-error line-through">
                Texto suprimido (rojo)
              </span>
            </div>

            {diffStory.originalTitle !== diffStory.editedTitle && (
              <div className="mt-4 border-l-2 border-ink pl-3 text-sm">
                <p className="text-xs text-muted">Cambio en el título:</p>
                <p className="mt-1">
                  <del className="text-error line-through">
                    {diffStory.originalTitle}
                  </del>{" "}
                  <ins className="font-semibold text-success no-underline">
                    {diffStory.editedTitle}
                  </ins>
                </p>
              </div>
            )}

            <article className="mt-5 whitespace-pre-wrap border-t border-rule pt-4 text-sm leading-relaxed text-ink">
              {computeWordDiffSegments(
                diffStory.originalBody,
                diffStory.editedBody
              ).map((seg, idx) => {
                if (seg.kind === "added") {
                  return (
                    <ins
                      key={idx}
                      className="bg-paper-2 px-0.5 font-semibold text-success no-underline"
                    >
                      {seg.value}
                    </ins>
                  );
                }
                if (seg.kind === "removed") {
                  return (
                    <del
                      key={idx}
                      className="bg-paper-2 px-0.5 text-error line-through"
                    >
                      {seg.value}
                    </del>
                  );
                }
                return <span key={idx}>{seg.value}</span>;
              })}
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
