"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Trophy } from "lucide-react";

interface ReadinessResponse {
  ok: boolean;
  editionTitle?: string;
  winnersAnnounced?: boolean;
  ready?: boolean;
  reason?: string | null;
  juryVotesCount?: number;
  totalJurorsCount?: number;
}

export function PublishWinnersButton() {
  const [status, setStatus] = useState<ReadinessResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/publish-winners")
      .then((res) => res.json() as Promise<ReadinessResponse>)
      .then((data) => {
        if (data.ok) setStatus(data);
      })
      .catch(() => {
        // Ignore silent load error
      });
  }, []);

  if (!status) return null;

  async function handlePublish() {
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/publish-winners", {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok: boolean;
        notifiedCount?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error ?? "No se pudieron publicar los ganadores."
        );
        return;
      }
      setStatus((prev) =>
        prev ? { ...prev, winnersAnnounced: true, ready: false } : prev
      );
      setMessage(
        `Ganadores publicados oficialmente y correo E26 enviado a ${data.notifiedCount ?? 0} destinatarios.`
      );
      setConfirmOpen(false);
    } catch {
      setErrorMessage("Error de conexión al publicar los ganadores.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="rounded-card border-2 border-ink bg-paper-2 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-accent-2">
              <Trophy className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-semibold">
                Etapa 7: Anuncio de ganadores
              </span>
            </div>
            <h2 className="mt-1">{status.editionTitle}</h2>
            <p className="mt-1 text-xs text-muted num">
              Votos del jurado: {status.juryVotesCount ?? 0} /{" "}
              {status.totalJurorsCount ?? 0}
            </p>
            {status.reason && !status.winnersAnnounced && (
              <p className="mt-2 text-sm text-ink-2">{status.reason}</p>
            )}
          </div>

          {status.winnersAnnounced ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              <span>Ganadores publicados</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={!status.ready || busy}
              onClick={() => setConfirmOpen(true)}
              aria-label="Publicar y Anunciar Ganadores"
              className="btn btn--primary"
            >
              Publicar ganadores
            </button>
          )}
        </div>

        {message && (
          <p className="mt-4 border-l-2 border-success py-1 pl-4 text-sm text-success">
            {message}
          </p>
        )}
        {errorMessage && (
          <p
            role="alert"
            className="mt-4 border-l-2 border-error py-1 pl-4 text-sm text-error"
          >
            {errorMessage}
          </p>
        )}
      </section>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-publish-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-lg rounded-card border-2 border-ink bg-paper p-6">
            <h3 id="confirm-publish-title">
              Confirmar anuncio oficial de ganadores
            </h3>
            <p className="mt-3 text-sm text-ink-2">
              Esta acción publicará públicamente los resultados en /resultados,
              el archivo de la edición en /ediciones y enviará el correo E26 a
              todos los participantes, jurados y administradores.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
                className="btn btn--secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handlePublish}
                className="btn btn--primary"
              >
                {busy ? "Publicando…" : "Sí, anunciar ganadores"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
