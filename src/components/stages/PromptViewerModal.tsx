"use client";

import { X } from "lucide-react";
import type { MediaType } from "@/db/schema";
import { parseVideoEmbedUrl } from "@/lib/prompt-bank";

export interface PromptModalData {
  promptNumber: number;
  promptTitle: string;
  promptBody: string;
  promptMediaType: MediaType | null;
  promptMediaUrl: string | null;
}

interface PromptViewerModalProps {
  prompt: PromptModalData;
  titleId?: string;
  onClose: () => void;
}

export function PromptViewerModal({
  prompt,
  titleId = "prompt-modal-title",
  onClose,
}: PromptViewerModalProps) {
  const videoEmbedUrl =
    prompt.promptMediaType === "VIDEO" && prompt.promptMediaUrl
      ? parseVideoEmbedUrl(prompt.promptMediaUrl)
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card border-2 border-ink bg-paper p-6">
        <div className="flex items-start justify-between gap-4 border-b border-rule pb-3">
          <div>
            <p className="text-xs font-semibold text-accent-2">
              Consigna {prompt.promptNumber}
            </p>
            <h3 id={titleId} className="mt-1">
              {prompt.promptTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar consigna"
            className="btn btn--secondary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {prompt.promptBody}
        </div>

        {prompt.promptMediaType === "IMAGE" && prompt.promptMediaUrl && (
          <figure className="mt-4">
            <img
              src={prompt.promptMediaUrl}
              alt={`Imagen de la consigna ${prompt.promptNumber}`}
              className="max-h-80 w-auto border border-rule object-contain"
            />
          </figure>
        )}

        {videoEmbedUrl && (
          <div className="mt-4 aspect-video w-full overflow-hidden border border-rule">
            <iframe
              src={videoEmbedUrl}
              title={`Video de la consigna ${prompt.promptNumber}`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </div>
    </div>
  );
}
