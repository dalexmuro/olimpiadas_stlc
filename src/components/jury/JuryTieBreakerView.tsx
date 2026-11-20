"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, Scale, X } from "lucide-react";
import type { AnonymousVotingStoryItem } from "@/lib/stage5-voting";

export interface JuryTieBreakerViewProps {
  tiedPositionsLabel: string;
  initialHasVoted: boolean;
  tiedStories: AnonymousVotingStoryItem[];
}

export function JuryTieBreakerView({
  tiedPositionsLabel,
  initialHasVoted,
  tiedStories,
}: JuryTieBreakerViewProps) {
  const requiresSecondChoice = tiedStories.length >= 3;
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [firstChoiceId, setFirstChoiceId] = useState<string | null>(null);
  const [secondChoiceId, setSecondChoiceId] = useState<string | null>(null);
  const [readingStory, setReadingStory] =
    useState<AnonymousVotingStoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = Boolean(
    firstChoiceId &&
      (!requiresSecondChoice ||
        (secondChoiceId && secondChoiceId !== firstChoiceId))
  );

  async function handleSubmit() {
    if (!firstChoiceId || !canSubmit) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/jury/tie-breaker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstChoiceStoryId: firstChoiceId,
          secondChoiceStoryId: requiresSecondChoice ? secondChoiceId : null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo registrar tu desempate.");
        return;
      }
      setHasVoted(true);
    } catch {
      setErrorMessage("Error de conexión al enviar tu voto de desempate.");
    } finally {
      setBusy(false);
    }
  }

  if (hasVoted) {
    return (
      <section className="rounded-card border border-ink bg-paper-2 p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-1 h-5 w-5 shrink-0 text-success"
            aria-hidden="true"
          />
          <div>
            <h2>Voto de desempate registrado</h2>
            <p className="lead mt-3 text-ink-2">
              Gracias por completar el desempate del jurado. Cuando todos los
              miembros del jurado hayan votado, el podio quedará resuelto para
              el anuncio oficial de ganadores.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-card border-2 border-ink bg-paper p-8">
      <div className="flex items-center gap-2 text-accent-2">
        <Scale className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-semibold">
          Sub-etapa de desempate del jurado
        </span>
      </div>

      <h2 className="mt-2">Desempate en {tiedPositionsLabel}</h2>
      <p className="mt-2 text-sm text-ink-2">
        {requiresSecondChoice
          ? "Hay tres o más cuentos empatados. Selecciona tu primera y tu segunda preferencia entre estos finalistas anónimos."
          : "Selecciona el cuento que prefieres para resolver el empate entre estos dos finalistas anónimos."}
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      <ul className="mt-6 divide-y divide-rule border-y border-rule">
        {tiedStories.map((story) => {
          const isFirst = firstChoiceId === story.id;
          const isSecond = secondChoiceId === story.id;
          return (
            <li
              key={story.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="text-xs font-semibold text-accent-2">
                  Consigna {story.promptNumber}
                </p>
                <p className="mt-1 font-display text-lg font-extrabold text-ink">
                  {story.title}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReadingStory(story)}
                  className="btn btn--secondary"
                >
                  <BookOpen
                    className="mr-1.5 inline h-4 w-4"
                    aria-hidden="true"
                  />
                  Leer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFirstChoiceId(story.id);
                    if (secondChoiceId === story.id) setSecondChoiceId(null);
                  }}
                  className={isFirst ? "btn btn--primary" : "btn btn--secondary"}
                >
                  {requiresSecondChoice ? "1ra opción" : "Elegir ganador"}
                </button>
                {requiresSecondChoice && (
                  <button
                    type="button"
                    onClick={() => {
                      setSecondChoiceId(story.id);
                      if (firstChoiceId === story.id) setFirstChoiceId(null);
                    }}
                    className={
                      isSecond ? "btn btn--primary" : "btn btn--secondary"
                    }
                  >
                    2da opción
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={handleSubmit}
          className="btn btn--primary"
        >
          {busy ? "Enviando…" : "Enviar desempate"}
        </button>
      </div>
      </section>

      {readingStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tb-reader-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card border-2 border-ink bg-paper p-6">
            <div className="flex items-start justify-between gap-4 border-b border-rule pb-3">
              <div>
                <p className="text-xs font-semibold text-accent-2">
                  Consigna {readingStory.promptNumber}
                </p>
                <h3 id="tb-reader-title" className="mt-1">
                  {readingStory.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReadingStory(null)}
                aria-label="Cerrar lector"
                className="btn btn--secondary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <article className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {readingStory.body}
            </article>
          </div>
        </div>
      )}
    </>
  );
}
