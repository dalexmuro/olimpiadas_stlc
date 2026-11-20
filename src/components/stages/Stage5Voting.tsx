"use client";

import { useMemo, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  GripVertical,
  Trophy,
  X,
} from "lucide-react";
import type { DisqualificationReason, EnrollmentStatus } from "@/db/schema";
import { parseVideoEmbedUrl } from "@/lib/prompt-bank";
import { getDisqualificationReasonLabel } from "@/lib/stage2-writing";
import {
  MIN_PRESELECTED_TO_VOTE,
  type AnonymousVotingStoryItem,
} from "@/lib/stage5-voting";
import { formatCaracasDateTime } from "@/lib/timezone";

export interface Stage5VotingProps {
  enrollmentStatus?: EnrollmentStatus;
  disqualificationReason?: DisqualificationReason | null;
  initialHasVoted: boolean;
  votingEndAt: string;
  stories: AnonymousVotingStoryItem[];
  /** Endpoint to toggle read/preselect state (defaults to `/api/contest/voting/state`) */
  stateEndpoint?: string;
  /** Endpoint to cast definitive Top 3 vote (defaults to `/api/contest/voting/cast`) */
  castEndpoint?: string;
  /** Points label per podium slot (default 3 / 2 / 1 for participants; configurable for jury) */
  pointsLabels?: { first: string; second: string; third: string };
  /** Heading label */
  headingTitle?: string;
}

type PodiumSlot = "first" | "second" | "third";

