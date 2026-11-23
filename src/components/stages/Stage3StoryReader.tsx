"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Stage3StoryItem } from "@/lib/stage3-submission";

interface Stage3StoryReaderProps {
  story: Stage3StoryItem;
  readingIndex: number;
  totalStories: number;
  onBackToList: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenPrompt: (story: Stage3StoryItem) => void;
  onRequestSelect: (story: Stage3StoryItem) => void;
}

export function Stage3StoryReader({
  story,
  readingIndex,
  totalStories,
  onBackToList,
  onPrev,
  onNext,
  onOpenPrompt,
  onRequestSelect,
}: Stage3StoryReaderProps) {
  return (
    <section className="rounded-card border border-ink bg-paper p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <button
          type="button"
          onClick={onBackToList}
          className="btn btn--secondary"
        >
          Volver a la lista
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={readingIndex <= 0}
            onClick={onPrev}
            className="btn btn--secondary"
          >
            <ChevronLeft className="mr-1 inline h-4 w-4" aria-hidden="true" />
            Anterior
          </button>
          <button
            type="button"
            disabled={readingIndex >= totalStories - 1}
            onClick={onNext}
            className="btn btn--secondary"
          >
            Siguiente
            <ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent-2">
            Consigna {story.promptNumber}
          </p>
          <h2 className="mt-1">{story.originalTitle}</h2>
        </div>
        <button
          type="button"
          onClick={() => onOpenPrompt(story)}
          className="riso-link text-sm font-medium"
        >
          Ver consigna completa
        </button>
      </div>

      <article className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink">
        {story.originalBody}
      </article>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
        <span className="text-xs text-muted num">
          Extensión original: {story.originalCharCount} caracteres
        </span>
        <button
          type="button"
          onClick={() => onRequestSelect(story)}
          className="btn btn--primary"
        >
          Seleccionar este cuento
        </button>
      </div>
    </section>
  );
}
