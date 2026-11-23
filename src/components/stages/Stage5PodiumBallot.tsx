"use client";

import type { DragEvent } from "react";
import { GripVertical } from "lucide-react";
import type { AnonymousVotingStoryItem } from "@/lib/stage5-voting";

export type PodiumSlot = "first" | "second" | "third";

interface Stage5PodiumBallotProps {
  podium: Record<PodiumSlot, string | null>;
  preselectedStories: AnonymousVotingStoryItem[];
  storyById: Map<string, AnonymousVotingStoryItem>;
  pointsLabels: { first: string; second: string; third: string };
  isBallotComplete: boolean;
  busy: boolean;
  onAssignSlot: (slot: PodiumSlot, storyId: string) => void;
  onAssignNextEmpty: (storyId: string) => void;
  onClearSlot: (slot: PodiumSlot) => void;
  onDragStart: (storyId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDropOnSlot: (slot: PodiumSlot, event: DragEvent<HTMLDivElement>) => void;
  onBackToList: () => void;
  onOpenConfirm: () => void;
}

export function Stage5PodiumBallot({
  podium,
  preselectedStories,
  storyById,
  pointsLabels,
  isBallotComplete,
  busy,
  onAssignSlot,
  onAssignNextEmpty,
  onClearSlot,
  onDragStart,
  onDragOver,
  onDropOnSlot,
  onBackToList,
  onOpenConfirm,
}: Stage5PodiumBallotProps) {
  const slots = [
    { slot: "first" as const, label: "1er lugar", pts: pointsLabels.first },
    { slot: "second" as const, label: "2do lugar", pts: pointsLabels.second },
    { slot: "third" as const, label: "3er lugar", pts: pointsLabels.third },
  ] as const;

  return (
    <section className="rounded-card border border-ink bg-paper p-8">
      <h3>Asigna tu podio definitivo</h3>
      <p className="mt-2 text-sm text-ink-2">
        Arrastra tus cuentos preseleccionados hacia los puestos del podio o usa
        los botones rápidos de cada tarjeta para asignarlos.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {slots.map(({ slot, label, pts }) => {
          const assignedId = podium[slot];
          const assignedStory = assignedId ? storyById.get(assignedId) : null;
          return (
            <div
              key={slot}
              onDragOver={onDragOver}
              onDrop={(e) => onDropOnSlot(slot, e)}
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
                  onClick={() => onClearSlot(slot)}
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
                onDragStart={() => onDragStart(story.id)}
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
                      onClick={() => onAssignNextEmpty(story.id)}
                      className="btn btn--secondary"
                    >
                      Asignar al podio
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAssignSlot("first", story.id)}
                    className="btn btn--secondary"
                  >
                    1º
                  </button>
                  <button
                    type="button"
                    onClick={() => onAssignSlot("second", story.id)}
                    className="btn btn--secondary"
                  >
                    2º
                  </button>
                  <button
                    type="button"
                    onClick={() => onAssignSlot("third", story.id)}
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
          onClick={onBackToList}
          className="btn btn--secondary"
        >
          Volver a la lista
        </button>
        <button
          type="button"
          disabled={!isBallotComplete || busy}
          onClick={onOpenConfirm}
          aria-label="Confirmar voto definitivo"
          className="btn btn--primary"
        >
          Confirmar voto
        </button>
      </div>
    </section>
  );
}
