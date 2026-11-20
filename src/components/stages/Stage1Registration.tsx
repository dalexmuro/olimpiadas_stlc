"use client";

import { useState, type FormEvent } from "react";
import { formatCaracasDateTime } from "@/lib/timezone";

export interface Stage1RegistrationProps {
  editionTitle: string;
  registrationEndAt: string;
  writingStartAt: string;
  isEnrolled: boolean;
  onEnrolled?: () => void;
}

export function Stage1Registration({
  editionTitle,
  registrationEndAt,
  writingStartAt,
  isEnrolled,
  onEnrolled,
}: Stage1RegistrationProps) {
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [enrolledNow, setEnrolledNow] = useState(isEnrolled);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!acceptedRules) {
      setErrorMessage(
        "Debes marcar la casilla aceptando las Bases del Concurso para inscribirte."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contest/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acceptedRules: true }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error ?? "No se pudo completar tu inscripción. Inténtalo de nuevo."
        );
        return;
      }

      setEnrolledNow(true);
      onEnrolled?.();
    } catch {
      setErrorMessage("Error de conexión al registrar tu inscripción.");
    } finally {
      setSubmitting(false);
    }
  }

  if (enrolledNow) {
    return (
      <section className="rounded-card border border-ink bg-paper-2 p-8">
        <h2>Inscripción confirmada</h2>
        <p className="lead mt-3 text-ink-2">
          Ya formas parte de {editionTitle}. Hemos enviado un correo de
          confirmación a tu dirección registrada.
        </p>
        <p className="mt-4 text-sm text-ink-2 num">
          La etapa de envío de cuentos inicia el{" "}
          <strong>{formatCaracasDateTime(writingStartAt)}</strong>.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <a href="/perfil" className="btn btn--secondary">
            Revisar mi perfil
          </a>
          <a href="/bases-del-concurso" className="riso-link self-center text-sm font-medium">
            Consultar las Bases del Concurso
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-ink bg-paper p-8">
      <h2>Inscripciones abiertas</h2>
      <p className="lead mt-3 text-ink-2">
        Confirma tu participación en {editionTitle}. Las inscripciones cierran
        el{" "}
        <strong className="num">{formatCaracasDateTime(registrationEndAt)}</strong>.
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={acceptedRules}
            onChange={(e) => setAcceptedRules(e.target.checked)}
            className="mt-1"
          />
          <span>
            He leído y acepto las{" "}
            <a
              href="/bases-del-concurso"
              target="_blank"
              rel="noreferrer"
              className="riso-link font-medium"
            >
              Bases del Concurso
            </a>{" "}
            para participar en {editionTitle}.
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting || !acceptedRules}
          className="btn btn--primary"
        >
          {submitting ? "Inscribiendo…" : "Inscribirme al concurso"}
        </button>
      </form>
    </section>
  );
}
