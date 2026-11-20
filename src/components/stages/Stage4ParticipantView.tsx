"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { DisqualificationReason, EnrollmentStatus } from "@/db/schema";
import {
  MAX_STORY_TITLE_LENGTH,
  getDisqualificationReasonLabel,
} from "@/lib/stage2-writing";
import { validateStage3EditInput } from "@/lib/stage3-submission";
import {
  formatCaracasDateTime,
  getRemainingTimeBreakdown,
  type CountdownBreakdown,
} from "@/lib/timezone";

export interface Stage4ParticipantViewProps {
  enrollmentStatus: EnrollmentStatus;
  disqualificationReason: DisqualificationReason | null;
  inCorrectionWindow: boolean;
  correctionDeadlineAt: string | null;
  correctionSubmittedAt: string | null;
  votingStartAt: string;
  minChars: number;
  maxChars: number;
  minSimilarityPct: number;
  story: {
    id: string;
    promptNumber: number;
    originalBody: string;
    editedTitle: string;
    editedBody: string;
  } | null;
}

function useCountdown(targetIso: string | null): CountdownBreakdown | null {
  const [state, setState] = useState<CountdownBreakdown | null>(() =>
    targetIso ? getRemainingTimeBreakdown(targetIso) : null
  );

  useEffect(() => {
    if (!targetIso) {
      setState(null);
      return;
    }
    const tick = () => setState(getRemainingTimeBreakdown(targetIso));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  return state;
}

export function Stage4ParticipantView({
  enrollmentStatus,
  disqualificationReason,
  inCorrectionWindow,
  correctionDeadlineAt,
  correctionSubmittedAt,
  votingStartAt,
  minChars,
  maxChars,
  minSimilarityPct,
  story,
}: Stage4ParticipantViewProps) {
  const [title, setTitle] = useState(story?.editedTitle ?? "");
  const [body, setBody] = useState(story?.editedBody ?? "");
  const [submittedNow, setSubmittedNow] = useState(
    Boolean(correctionSubmittedAt)
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const votingCountdown = useCountdown(votingStartAt);
  const correctionCountdown = useCountdown(
    inCorrectionWindow && !submittedNow ? correctionDeadlineAt : null
  );

  const validation = useMemo(() => {
    if (!story) return null;
    return validateStage3EditInput({
      title,
      body,
      originalBody: story.originalBody,
      minChars,
      maxChars,
      minSimilarityPct,
    });
  }, [story, title, body, minChars, maxChars, minSimilarityPct]);

  if (enrollmentStatus === "DISQUALIFIED") {
    return (
      <section className="rounded-card border border-error bg-paper-2 p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-1 h-5 w-5 shrink-0 text-error"
            aria-hidden="true"
          />
          <div>
            <h2>Participación descalificada</h2>
            <p className="lead mt-3 text-ink-2">
              {getDisqualificationReasonLabel(disqualificationReason)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  async function handleCorrectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation?.valid) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/contest/correction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error ?? "No se pudo enviar tu versión corregida."
        );
        return;
      }
      setSubmittedNow(true);
    } catch {
      setErrorMessage("Error de conexión al enviar tu corrección.");
    } finally {
      setSubmitting(false);
    }
  }

  if (inCorrectionWindow && !submittedNow && story && correctionDeadlineAt) {
    return (
      <section className="rounded-card border border-error bg-paper-2 p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
          <div>
            <p className="text-sm font-semibold text-error">
              Ventana excepcional de corrección (24 horas)
            </p>
            <h2 className="mt-1">Ajusta las modificaciones de tu cuento</h2>
          </div>
          <div className="text-right text-xs text-error num">
            <p className="font-semibold">
              Tiempo restante:{" "}
              {correctionCountdown ? correctionCountdown.formatted : "Calculando…"}
            </p>
            <p className="mt-1 text-muted">
              Cierra: {formatCaracasDateTime(correctionDeadlineAt)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-2">
          El equipo administrador detectó modificaciones excesivas respecto a tu
          versión original de la Consigna {story.promptNumber}. Corrige tu texto
          respetando el sentido original y vuelve a enviarlo antes del cierre.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 border-l-2 border-error py-1 pl-4 text-sm text-error"
          >
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleCorrectionSubmit}
          className="mt-6 space-y-6"
          noValidate
        >
          <div>
            <label
              htmlFor="correction-title"
              className="block text-sm font-semibold text-ink"
            >
              Título del cuento
            </label>
            <input
              id="correction-title"
              type="text"
              maxLength={MAX_STORY_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-input border border-ink bg-paper px-3 py-2 text-base text-ink"
              required
            />
          </div>

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <label
                htmlFor="correction-body"
                className="block text-sm font-semibold text-ink"
              >
                Texto corregido
              </label>
              {validation && (
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold num">
                  <span
                    className={
                      validation.charCount < minChars ||
                      validation.charCount > maxChars
                        ? "text-error"
                        : "text-success"
                    }
                  >
                    {validation.charCount} caracteres ({minChars} a {maxChars})
                  </span>
                  <span
                    className={
                      validation.meetsSimilarityThreshold
                        ? "text-success"
                        : "text-error"
                    }
                  >
                    Similitud: {validation.similarityPct.toFixed(1)}% (mín.{" "}
                    {minSimilarityPct}%)
                  </span>
                </div>
              )}
            </div>

            <textarea
              id="correction-body"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-2 w-full rounded-input border border-ink bg-paper px-3 py-3 text-base leading-relaxed text-ink"
              required
            />

            {validation && validation.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-error">
                {validation.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              !validation?.valid ||
              Boolean(correctionCountdown?.expired)
            }
            className="btn btn--primary"
          >
            {submitting ? "Enviando…" : "Enviar cuento corregido"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-ink bg-paper-2 p-8">
      <div className="flex items-center gap-2 text-ink-2">
        {submittedNow ? (
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
        ) : (
          <Clock className="h-5 w-5" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">
          {submittedNow
            ? "Corrección enviada a revisión final"
            : "Revisión de administradores en curso"}
        </span>
      </div>

      <h2 className="mt-3">
        {submittedNow
          ? "Tu versión corregida está siendo validada"
          : "Los administradores están revisando los cuentos postulados"}
      </h2>

      <p className="lead mt-3 text-ink-2">
        Inicio de la etapa de votaciones en…
      </p>

      <p className="mt-4 font-display text-4xl font-extrabold text-ink num">
        {votingCountdown ? votingCountdown.formatted : "Calculando…"}
      </p>

      <p className="mt-4 text-sm text-ink-2 num">
        Apertura de votaciones:{" "}
        <strong>{formatCaracasDateTime(votingStartAt)}</strong>.
      </p>
    </section>
  );
}
