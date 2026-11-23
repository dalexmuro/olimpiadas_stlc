"use client";

import { useMemo, useState, type DragEvent } from "react";
import { Bookmark, BookOpen, CheckCircle2, Trophy } from "lucide-react";
import type { DisqualificationReason, EnrollmentStatus } from "@/db/schema";
import {
  MIN_PRESELECTED_TO_VOTE,
  type AnonymousVotingStoryItem,
} from "@/lib/stage5-voting";
import { formatCaracasDateTime } from "@/lib/timezone";
import { DisqualifiedNotice } from "./DisqualifiedNotice";
import { PromptViewerModal } from "./PromptViewerModal";
import { Stage5PodiumBallot, type PodiumSlot } from "./Stage5PodiumBallot";
import { Stage5StoryReader } from "./Stage5StoryReader";

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
    return <DisqualifiedNotice reason={disqualificationReason} />;
  }

  async function toggleState(
    story: AnonymousVotingStoryItem,
    patch: { isRead?: boolean; isPreselected?: boolean }
  ) {
    if (patch.isPreselected === true && story.isOwnStory) return;
    if (hasVoted && patch.isPreselected !== undefined) return;

    setErrorMessage(null);
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

  return (
    <div className="space-y-6">
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

      {votingMode && !hasVoted && (
        <Stage5PodiumBallot
          podium={podium}
          preselectedStories={preselectedStories}
          storyById={storyById}
          pointsLabels={pointsLabels}
          isBallotComplete={isBallotComplete}
          busy={busy}
          onAssignSlot={assignToPodium}
          onAssignNextEmpty={assignToNextEmptySlot}
          onClearSlot={(slot) =>
            setPodium((prev) => ({ ...prev, [slot]: null }))
          }
          onDragStart={setDraggedStoryId}
          onDragOver={handleDragOver}
          onDropOnSlot={handleDropOnSlot}
          onBackToList={() => setVotingMode(false)}
          onOpenConfirm={() => setConfirmVoteOpen(true)}
        />
      )}

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

      {!votingMode && readingStory && readingIndex !== null && (
        <Stage5StoryReader
          story={readingStory}
          readingIndex={readingIndex}
          totalStories={stories.length}
          hasVoted={hasVoted}
          onBackToList={() => setReadingIndex(null)}
          onPrev={() => setReadingIndex((i) => (i !== null ? i - 1 : 0))}
          onNext={() =>
            setReadingIndex((i) =>
              i !== null ? Math.min(stories.length - 1, i + 1) : 0
            )
          }
          onOpenPrompt={setPromptModalStory}
          onToggleRead={(story) =>
            toggleState(story, { isRead: !story.isRead })
          }
          onTogglePreselect={(story) =>
            toggleState(story, { isPreselected: !story.isPreselected })
          }
        />
      )}

      {promptModalStory && (
        <PromptViewerModal
          prompt={promptModalStory}
          titleId="voting-prompt-modal-title"
          onClose={() => setPromptModalStory(null)}
        />
      )}

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
