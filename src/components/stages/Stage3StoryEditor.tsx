"use client";

import type { FormEvent } from "react";
import { Lock, Save } from "lucide-react";
import { MAX_STORY_TITLE_LENGTH } from "@/lib/stage2-writing";
import type {
  Stage3EditValidationResult,
  Stage3StoryItem,
} from "@/lib/stage3-submission";

interface Stage3StoryEditorProps {
  story: Stage3StoryItem;
  editTitle: string;
  editBody: string;
  minChars: number;
  maxChars: number;
  minSimilarityPct: number;
  validation: Stage3EditValidationResult;
  busyAction: "select" | "save_draft" | "postulate" | null;
  onTitleChange: (next: string) => void;
  onBodyChange: (next: string) => void;
  onSaveDraft: (event: FormEvent<HTMLFormElement>) => void;
  onOpenPrompt: (story: Stage3StoryItem) => void;
  onOpenConfirmPostulate: () => void;
}

export function Stage3StoryEditor({
  story,
  editTitle,
  editBody,
  minChars,
  maxChars,
  minSimilarityPct,
  validation,
  busyAction,
  onTitleChange,
  onBodyChange,
  onSaveDraft,
  onOpenPrompt,
  onOpenConfirmPostulate,
}: Stage3StoryEditorProps) {
  return (
    <section className="rounded-card border border-ink bg-paper-2 p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
        <div>
          <p className="text-sm font-semibold text-accent-2">
            Cuento seleccionado: Consigna {story.promptNumber}
          </p>
          <h2 className="mt-1">Edita y postula tu cuento</h2>
        </div>
        <button
          type="button"
          onClick={() => onOpenPrompt(story)}
          className="riso-link text-sm font-medium"
        >
          Ver consigna completa
        </button>
      </div>

      <form onSubmit={onSaveDraft} className="mt-6 space-y-6" noValidate>
        <div>
          <label
            htmlFor="stage3-title"
            className="block text-sm font-semibold text-ink"
          >
            Título del cuento
          </label>
          <input
            id="stage3-title"
            type="text"
            maxLength={MAX_STORY_TITLE_LENGTH}
            value={editTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="mt-2 w-full rounded-input border border-ink bg-paper px-3 py-2 text-base text-ink"
            required
          />
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <label
              htmlFor="stage3-body"
              className="block text-sm font-semibold text-ink"
            >
              Texto del cuento
            </label>
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
          </div>

          <textarea
            id="stage3-body"
            rows={14}
            value={editBody}
            onChange={(e) => onBodyChange(e.target.value)}
            className="mt-2 w-full rounded-input border border-ink bg-paper px-3 py-3 text-base leading-relaxed text-ink"
            required
          />

          {validation.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-error">
              {validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <button
            type="submit"
            disabled={busyAction !== null || !validation.valid}
            className="btn btn--secondary"
          >
            <Save className="mr-2 inline h-4 w-4" aria-hidden="true" />
            {busyAction === "save_draft" ? "Guardando…" : "Guardar borrador"}
          </button>

          <button
            type="button"
            disabled={busyAction !== null || !validation.valid}
            onClick={onOpenConfirmPostulate}
            className="btn btn--primary"
          >
            <Lock className="mr-2 inline h-4 w-4" aria-hidden="true" />
            Postular definitivamente
          </button>
        </div>
      </form>
    </section>
  );
}
