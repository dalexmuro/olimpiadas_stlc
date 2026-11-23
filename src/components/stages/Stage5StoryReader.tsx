"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
} from "lucide-react";
import type { AnonymousVotingStoryItem } from "@/lib/stage5-voting";

interface Stage5StoryReaderProps {
  story: AnonymousVotingStoryItem;
  readingIndex: number;
  totalStories: number;
  hasVoted: boolean;
  onBackToList: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenPrompt: (story: AnonymousVotingStoryItem) => void;
  onToggleRead: (story: AnonymousVotingStoryItem) => void;
  onTogglePreselect: (story: AnonymousVotingStoryItem) => void;
}

export function Stage5StoryReader({
  story,
  readingIndex,
  totalStories,
  hasVoted,
  onBackToList,
  onPrev,
  onNext,
  onOpenPrompt,
  onToggleRead,
  onTogglePreselect,
}: Stage5StoryReaderProps) {
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
            {story.isOwnStory ? " (Tu cuento)" : ""}
          </p>
          <h2 className="mt-1">{story.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => onOpenPrompt(story)}
          className="riso-link text-sm font-medium"
        >
          <FileText className="mr-1 inline h-4 w-4" aria-hidden="true" />
          Ver consigna completa
        </button>
      </div>

      <article className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink">
        {story.body}
      </article>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-6">
        <button
          type="button"
          onClick={() => onToggleRead(story)}
          className={story.isRead ? "btn btn--primary" : "btn btn--secondary"}
        >
          <Eye className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          {story.isRead ? "Leído" : "Marcar como leído"}
        </button>

        {!hasVoted && (
          <button
            type="button"
            disabled={story.isOwnStory}
            onClick={() => onTogglePreselect(story)}
            className={
              story.isPreselected ? "btn btn--primary" : "btn btn--secondary"
            }
          >
            <Bookmark className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
            {story.isPreselected ? "Preseleccionado" : "Preseleccionar"}
          </button>
        )}
      </div>
    </section>
  );
}