export function Stage5Voting({
  enrollmentStatus = "ACTIVE",
  disqualificationReason = null,
  initialHasVoted,
  votingEndAt,
  stories: initialStories,
  stateEndpoint = "/api/contest/voting/state",
  castEndpoint = "/api/contest/voting/cast",
  pointsLabels = { first: "3 pts", second: "2 pts", third: "1 pt" },
  headingTitle = "Votaciones de participantes",
}: Stage5VotingProps) {
  const [stories, setStories] =
    useState<AnonymousVotingStoryItem[]>(initialStories);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const [promptModalStory, setPromptModalStory] =
    useState<AnonymousVotingStoryItem | null>(null);
  const [votingMode, setVotingMode] = useState(false);
  const [podium, setPodium] = useState<Record<PodiumSlot, string | null>>({
    first: null,
    second: null,
    third: null,
  });
  const [draggedStoryId, setDraggedStoryId] = useState<string | null>(null);
  const [confirmVoteOpen, setConfirmVoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const preselectedStories = useMemo(
    () => stories.filter((s) => s.isPreselected && !s.isOwnStory),
    [stories]
  );

  const storyById = useMemo(
    () => new Map(stories.map((s) => [s.id, s])),
    [stories]
  );

  const canOpenVoting =
    !hasVoted && preselectedStories.length >= MIN_PRESELECTED_TO_VOTE;

  const isBallotComplete = Boolean(
    podium.first && podium.second && podium.third
  );

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

  async function toggleState(
    story: AnonymousVotingStoryItem,
    patch: { isRead?: boolean; isPreselected?: boolean }
  ) {
    if (patch.isPreselected === true && story.isOwnStory) return;
    if (hasVoted && patch.isPreselected !== undefined) return;

    setErrorMessage(null);
    // Optimistic update
    setStories((prev) =>
      prev.map((item) =>
        item.id === story.id
          ? {
              ...item,
              isRead: patch.isRead ?? item.isRead,
              isPreselected: patch.isPreselected ?? item.isPreselected,
            }
          : item
      )
    );

    try {
      const res = await fetch(stateEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storyId: story.id, ...patch }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo actualizar el estado.");
        // Revert optimistic update
        setStories((prev) =>
          prev.map((item) => (item.id === story.id ? story : item))
        );
      }
    } catch {
      setErrorMessage("Error de conexión al guardar tu progreso de lectura.");
      setStories((prev) =>
        prev.map((item) => (item.id === story.id ? story : item))
      );
    }
  }

  function assignToPodium(slot: PodiumSlot, storyId: string) {
    setPodium((prev) => {
      const next: Record<PodiumSlot, string | null> = { ...prev };
      // Remove storyId from any other slot if already assigned
      (["first", "second", "third"] as PodiumSlot[]).forEach((k) => {
        if (next[k] === storyId) next[k] = null;
      });
      next[slot] = storyId;
      return next;
    });
  }

  function assignToNextEmptySlot(storyId: string) {
    setPodium((prev) => {
      if (
        prev.first === storyId ||
        prev.second === storyId ||
        prev.third === storyId
      ) {
        return prev;
      }
      if (!prev.first) return { ...prev, first: storyId };
      if (!prev.second) return { ...prev, second: storyId };
      if (!prev.third) return { ...prev, third: storyId };
      return prev;
    });
  }

  function handleDragStart(storyId: string) {
    setDraggedStoryId(storyId);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDropOnSlot(slot: PodiumSlot, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (draggedStoryId) {
      assignToPodium(slot, draggedStoryId);
      setDraggedStoryId(null);
    }
  }

  async function handleConfirmVote() {
    if (!podium.first || !podium.second || !podium.third) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch(castEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstPlaceStoryId: podium.first,
          secondPlaceStoryId: podium.second,
          thirdPlaceStoryId: podium.third,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo registrar tu voto.");
        return;
      }
      setHasVoted(true);
      setVotingMode(false);
      setConfirmVoteOpen(false);
    } catch {
      setErrorMessage("Error de conexión al enviar tu votación.");
    } finally {
      setBusy(false);
    }
  }

  const readingStory =
    readingIndex !== null ? (stories[readingIndex] ?? null) : null;
  const promptModalVideoUrl =
    promptModalStory?.promptMediaType === "VIDEO" &&
    promptModalStory.promptMediaUrl
      ? parseVideoEmbedUrl(promptModalStory.promptMediaUrl)
      : null;

  return (
    <div className="space-y-6">
      {/* Top Status & Vote CTA Bar */}
      <section className="rounded-card border border-ink bg-paper-2 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2>{headingTitle}</h2>
            <p className="mt-1 text-sm text-ink-2 num">
              Cierre de votaciones:{" "}
              <strong>{formatCaracasDateTime(votingEndAt)}</strong>
            </p>
          </div>

          {hasVoted ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              <span>Votación enviada (modo lectura)</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-ink-2 num">
                Preseleccionados: {preselectedStories.length} /{" "}
                {MIN_PRESELECTED_TO_VOTE} mínimo
              </span>
              <button
                type="button"
                disabled={!canOpenVoting}
                onClick={() => {
                  setVotingMode((prev) => !prev);
                  setReadingIndex(null);
                }}
                className="btn btn--primary whitespace-nowrap"
              >
                <Trophy className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                {votingMode ? "Volver a los cuentos" : "Votar"}
              </button>
            </div>
          )}
        </div>

        {hasVoted && (
          <p className="mt-3 text-sm text-muted">
            Tu voto definitivo fue registrado y confirmado por correo. Puedes
            seguir leyendo los cuentos participantes en modo lectura.
          </p>
        )}
      </section>

      {errorMessage && (
        <div
          role="alert"
          className="border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {/* INTERACTIVE TOP 3 VOTING VIEW (Click or Drag, zero typing) */}
      {votingMode && !hasVoted && (
        <section className="rounded-card border border-ink bg-paper p-8">
          <h3>Asigna tu podio definitivo</h3>
          <p className="mt-2 text-sm text-ink-2">
            Arrastra tus cuentos preseleccionados hacia los puestos del podio o
            usa los botones rápidos de cada tarjeta para asignarlos.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {(
              [
                {
                  slot: "first" as const,
                  label: "1er lugar",
                  pts: pointsLabels.first,
                },
                {
                  slot: "second" as const,
                  label: "2do lugar",
                  pts: pointsLabels.second,
                },
                {
                  slot: "third" as const,
                  label: "3er lugar",
                  pts: pointsLabels.third,
                },
              ] as const
            ).map(({ slot, label, pts }) => {
              const assignedId = podium[slot];
              const assignedStory = assignedId
                ? storyById.get(assignedId)
                : null;
              return (
                <div
                  key={slot}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnSlot(slot, e)}
                  className="flex min-h-36 flex-col justify-between border-2 border-dashed border-ink bg-paper-2 p-4"
                >
                  <div>
                    <p className="text-xs font-semibold text-accent-2">
                      {label} ({pts})
                    </p>
                    {assignedStory ? (
                      <div className="mt-2">
                        <p className="font-display text-base font-extrabold text-ink">
                          {assignedStory.title}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Consigna {assignedStory.promptNumber}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted">
                        Arrastra aquí o selecciona un cuento preseleccionado.
                      </p>
                    )}
                  </div>

                  {assignedStory && (
                    <button
                      type="button"
                      onClick={() =>
                        setPodium((prev) => ({ ...prev, [slot]: null }))
                      }
                      className="riso-link mt-3 self-start text-xs font-medium"
                    >
                      Quitar de este puesto
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <h4 className="text-sm font-semibold text-ink">
              Tus cuentos preseleccionados ({preselectedStories.length})
            </h4>
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {preselectedStories.map((story) => {
                const assignedSlot =
                  podium.first === story.id
                    ? "1er lugar"
                    : podium.second === story.id
                      ? "2do lugar"
                      : podium.third === story.id
                        ? "3er lugar"
                        : null;
                return (
                  <li
                    key={story.id}
                    draggable
                    onDragStart={() => handleDragStart(story.id)}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical
                        className="h-4 w-4 text-muted"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-xs font-semibold text-accent-2">
                          Consigna {story.promptNumber}
                        </p>
                        <p className="font-display text-base font-extrabold text-ink">
                          {story.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {assignedSlot ? (
                        <span className="text-xs font-semibold text-success">
                          Asignado: {assignedSlot}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => assignToNextEmptySlot(story.id)}
                          className="btn btn--secondary"
                        >
                          Asignar al podio
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => assignToPodium("first", story.id)}
                        className="btn btn--secondary"
                      >
                        1º
                      </button>
                      <button
                        type="button"
                        onClick={() => assignToPodium("second", story.id)}
                        className="btn btn--secondary"
                      >
                        2º
                      </button>
                      <button
                        type="button"
                        onClick={() => assignToPodium("third", story.id)}
                        className="btn btn--secondary"
                      >
                        3º
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
            <button
              type="button"
              onClick={() => setVotingMode(false)}
              className="btn btn--secondary"
            >
              Volver a la lista
            </button>
            <button
              type="button"
              disabled={!isBallotComplete || busy}
              onClick={() => setConfirmVoteOpen(true)}
              aria-label="Confirmar voto definitivo"
              className="btn btn--primary"
            >
              Confirmar voto
            </button>
          </div>
        </section>
      )}

      {/* ANONYMOUS STORY LIST VIEW */}
      {!votingMode && !readingStory && (
        <section className="rounded-card border border-ink bg-paper p-8">
          <h3>Cuentos participantes ({stories.length})</h3>
          <p className="mt-2 text-sm text-ink-2">
            Los cuentos son completamente anónimos y aparecen en un orden
            aleatorio fijo asignado a tu cuenta. Preselecciona al menos{" "}
            {MIN_PRESELECTED_TO_VOTE} favoritos para habilitar la votación.
          </p>

          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {stories.map((story, idx) => (
              <li
                key={story.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-accent-2">
                      Consigna {story.promptNumber}
                    </span>
                    {story.isOwnStory && (
                      <span className="font-semibold text-muted">
                        Tu cuento
                      </span>
                    )}
                    {story.isRead && (
                      <span className="font-semibold text-success">Leído</span>
                    )}
                    {story.isPreselected && (
                      <span className="font-semibold text-ink">
                        Preseleccionado
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-display text-lg font-extrabold text-ink">
                    {story.title}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReadingIndex(idx)}
                    className="btn btn--secondary"
                  >
                    <BookOpen
                      className="mr-1.5 inline h-4 w-4"
                      aria-hidden="true"
                    />
                    Leer
                  </button>

                  {!hasVoted && (
                    <button
                      type="button"
                      disabled={story.isOwnStory}
                      onClick={() =>
                        toggleState(story, {
                          isPreselected: !story.isPreselected,
                        })
                      }
                      aria-label={
                        story.isOwnStory
                          ? "No puedes preseleccionar tu propio cuento"
                          : story.isPreselected
                            ? "Quitar preselección"
                            : "Preseleccionar"
                      }
                      className={
                        story.isPreselected
                          ? "btn btn--primary"
                          : "btn btn--secondary"
                      }
                    >
                      <Bookmark
                        className="mr-1.5 inline h-4 w-4"
                        aria-hidden="true"
                      />
                      {story.isPreselected ? "Preseleccionado" : "Preseleccionar"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ANONYMOUS STORY READER VIEW */}
      {!votingMode && readingStory && readingIndex !== null && (
        <section className="rounded-card border border-ink bg-paper p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
            <button
              type="button"
              onClick={() => setReadingIndex(null)}
              className="btn btn--secondary"
            >
              Volver a la lista
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={readingIndex <= 0}
                onClick={() => setReadingIndex((i) => (i !== null ? i - 1 : 0))}
                className="btn btn--secondary"
              >
                <ChevronLeft
                  className="mr-1 inline h-4 w-4"
                  aria-hidden="true"
                />
                Anterior
              </button>
              <button
                type="button"
                disabled={readingIndex >= stories.length - 1}
                onClick={() =>
                  setReadingIndex((i) =>
                    i !== null ? Math.min(stories.length - 1, i + 1) : 0
                  )
                }
                className="btn btn--secondary"
              >
                Siguiente
                <ChevronRight
                  className="ml-1 inline h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent-2">
                Consigna {readingStory.promptNumber}
                {readingStory.isOwnStory ? " (Tu cuento)" : ""}
              </p>
              <h2 className="mt-1">{readingStory.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setPromptModalStory(readingStory)}
              className="riso-link text-sm font-medium"
            >
              <FileText className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Ver consigna completa
            </button>
          </div>

          <article className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink">
            {readingStory.body}
          </article>

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-6">
            <button
              type="button"
              onClick={() =>
                toggleState(readingStory, { isRead: !readingStory.isRead })
              }
              className={
                readingStory.isRead ? "btn btn--primary" : "btn btn--secondary"
              }
            >
              <Eye className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              {readingStory.isRead ? "Leído" : "Marcar como leído"}
            </button>

            {!hasVoted && (
              <button
                type="button"
                disabled={readingStory.isOwnStory}
                onClick={() =>
                  toggleState(readingStory, {
                    isPreselected: !readingStory.isPreselected,
                  })
                }
                className={
                  readingStory.isPreselected
                    ? "btn btn--primary"
                    : "btn btn--secondary"
                }
              >
                <Bookmark
                  className="mr-1.5 inline h-4 w-4"
                  aria-hidden="true"
                />
                {readingStory.isPreselected
                  ? "Preseleccionado"
                  : "Preseleccionar"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Modal: Prompt Viewer */}
      {promptModalStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="voting-prompt-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card border-2 border-ink bg-paper p-6">
            <div className="flex items-start justify-between gap-4 border-b border-rule pb-3">
              <div>
                <p className="text-xs font-semibold text-accent-2">
                  Consigna {promptModalStory.promptNumber}
                </p>
                <h3 id="voting-prompt-modal-title" className="mt-1">
                  {promptModalStory.promptTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPromptModalStory(null)}
                aria-label="Cerrar consigna"
                className="btn btn--secondary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {promptModalStory.promptBody}
            </div>
            {promptModalStory.promptMediaType === "IMAGE" &&
              promptModalStory.promptMediaUrl && (
                <figure className="mt-4">
                  <img
                    src={promptModalStory.promptMediaUrl}
                    alt={`Imagen de la consigna ${promptModalStory.promptNumber}`}
                    className="max-h-80 w-auto border border-rule object-contain"
                  />
                </figure>
              )}
            {promptModalVideoUrl && (
              <div className="mt-4 aspect-video w-full overflow-hidden border border-rule">
                <iframe
                  src={promptModalVideoUrl}
                  title={`Video de la consigna ${promptModalStory.promptNumber}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Irreversible Definitive Vote Confirmation */}
      {confirmVoteOpen && podium.first && podium.second && podium.third && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-vote-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-lg rounded-card border-2 border-ink bg-paper p-6">
            <h3 id="confirm-vote-title">Confirmar voto definitivo</h3>
            <p className="mt-3 text-sm text-ink-2">
              Una vez enviado, tu voto no podrá modificarse. Revisa tu podio:
            </p>
            <ol className="mt-4 space-y-2 border-y border-rule py-4 text-sm text-ink">
              <li>
                <strong>1er lugar ({pointsLabels.first}):</strong>{" "}
                {storyById.get(podium.first)?.title}
              </li>
              <li>
                <strong>2do lugar ({pointsLabels.second}):</strong>{" "}
                {storyById.get(podium.second)?.title}
              </li>
              <li>
                <strong>3er lugar ({pointsLabels.third}):</strong>{" "}
                {storyById.get(podium.third)?.title}
              </li>
            </ol>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmVoteOpen(false)}
                className="btn btn--secondary"
              >
                Revisar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmVote}
                className="btn btn--primary"
              >
                {busy ? "Enviando…" : "Sí, enviar mi voto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
