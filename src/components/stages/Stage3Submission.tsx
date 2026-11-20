"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Save,
  X,
} from "lucide-react";
import type { DisqualificationReason, EnrollmentStatus } from "@/db/schema";
import { parseVideoEmbedUrl } from "@/lib/prompt-bank";
import { MAX_STORY_TITLE_LENGTH, getDisqualificationReasonLabel } from "@/lib/stage2-writing";
import {
  validateStage3EditInput,
  type Stage3StoryItem,
} from "@/lib/stage3-submission";
import { formatCaracasDateTime } from "@/lib/timezone";

export interface Stage3SubmissionProps {
  enrollmentStatus: EnrollmentStatus;
  disqualificationReason: DisqualificationReason | null;
  initialSelectedStoryId: string | null;
  minChars: number;
  maxChars: number;
  minSimilarityPct: number;
  submissionEndAt: string;
  stories: Stage3StoryItem[];
}

export function Stage3Submission({
  enrollmentStatus,
  disqualificationReason,
  initialSelectedStoryId,
  minChars,
  maxChars,
  minSimilarityPct,
  submissionEndAt,
  stories: initialStories,
}: Stage3SubmissionProps) {
  const [stories, setStories] = useState<Stage3StoryItem[]>(initialStories);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(
    initialSelectedStoryId
  );
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const [promptModalStory, setPromptModalStory] =
    useState<Stage3StoryItem | null>(null);
  const [confirmSelectStory, setConfirmSelectStory] =
    useState<Stage3StoryItem | null>(null);
  const [confirmPostulateOpen, setConfirmPostulateOpen] = useState(false);

  const selectedStory = useMemo(
    () => stories.find((s) => s.id === selectedStoryId) ?? null,
    [stories, selectedStoryId]
  );

  const [editTitle, setEditTitle] = useState<string>(
    selectedStory?.editedTitle ?? selectedStory?.originalTitle ?? ""
  );
  const [editBody, setEditBody] = useState<string>(
    selectedStory?.editedBody ?? selectedStory?.originalBody ?? ""
  );
  const [busyAction, setBusyAction] = useState<
    "select" | "save_draft" | "postulate" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const editValidation = useMemo(() => {
    if (!selectedStory) return null;
    return validateStage3EditInput({
      title: editTitle,
      body: editBody,
      originalBody: selectedStory.originalBody,
      minChars,
      maxChars,
      minSimilarityPct,
    });
  }, [selectedStory, editTitle, editBody, minChars, maxChars, minSimilarityPct]);

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

  async function handleConfirmSelect(story: Stage3StoryItem) {
    setBusyAction("select");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/contest/submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "select", storyId: story.id }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error ?? "No se pudo seleccionar el cuento. Inténtalo de nuevo."
        );
        return;
      }

      setStories((prev) =>
        prev.map((item) =>
          item.id === story.id
            ? {
                ...item,
                isSelectedForPostulation: true,
                editedTitle: item.originalTitle,
                editedBody: item.originalBody,
                editedCharCount: item.originalCharCount,
                similarityPct: 100,
              }
            : item
        )
      );
      setSelectedStoryId(story.id);
      setEditTitle(story.originalTitle);
      setEditBody(story.originalBody);
      setReadingIndex(null);
      setConfirmSelectStory(null);
      setSuccessMessage(
        "Cuento seleccionado. Ahora puedes editarlo antes de postularlo definitivamente."
      );
    } catch {
      setErrorMessage("Error de conexión al seleccionar el cuento.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStory || !editValidation?.valid) return;
    setBusyAction("save_draft");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/contest/submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          storyId: selectedStory.id,
          title: editTitle,
          body: editBody,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        charCount?: number;
        similarityPct?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo guardar el borrador.");
        return;
      }

      setStories((prev) =>
        prev.map((item) =>
          item.id === selectedStory.id
            ? {
                ...item,
                editedTitle: editTitle.trim(),
                editedBody: editBody,
                editedCharCount: data.charCount ?? editBody.length,
                similarityPct: data.similarityPct ?? editValidation.similarityPct,
              }
            : item
        )
      );
      setSuccessMessage(
        "Borrador guardado. Recuerda presionar 'Postular definitivamente' cuando estés listo."
      );
    } catch {
      setErrorMessage("Error de conexión al guardar el borrador.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConfirmPostulate() {
    if (!selectedStory || !editValidation?.valid) return;
    setBusyAction("postulate");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/contest/submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "postulate",
          storyId: selectedStory.id,
          title: editTitle,
          body: editBody,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        postulatedAt?: string;
        similarityPct?: number;
        charCount?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo completar la postulación.");
        return;
      }

      const postulatedAt = data.postulatedAt ?? new Date().toISOString();
      setStories((prev) =>
        prev.map((item) =>
          item.id === selectedStory.id
            ? {
                ...item,
                editedTitle: editTitle.trim(),
                editedBody: editBody,
                editedCharCount: data.charCount ?? editBody.length,
                similarityPct: data.similarityPct ?? editValidation.similarityPct,
                isPostulated: true,
                postulatedAt,
              }
            : item
        )
      );
      setConfirmPostulateOpen(false);
    } catch {
      setErrorMessage("Error de conexión al postular tu cuento.");
    } finally {
      setBusyAction(null);
    }
  }

  const promptModalVideoUrl =
    promptModalStory?.promptMediaType === "VIDEO" &&
    promptModalStory.promptMediaUrl
      ? parseVideoEmbedUrl(promptModalStory.promptMediaUrl)
      : null;

  // Definitive postulation completed view
  if (selectedStory?.isPostulated) {
    return (
      <div className="space-y-6">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-1 h-5 w-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <div>
              <h2>Cuento postulado definitivamente</h2>
              <p className="lead mt-3 text-ink-2">
                Tu cuento{" "}
                <strong>
                  {selectedStory.editedTitle ?? selectedStory.originalTitle}
                </strong>{" "}
                (Consigna {selectedStory.promptNumber}) fue postulado con éxito.
              </p>
              {selectedStory.postulatedAt && (
                <p className="mt-3 text-sm text-ink-2 num">
                  Fecha de postulación:{" "}
                  <strong>
                    {formatCaracasDateTime(selectedStory.postulatedAt)}
                  </strong>
                  .
                </p>
              )}
              <p className="mt-3 text-sm text-muted">
                Hemos enviado un correo de confirmación. Tu obra pasará a la
                etapa de revisión de los administradores al cerrar esta fase.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setPromptModalStory(selectedStory)}
                  className="btn btn--secondary"
                >
                  <FileText className="mr-2 inline h-4 w-4" aria-hidden="true" />
                  Ver consigna completa
                </button>
              </div>
            </div>
          </div>
        </section>

        {promptModalStory && (
          <PromptModal
            story={promptModalStory}
            videoEmbedUrl={promptModalVideoUrl}
            onClose={() => setPromptModalStory(null)}
          />
        )}
      </div>
    );
  }

  const readingStory =
    readingIndex !== null ? (stories[readingIndex] ?? null) : null;

  return (
    <div className="space-y-6">
      {/* Persistent reminder banner required until definitive postulation */}
      <div
        role="status"
        className="border-l-4 border-accent bg-paper-2 px-5 py-4 text-sm font-medium text-ink"
      >
        Recuerda que esta etapa no ha sido completada hasta que selecciones
        &apos;Postular definitivamente&apos;. Cierre de la etapa:{" "}
        <strong className="num">{formatCaracasDateTime(submissionEndAt)}</strong>.
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="border-l-2 border-success py-1 pl-4 text-sm text-success"
        >
          {successMessage}
        </div>
      )}

      {/* MODE A: Selecting which Stage 2 story to postulate */}
      {!selectedStory && !readingStory && (
        <section className="rounded-card border border-ink bg-paper p-8">
          <h2>Tus cuentos de la etapa de escritura</h2>
          <p className="lead mt-2 text-ink-2">
            Lee con calma los cuentos que entregaste y elige el único que
            deseas editar y postular para las votaciones.
          </p>

          {stories.length === 0 ? (
            <p className="mt-6 text-sm text-error">
              No se encontraron cuentos entregados en la etapa anterior.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-rule border-y border-rule">
              {stories.map((story, idx) => (
                <li
                  key={story.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-xs font-semibold text-accent-2">
                      Consigna {story.promptNumber}
                    </p>
                    <p className="mt-1 font-display text-lg font-extrabold text-ink">
                      {story.originalTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted num">
                      {story.originalCharCount} caracteres
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReadingIndex(idx)}
                    className="btn btn--secondary"
                  >
                    <BookOpen className="mr-2 inline h-4 w-4" aria-hidden="true" />
                    Leer cuento
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* MODE A.2: Story Reader with Prev/Next, Back to list, Prompt Modal, and Select button */}
      {!selectedStory && readingStory && readingIndex !== null && (
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
                <ChevronLeft className="mr-1 inline h-4 w-4" aria-hidden="true" />
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
                <ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent-2">
                Consigna {readingStory.promptNumber}
              </p>
              <h2 className="mt-1">{readingStory.originalTitle}</h2>
            </div>
            <button
              type="button"
              onClick={() => setPromptModalStory(readingStory)}
              className="riso-link text-sm font-medium"
            >
              Ver consigna completa
            </button>
          </div>

          <article className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink">
            {readingStory.originalBody}
          </article>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
            <span className="text-xs text-muted num">
              Extensión original: {readingStory.originalCharCount} caracteres
            </span>
            <button
              type="button"
              onClick={() => setConfirmSelectStory(readingStory)}
              className="btn btn--primary"
            >
              Seleccionar este cuento
            </button>
          </div>
        </section>
      )}

      {/* MODE B: Editing & Definitive Postulation of the selected story */}
      {selectedStory && editValidation && (
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
            <div>
              <p className="text-sm font-semibold text-accent-2">
                Cuento seleccionado: Consigna {selectedStory.promptNumber}
              </p>
              <h2 className="mt-1">Edita y postula tu cuento</h2>
            </div>
            <button
              type="button"
              onClick={() => setPromptModalStory(selectedStory)}
              className="riso-link text-sm font-medium"
            >
              Ver consigna completa
            </button>
          </div>

          <form onSubmit={handleSaveDraft} className="mt-6 space-y-6" noValidate>
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
                onChange={(e) => setEditTitle(e.target.value)}
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
                      editValidation.charCount < minChars ||
                      editValidation.charCount > maxChars
                        ? "text-error"
                        : "text-success"
                    }
                  >
                    {editValidation.charCount} caracteres ({minChars} a {maxChars})
                  </span>
                  <span
                    className={
                      editValidation.meetsSimilarityThreshold
                        ? "text-success"
                        : "text-error"
                    }
                  >
                    Similitud: {editValidation.similarityPct.toFixed(1)}% (mín.{" "}
                    {minSimilarityPct}%)
                  </span>
                </div>
              </div>

              <textarea
                id="stage3-body"
                rows={14}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="mt-2 w-full rounded-input border border-ink bg-paper px-3 py-3 text-base leading-relaxed text-ink"
                required
              />

              {editValidation.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-error">
                  {editValidation.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
              <button
                type="submit"
                disabled={busyAction !== null || !editValidation.valid}
                className="btn btn--secondary"
              >
                <Save className="mr-2 inline h-4 w-4" aria-hidden="true" />
                {busyAction === "save_draft"
                  ? "Guardando…"
                  : "Guardar borrador"}
              </button>

              <button
                type="button"
                disabled={busyAction !== null || !editValidation.valid}
                onClick={() => setConfirmPostulateOpen(true)}
                className="btn btn--primary"
              >
                <Lock className="mr-2 inline h-4 w-4" aria-hidden="true" />
                Postular definitivamente
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Modal: Complete Prompt Viewer */}
      {promptModalStory && (
        <PromptModal
          story={promptModalStory}
          videoEmbedUrl={promptModalVideoUrl}
          onClose={() => setPromptModalStory(null)}
        />
      )}

      {/* Modal: Irreversible Selection Confirmation */}
      {confirmSelectStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-select-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-lg rounded-card border-2 border-ink bg-paper p-6">
            <h3 id="confirm-select-title">Confirmar selección irreversible</h3>
            <p className="mt-3 text-sm text-ink-2">
              Vas a seleccionar{" "}
              <strong>{confirmSelectStory.originalTitle}</strong> (Consigna{" "}
              {confirmSelectStory.promptNumber}) para editar y postular. Una vez
              confirmado, no podrás cambiarlo por otro cuento.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={busyAction === "select"}
                onClick={() => setConfirmSelectStory(null)}
                className="btn btn--secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction === "select"}
                onClick={() => handleConfirmSelect(confirmSelectStory)}
                className="btn btn--primary"
              >
                {busyAction === "select"
                  ? "Confirmando…"
                  : "Sí, seleccionar este cuento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Irreversible Definitive Postulation Confirmation */}
      {confirmPostulateOpen && selectedStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-postulate-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-lg rounded-card border-2 border-ink bg-paper p-6">
            <h3 id="confirm-postulate-title">
              Confirmar postulación definitiva
            </h3>
            <p className="mt-3 text-sm text-ink-2">
              Al confirmar, tu cuento <strong>{editTitle.trim()}</strong>{" "}
              quedará postulado de forma definitiva y no podrás volver a
              editarlo.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={busyAction === "postulate"}
                onClick={() => setConfirmPostulateOpen(false)}
                className="btn btn--secondary"
              >
                Seguir editando
              </button>
              <button
                type="button"
                disabled={busyAction === "postulate"}
                onClick={handleConfirmPostulate}
                className="btn btn--primary"
              >
                {busyAction === "postulate"
                  ? "Postulando…"
                  : "Confirmar postulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PromptModal({
  story,
  videoEmbedUrl,
  onClose,
}: {
  story: Stage3StoryItem;
  videoEmbedUrl: string | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card border-2 border-ink bg-paper p-6">
        <div className="flex items-start justify-between gap-4 border-b border-rule pb-3">
          <div>
            <p className="text-xs font-semibold text-accent-2">
              Consigna {story.promptNumber}
            </p>
            <h3 id="prompt-modal-title" className="mt-1">
              {story.promptTitle}
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
          {story.promptBody}
        </div>

        {story.promptMediaType === "IMAGE" && story.promptMediaUrl && (
          <figure className="mt-4">
            <img
              src={story.promptMediaUrl}
              alt={`Imagen de la consigna ${story.promptNumber}`}
              className="max-h-80 w-auto border border-rule object-contain"
            />
          </figure>
        )}

        {videoEmbedUrl && (
          <div className="mt-4 aspect-video w-full overflow-hidden border border-rule">
            <iframe
              src={videoEmbedUrl}
              title={`Video de la consigna ${story.promptNumber}`}
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
